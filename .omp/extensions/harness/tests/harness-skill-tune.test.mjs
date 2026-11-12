// Tests for the harness-skill-tune inspection script (#127).
//
// Run: node --test .omp/extensions/harness/tests/harness-skill-tune.test.mjs
//
// The skill is source-repo-only (not on the harness-sync whitelist), but this suite ships to
// consumers with the gates, so in a consumer tree it must skip, not fail — same arrangement
// as docs-drift.test.mjs.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..', '..');
const scriptPath = resolve(repoRoot, '.omp/skills/harness-skill-tune/scripts/skill-tune.mjs');
const SOURCE_ONLY_SKIP = existsSync(scriptPath) ? false : 'harness-skill-tune is source-repo-only; not present in consumer repos';
// Skip mode keeps the test's own function (the last argument) whether or not options are passed.
const test = SOURCE_ONLY_SKIP ? (name, ...rest) => nodeTest(name, { skip: SOURCE_ONLY_SKIP }, rest.at(-1)) : nodeTest;
const tune = SOURCE_ONLY_SKIP ? {} : await import(pathToFileURL(scriptPath).href);

const require = createRequire(import.meta.url);
let sqlite = null;
try { sqlite = require('node:sqlite'); } catch { /* older Node: the command_usage test skips */ }

