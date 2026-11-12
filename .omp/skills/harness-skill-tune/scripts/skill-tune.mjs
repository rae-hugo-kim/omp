#!/usr/bin/env node
// harness-skill-tune — inspection step (#127).
//
//   node .omp/skills/harness-skill-tune/scripts/skill-tune.mjs check [options]
//   node .omp/skills/harness-skill-tune/scripts/skill-tune.mjs refresh-reserved
//
// `check` is read-only: it reads the repo's .omp/skills, the omp session transcripts, the
// command_usage table and the loaded-skill list, and prints one report. It never edits a skill.
// `refresh-reserved` rewrites reserved-names.json (the reserved-name baseline) and nothing else.
//
// Source-repo only: not on the harness-sync whitelist. Everything here is deterministic; the
// judgement calls (description quality, whether a finding matters) live in SKILL.md.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const MAX_SKILL_LINES = 500; // skill-creator guidance: keep SKILL.md under 500 lines
const SKILLS_REL = '.omp/skills';
const AGENTS_REL = '.omp/agents';
const UPSTREAM_REPO = 'can1357/oh-my-pi';
const UPSTREAM_SLASH_DIR = 'packages/coding-agent/src/slash-commands';
const UPSTREAM_BUNDLED_COMMANDS = 'packages/coding-agent/src/task/commands.ts';
// Fewer names than this in a freshly built snapshot means a source format drifted (see assertPlausibleSnapshot).
const SNAPSHOT_MINIMUMS = { builtin_commands: 20, bundled_commands: 1, cli_subcommands: 10, bundled_agents: 1 };
const SUBPROCESS_TIMEOUT_MS = 120_000;
const SEVERITIES = ['high', 'medium', 'low'];
const UNMEASURED = '측정 불가';
const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// ---------- shared helpers ------------------------------------------------------------------

function makeFinding({ code, severity, skill, line, key, mechanical = false, message }) {
  const hash = createHash('sha1').update(`${code}\0${skill}\0${key}`).digest('hex').slice(0, 6);
  return {
    id: `${code}-${skill}-${hash}`, code, severity, skill,
    evidence: `${SKILLS_REL}/${skill}/SKILL.md:${line}`, mechanical, message,
  };
}

