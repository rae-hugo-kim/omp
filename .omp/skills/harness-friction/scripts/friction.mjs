#!/usr/bin/env node
// harness-friction — omp release vs harness friction audit helpers (#129).
//
//   node .omp/skills/harness-friction/scripts/friction.mjs range     [--from X] [--to Y]
//   node .omp/skills/harness-friction/scripts/friction.mjs releases  [--from X] [--to Y] --out releases.json
//   node .omp/skills/harness-friction/scripts/friction.mjs models    [--releases-json f] [--format md|json] [--out f]
//   node .omp/skills/harness-friction/scripts/friction.mjs baseline  --set <version> --report <path> [--date YYYY-MM-DD]
//
// `range` prints the audit window: baseline (baseline.json, or --from) → installed omp (or --to).
// `releases` collects every upstream release in that window (gh release list/view) into one JSON
// file and reports "N in range / M read" — the audit report quotes both numbers.
// `models` is the deterministic model-reference survival check: every fixed `model:` value in
// .omp/agents/*.md and every backticked `provider/model` id in .omp/rules/*.md + AGENTS.md must
// resolve in the installed omp catalog (`omp models --kind all --json`). Role references
// (`@advisor`, `["@task", "@default"]`) are reported for information and never flagged. With
// --releases-json the report cites the release bullets that pause or remove an unresolved provider.
// `baseline` records the new baseline after an audit (the previous entry moves to `history`).
//
// Source-repo only: not on the harness-sync whitelist. Reading the release notes and judging each
// change (conflict / drift / unrelated) is the skill's procedure, not this script.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const UPSTREAM_REPO = 'can1357/oh-my-pi';
const AGENTS_REL = '.omp/agents';
const RULES_REL = '.omp/rules';
const RULE_DOCS = ['AGENTS.md'];
const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE_PATH = path.join(SKILL_DIR, 'baseline.json');
const SUBPROCESS_TIMEOUT_MS = 120_000;
const RELEASE_FIELDS = 'tagName,publishedAt,name,body,url';
const USAGE = 'friction: usage — range [--from X] [--to Y] | releases [--from X] [--to Y] --out f | models [--releases-json f] [--format md|json] [--out f] | baseline --set <version> --report <path> [--date d]';

// ---------- versions ---------------------------------------------------------------------------

export function parseVersion(text) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(text ?? ''));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) throw new Error(`버전 형식이 아닙니다: ${!pa ? a : b}`);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

const versionOf = (tag) => parseVersion(tag)?.join('.') ?? null;

// Releases with baseline < version <= to, ascending. Drafts and prereleases are left out: the
// harness runs released binaries only. A tag that is not x.y.z is not a release of ours.
export function releasesInRange(list, from, to) {
  return list
    .filter((r) => !r.isDraft && !r.isPrerelease && versionOf(r.tagName))
    .filter((r) => compareVersions(versionOf(r.tagName), from) > 0 && compareVersions(versionOf(r.tagName), to) <= 0)
    .sort((a, b) => compareVersions(versionOf(a.tagName), versionOf(b.tagName)));
}

// ---------- subprocess seams --------------------------------------------------------------------

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: SUBPROCESS_TIMEOUT_MS, ...options });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? ((result.stderr || '').trim() || `exit ${result.status}`);
    throw new Error(`${bin} ${args.join(' ')} 실패: ${detail}`);
  }
  return result.stdout;
}

function installedOmpVersion(ompBin) {
  const version = parseVersion(run(ompBin, ['--version']));
  if (!version) throw new Error(`설치된 omp 버전을 확인할 수 없습니다 (${ompBin} --version).`);
  return version.join('.');
}