function tmp(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function put(root, rel, content) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

const skillMd = (name, body = 'Body.\n', description = 'Does a thing. Use when asked.') =>
  `---\nname: ${name}\n${description === null ? '' : `description: ${description}\n`}---\n\n# ${name}\n\n${body}`;

// A repo fixture with the given { skillDir: SKILL.md content } map.
function repoFixture(t, skills, extra = {}) {
  const root = tmp(t, 'skill-tune-repo-');
  for (const [dir, content] of Object.entries(skills)) put(root, `.omp/skills/${dir}/SKILL.md`, content);
  for (const [rel, content] of Object.entries(extra)) put(root, rel, content);
  return root;
}

const sessionHeader = (cwd) => ({ type: 'session', version: 3, id: 's', timestamp: '2026-01-01T00:00:00.000Z', cwd });
const execStart = (id, path, timestamp, toolName = 'read') => ({
  type: 'custom', customType: 'tool_execution_start', timestamp,
  data: { toolCallId: id, toolName, args: toolName === 'read' ? { path } : { pattern: 'x', path } },
});
const assistantCall = (id, path, timestamp, name = 'read') => ({
  type: 'message', timestamp,
  message: { role: 'assistant', content: [{ type: 'toolCall', id, name, arguments: { path } }] },
});
const jsonl = (records) => records.map((r) => JSON.stringify(r)).join('\n') + '\n';

// --- 1. Usage: sessions --------------------------------------------------------------------

test('usage: reads are deduplicated per tool call, sub-path reads go to the skill, unread skills show 0', (t) => {
  const sessions = tmp(t, 'skill-tune-sessions-');
  const repo = join(sessions, 'work', 'repo'); // only compared as a cwd string; need not exist
  // One call recorded twice (assistant toolCall + tool_execution_start) is ONE read.
  put(sessions, '-work-repo/2026-03-01_a.jsonl', jsonl([
    { type: 'title', title: 'x' },
    sessionHeader(repo),
    assistantCall('t1', 'skill://alpha', '2026-03-01T10:00:00.000Z'),
    execStart('t1', 'skill://alpha', '2026-03-01T10:00:01.000Z'),
    execStart('t2', 'skill://alpha/references/x.md', '2026-03-02T09:00:00.000Z'),
    // A grep over a skill:// path and a read of an ordinary file are not skill reads.
    execStart('t3', 'skill://alpha', '2026-03-05T00:00:00.000Z', 'grep'),
    execStart('t4', 'docs/skill://alpha.md', '2026-03-05T00:00:00.000Z'),
    // A skill:// name that collides with an Object.prototype member must not break the tally.
    execStart('t5', 'skill://constructor', '2026-03-05T00:00:00.000Z'),
  ]));
  // A nested subagent transcript is its own session file; a cwd below the repo root still belongs to the repo.
  put(sessions, '-work-repo/2026-03-01_a/Sub.jsonl', jsonl([
    sessionHeader(join(repo, 'docs')),
    execStart('u1', 'skill://beta', '2026-03-03T00:00:00.000Z'),
  ]));
  // Another project; an old transcript that only has the assistant toolCall record.
  put(sessions, '-else/2026-04-01_b.jsonl', jsonl([
    sessionHeader(`${repo}-other`),
    assistantCall('v1', 'skill://alpha', '2026-04-01T00:00:00.000Z'),
  ]));

  const usage = tune.collectSessionUsage({ sessionsDir: sessions, repoPrefixes: [repo], skills: ['alpha', 'beta', 'gamma'] });

  assert.equal(usage.measured, true);
  assert.deepEqual(usage.perSkill.alpha.repo, { sessions: 1, reads: 2, last: '2026-03-02T09:00:00.000Z' });
  // `<repo>-other` shares a string prefix with `<repo>` but is a different directory.
  assert.deepEqual(usage.perSkill.alpha.all, { sessions: 2, reads: 3, last: '2026-04-01T00:00:00.000Z' });
  assert.deepEqual(usage.perSkill.beta.repo, { sessions: 1, reads: 1, last: '2026-03-03T00:00:00.000Z' });
  assert.deepEqual(usage.perSkill.gamma.all, { sessions: 0, reads: 0, last: null });
  assert.deepEqual(usage.perSkill.gamma.repo, { sessions: 0, reads: 0, last: null });
});

test('usage: /skill: invocation counts come from command_usage', { skip: sqlite ? false : 'node:sqlite unavailable' }, (t) => {
  const dir = tmp(t, 'skill-tune-db-');
  const dbPath = join(dir, 'agent.db');
  const db = new sqlite.DatabaseSync(dbPath);
  db.exec('CREATE TABLE command_usage (name TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, last_used_at INTEGER NOT NULL DEFAULT 0)');
  db.exec("INSERT INTO command_usage VALUES ('skill:alpha', 3, 1791352816), ('model', 24, 1794291477), ('skill:elsewhere', 9, 1)");
  db.close();

  const commands = tune.collectCommandUsage({ dbPath, skills: ['alpha', 'gamma'] });

  assert.equal(commands.measured, true);
  assert.deepEqual(commands.perSkill.alpha, { count: 3, last: '2026-10-07T06:00:16.000Z' });
  assert.deepEqual(commands.perSkill.gamma, { count: 0, last: null });
});

test('usage: a missing session directory or unreadable command_usage is "unmeasured", never a failure', (t) => {
  const dir = tmp(t, 'skill-tune-missing-');
  const garbage = put(dir, 'agent.db', 'this is not a sqlite database');

  const usage = tune.collectSessionUsage({ sessionsDir: join(dir, 'no-sessions'), repoPrefixes: [], skills: ['alpha'] });
  assert.equal(usage.measured, false);
  assert.match(usage.reason, /no-sessions/);

  for (const dbPath of [join(dir, 'absent.db'), garbage]) {
    const commands = tune.collectCommandUsage({ dbPath, skills: ['alpha'] });
    assert.equal(commands.measured, false, dbPath);
    assert.ok(commands.reason, 'an unmeasured column carries its reason');
  }
});

const CANNOT_DENY_READ = process.platform === 'win32' || process.getuid?.() === 0
  ? 'directory read permissions cannot be revoked for this user' : false;

test('usage: a session directory that cannot be listed is "unmeasured"; an unreadable subdirectory is counted, not hidden', { skip: CANNOT_DENY_READ }, (t) => {
  const sessions = tmp(t, 'skill-tune-denied-');
  put(sessions, '-a/2026-03-01_a.jsonl', jsonl([sessionHeader('/x'), execStart('t1', 'skill://alpha', '2026-03-01T10:00:00.000Z')]));
  const locked = join(sessions, '-locked');
  put(sessions, '-locked/2026-03-01_b.jsonl', jsonl([sessionHeader('/x'), execStart('t2', 'skill://alpha', '2026-03-01T10:00:00.000Z')]));

  // Permissions are restored here, not in an after-hook: the fixture cleanup has to list the tree.
  const withMode = (dir, run) => {
    chmodSync(dir, 0o000);
    try { return run(); } finally { chmodSync(dir, 0o700); }
  };
  const collect = () => tune.collectSessionUsage({ sessionsDir: sessions, repoPrefixes: [], skills: ['alpha'] });

  const partial = withMode(locked, collect);
  assert.equal(partial.measured, true);
  assert.equal(partial.perSkill.alpha.all.reads, 1);
  assert.equal(partial.unreadable, 1);

  const denied = withMode(sessions, collect);
  assert.equal(denied.measured, false);
  assert.ok(denied.reason);
});

// --- 2. Name collisions --------------------------------------------------------------------

const RESERVED = {
  omp_version: '9.9.9',
  builtin_commands: ['loop', 'model'],
  builtin_aliases: ['models'],
  bundled_commands: ['init'],
  cli_subcommands: ['commit'],
  bundled_agents: ['scout'],
};

test('collisions: a skill named like a reserved omp name is flagged, with the kind of name it hits', (t) => {
  const root = repoFixture(t, {
    init: skillMd('init'), models: skillMd('models'), commit: skillMd('commit'), alpha: skillMd('alpha'),
  });

  const findings = tune.checkNameCollisions({ repoRoot: root, skills: ['alpha', 'commit', 'init', 'models'], reserved: RESERVED, skillList: [] });

  const reserved = findings.filter((f) => f.code === 'NAME-RESERVED');
  assert.deepEqual(reserved.map((f) => f.skill).sort(), ['commit', 'init', 'models']);
  const bySkill = Object.fromEntries(reserved.map((f) => [f.skill, f]));
  assert.match(bySkill.init.message, /\/init/);
  assert.equal(bySkill.init.evidence, '.omp/skills/init/SKILL.md:2');
  // A CLI subcommand lives in another namespace (`omp commit`), so it ranks below a slash-name hit.
  assert.equal(bySkill.init.severity, 'medium');
  assert.equal(bySkill.models.severity, 'medium');
  assert.equal(bySkill.commit.severity, 'low');
});

test('collisions: a same-named skill from another source is flagged; an identical copy ranks lower than a diverged one', (t) => {
  const root = repoFixture(t, { alpha: skillMd('alpha'), beta: skillMd('beta'), gamma: skillMd('gamma'), delta: skillMd('delta') });
  const outside = tmp(t, 'skill-tune-user-');
  const diverged = put(outside, 'skills/alpha/SKILL.md', skillMd('alpha', 'Older body.\n'));
  const identical = put(outside, 'agents/beta/SKILL.md', skillMd('beta'));
  // A copy the loader does not list (dropped as identical, or its provider is off) is still on disk.
  const unlisted = put(outside, 'claude/gamma/SKILL.md', skillMd('gamma'));
  put(outside, 'claude/not-a-repo-skill/SKILL.md', skillMd('not-a-repo-skill'));
  const skillList = [
    { name: 'alpha', filePath: join(root, '.omp/skills/alpha/SKILL.md'), source: 'native:project' },
    { name: 'agent/alpha', filePath: diverged, source: 'native:user' },
    // The loader suffixes a name it had to disambiguate; the directory still names the skill.
    { name: 'agents/beta~2', filePath: identical, source: 'agents:user' },
    { name: 'unrelated', filePath: join(outside, 'skills/unrelated/SKILL.md'), source: 'native:user' },
  ];
  // `skills/` is also listed by the loader: the alpha copy must be reported once, not twice.
  const skillRoots = [join(outside, 'skills'), join(outside, 'claude'), join(outside, 'no-such-root')];

  const findings = tune.checkNameCollisions({ repoRoot: root, skills: ['alpha', 'beta', 'delta', 'gamma'], reserved: RESERVED, skillList, skillRoots });

  const dups = findings.filter((f) => f.code === 'NAME-DUP');
  assert.deepEqual(dups.map((f) => [f.skill, f.severity]).sort(), [['alpha', 'medium'], ['beta', 'low'], ['gamma', 'low']]);
  assert.ok(dups.find((f) => f.skill === 'alpha').message.includes(diverged));
  assert.match(dups.find((f) => f.skill === 'alpha').message, /agent\/alpha/);
  assert.ok(dups.find((f) => f.skill === 'gamma').message.includes(unlisted));
  assert.match(dups.find((f) => f.skill === 'gamma').message, /로드 목록에 없음/);
  assert.equal(dups.every((f) => f.mechanical === false), true);
});

// --- 3. Body consistency -------------------------------------------------------------------

test('bodies: a missing path, a missing /skill: target and a name/dir mismatch are three separate findings', (t) => {
  const body = [
    'See `docs/missing.md` (again: `docs/missing.md`) and `docs/exists.md`, then run `/skill:nope` or `/skill:other`.',
    'Template placeholders such as `docs/reviews/review-<ts>.json`, `docs/absent/<id>.json`, `docs/absent.<ext>` and `/skill:<name>` are not references.',
    'A file next to this skill: `references/notes.md`. Not a path: `owner/repo`. Another source: `/skill:agents/kickoff`.',
  ].join('\n');
  const root = repoFixture(
    t,
    { renamed: skillMd('old-name', body), other: skillMd('other') },
    { 'docs/exists.md': 'x', '.omp/skills/renamed/references/notes.md': 'x' },
  );

  const { findings } = tune.checkBodies({ repoRoot: root, skills: ['other', 'renamed'], knownAgents: [], expectedAbsent: {} });

  const got = findings.map((f) => [f.code, f.skill, f.evidence, f.mechanical]);
  assert.deepEqual(got.sort(), [
    ['FM-NAME', 'renamed', '.omp/skills/renamed/SKILL.md:2', true],
    ['REF-PATH', 'renamed', '.omp/skills/renamed/SKILL.md:8', false],
    ['REF-SKILL', 'renamed', '.omp/skills/renamed/SKILL.md:10', false],
    ['REF-SKILL', 'renamed', '.omp/skills/renamed/SKILL.md:8', false],
  ]);
  const message = (code, line) => findings.find((f) => f.code === code && f.evidence.endsWith(`:${line}`)).message;
  assert.match(message('REF-PATH', 8), /docs\/missing\.md.*\(줄 8\)/);
  assert.match(message('REF-SKILL', 10), /\/skill:agents\/kickoff/);
  assert.match(message('REF-SKILL', 8), /\/skill:nope/);
});

test('bodies: missing frontmatter, missing description and an unknown agent are flagged; known agents are not', (t) => {
  const root = repoFixture(t, {
    nofm: '# No frontmatter here\n',
    nodesc: skillMd('nodesc', 'Body.\n', null),
    // A YAML comment is not part of the name, and `null` is not a description.
    commented: '---\nname: commented # same as the directory\ndescription: null\n---\n',
    // "omp 에이전트 디렉터리" names omp itself (its agent directory), not a task agent.
    agents: skillMd('agents', 'Spawn the `reviewer` 에이전트, then the `scout` agent.\n1. critic 에이전트 (opus) 호출\nomp 에이전트 디렉터리를 읽습니다.\n'),
  });

  const { findings, lines } = tune.checkBodies({ repoRoot: root, skills: ['agents', 'commented', 'nodesc', 'nofm'], knownAgents: ['reviewer', 'scout'], expectedAbsent: {} });

  assert.deepEqual(findings.map((f) => [f.code, f.skill]).sort(), [['FM-DESC', 'commented'], ['FM-DESC', 'nodesc'], ['FM-MISSING', 'nofm'], ['REF-AGENT', 'agents']]);
  assert.match(findings.find((f) => f.code === 'REF-AGENT').message, /critic/);
  assert.equal(lines.nofm, 1);
});

test('bodies: gitignored and expected-absent paths are suppressed and counted, not reported', (t) => {
  const body = 'Runtime file `docs/harness/current-scope.md`, local archive `docs/sum/INDEX.md`, stale `docs/gone.md`.\n';
  const root = repoFixture(t, { alpha: skillMd('alpha', body) }, { '.gitignore': 'docs/sum/\n', 'docs/keep.md': 'x' });
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: root }).status, 0);

  const { findings, suppressed } = tune.checkBodies({
    repoRoot: root, skills: ['alpha'], knownAgents: [],
    expectedAbsent: { 'docs/harness/current-scope.md': 'exists only while a thread is open' },
  });

  assert.deepEqual(findings.map((f) => f.message.match(/docs\/[\w./-]+/)[0]), ['docs/gone.md']);
  assert.deepEqual(suppressed, { gitignored: 1, expected: 1 });
});