export function listRepoSkills(repoRoot) {
  const dir = path.join(repoRoot, SKILLS_REL);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

// The inline value of a frontmatter `key: value` line. Block-scalar markers and YAML null are
// empty; quotes are removed; a trailing ` # comment` is not part of the value.
function scalarValue(raw) {
  const inline = raw.trim();
  if (/^[>|][+-]?$/.test(inline)) return '';
  const quoted = /^(["'])(.*)\1(?:\s+#.*)?$/.exec(inline);
  if (quoted) return quoted[2];
  const bare = inline.replace(/\s+#.*$/, '');
  return bare === 'null' || bare === '~' ? '' : bare;
}

// Symlink-free form of a path when it exists (so two spellings of one directory compare equal).
function realOrResolved(target) {
  try {
    return fs.realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

// Top-level `key: value` pairs of a leading `---` block. Block scalars (`>`, `|`) and
// continuation lines are folded into one string; nested structures are not interpreted.
function parseFrontmatter(lines) {
  if ((lines[0] ?? '').trim() !== '---') return { present: false, fields: {}, end: 0 };
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end === -1) return { present: false, fields: {}, end: 0 };
  const fields = {};
  let current = null;
  for (let i = 1; i < end; i++) {
    const top = /^([A-Za-z_][\w-]*):(.*)$/.exec(lines[i]);
    if (top) {
      current = { value: scalarValue(top[2]), line: i + 1 };
      fields[top[1]] = current;
    } else if (current && /^\s+\S/.test(lines[i])) {
      current.value = `${current.value} ${lines[i].trim()}`.trim();
    }
  }
  return { present: true, fields, end: end + 1 };
}

function readSkill(repoRoot, skill) {
  const rel = `${SKILLS_REL}/${skill}/SKILL.md`;
  const file = path.join(repoRoot, rel);
  if (!fs.existsSync(file)) return { exists: false, rel, file, lines: [], lineCount: 0, frontmatter: parseFrontmatter([]) };
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  const lineCount = content.endsWith('\n') ? lines.length - 1 : lines.length;
  return { exists: true, rel, file, content, lines, lineCount, frontmatter: parseFrontmatter(lines) };
}

// ---------- 1. usage: session transcripts ----------------------------------------------------

const NEEDLE = Buffer.from('skill://');
const SKILL_URL = /^skill:\/\/([A-Za-z0-9_.-]+)/;
const HEADER_SCAN_LINES = 20;
const NEWLINE = 10;

// *.jsonl files under dir (recursive). A subdirectory that cannot be listed is counted, not hidden.
function walkJsonl(dir, found = { files: [], unreadableDirs: 0 }) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { found.unreadableDirs++; return found; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonl(full, found);
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) found.files.push(full);
  }
  return found;
}

// The `read` tool calls of one transcript record. A call is written twice by current omp (the
// assistant message's toolCall block, then a tool_execution_start record) and once by older
// versions, so callers deduplicate on the tool call id.
function readCallsOf(record) {
  if (record?.type === 'custom' && record.customType === 'tool_execution_start') {
    const data = record.data ?? {};
    return data.toolName === 'read' ? [{ id: data.toolCallId, path: data.args?.path, ts: record.timestamp }] : [];
  }
  if (record?.type === 'message' && record.message?.role === 'assistant' && Array.isArray(record.message.content)) {
    return record.message.content
      .filter((block) => block?.type === 'toolCall' && block.name === 'read')
      .map((block) => ({ id: block.id, path: block.arguments?.path, ts: record.timestamp }));
  }
  return [];
}

function sessionCwd(buf) {
  let start = 0;
  for (let n = 0; n < HEADER_SCAN_LINES && start < buf.length; n++) {
    const nl = buf.indexOf(NEWLINE, start);
    const end = nl === -1 ? buf.length : nl;
    const line = buf.toString('utf8', start, end);
    if (line.includes('"session"')) {
      try {
        const record = JSON.parse(line);
        if (record.type === 'session' && typeof record.cwd === 'string') return record.cwd;
      } catch { /* not a header line */ }
    }
    start = end + 1;
  }
  return null;
}

// skill name -> { reads, last } for one transcript; only lines that mention skill:// are parsed.
function skillReadsInFile(buf) {
  const calls = new Map();
  let from = 0;
  for (let hit = buf.indexOf(NEEDLE, from); hit !== -1; hit = buf.indexOf(NEEDLE, from)) {
    const lineStart = buf.lastIndexOf(NEWLINE, hit) + 1;
    const nl = buf.indexOf(NEWLINE, hit);
    const lineEnd = nl === -1 ? buf.length : nl;
    from = lineEnd + 1;
    let record;
    try { record = JSON.parse(buf.toString('utf8', lineStart, lineEnd)); } catch { continue; }
    for (const call of readCallsOf(record)) {
      const skill = typeof call.path === 'string' ? SKILL_URL.exec(call.path)?.[1] : null;
      const key = call.id ?? `line:${lineStart}`;
      if (skill && !calls.has(key)) calls.set(key, { skill, ts: typeof call.ts === 'string' ? call.ts : null });
    }
  }
  const perSkill = new Map();
  for (const { skill, ts } of calls.values()) {
    const prev = perSkill.get(skill) ?? { reads: 0, last: null };
    perSkill.set(skill, { reads: prev.reads + 1, last: laterOf(prev.last, ts) });
  }
  return perSkill;
}

const laterOf = (a, b) => (a && b ? (a > b ? a : b) : a ?? b);
const emptyCount = () => ({ sessions: 0, reads: 0, last: null });
const addSession = (count, { reads, last }) => ({ sessions: count.sessions + 1, reads: count.reads + reads, last: laterOf(count.last, last) });

function isUnder(cwd, prefixes) {
  return typeof cwd === 'string' && prefixes.some((prefix) => cwd === prefix || cwd.startsWith(prefix + path.sep));
}

export function collectSessionUsage({ sessionsDir, repoPrefixes, skills }) {
  const perSkill = Object.fromEntries(skills.map((skill) => [skill, { repo: emptyCount(), all: emptyCount() }]));
  const unmeasured = (reason) => ({ measured: false, reason, dir: sessionsDir, files: 0, unreadable: 0, perSkill });
  try {
    if (!fs.statSync(sessionsDir).isDirectory()) return unmeasured(`세션 디렉터리 없음: ${sessionsDir}`);
    fs.readdirSync(sessionsDir);
  } catch (error) {
    return unmeasured(error.code === 'ENOENT' ? `세션 디렉터리 없음: ${sessionsDir}` : `세션 디렉터리를 읽을 수 없음: ${sessionsDir} (${error.code ?? error.message})`);
  }
  const prefixes = repoPrefixes.map((prefix) => path.resolve(prefix));
  const { files, unreadableDirs } = walkJsonl(sessionsDir);
  let unreadable = unreadableDirs; // directories that could not be listed + files that could not be read
  for (const file of files) {
    let buf;
    try { buf = fs.readFileSync(file); } catch { unreadable++; continue; }
    if (buf.indexOf(NEEDLE) === -1) continue;
    const reads = skillReadsInFile(buf);
    const inRepo = isUnder(sessionCwd(buf), prefixes);
    for (const [skill, count] of reads) {
      if (!Object.hasOwn(perSkill, skill)) continue; // a skill:// read of something that is not a skill of this repo
      const row = perSkill[skill];
      perSkill[skill] = { all: addSession(row.all, count), repo: inRepo ? addSession(row.repo, count) : row.repo };
    }
  }
  return { measured: true, dir: sessionsDir, files: files.length, unreadable, perSkill };
}

// ---------- 1b. usage: /skill:<name> invocations (command_usage) ------------------------------

export function collectCommandUsage({ dbPath, skills }) {
  const perSkill = Object.fromEntries(skills.map((skill) => [skill, { count: 0, last: null }]));
  const unmeasured = (reason) => ({ measured: false, reason, db: dbPath, perSkill });
  let sqlite;
  try { sqlite = require('node:sqlite'); } catch { return unmeasured(`node:sqlite를 쓸 수 없는 Node 버전: ${process.version}`); }
  if (!fs.existsSync(dbPath)) return unmeasured(`agent.db 없음: ${dbPath}`);
  let db;
  let rows;
  try {
    db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
    rows = db.prepare("SELECT name, count, last_used_at FROM command_usage WHERE name LIKE 'skill:%'").all();
  } catch (error) {
    return unmeasured(`command_usage 읽기 실패: ${error.message}`);
  } finally {
    try { db?.close(); } catch { /* already closed or never opened */ }
  }
  for (const row of rows) {
    const skill = String(row.name).slice('skill:'.length);
    if (!Object.hasOwn(perSkill, skill)) continue;
    const seconds = Number(row.last_used_at);
    perSkill[skill] = { count: Number(row.count), last: seconds > 0 ? new Date(seconds * 1000).toISOString() : null };
  }
  return { measured: true, db: dbPath, perSkill };
}

// ---------- 2. name collisions ----------------------------------------------------------------

const RESERVED_KINDS = [
  { key: 'builtin_commands', severity: 'medium', describe: (name) => `omp 빌트인 슬래시 명령 \`/${name}\`` },
  { key: 'builtin_aliases', severity: 'medium', describe: (name) => `omp 빌트인 슬래시 명령의 별칭 \`/${name}\`` },
  { key: 'bundled_commands', severity: 'medium', describe: (name) => `omp 번들 명령 \`/${name}\`` },
  { key: 'cli_subcommands', severity: 'low', describe: (name) => `omp CLI 하위 명령 \`omp ${name}\`` },
];

function nameLineOf(repoRoot, skill) {
  return readSkill(repoRoot, skill).frontmatter.fields.name?.line ?? 1;
}

function reservedFindings(repoRoot, skill, reserved) {
  return RESERVED_KINDS
    .filter((kind) => (reserved[kind.key] ?? []).includes(skill))
    .map((kind) => makeFinding({
      code: 'NAME-RESERVED', severity: kind.severity, skill, line: nameLineOf(repoRoot, skill), key: kind.key,
      message: `스킬 이름이 ${kind.describe(skill)}과 같습니다 (기준 omp ${reserved.omp_version}).`,
    }));
}

function compareCopy(repoFile, otherFile) {
  try {
    return fs.readFileSync(repoFile).equals(fs.readFileSync(otherFile)) ? 'identical' : 'differs';
  } catch {
    return 'unreadable';
  }
}

const COPY_STATE = {
  identical: { severity: 'low', text: 'SKILL.md 내용 동일' },
  differs: { severity: 'medium', text: 'SKILL.md 내용 다름' },
  unreadable: { severity: 'medium', text: '내용 비교 불가' },
};

// Same-named copies outside the repo, keyed by real path so one copy is reported once: what the
// loader lists (`omp skill list --json`) plus what sits on disk under the given skill roots. The
// loader's list is post-collision — it can drop a copy or skip a disabled provider — so the
// directory scan is the part that does not depend on loader behaviour.
function externalCopies(repoRoot, skills, skillList, skillRoots) {
  const ownDir = realOrResolved(path.join(repoRoot, SKILLS_REL)) + path.sep;
  const copies = new Map();
  const add = (skill, file, loaded) => {
    const real = realOrResolved(file);
    if (!skill || real.startsWith(ownDir) || copies.has(real)) return;
    copies.set(real, { skill, file, loaded });
  };
  for (const entry of skillList ?? []) {
    if (typeof entry?.filePath !== 'string' || typeof entry.name !== 'string') continue;
    // The directory names the skill; the loaded name may carry a namespace or a `~N` suffix.
    const names = [path.basename(path.dirname(entry.filePath)), entry.name.split('/').pop().replace(/~\d+$/, '')];
    add(names.find((name) => skills.includes(name)), entry.filePath, { name: entry.name, source: entry.source ?? '?' });
  }
  for (const root of skillRoots ?? []) {
    for (const skill of skills) {
      const file = path.join(root, skill, 'SKILL.md');
      if (fs.existsSync(file)) add(skill, file, null);
    }
  }
  return [...copies.values()];
}

function duplicateFindings(repoRoot, skills, skillList, skillRoots) {
  return externalCopies(repoRoot, skills, skillList, skillRoots).map(({ skill, file, loaded }) => {
    const state = COPY_STATE[compareCopy(readSkill(repoRoot, skill).file, file)];
    const how = loaded ? `출처 ${loaded.source}, 로드 이름 \`${loaded.name}\`` : '로드 목록에 없음';
    return makeFinding({
      code: 'NAME-DUP', severity: state.severity, skill, line: nameLineOf(repoRoot, skill), key: file,
      message: `같은 이름의 스킬이 다른 출처에 있습니다: ${file} (${how}, ${state.text}).`,
    });
  });
}

// reserved: the reserved-names.json object or null. skillList: `omp skill list --json` entries or
// null. skillRoots: directories whose `<name>/SKILL.md` children are compared by name.
export function checkNameCollisions({ repoRoot, skills, reserved, skillList, skillRoots = [] }) {
  const fromReserved = reserved ? skills.flatMap((skill) => reservedFindings(repoRoot, skill, reserved)) : [];
  return [...fromReserved, ...duplicateFindings(repoRoot, skills, skillList, skillRoots)];
}

// ---------- 3. body consistency ----------------------------------------------------------------

const CODE_SPAN = /`([^`\n]+)`/g;
const PATH_TOKEN = /(?<![\w./~-])((?:\.[A-Za-z][\w-]*|[A-Za-z][\w-]*)(?:\/[\w.@-]+)+)/g;
const PLACEHOLDER_AFTER = /^[./]*[<*{$[]/; // the token runs into a template placeholder: `review-<ts>.json`, `dir/<id>.json`, `name.<ext>`
const FILE_EXT = /\.(?:md|mjs|js|ts|sh|json|jsonl|ya?ml|html|txt)$/;
const SKILL_REF = /\/skill:([a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*)/g;
const AGENT_REFS = [
  /`([a-z][a-z0-9-]*)`\s*(?:에이전트|agents?\b)/gi,
  /(?<![\w`/-])([a-z][a-z0-9-]*[a-z0-9])\s+에이전트/g,
];
// "omp 에이전트 디렉터리/세션" names omp itself, not a task agent.
const NOT_AGENT_NAMES = new Set(['omp']);