function readJson(file, what) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${what}을(를) 읽을 수 없습니다 (${file}): ${error.message}`);
  }
}

export function readBaseline(file = BASELINE_PATH) {
  const baseline = readJson(file, '기준 버전 기록');
  if (!parseVersion(baseline.omp_version)) throw new Error(`기준 버전 기록의 omp_version이 버전 형식이 아닙니다: ${file}`);
  return baseline;
}

function resolveRange(values, ompBin) {
  const from = values.from ?? readBaseline().omp_version;
  const to = values.to ?? installedOmpVersion(ompBin);
  if (!parseVersion(from) || !parseVersion(to)) throw new Error(`--from/--to는 x.y.z 형식입니다: ${from} → ${to}`);
  if (compareVersions(from, to) > 0) throw new Error(`기준 버전(${from})이 대상 버전(${to})보다 큽니다 — 기준 기록을 확인하세요.`);
  return { from: versionOf(from), to: versionOf(to) };
}

// ---------- releases ----------------------------------------------------------------------------

function listReleases(values) {
  if (values['list-json']) return readJson(values['list-json'], '릴리스 목록');
  return JSON.parse(run('gh', ['release', 'list', '-R', UPSTREAM_REPO, '--limit', '200', '--json', 'tagName,publishedAt,isDraft,isPrerelease']));
}

function viewRelease(tag) {
  return JSON.parse(run('gh', ['release', 'view', tag, '-R', UPSTREAM_REPO, '--json', RELEASE_FIELDS]));
}

function releasesCommand(values, ompBin) {
  if (!values.out) throw new Error('releases에는 --out <file.json>이 필요합니다.');
  const { from, to } = resolveRange(values, ompBin);
  const inRange = releasesInRange(listReleases(values), from, to);
  const read = [];
  const failed = [];
  for (const r of inRange) {
    try {
      read.push(viewRelease(r.tagName));
    } catch (error) {
      failed.push(`${r.tagName}: ${error.message}`);
    }
  }
  fs.writeFileSync(values.out, `${JSON.stringify({ from, to, in_range: inRange.map((r) => r.tagName), releases: read }, null, 1)}\n`);
  const summary = `구간 ${from} → ${to}: 릴리스 ${inRange.length}개 / 읽은 수 ${read.length}개 -> ${values.out}`;
  if (failed.length) throw new Error(`${summary}\n읽지 못한 릴리스:\n  ${failed.join('\n  ')}`);
  return `${summary}\n`;
}

// ---------- model references --------------------------------------------------------------------

// Frontmatter `model:` value of an agent file: the line number and the list of references it
// names. A scalar is one reference; an inline list (`["@task", "@default"]`) is several.
export function agentModelRefs(content) {
  const lines = content.split(/\r?\n/);
  if ((lines[0] ?? '').trim() !== '---') return null;
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end === -1) return null;
  for (let i = 1; i < end; i++) {
    const m = /^model:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const raw = m[1].trim();
    const list = /^\[(.*)\]$/.exec(raw);
    const items = list ? list[1].split(',') : [raw];
    const refs = items.map((item) => item.trim().replace(/^(["'])(.*)\1$/, '$2')).filter(Boolean);
    return { line: i + 1, refs };
  }
  return null;
}

const isRoleRef = (ref) => ref.startsWith('@');
const stripLevel = (ref) => ref.replace(/:[a-z]+$/, '');

// Backticked `provider/model[:level]` tokens in prose. Only providers the catalog, the agents or
// the role config know are considered, so repo paths (`docs/harness`) and version tags never match.
const CODE_TOKEN = /`([a-z][a-z0-9-]*)\/([a-z0-9][a-z0-9.-]*)(?::[a-z]+)?`/g;

export function proseModelRefs(content, knownProviders) {
  const refs = [];
  content.split(/\r?\n/).forEach((line, idx) => {
    for (const m of line.matchAll(CODE_TOKEN)) {
      if (!knownProviders.has(m[1])) continue;
      refs.push({ line: idx + 1, ref: `${m[1]}/${m[2]}` });
    }
  });
  return refs;
}

function catalogFrom(modelsJson) {
  const models = Array.isArray(modelsJson) ? modelsJson : modelsJson?.models;
  if (!Array.isArray(models)) throw new Error('모델 카탈로그 형식을 알 수 없습니다 (omp models --kind all --json의 models 배열이 없습니다).');
  const kinds = new Map();
  const providers = new Set();
  for (const m of models) {
    const selector = m.selector ?? (m.provider && m.id ? `${m.provider}/${m.id}` : null);
    if (!selector) continue;
    kinds.set(selector, m.kind ?? 'chat');
    providers.add(selector.split('/')[0]);
  }
  return { kinds, providers, count: kinds.size };
}

// An agent's fixed model must be a chat model; a prose id only has to exist in some catalog kind.
function resolveFixed(ref, catalog, { chatOnly = false } = {}) {
  const selector = stripLevel(ref);
  const kind = catalog.kinds.get(selector);
  if (kind !== undefined) return { ref, selector, status: chatOnly && kind !== 'chat' ? 'not-chat' : 'resolved', kind };
  const provider = selector.split('/')[0];
  return { ref, selector, status: catalog.providers.has(provider) ? 'model-missing' : 'provider-missing' };
}

// Release bullets that mention the provider of an unresolved reference together with a pause/
// removal word — the lines the audit report cites as the upstream cause. Hyphens in the provider
// name match a space too (`google-antigravity` ↔ "Google Antigravity").
const REMOVAL_WORDS = /\b(paus\w*|disabl\w*|remov\w*|retir\w*|dropp?\w*|deprecat\w*|discontinu\w*)\b/i;

export function releaseMentions(releases, provider) {
  const name = new RegExp(provider.split('-').map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[- ]'), 'i');
  const hits = [];
  for (const r of releases) {
    for (const line of String(r.body ?? '').split(/\r?\n/)) {
      if (!line.startsWith('- ') || !name.test(line) || !REMOVAL_WORDS.test(line)) continue;
      hits.push({ tag: r.tagName, url: r.url, bullet: line.slice(2).replace(/\s+/g, ' ').trim().slice(0, 240) });
    }
  }
  return hits;
}

function* agentFiles(repoRoot) {
  const dir = path.join(repoRoot, AGENTS_REL);
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort()) yield { rel: `${AGENTS_REL}/${name}`, file: path.join(dir, name) };
}

function* proseFiles(repoRoot) {
  const dir = path.join(repoRoot, RULES_REL);
  if (fs.existsSync(dir)) for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort()) yield { rel: `${RULES_REL}/${name}`, file: path.join(dir, name) };
  for (const rel of RULE_DOCS) {
    const file = path.join(repoRoot, rel);
    if (fs.existsSync(file)) yield { rel, file };
  }
}

function finding(code, file, line, resolved, releases) {
  const provider = resolved.selector.split('/')[0];
  const why = resolved.status === 'provider-missing'
    ? `프로바이더 \`${provider}\`가 현재 omp 카탈로그에 없습니다`
    : resolved.status === 'not-chat'
      ? `\`${resolved.selector}\`는 채팅 모델이 아닙니다 (kind: ${resolved.kind})`
      : `모델 \`${resolved.selector}\`가 프로바이더 \`${provider}\`의 현재 카탈로그에 없습니다`;
  const mentions = resolved.status === 'not-chat' ? [] : releaseMentions(releases, provider);
  return { code, severity: 'high', evidence: `${file}:${line}`, ref: resolved.ref, status: resolved.status, message: why, releases: mentions };
}