test('bodies: a SKILL.md past the size limit gets a size finding', (t) => {
  const root = repoFixture(t, { big: skillMd('big', 'line\n'.repeat(tune.MAX_SKILL_LINES)), small: skillMd('small') });

  const { findings, lines } = tune.checkBodies({ repoRoot: root, skills: ['big', 'small'], knownAgents: [], expectedAbsent: {} });

  assert.deepEqual(findings.map((f) => [f.code, f.skill, f.severity]), [['SIZE', 'big', 'low']]);
  assert.ok(lines.big > tune.MAX_SKILL_LINES && lines.small < 20);
});

// --- 4. Report -----------------------------------------------------------------------------

test('report: per-skill table with counts, and every finding carries id, severity, skill, file:line and a mechanical flag', (t) => {
  const root = repoFixture(t, {
    init: skillMd('init', 'Run `/skill:nope`.\n'),
    gamma: skillMd('gamma'),
  });
  const sessions = tmp(t, 'skill-tune-sessions-');
  put(sessions, '-r/2026-03-01_a.jsonl', jsonl([sessionHeader(root), execStart('t1', 'skill://init', '2026-03-01T10:00:00.000Z')]));
  const reservedPath = put(root, 'reserved.json', JSON.stringify(RESERVED));

  const result = tune.runCheck({
    repoRoot: root, sessionsDir: sessions, dbPath: join(root, 'absent.db'), repoPrefixes: [root],
    reservedPath, expectedAbsentPath: null, skillList: [], ompVersion: '9.9.9', now: '2026-11-13T00:00:00.000Z',
  });
  const report = tune.renderReport(result);

  assert.equal(result.findings.length, 2);
  const ids = new Set();
  for (const f of result.findings) {
    assert.match(f.id, /^[A-Z-]+-[a-z0-9-]+-[0-9a-f]{6}$/);
    assert.ok(['high', 'medium', 'low'].includes(f.severity));
    assert.match(f.evidence, /^\.omp\/skills\/[^:]+:\d+$/);
    assert.equal(typeof f.mechanical, 'boolean');
    ids.add(f.id);
    const row = report.split('\n').find((line) => line.includes(f.id));
    assert.ok(row, `finding ${f.id} has a report row`);
    for (const cell of [f.severity, f.skill, f.evidence]) assert.ok(row.includes(cell), `${f.id} row shows ${cell}`);
  }
  assert.equal(ids.size, result.findings.length, 'finding ids are unique');

  const cells = (name) => report.split('\n').find((line) => line.startsWith(`| \`${name}\` |`)).split('|').map((c) => c.trim());
  // | skill | lines | repo sessions | repo reads | repo last | all sessions | all reads | all last | /skill: | findings |
  assert.deepEqual(cells('init').slice(3, 9), ['1', '1', '2026-03-01', '1', '1', '2026-03-01']);
  assert.deepEqual(cells('gamma').slice(3, 9), ['0', '0', '-', '0', '0', '-']);
  assert.equal(cells('init')[9], '측정 불가');
  assert.equal(cells('init')[10], '2');
  assert.match(report, /omp 9\.9\.9/);
});