function entryNames(dir) {
  return fs.existsSync(dir) ? new Set(fs.readdirSync(dir)) : new Set();
}

// value -> [line numbers] for every match of `collect(line)` over the body lines.
function collectRefs(lines, firstLine, collect) {
  const refs = new Map();
  lines.forEach((line, index) => {
    if (index + 1 < firstLine) return;
    for (const value of new Set(collect(line))) refs.set(value, [...(refs.get(value) ?? []), index + 1]);
  });
  return refs;
}

// Repo-path candidates inside inline code spans. A candidate counts as a path reference when its
// first segment is a top-level repo entry or an entry of the skill directory, or when it ends in
// a known file extension; a token cut short by a template placeholder (`review-<ts>.json`) is skipped.
function pathCandidates(line, roots) {
  const found = [];
  for (const span of line.matchAll(CODE_SPAN)) {
    for (const match of span[1].matchAll(PATH_TOKEN)) {
      const raw = match[1].replace(/\.+$/, '');
      if (PLACEHOLDER_AFTER.test(span[1].slice(match.index + raw.length))) continue;
      if (roots.has(raw.split('/')[0]) || FILE_EXT.test(raw)) found.push(raw);
    }
  }
  return found;
}

function gitIgnored(repoRoot, paths) {
  if (paths.length === 0) return new Set();
  const input = paths.flatMap((p) => [p, `${p}/`]).join('\n');
  const run = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], { cwd: repoRoot, input, encoding: 'utf8' });
  if (run.status !== 0) return new Set(); // 1 = nothing ignored, 128 = not a git repo
  return new Set(run.stdout.split('\n').filter(Boolean).map((p) => p.replace(/\/$/, '')));
}