export function checkModelRefs({ repoRoot, modelsJson, rolesJson = null, releases = [] }) {
  const catalog = catalogFrom(modelsJson);
  const roles = rolesJson && typeof rolesJson === 'object' ? rolesJson : {};
  const agents = [];
  const findings = [];
  const knownProviders = new Set(catalog.providers);
  for (const target of Object.values(roles)) if (typeof target === 'string' && target.includes('/')) knownProviders.add(target.split('/')[0]);

  for (const { rel, file } of agentFiles(repoRoot)) {
    const parsed = agentModelRefs(fs.readFileSync(file, 'utf8'));
    if (!parsed) {
      agents.push({ file: rel, line: null, refs: [], note: 'model 없음(기본 모델 상속)' });
      continue;
    }
    const entries = parsed.refs.map((ref) => (isRoleRef(ref) ? { ref, status: 'role' } : resolveFixed(ref, catalog, { chatOnly: true })));
    agents.push({ file: rel, line: parsed.line, refs: entries });
    for (const e of entries) {
      if (e.status === 'role') {
        const target = roles[e.ref.slice(1)];
        if (typeof target === 'string' && target.includes('/')) e.target = resolveFixed(target, catalog, { chatOnly: true });
        continue;
      }
      knownProviders.add(e.selector.split('/')[0]);
      if (e.status !== 'resolved') findings.push(finding('AGENT-MODEL', rel, parsed.line, e, releases));
    }
  }

  for (const { rel, file } of proseFiles(repoRoot)) {
    for (const { line, ref } of proseModelRefs(fs.readFileSync(file, 'utf8'), knownProviders)) {
      const resolved = resolveFixed(ref, catalog);
      if (resolved.status !== 'resolved') findings.push(finding('RULE-MODEL', rel, line, resolved, releases));
    }
  }

  const roleRows = Object.entries(roles).map(([role, target]) => ({
    role, target,
    status: typeof target === 'string' && target.includes('/') ? resolveFixed(target, catalog).status : 'skipped',
  }));
  return { catalog: { count: catalog.count, providers: [...catalog.providers].sort() }, agents, roles: roleRows, findings };
}

const statusLabel = (status) => (status === 'resolved' ? '해석됨' : status === 'skipped' ? '검사 안 함' : `**해석 안 됨** (${status})`);