test('report: ids stay the same when unrelated lines shift', (t) => {
  const ids = (body) => {
    const root = repoFixture(t, { alpha: skillMd('alpha', body) });
    return tune.checkBodies({ repoRoot: root, skills: ['alpha'], knownAgents: [], expectedAbsent: {} }).findings.map((f) => f.id);
  };
  assert.deepEqual(ids('Use `/skill:nope`.\n'), ids('An added intro line.\n\nUse `/skill:nope`.\n'));
});

// CLI runs get their own home so the default skill directories never reach the developer's real ones.
const cliEnv = (home) => ({ ...process.env, HOME: home, USERPROFILE: home, PI_CODING_AGENT_DIR: '' });

test('cli: check exits 0 with every usage source missing, and still finds a copy in the home skill directories', (t) => {
  const root = repoFixture(t, { alpha: skillMd('alpha') });
  const home = tmp(t, 'skill-tune-home-');
  const copy = put(home, '.claude/skills/alpha/SKILL.md', skillMd('alpha'));

  // No omp binary: the loader's list is unavailable, the on-disk scan is not.
  const run = spawnSync(process.execPath, [scriptPath, 'check', '--repo', root, '--omp-bin', join(root, 'no-omp')], { encoding: 'utf8', env: cliEnv(home) });

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /\| `alpha` \|/);
  assert.match(run.stdout, /측정 불가/);
  const dup = run.stdout.split('\n').find((line) => line.includes('NAME-DUP-alpha-'));
  assert.ok(dup?.includes(copy), run.stdout);
});