const lineList = (lines) => (lines.length > 1 ? `줄 ${lines.join(', ')}` : `줄 ${lines[0]}`);

function pathFindings(repoRoot, skill, doc, expectedAbsent) {
  const skillDir = path.join(repoRoot, SKILLS_REL, skill);
  const roots = new Set([...entryNames(repoRoot), ...entryNames(skillDir)]);
  roots.delete('.git');
  const refs = collectRefs(doc.lines, doc.frontmatter.end + 1, (line) => pathCandidates(line, roots));
  const isExpected = (ref) => Object.hasOwn(expectedAbsent, ref);
  const expected = [...refs.keys()].filter(isExpected);
  const ignored = gitIgnored(repoRoot, [...refs.keys()].filter((ref) => !isExpected(ref)));
  const findings = [...refs]
    .filter(([ref]) => !isExpected(ref) && !ignored.has(ref))
    .filter(([ref]) => !fs.existsSync(path.join(repoRoot, ref)) && !fs.existsSync(path.join(skillDir, ref)))
    .map(([ref, lines]) => makeFinding({
      code: 'REF-PATH', severity: 'medium', skill, line: lines[0], key: ref,
      message: `본문이 참조하는 경로 \`${ref}\`가 리포에 없습니다 (${lineList(lines)}).`,
    }));
  return { findings, suppressed: { gitignored: ignored.size, expected: expected.length } };
}

function skillRefFindings(skill, doc, repoSkills) {
  const refs = collectRefs(doc.lines, doc.frontmatter.end + 1, (line) => [...line.matchAll(SKILL_REF)].map((m) => m[1]));
  return [...refs].filter(([name]) => !repoSkills.has(name)).map(([name, lines]) => makeFinding({
    code: 'REF-SKILL', severity: 'medium', skill, line: lines[0], key: name,
    message: `본문이 참조하는 \`/skill:${name}\`이 ${SKILLS_REL}/에 없습니다 (${lineList(lines)}).`,
  }));
}