export function renderModelReport(result, { from = null, to = null } = {}) {
  const out = ['# 모델 참조 생존 검사', ''];
  if (from && to) out.push(`- 구간: ${from} → ${to}`);
  out.push(`- 카탈로그: 모델 ${result.catalog.count}개, 프로바이더 ${result.catalog.providers.join(', ') || '(없음)'}`, '');
  out.push('## 에이전트 `model:`', '', '| 파일 | 참조 | 종류 | 상태 |', '|---|---|---|---|');
  for (const a of result.agents) {
    if (!a.refs.length) { out.push(`| \`${a.file}\` | — | — | ${a.note} |`); continue; }
    for (const e of a.refs) {
      const status = e.status === 'role'
        ? `검사 안 함${e.target ? ` (modelRoles → \`${e.target.selector}\`: ${statusLabel(e.target.status)})` : ''}`
        : statusLabel(e.status);
      out.push(`| \`${a.file}:${a.line}\` | \`${e.ref}\` | ${e.status === 'role' ? '롤 참조' : '고정값'} | ${status} |`);
    }
  }
  if (result.roles.length) {
    out.push('', '## 호스트 `modelRoles` (참고 — 리포 산출물이 아닙니다)', '', '| 롤 | 대상 | 상태 |', '|---|---|---|');
    for (const r of result.roles) out.push(`| ${r.role} | \`${r.target}\` | ${statusLabel(r.status)} |`);
  }
  out.push('', `## 지적 (${result.findings.length}건)`, '');
  if (!result.findings.length) out.push('해석되지 않는 고정 모델 참조가 없습니다.');
  for (const f of result.findings) {
    out.push(`- **${f.code}** \`${f.evidence}\` — \`${f.ref}\`: ${f.message}.`);
    if (f.status !== 'not-chat' && !f.releases.length) out.push('  - (구간 릴리스 노트에 이 프로바이더의 중지·제거 언급 없음)');
    for (const r of f.releases) out.push(`  - ${r.tag}: ${r.bullet} (${r.url})`);
  }
  out.push('');
  return out.join('\n');
}

function gitToplevel() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

// `omp config get modelRoles` prints JSON; a host without the key is reported without role rows.
function readRoles(ompBin) {
  try {
    return JSON.parse(run(ompBin, ['config', 'get', 'modelRoles']));
  } catch {
    return null;
  }
}

function modelsCommand(values, ompBin) {
  const repoRoot = path.resolve(values.repo ?? gitToplevel() ?? process.cwd());
  const modelsJson = values['models-json'] ? readJson(values['models-json'], '모델 카탈로그') : JSON.parse(run(ompBin, ['models', '--kind', 'all', '--json']));
  const rolesJson = values['roles-json'] ? readJson(values['roles-json'], 'modelRoles') : readRoles(ompBin);
  const releasesFile = values['releases-json'] ? readJson(values['releases-json'], '릴리스 기록') : null;
  const releases = Array.isArray(releasesFile) ? releasesFile : releasesFile?.releases ?? [];
  const result = checkModelRefs({ repoRoot, modelsJson, rolesJson, releases });
  const range = releasesFile && !Array.isArray(releasesFile) ? { from: releasesFile.from, to: releasesFile.to } : {};
  const output = values.format === 'json' ? `${JSON.stringify(result, null, 2)}\n` : renderModelReport(result, range);
  if (values.out) fs.writeFileSync(values.out, output);
  return values.out ? `지적 ${result.findings.length}건 -> ${values.out}\n` : output;
}

// ---------- baseline ----------------------------------------------------------------------------

export function nextBaseline(current, { version, report, date }) {
  if (!parseVersion(version)) throw new Error(`--set은 x.y.z 형식입니다: ${version}`);
  if (!report) throw new Error('--report <보고서 경로>가 필요합니다.');
  if (compareVersions(version, current.omp_version) < 0) throw new Error(`새 기준(${version})이 현재 기준(${current.omp_version})보다 낮습니다.`);
  const { history = [], ...previous } = current;
  return { omp_version: versionOf(version), audited_at: date, report, history: [...history, previous] };
}

function baselineCommand(values) {
  const current = readBaseline();
  const next = nextBaseline(current, { version: values.set, report: values.report, date: values.date ?? new Date().toISOString().slice(0, 10) });
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
  return `기준 버전 ${current.omp_version} → ${next.omp_version} (${next.audited_at}, ${next.report}) -> ${BASELINE_PATH}\n`;
}

// ---------- CLI ---------------------------------------------------------------------------------

const OPTIONS = {
  from: { type: 'string' }, to: { type: 'string' }, out: { type: 'string' }, format: { type: 'string' },
  repo: { type: 'string' }, 'omp-bin': { type: 'string' }, 'list-json': { type: 'string' },
  'models-json': { type: 'string' }, 'roles-json': { type: 'string' }, 'releases-json': { type: 'string' },
  set: { type: 'string' }, report: { type: 'string' }, date: { type: 'string' },
};

function main(argv) {
  const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  const [command] = positionals;
  const ompBin = values['omp-bin'] ?? 'omp';
  if (values.format && !['md', 'json'].includes(values.format)) throw new Error(`--format은 md 또는 json입니다: ${values.format}`);
  if (command === 'range') {
    const { from, to } = resolveRange(values, ompBin);
    return `기준 ${from} → 대상 ${to}\n`;
  }
  if (command === 'releases') return releasesCommand(values, ompBin);
  if (command === 'models') return modelsCommand(values, ompBin);
  if (command === 'baseline') return baselineCommand(values);
  throw new Error(USAGE);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