test('cli: check refuses to write its report over anything under .omp/skills', (t) => {
  const root = repoFixture(t, { alpha: skillMd('alpha') });
  const listPath = put(root, 'list.json', JSON.stringify({ skills: [] }));
  const target = join(root, '.omp/skills/alpha/SKILL.md');

  const run = spawnSync(process.execPath, [
    scriptPath, 'check', '--repo', root, '--skill-list-json', listPath, '--omp-bin', join(root, 'no-omp'), '--out', target,
  ], { encoding: 'utf8', env: cliEnv(tmp(t, 'skill-tune-home-')) });

  assert.equal(run.status, 1);
  assert.equal(readFileSync(target, 'utf8'), skillMd('alpha'));
});

// --- 5. Reserved-name parsers (refresh-reserved) --------------------------------------------

test('reserved: only top-level slash commands and their aliases are taken from the builtin sources', () => {
  const source = [
    'export const BUILTIN_X_SLASH_COMMANDS: ReadonlyArray<SlashCommandSpec> = [',
    '\t{',
    '\t\tname: "skills",',
    '\t\tsubcommands: [',
    '\t\t\t{ name: "search", description: "Search" },',
    '\t\t\t{',
    '\t\t\t\tname: "install",',
    '\t\t\t},',
    '\t\t],',
    '\t},',
    '\t{',
    '\t\tname: "model",',
    '\t\taliases: ["models", "m"],',
    '\t},',
    '];',
  ].join('\n');

  assert.deepEqual(tune.parseBuiltinSlashCommands(source), { names: ['skills', 'model'], aliases: ['models', 'm'] });
});