function agentRefFindings(skill, doc, knownAgents) {
  const collect = (line) => AGENT_REFS
    .flatMap((pattern) => [...line.matchAll(pattern)].map((m) => m[1].toLowerCase()))
    .filter((name) => !NOT_AGENT_NAMES.has(name));
  const refs = collectRefs(doc.lines, doc.frontmatter.end + 1, collect);
  return [...refs].filter(([name]) => !knownAgents.has(name)).map(([name, lines]) => makeFinding({
    code: 'REF-AGENT', severity: 'medium', skill, line: lines[0], key: name,
    message: `본문이 참조하는 에이전트 \`${name}\`가 ${AGENTS_REL}/과 omp 번들 에이전트에 없습니다 (${lineList(lines)}).`,
  }));
}

function frontmatterFindings(skill, doc) {
  const { present, fields } = doc.frontmatter;
  if (!present) {
    const what = doc.exists ? 'frontmatter(`---` 블록)가 없거나 닫히지 않았습니다' : 'SKILL.md가 없습니다';
    return [makeFinding({ code: 'FM-MISSING', severity: 'high', skill, line: 1, key: 'frontmatter', message: `${what}.` })];
  }
  const findings = [];
  if (fields.name?.value !== skill) {
    const got = fields.name ? `\`${fields.name.value}\`` : '없음';
    findings.push(makeFinding({
      code: 'FM-NAME', severity: 'high', skill, line: fields.name?.line ?? 1, key: 'name', mechanical: true,
      message: `frontmatter \`name\`(${got})이 디렉터리명 \`${skill}\`과 다릅니다.`,
    }));
  }
  if (!fields.description?.value) {
    findings.push(makeFinding({
      code: 'FM-DESC', severity: 'high', skill, line: fields.description?.line ?? 1, key: 'description',
      message: 'frontmatter `description`이 없거나 비어 있습니다.',
    }));
  }
  return findings;
}

function sizeFindings(skill, doc) {
  if (doc.lineCount <= MAX_SKILL_LINES) return [];
  return [makeFinding({
    code: 'SIZE', severity: 'low', skill, line: 1, key: 'size',
    message: `SKILL.md가 ${doc.lineCount}줄입니다 (기준 ${MAX_SKILL_LINES}줄 초과).`,
  })];
}

// expectedAbsent: { "<repo path>": "<why its absence is expected>" } — suppressed, but counted.
export function checkBodies({ repoRoot, skills, knownAgents, expectedAbsent }) {
  const repoSkills = new Set(listRepoSkills(repoRoot));
  const agents = new Set(knownAgents);
  const findings = [];
  const lines = {};
  let suppressed = { gitignored: 0, expected: 0 };
  for (const skill of skills) {
    const doc = readSkill(repoRoot, skill);
    lines[skill] = doc.lineCount;
    findings.push(...frontmatterFindings(skill, doc));
    if (!doc.exists) continue;
    const paths = pathFindings(repoRoot, skill, doc, expectedAbsent);
    suppressed = {
      gitignored: suppressed.gitignored + paths.suppressed.gitignored,
      expected: suppressed.expected + paths.suppressed.expected,
    };
    findings.push(...paths.findings, ...skillRefFindings(skill, doc, repoSkills), ...agentRefFindings(skill, doc, agents), ...sizeFindings(skill, doc));
  }
  return { findings, lines, suppressed };
}

// ---------- 4. check + report ------------------------------------------------------------------

