// Tests for the harness-friction audit helpers (#129).
//
// Run: node --test .omp/extensions/harness/tests/harness-friction.test.mjs
//
// The skill is source-repo-only (not on the harness-sync whitelist), but this suite ships to
// consumers with the gates, so in a consumer tree it must skip, not fail — same arrangement as
// harness-skill-tune.test.mjs and docs-drift.test.mjs.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mkdtempReal } from './helpers/real-tmpdir.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..', '..');
const scriptPath = resolve(repoRoot, '.omp/skills/harness-friction/scripts/friction.mjs');
const SOURCE_ONLY_SKIP = existsSync(scriptPath) ? false : 'harness-friction is source-repo-only; not present in consumer repos';
const test = SOURCE_ONLY_SKIP ? (name, ...rest) => nodeTest(name, { skip: SOURCE_ONLY_SKIP }, rest.at(-1)) : nodeTest;
const friction = SOURCE_ONLY_SKIP ? {} : await import(pathToFileURL(scriptPath).href);

function tmp(t, prefix) {
  const dir = mkdtempReal(prefix);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function put(root, rel, content) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

const agentMd = (name, modelLine) => `---\nname: ${name}\ndescription: ${name} agent\n${modelLine === null ? '' : `model: ${modelLine}\n`}tools: read\n---\n\nBody.\n`;

// A catalog in the shape of `omp models --kind all --json`: two chat providers and a search kind.
const catalog = {
  models: [
    { provider: 'anthropic', kind: 'chat', id: 'claude-opus-5-5', selector: 'anthropic/claude-opus-5-5' },
    { provider: 'anthropic', kind: 'chat', id: 'claude-fable-5-1', selector: 'anthropic/claude-fable-5-1' },
    { provider: 'openai-codex', kind: 'chat', id: 'gpt-6-astra', selector: 'openai-codex/gpt-6-astra' },
    { provider: 'web', kind: 'search', id: 'exa', selector: 'web/exa' },
  ],
};

const roles = { advisor: 'openai-codex/gpt-6-astra:xhigh', slow: 'anthropic/claude-fable-5-1:high', task: 'anthropic/claude-opus-5-5:high', default: 'anthropic/claude-fable-5-1:high', web: 'web/exa' };

function fixtureRepo(t) {
  const root = tmp(t, 'friction-repo-');
  put(root, '.omp/agents/argon.md', agentMd('argon', '"google-antigravity/gemini-4-argon"'));
  put(root, '.omp/agents/opus.md', agentMd('opus', '"anthropic/claude-opus-5-5"'));
  put(root, '.omp/agents/gone.md', agentMd('gone', 'anthropic/claude-nope-9'));
  put(root, '.omp/agents/advisor.md', agentMd('advisor', '"@advisor"'));
  put(root, '.omp/agents/verifier.md', agentMd('verifier', '["@task", "@default"]'));
  put(root, '.omp/agents/plain.md', agentMd('plain', null));
  // Block-list form with a trailing comment on the key line; the body names a retired provider in a table.
  put(root, '.omp/agents/blocky.md', '---\nname: blocky\ndescription: b\nmodel: # list\n  - "@task"\n  - anthropic/claude-fable-5-1 # chat\n---\n\n| member | model |\n|---|---|\n| argon | `google-antigravity/gemini-4-argon` |\n');
  put(root, '.omp/rules/routing.md', [
    '# routing',
    'The panel pins `anthropic/claude-opus-5-5` and `google-antigravity/gemini-4-argon` (third family).',
    'Paths like `docs/harness/audit.jsonl` and tags like `harness/2026.90` are not models.',
    'A level suffix is fine: `openai-codex/gpt-6-astra:xhigh`.',
    '',
  ].join('\n'));
  put(root, 'AGENTS.md', '# AGENTS\n\nRole refs such as `@advisor` are not fixed; `anthropic/claude-fable-5-1` is.\n');
  return root;
}

const releases = [
  { tagName: 'v18.13.0', url: 'u/18.13.0', body: '- Google Antigravity requests now carry request labels ([#17012](x))\n' },
  { tagName: 'v18.18.4', url: 'u/18.18.4', body: '## pi-catalog\n\n### Changed\n\n- Paused Google Antigravity, since Google may restrict accounts ([#18622](x))\n' },
];

test('models: an unresolved fixed agent model is flagged with file:line; resolved fixed values and role refs are not', (t) => {
  const result = friction.checkModelRefs({ repoRoot: fixtureRepo(t), modelsJson: catalog, rolesJson: roles, releases });
  const byEvidence = Object.fromEntries(result.findings.map((f) => [f.evidence, f]));

  const argon = byEvidence['.omp/agents/argon.md:4'];
  assert.ok(argon, 'argon pinned to a paused provider must be flagged');
  assert.equal(argon.code, 'AGENT-MODEL');
  assert.equal(argon.status, 'provider-missing');
  assert.equal(argon.ref, 'google-antigravity/gemini-4-argon');
  // Only the pause bullet is cited — the request-label bullet has no removal word.
  assert.deepEqual(argon.releases.map((r) => r.tag), ['v18.18.4']);
  assert.match(argon.releases[0].bullet, /^Paused Google Antigravity/);

  const gone = byEvidence['.omp/agents/gone.md:4'];
  assert.ok(gone, 'a missing model under a known provider must be flagged');
  assert.equal(gone.status, 'model-missing');
  assert.deepEqual(gone.releases, []);

  const agentFindings = result.findings.filter((f) => f.code === 'AGENT-MODEL').map((f) => f.evidence).sort();
  assert.deepEqual(agentFindings, ['.omp/agents/argon.md:4', '.omp/agents/gone.md:4'], 'opus (resolved), advisor/verifier (role refs) and plain (no model) are not flagged');

  const roleRefs = result.agents.find((a) => a.file === '.omp/agents/verifier.md').refs;
  assert.deepEqual(roleRefs.map((r) => [r.ref, r.status]), [['@task', 'role'], ['@default', 'role']]);
  assert.equal(roleRefs[0].target.status, 'resolved', 'a role ref reports where modelRoles points, for information');
});

test('models: prose ids in rules/AGENTS.md are checked only for known providers; paths and tags are ignored', (t) => {
  const result = friction.checkModelRefs({ repoRoot: fixtureRepo(t), modelsJson: catalog, rolesJson: roles, releases });
  const rule = result.findings.filter((f) => f.code === 'RULE-MODEL');
  assert.deepEqual(rule.map((f) => [f.evidence, f.ref]), [['.omp/rules/routing.md:2', 'google-antigravity/gemini-4-argon']]);
  assert.equal(rule[0].releases.length, 1, 'the same release citation attaches to the rule finding');
});

test('models: a fixed agent model that resolves to a non-chat catalog kind is flagged as not-chat', (t) => {
  const root = tmp(t, 'friction-kind-');
  put(root, '.omp/agents/searcher.md', agentMd('searcher', '"web/exa"'));
  const result = friction.checkModelRefs({ repoRoot: root, modelsJson: catalog, rolesJson: null, releases: [] });
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].status, 'not-chat');
  assert.equal(result.findings[0].releases.length, 0);
});