test('reserved: bundled commands and CLI subcommands are parsed from their sources', () => {
  const embedded = 'const EMBEDDED_COMMANDS: { name: string; content: string }[] = [{ name: "init.md", content: prompt.render(initMd) }];';
  assert.deepEqual(tune.parseEmbeddedCommands(embedded), ['init']);

  const help = [
    'omp v1.2.3', '', 'USAGE', '  $ omp [COMMAND]', '', 'FLAGS', '      --model=<value>   Model to use', '',
    'COMMANDS', '  acp            Run omp as an ACP server', '  auth-broker    Manage the broker', '  sh             Run sh', '',
    'Environment Variables:', '  ANTHROPIC_API_KEY          - Anthropic Claude models',
  ].join('\n');
  assert.deepEqual(tune.parseCliCommands(help), ['acp', 'auth-broker', 'sh']);
});

test('reserved: a snapshot with an empty list is rejected before it can replace the baseline', () => {
  const snapshot = {
    builtin_commands: Array.from({ length: 30 }, (_, i) => `cmd${i}`), builtin_aliases: [],
    bundled_commands: ['init'], cli_subcommands: Array.from({ length: 12 }, (_, i) => `sub${i}`), bundled_agents: ['scout'],
  };
  assert.doesNotThrow(() => tune.assertPlausibleSnapshot(snapshot));
  // An upstream format change makes a parser return nothing; the names it guarded would vanish silently.
  for (const key of ['builtin_commands', 'bundled_commands', 'cli_subcommands', 'bundled_agents']) {
    assert.throws(() => tune.assertPlausibleSnapshot({ ...snapshot, [key]: [] }), new RegExp(key), key);
  }
});

// --- 6. The skill itself --------------------------------------------------------------------

test('the harness-skill-tune skill passes its own frontmatter checks', () => {
  const { findings } = tune.checkBodies({ repoRoot, skills: ['harness-skill-tune'], knownAgents: [], expectedAbsent: {} });
  assert.deepEqual(findings.filter((f) => f.code.startsWith('FM-')), []);
});