function readJsonIfPresent(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${file}: 읽을 수 없는 JSON입니다 (${error.message})`);
  }
}

function repoAgentNames(repoRoot) {
  const dir = path.join(repoRoot, AGENTS_REL);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -'.md'.length));
}

function sortFindings(findings) {
  const rank = (f) => SEVERITIES.indexOf(f.severity);
  return [...findings].sort((a, b) => rank(a) - rank(b) || a.skill.localeCompare(b.skill) || a.id.localeCompare(b.id));
}

// skillList / ompVersion are resolved by the caller (the CLI asks the installed omp); null = unmeasured.
export function runCheck({ repoRoot, sessionsDir, dbPath, repoPrefixes, reservedPath, expectedAbsentPath, skillList, skillListReason, skillRoots = [], ompVersion, now }) {
  const skills = listRepoSkills(repoRoot);
  const reserved = readJsonIfPresent(reservedPath);
  const expectedAbsent = readJsonIfPresent(expectedAbsentPath) ?? {};
  const knownAgents = [...repoAgentNames(repoRoot), ...(reserved?.bundled_agents ?? [])];
  const bodies = checkBodies({ repoRoot, skills, knownAgents, expectedAbsent });
  const collisions = checkNameCollisions({ repoRoot, skills, reserved, skillList, skillRoots });
  return {
    generatedAt: now ?? new Date().toISOString(),
    repoRoot, skills, repoPrefixes,
    reserved: reserved ? { ompVersion: reserved.omp_version, generatedAt: reserved.generated_at, path: reservedPath } : null,
    ompVersion: ompVersion ?? null,
    sessions: collectSessionUsage({ sessionsDir, repoPrefixes, skills }),
    commands: collectCommandUsage({ dbPath, skills }),
    crossSource: { loaded: skillList ? skillList.length : null, reason: skillListReason ?? 'omp skill list 결과 없음', roots: skillRoots },
    lines: bodies.lines,
    suppressed: bodies.suppressed,
    findings: sortFindings([...collisions, ...bodies.findings]),
  };
}

const day = (iso) => (iso ? iso.slice(0, 10) : '-');
const cell = (text) => String(text).replace(/\|/g, '\\|');
const row = (cells) => `| ${cells.map(cell).join(' | ')} |`;

function reportHeader(result) {
  const { reserved, ompVersion, sessions, commands, crossSource, suppressed } = result;
  const installed = ompVersion ?? '확인 불가';
  const stale = reserved && ompVersion && reserved.ompVersion !== ompVersion
    ? ' — **기준 버전이 설치된 omp와 다릅니다. `refresh-reserved`로 갱신하세요.**' : '';
  return [
    `- 생성: ${result.generatedAt}`,
    `- 리포: \`${result.repoRoot}\` (스킬 ${result.skills.length}개)`,
    reserved
      ? `- 예약 이름 기준: omp ${reserved.ompVersion} (\`reserved-names.json\`, ${reserved.generatedAt}), 설치된 omp: ${installed}${stale}`
      : `- 예약 이름 기준: ${UNMEASURED} — reserved-names.json 없음`,
    sessions.measured
      ? `- 세션 원천: \`${sessions.dir}\` (세션 파일 ${sessions.files}개${sessions.unreadable ? `, 읽지 못한 파일·디렉터리 ${sessions.unreadable}개` : ''})`
      : `- 세션 원천: ${UNMEASURED} — ${sessions.reason}`,
    `- 리포 범위(세션 cwd 접두): ${result.repoPrefixes.map((p) => `\`${p}\``).join(', ') || '없음'}`,
    commands.measured ? `- \`/skill:\` 호출 원천: \`${commands.db}\`의 \`command_usage\`` : `- \`/skill:\` 호출 원천: ${UNMEASURED} — ${commands.reason}`,
    `- 출처 간 사본 원천: \`omp skill list --json\` ${crossSource.loaded === null ? `${UNMEASURED} — ${crossSource.reason}` : `(로드된 스킬 ${crossSource.loaded}개)`}, 스킬 디렉터리 ${crossSource.roots.map((p) => `\`${p}\``).join(', ') || '없음'}`,
    `- 억제한 경로 참조: gitignore 대상 ${suppressed.gitignored}건, 예상된 부재(\`expected-absent-paths.json\`) ${suppressed.expected}건`,
  ];
}

function usageRows(result) {
  const { sessions, commands } = result;
  const counts = (skill) => {
    if (!sessions.measured) return Array(6).fill(UNMEASURED);
    const { repo, all } = sessions.perSkill[skill];
    return [repo.sessions, repo.reads, day(repo.last), all.sessions, all.reads, day(all.last)];
  };
  const invoked = (skill) => {
    if (!commands.measured) return UNMEASURED;
    const { count, last } = commands.perSkill[skill];
    return count > 0 ? `${count} (${day(last)})` : '0';
  };
  const allReads = (skill) => (sessions.measured ? sessions.perSkill[skill].all.reads : 0);
  return [...result.skills]
    .sort((a, b) => allReads(b) - allReads(a) || a.localeCompare(b))
    .map((skill) => row([`\`${skill}\``, result.lines[skill], ...counts(skill), invoked(skill), result.findings.filter((f) => f.skill === skill).length]));
}

export function renderReport(result) {
  const findingRows = result.findings.map((f) => row([f.id, f.severity, `\`${f.skill}\``, `\`${f.evidence}\``, f.mechanical ? '가능' : '불가', f.message]));
  return [
    '# harness-skill-tune 점검 보고서',
    '',
    ...reportHeader(result),
    '',
    '## 스킬별 표',
    '',
    '| 스킬 | 줄 수 | 리포 세션 | 리포 읽기 | 리포 마지막 | 전체 세션 | 전체 읽기 | 전체 마지막 | `/skill:` 호출 | 지적 |',
    '|---|---:|---:|---:|---|---:|---:|---|---|---:|',
    ...usageRows(result),
    '',
    `## 지적 목록 (${result.findings.length}건)`,
    '',
    '| ID | 심각도 | 스킬 | 근거 | 기계적 수정 | 내용 |',
    '|---|---|---|---|---|---|',
    ...findingRows,
    '',
    '## 한계',
    '',
    '- 세션 수는 그 스킬을 한 번 이상 읽은 세션 파일 수이고(서브에이전트 기록도 파일 하나), 읽기는 `read` 도구 호출을 tool call id로 중복 없이 센 값입니다. 실패한 읽기와 재읽기도 셉니다.',
    '- 전체 범위는 이름으로만 귀속하므로 다른 리포·다른 출처의 같은 이름 스킬 읽기가 섞입니다. 리포 범위는 세션 cwd가 위 접두 아래인 것만 세며, 지워진 워크트리는 접두를 넘겨야 잡힙니다.',
    '- `/skill:` 호출 수는 이 머신 전체 합산입니다(`command_usage`에 프로젝트 구분이 없습니다).',
    '- 경로 참조는 인라인 코드(백틱) 안의 리포 경로만 봅니다. 마크다운 링크는 `scripts/docs-drift`가 검사합니다.',
    '',
  ].join('\n');
}

// ---------- 5. reserved names (refresh-reserved) -----------------------------------------------