test('models: the Markdown report names the unresolved reference, its evidence and the pausing release', (t) => {
  const result = friction.checkModelRefs({ repoRoot: fixtureRepo(t), modelsJson: catalog, rolesJson: roles, releases });
  const md = friction.renderModelReport(result, { from: '18.11.1', to: '18.18.6', releasesSupplied: true });
  assert.match(md, /구간: 18\.11\.1 → 18\.18\.6/);
  assert.match(md, /\| `\.omp\/agents\/argon\.md:4` \| `google-antigravity\/gemini-4-argon` \| 고정값 \| \*\*해석 안 됨\*\* \(provider-missing\) \|/);
  assert.match(md, /\| `\.omp\/agents\/opus\.md:4` \| `anthropic\/claude-opus-5-5` \| 고정값 \| 해석됨 \|/);
  assert.match(md, /\| `\.omp\/agents\/advisor\.md:4` \| `@advisor` \| 롤 참조 \| 검사 안 함 \(modelRoles → `openai-codex\/gpt-6-astra`: 해석됨\) \|/);
  assert.match(md, /- \*\*AGENT-MODEL\*\* `\.omp\/agents\/argon\.md:4` — `google-antigravity\/gemini-4-argon`: 프로바이더 `google-antigravity`가 현재 omp 카탈로그에 없습니다\.\n {2}- v18\.18\.4: Paused Google Antigravity/);
  assert.match(md, /- \*\*AGENT-MODEL\*\* `\.omp\/agents\/gone\.md:4`[^\n]*\n {2}- \(구간 릴리스 노트에 이 프로바이더의 중지·제거 언급 없음\)/);
  assert.ok(!md.includes('릴리스 기록 없음'), 'releases were supplied, so the hint is absent');
  const noReleases = friction.renderModelReport(friction.checkModelRefs({ repoRoot: fixtureRepo(t), modelsJson: catalog, rolesJson: roles, releases: [] }));
  assert.match(noReleases, /- 릴리스 기록 없음 — `--releases-json`을 주면/);
  assert.ok(!noReleases.includes('언급 없음'), 'without releases the "no mention" line would be a false claim');
});