// Top-level entries of a BUILTIN_*_SLASH_COMMANDS array are formatted one field per line at two
// tabs; subcommands sit deeper or inline, so the indentation tells them apart.
export function parseBuiltinSlashCommands(source) {
  const names = [...source.matchAll(/^\t\tname: "([^"]+)"/gm)].map((m) => m[1]);
  const aliases = [...source.matchAll(/^\t\taliases: \[([^\]]*)\]/gm)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((a) => a[1]));
  return { names, aliases };
}

export function parseEmbeddedCommands(source) {
  const block = /EMBEDDED_COMMANDS[^=]*=\s*\[([\s\S]*?)\];/.exec(source);
  return block ? [...block[1].matchAll(/name:\s*"([^"]+)\.md"/g)].map((m) => m[1]) : [];
}

export function parseCliCommands(helpText) {
  const lines = helpText.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === 'COMMANDS');
  if (start === -1) return [];
  const names = [];
  for (const line of lines.slice(start + 1)) {
    const match = /^ {2}([a-z][a-z0-9-]*)\s{2,}\S/.exec(line);
    if (!match) break;
    names.push(match[1]);
  }
  return names;
}

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: SUBPROCESS_TIMEOUT_MS, ...options });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? ((result.stderr || '').trim() || `exit ${result.status}`);
    throw new Error(`${bin} ${args.join(' ')} 실패: ${detail}`);
  }
  return result.stdout;
}

function installedOmpVersion(ompBin) {
  try {
    return /(\d+\.\d+\.\d+)/.exec(run(ompBin, ['--version']))?.[1] ?? null;
  } catch {
    return null;
  }
}

function bundledAgents(ompBin) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-tune-agents-'));
  try {
    const written = JSON.parse(run(ompBin, ['agents', 'unpack', '--dir', dir, '--json'])).written ?? [];
    return written.map((file) => path.basename(file, '.md'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const upstreamRaw = (file, tag) => run('gh', ['api', `repos/${UPSTREAM_REPO}/contents/${file}?ref=${tag}`, '-H', 'Accept: application/vnd.github.raw']);
const sortedUnique = (values) => [...new Set(values)].sort();

function refreshReserved({ ompBin, reservedPath }) {
  const version = installedOmpVersion(ompBin);
  if (!version) throw new Error(`설치된 omp 버전을 확인할 수 없습니다 (${ompBin} --version).`);
  const tag = `v${version}`;
  const listing = JSON.parse(run('gh', ['api', `repos/${UPSTREAM_REPO}/contents/${UPSTREAM_SLASH_DIR}?ref=${tag}`]));
  const builtinFiles = listing.map((entry) => entry.name).filter((name) => /^builtin-.*\.ts$/.test(name));
  const parsed = builtinFiles.map((name) => parseBuiltinSlashCommands(upstreamRaw(`${UPSTREAM_SLASH_DIR}/${name}`, tag)));
  const builtinCommands = sortedUnique(parsed.flatMap((p) => p.names));
  const snapshot = {
    schema: 'omp-reserved-names/v1',
    omp_version: version,
    generated_at: new Date().toISOString().slice(0, 10),
    sources: {
      builtin: `${UPSTREAM_REPO}@${tag}:${UPSTREAM_SLASH_DIR}/builtin-*.ts (최상위 name·aliases)`,
      bundled_commands: `${UPSTREAM_REPO}@${tag}:${UPSTREAM_BUNDLED_COMMANDS} (EMBEDDED_COMMANDS)`,
      cli_subcommands: 'omp --help (COMMANDS)',
      bundled_agents: 'omp agents unpack --json',
    },
    builtin_commands: builtinCommands,
    builtin_aliases: sortedUnique(parsed.flatMap((p) => p.aliases)),
    bundled_commands: sortedUnique(parseEmbeddedCommands(upstreamRaw(UPSTREAM_BUNDLED_COMMANDS, tag))),
    cli_subcommands: sortedUnique(parseCliCommands(run(ompBin, ['--help']))),
    bundled_agents: sortedUnique(bundledAgents(ompBin)),
  };
  assertPlausibleSnapshot(snapshot);
  fs.writeFileSync(reservedPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}

// A snapshot is only written when every list reached a plausible size: an upstream format change
// makes a parser return nothing, and the names that list guarded would otherwise vanish silently.
export function assertPlausibleSnapshot(snapshot) {
  const short = Object.entries(SNAPSHOT_MINIMUMS).filter(([key, min]) => (snapshot[key]?.length ?? 0) < min);
  if (short.length === 0) return;
  const detail = short.map(([key, min]) => `${key} ${snapshot[key]?.length ?? 0}개(최소 ${min}개)`).join(', ');
  throw new Error(`예약 이름을 충분히 읽지 못했습니다: ${detail}. 업스트림 소스나 omp 출력 형식이 바뀌었을 수 있습니다. 기준 파일을 쓰지 않습니다.`);
}

// ---------- CLI --------------------------------------------------------------------------------

const USAGE = `usage:
  skill-tune.mjs check [--repo <dir>] [--agent-dir <dir>] [--sessions-dir <dir>] [--db <file>]
                       [--repo-prefix <dir>]... [--skill-root <dir>]... [--skill-list-json <file>]
                       [--omp-bin <bin>] [--reserved <file>] [--format md|json] [--out <file>]
  skill-tune.mjs refresh-reserved [--omp-bin <bin>] [--reserved <file>]`;

const OPTIONS = {
  repo: { type: 'string' }, 'agent-dir': { type: 'string' }, 'sessions-dir': { type: 'string' }, db: { type: 'string' },
  'repo-prefix': { type: 'string', multiple: true }, 'skill-root': { type: 'string', multiple: true },
  'skill-list-json': { type: 'string' }, 'omp-bin': { type: 'string' },
  reserved: { type: 'string' }, format: { type: 'string' }, out: { type: 'string' },
};

function gitLines(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.split('\n').filter(Boolean) : [];
}

function loadSkillList(values, repoRoot, ompBin) {
  try {
    const text = values['skill-list-json'] ? fs.readFileSync(values['skill-list-json'], 'utf8') : run(ompBin, ['skill', 'list', '--json'], { cwd: repoRoot });
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : parsed.skills;
    if (!Array.isArray(list)) throw new Error('스킬 목록 JSON에 배열이 없습니다');
    return { skillList: list };
  } catch (error) {
    return { skillList: null, skillListReason: error.message };
  }
}

// Where same-named copies can live: the conventional user-level skill directories, every directory
// the loader reported a skill from, and any --skill-root. Only existing directories are kept.
function skillRootsFor(values, repoRoot, agentDir, skillList) {
  const ownDir = realOrResolved(path.join(repoRoot, SKILLS_REL));
  const home = os.homedir();
  const listed = (skillList ?? []).filter((entry) => typeof entry?.filePath === 'string').map((entry) => path.dirname(path.dirname(entry.filePath)));
  const candidates = [path.join(agentDir, 'skills'), path.join(home, '.claude', 'skills'), path.join(home, '.agents', 'skills'), ...listed, ...(values['skill-root'] ?? [])];
  return [...new Set(candidates.map((dir) => realOrResolved(dir)))].filter((dir) => dir !== ownDir && fs.existsSync(dir));
}

// The inspection never changes a skill, so its report cannot be aimed at one either.
function assertReportTarget(repoRoot, target) {
  const skillsDir = realOrResolved(path.join(repoRoot, SKILLS_REL)) + path.sep;
  const resolved = path.join(realOrResolved(path.dirname(path.resolve(target))), path.basename(target));
  if (`${resolved}${path.sep}`.startsWith(skillsDir)) throw new Error(`--out은 ${SKILLS_REL}/ 아래에 쓸 수 없습니다: ${target}`);
}

function checkCommand(values) {
  const repoRoot = path.resolve(values.repo ?? gitLines(process.cwd(), ['rev-parse', '--show-toplevel'])[0] ?? process.cwd());
  if (values.out) assertReportTarget(repoRoot, values.out);
  const agentDir = path.resolve(values['agent-dir'] || process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.omp', 'agent'));
  const ompBin = values['omp-bin'] ?? 'omp';
  const worktrees = gitLines(repoRoot, ['worktree', 'list', '--porcelain']).filter((line) => line.startsWith('worktree ')).map((line) => line.slice('worktree '.length));
  const repoPrefixes = [...new Set([repoRoot, ...worktrees, ...(values['repo-prefix'] ?? [])].map((p) => path.resolve(p)))];
  const loaded = loadSkillList(values, repoRoot, ompBin);
  const result = runCheck({
    repoRoot, repoPrefixes, ...loaded,
    skillRoots: skillRootsFor(values, repoRoot, agentDir, loaded.skillList),
    sessionsDir: path.resolve(values['sessions-dir'] ?? path.join(agentDir, 'sessions')),
    dbPath: path.resolve(values.db ?? path.join(agentDir, 'agent.db')),
    reservedPath: path.resolve(values.reserved ?? path.join(SKILL_DIR, 'reserved-names.json')),
    expectedAbsentPath: path.join(SKILL_DIR, 'expected-absent-paths.json'),
    ompVersion: installedOmpVersion(ompBin),
  });
  const output = values.format === 'json' ? `${JSON.stringify(result, null, 2)}\n` : renderReport(result);
  if (values.out) fs.writeFileSync(values.out, output);
  else process.stdout.write(output);
}

function main(argv) {
  const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  const [command] = positionals;
  if (values.format && !['md', 'json'].includes(values.format)) throw new Error(`--format은 md 또는 json입니다: ${values.format}`);
  if (command === 'check') return checkCommand(values);
  if (command === 'refresh-reserved') {
    const reservedPath = path.resolve(values.reserved ?? path.join(SKILL_DIR, 'reserved-names.json'));
    const snapshot = refreshReserved({ ompBin: values['omp-bin'] ?? 'omp', reservedPath });
    const total = snapshot.builtin_commands.length + snapshot.builtin_aliases.length + snapshot.bundled_commands.length + snapshot.cli_subcommands.length;
    process.stdout.write(`reserved-names.json: omp ${snapshot.omp_version}, 예약 이름 ${total}개, 번들 에이전트 ${snapshot.bundled_agents.length}개 -> ${reservedPath}\n`);
    return undefined;
  }
  throw new Error(USAGE);
}

if (process.argv[1] && realOrResolved(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