test('models: a clean repo reports zero findings', (t) => {
  const root = tmp(t, 'friction-clean-');
  put(root, '.omp/agents/opus.md', agentMd('opus', '"anthropic/claude-opus-5-5"'));
  put(root, '.omp/agents/rev.md', agentMd('rev', '"@slow"'));
  put(root, 'AGENTS.md', 'See `anthropic/claude-fable-5-1`.\n');
  const result = friction.checkModelRefs({ repoRoot: root, modelsJson: catalog, rolesJson: roles, releases });
  assert.deepEqual(result.findings, []);
  assert.match(friction.renderModelReport(result), /## 지적 \(0건\)\n\n해석되지 않는 고정 모델 참조가 없습니다\./);
});

test('agentModelRefs: scalar, quoted, inline-list, block-list, trailing comment and absent model lines', () => {
  assert.deepEqual(friction.agentModelRefs('---\nname: a\nmodel: "x/y"\n---\n'), { line: 3, refs: ['x/y'] });
  assert.deepEqual(friction.agentModelRefs('---\nmodel: @slow\nname: a\n---\n'), { line: 2, refs: ['@slow'] });
  assert.deepEqual(friction.agentModelRefs('---\nmodel: ["@task", "@default"]\n---\n'), { line: 2, refs: ['@task', '@default'] });
  assert.deepEqual(friction.agentModelRefs('---\nmodel: "x/y" # pinned\n---\n'), { line: 2, refs: ['x/y'] });
  assert.deepEqual(friction.agentModelRefs('---\nmodel:\n  - "@task"\n  - x/y # chat\ntools: read\n---\n'), { line: 2, refs: ['@task', 'x/y'] });
  assert.deepEqual(friction.agentModelRefs('---\nmodel:\n- "@task"\n# comment line\n\n- x/y:off\ntools: read\n---\n'), { line: 2, refs: ['@task', 'x/y:off'] }, '0-indent list with a comment and a blank line');
  assert.deepEqual(friction.agentModelRefs('---\nmodel:\ntools: read\n---\n'), { line: 2, refs: [] }, 'an empty key has no refs');
  assert.equal(friction.agentModelRefs('---\nname: a\n---\n'), null);
  assert.equal(friction.agentModelRefs('no frontmatter\nmodel: x/y\n'), null);
});

test('models: block-list agents are checked and an agent BODY naming a retired provider is flagged as AGENT-PROSE', (t) => {
  const result = friction.checkModelRefs({ repoRoot: fixtureRepo(t), modelsJson: catalog, rolesJson: roles, releases });
  const blocky = result.agents.find((a) => a.file === '.omp/agents/blocky.md');
  assert.deepEqual(blocky.refs.map((r) => [r.ref, r.status]), [['@task', 'role'], ['anthropic/claude-fable-5-1', 'resolved']]);
  const prose = result.findings.filter((f) => f.code === 'AGENT-PROSE');
  assert.deepEqual(prose.map((f) => [f.evidence, f.ref]), [['.omp/agents/blocky.md:11', 'google-antigravity/gemini-4-argon']]);
});

test('models: a retired provider named only in a rule is still checked (KNOWN_PROVIDERS floor)', (t) => {
  const root = tmp(t, 'friction-floor-');
  put(root, '.omp/agents/opus.md', agentMd('opus', '"anthropic/claude-opus-5-5"'));
  put(root, '.omp/rules/r.md', 'Third family: `google-antigravity/gemini-4-argon`.\n');
  const result = friction.checkModelRefs({ repoRoot: root, modelsJson: catalog, rolesJson: {}, releases: [] });
  assert.deepEqual(result.findings.map((f) => [f.code, f.evidence]), [['RULE-MODEL', '.omp/rules/r.md:1']]);
});

test('releaseMentions: provider name needs word boundaries and a real removal word', () => {
  const rel = (body) => [{ tagName: 'v1', url: 'u', body }];
  assert.equal(friction.releaseMentions(rel('- Fixed the webview dropdown removing items'), 'web').length, 0, '"webview" is not the web provider');
  assert.equal(friction.releaseMentions(rel('- Paused Google Antigravity'), 'google-antigravity').length, 1);
  assert.equal(friction.releaseMentions(rel('- Google Antigravity requests now carry labels'), 'google-antigravity').length, 0, 'no removal word');
  assert.equal(friction.releaseMentions(rel('- The dropdown for xai-oauth is wider'), 'xai-oauth').length, 0, '"dropdown" is not "drop"');
});

test('assertListCoversBaseline: a listing that never reaches the baseline is a truncated listing', () => {
  const ok = [{ tagName: 'v18.18.6' }, { tagName: 'v18.11.1' }];
  assert.doesNotThrow(() => friction.assertListCoversBaseline(ok, '18.11.1'));
  assert.throws(() => friction.assertListCoversBaseline([{ tagName: 'v18.18.6' }, { tagName: 'v18.12.0' }], '18.11.1'), /목록이 잘렸거나/);
});

test('releasesInRange: (baseline, to] ascending, drafts/prereleases and non-semver tags excluded', () => {
  const list = [
    { tagName: 'v18.19.0', isDraft: false, isPrerelease: false },
    { tagName: 'v18.18.6', isDraft: false, isPrerelease: false },
    { tagName: 'v18.18.4', isDraft: false, isPrerelease: false },
    { tagName: 'v18.18.5-rc.1', isDraft: false, isPrerelease: true },
    { tagName: 'v18.11.2', isDraft: false, isPrerelease: false },
    { tagName: 'v18.11.1', isDraft: false, isPrerelease: false },
    { tagName: 'v18.12.0', isDraft: true, isPrerelease: false },
    { tagName: 'nightly', isDraft: false, isPrerelease: false },
    { tagName: 'v18.9.9', isDraft: false, isPrerelease: false },
  ];
  assert.deepEqual(friction.releasesInRange(list, '18.11.1', '18.18.6').map((r) => r.tagName), ['v18.11.2', 'v18.18.4', 'v18.18.6']);
  assert.deepEqual(friction.releasesInRange(list, '18.18.6', '18.18.6'), []);
});

test('compareVersions orders numerically, not lexically', () => {
  assert.ok(friction.compareVersions('18.9.9', '18.11.1') < 0);
  assert.ok(friction.compareVersions('v18.18.10', '18.18.9') > 0);
  assert.equal(friction.compareVersions('18.18.6', 'omp/18.18.6'), 0);
  assert.throws(() => friction.compareVersions('18.18', '18.18.6'), /버전 형식이 아닙니다/);
});

test('nextBaseline: moves the current entry into history, refuses regressions and missing report', () => {
  const current = { omp_version: '18.11.1', audited_at: '2026-10-16', report: 'r1.md', history: [{ omp_version: '18.3.0', audited_at: '2026-09-24', report: 'r0' }] };
  const next = friction.nextBaseline(current, { version: '18.18.6', report: 'r2.md', date: '2026-11-13' });
  assert.deepEqual(next, {
    omp_version: '18.18.6', audited_at: '2026-11-13', report: 'r2.md',
    history: [{ omp_version: '18.3.0', audited_at: '2026-09-24', report: 'r0' }, { omp_version: '18.11.1', audited_at: '2026-10-16', report: 'r1.md' }],
  });
  assert.throws(() => friction.nextBaseline(current, { version: '18.10.0', report: 'r.md', date: '2026-11-13' }), /낮습니다/);
  assert.throws(() => friction.nextBaseline(current, { version: '18.18.6', report: '', date: '2026-11-13' }), /--report/);
  assert.throws(() => friction.nextBaseline(current, { version: '18.11.1', report: 'r.md', date: '2026-11-13' }), /이미 기준 버전/);
  assert.throws(() => friction.nextBaseline(current, { version: '18.18.6', report: 'r.md', date: '11/13/2026' }), /--date/);
  assert.throws(() => friction.nextBaseline(current, { version: '18.18.6', report: 'missing.md', date: '2026-11-13', reportExists: () => false }), /--report 경로가 리포에 없습니다/);
  assert.throws(() => friction.nextBaseline(current, { version: '18.19.0-rc.1', report: 'r.md', date: '2026-11-13' }), /--set은 x\.y\.z/);
  assert.throws(() => friction.nextBaseline(current, { version: '18.18.6', report: 'r.md', date: '2026-13-45' }), /실제 날짜/);
});

test('CLI: range reads the committed baseline and installed omp, or --from/--to; models runs on fixture inputs', (t) => {
  const root = fixtureRepo(t);
  const modelsFile = put(root, 'models.json', JSON.stringify(catalog));
  const rolesFile = put(root, 'roles.json', JSON.stringify(roles));
  const releasesFile = put(root, 'releases.json', JSON.stringify({ from: '18.11.1', to: '18.18.6', releases }));

  const range = spawnSync(process.execPath, [scriptPath, 'range', '--from', '18.11.1', '--to', '18.18.6'], { encoding: 'utf8' });
  assert.equal(range.status, 0, range.stderr);
  assert.equal(range.stdout, '기준 18.11.1 → 대상 18.18.6\n');
  const bad = spawnSync(process.execPath, [scriptPath, 'range', '--from', '18.19.0', '--to', '18.18.6'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /기준 버전\(18\.19\.0\)이 대상 버전\(18\.18\.6\)보다 큽니다/);

  const baseline = JSON.parse(readFileSync(resolve(repoRoot, '.omp/skills/harness-friction/baseline.json'), 'utf8'));
  assert.match(baseline.omp_version, /^\d+\.\d+\.\d+$/, 'the committed baseline is a version');
  assert.ok(existsSync(resolve(repoRoot, baseline.report)), `baseline.report must exist: ${baseline.report}`);

  const models = spawnSync(process.execPath, [scriptPath, 'models', '--repo', root, '--models-json', modelsFile, '--roles-json', rolesFile, '--releases-json', releasesFile, '--format', 'json'], { encoding: 'utf8' });
  assert.equal(models.status, 0, models.stderr);
  const parsed = JSON.parse(models.stdout);
  assert.deepEqual(parsed.findings.map((f) => f.evidence).sort(), ['.omp/agents/argon.md:4', '.omp/agents/blocky.md:11', '.omp/agents/gone.md:4', '.omp/rules/routing.md:2']);
  const out = join(root, 'report.md');
  const md = spawnSync(process.execPath, [scriptPath, 'models', '--repo', root, '--models-json', modelsFile, '--roles-json', rolesFile, '--releases-json', releasesFile, '--out', out], { encoding: 'utf8' });
  assert.equal(md.status, 0, md.stderr);
  assert.equal(md.stdout, `지적 4건 -> ${out}\n`);
  assert.match(readFileSync(out, 'utf8'), /^# 모델 참조 생존 검사\n/);
});
