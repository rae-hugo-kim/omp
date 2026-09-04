// harness-sync.test.mjs — end-to-end contract of scripts/harness-sync.sh against a
// local file:// source. Nothing here touches the network.
//
// Contract under test:
//   (#24) a whitelist entry that exists only in the TARGET tag's script lands on the
//         consumer's FIRST sync — the consumer's stale local script hands execution
//         to the fetched tag's own copy (step 4b) instead of applying its old PATHS.
//   (#24) --dry-run reports the new entry for the same reason.
//   (#26) after a sync, core.hooksPath points at .githooks (idempotent; reported).
//   (#17) the gate tests under .omp/extensions/harness/tests arrive with the gates.
//   regression: a consumer whose script already equals the target's runs without a
//         hand-off and still produces the same result.
//
// Fixture: a bare "source" repo tagged harness/2026.99 whose tree is a pruned copy
// of this repo's harness assets plus one extra whitelist entry (docs/new-item.md);
// a consumer repo carrying THIS repo's script (which lacks that entry) and a meta
// pointing at the bare source via file://.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync, cpSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..');
const SYNC = join(repoRoot, 'scripts', 'harness-sync.sh');

// Hermetic env: an ambient GIT_DIR / GIT_WORK_TREE / GIT_INDEX_FILE (e.g. from a hook) would
// redirect every fixture git call at the wrong repo. Strip all GIT_* and the sync's own knobs —
// from this process too, since assessRisk() is imported and runs git in-process.
for (const k of Object.keys(process.env)) if (k.startsWith('GIT_') || k.startsWith('_HARNESS_SYNC_')) delete process.env[k];
function cleanEnv(extra = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('GIT_') && !k.startsWith('_HARNESS_SYNC_')) env[k] = v;
  return { ...env, ...extra };
}

function git(cwd, args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd, encoding: 'utf-8', env: cleanEnv() });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

const NEW_ENTRY = 'docs/rules/new-item.md';
const NEW_ENTRY_LINE = `  "${NEW_ENTRY}"\n)`;

// Minimal harness tree copied from this repo: enough for the script's PATHS loop to
// have real things to copy, without dragging the whole repo into every fixture.
const SEED = ['scripts/harness-sync.sh', 'rules', '.githooks', '.omp/extensions/harness', '.omp/agents'];

function seedTree(dir, { withNewEntry }) {
  for (const p of SEED) {
    const src = join(repoRoot, p);
    if (!existsSync(src)) continue;
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    cpSync(src, join(dir, p), { recursive: true });
  }
  rmSync(join(dir, '.omp', 'extensions', 'harness', 'tests', 'harness-sync.test.mjs'), { force: true });
  rmSync(join(dir, '.omp', 'state'), { recursive: true, force: true });
  const script = join(dir, 'scripts', 'harness-sync.sh');
  let text = readFileSync(script, 'utf-8');
  if (withNewEntry) {
    // Append one whitelist entry at the end of PATHS=( ... ). The file it names is
    // under docs/ (consumer space) so the copy path is the individual-file branch.
    text = text.replace(/\n\)\n/, `\n${NEW_ENTRY_LINE}\n`);
    assert.ok(text.includes(`"${NEW_ENTRY}"`), 'fixture: failed to inject the new PATHS entry');
    mkdirSync(join(dir, 'docs', 'rules'), { recursive: true });
    writeFileSync(join(dir, NEW_ENTRY), '# shipped by the target tag\n');
  }
  writeFileSync(script, text);
  chmodSync(script, 0o755);
}

function makeFixture({ consumerHasNewEntry = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hsync-'));
  const bare = join(root, 'source.git');
  const work = join(root, 'source-work');
  const consumer = join(root, 'consumer');

  // Source: tree + annotated tag harness/2026.99 pushed to a bare remote.
  git(root, ['init', '-q', '--bare', bare]);
  git(root, ['init', '-q', work]);
  seedTree(work, { withNewEntry: true });
  writeFileSync(join(work, '.omp', 'extensions', 'harness', 'harness-meta.json'),
    JSON.stringify({ version: '2026.99', updated: '2026-09-03', description: 'fixture source' }, null, 2));
  git(work, ['add', '-A']);
  git(work, ['commit', '-q', '-m', 'source tree']);
  git(work, ['tag', '-a', '-m', 'harness 2026.99', 'harness/2026.99']);
  git(work, ['push', '-q', bare, 'HEAD:refs/heads/main', 'refs/tags/harness/2026.99']);

  // Consumer: this repo's (older) script, a meta pointing at the bare source, an
  // origin that does NOT match the source-repo self-skip pattern, hooks unset.
  git(root, ['init', '-q', consumer]);
  git(consumer, ['remote', 'add', 'origin', 'git@example.com:someone/consumer.git']);
  seedTree(consumer, { withNewEntry: consumerHasNewEntry });
  // Stale baseline: an older consumer has different gate/rule content than the tag, so a sync
  // produces the multi-file diff the commit gates see in practice (not just meta + script).
  for (const f of ['gates/risk-assess.mjs', 'gates/review-gate.mjs', 'gates/backpressure-gate.mjs', 'gates/acceptance-gate.mjs']) {
    const p = join(consumer, '.omp', 'extensions', 'harness', f);
    writeFileSync(p, `// stale consumer copy\n${readFileSync(p, 'utf-8')}`);
  }
  rmSync(join(consumer, 'rules'), { recursive: true, force: true });
  mkdirSync(join(consumer, 'rules'));
  writeFileSync(join(consumer, 'rules', 'INDEX.md'), '# stale\n');
  writeFileSync(join(consumer, '.omp', 'extensions', 'harness', 'harness-meta.json'),
    JSON.stringify({ version: '2026.50', updated: '2026-01-01', description: 'consumer', source_remote: `file://${bare}`, commit_sha: 'deadbeef', bootstrapped_at: '2026-01-01T00:00:00Z' }, null, 2));
  git(consumer, ['add', '-A']);
  git(consumer, ['commit', '-q', '-m', 'consumer baseline']);
  return { root, consumer, bare };
}

function withFixture(opts, fn) {
  const fx = makeFixture(opts);
  try { return fn(fx); } finally { rmSync(fx.root, { recursive: true, force: true }); }
}

function runSync(consumer, args = []) {
  return spawnSync('bash', [join(consumer, 'scripts', 'harness-sync.sh'), ...args], { cwd: consumer, encoding: 'utf-8', env: cleanEnv() });
}

test('#24: a whitelist entry known only to the target tag lands on the FIRST sync', () => {
  withFixture({}, (fx) => {
    assert.ok(!existsSync(join(fx.consumer, NEW_ENTRY)), 'precondition: consumer lacks the new entry');
    const r = runSync(fx.consumer);
    assert.equal(r.status, 0, `sync failed:\n${r.stdout}\n${r.stderr}`);
    assert.match(r.stdout, /Running harness\/2026\.99's own sync script/, 'the local script must hand off to the fetched one');
    assert.ok(existsSync(join(fx.consumer, NEW_ENTRY)), 'the target tag\'s new whitelist entry must arrive on the first sync, not the second');
    const meta = JSON.parse(readFileSync(join(fx.consumer, '.omp', 'extensions', 'harness', 'harness-meta.json'), 'utf-8'));
    assert.equal(meta.version, '2026.99');
    assert.equal(meta.bootstrapped_at, '2026-01-01T00:00:00Z', 'bootstrapped_at must be preserved across the hand-off');
    assert.equal(meta.source_remote, `file://${fx.bare}`);
    // The consumer's own script is now the target's copy: a second run needs no hand-off.
    const again = runSync(fx.consumer);
    assert.equal(again.status, 0);
    assert.doesNotMatch(again.stdout, /own sync script/, 'once scripts match, no hand-off happens');
  });
});

test('#24: --dry-run also reports the target tag\'s new entry', () => {
  withFixture({}, (fx) => {
    const r = runSync(fx.consumer, ['--dry-run']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`WRITE\\s+${NEW_ENTRY.replaceAll('/', '\\/')}`), 'dry-run must list the entry the consumer\'s stale script does not know');
    assert.ok(!existsSync(join(fx.consumer, NEW_ENTRY)), 'dry-run must not write');
  });
});

test('#26: sync activates core.hooksPath=.githooks and reports it; a second sync leaves it unchanged', () => {
  withFixture({}, (fx) => {
    const first = runSync(fx.consumer);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /hooksPath=\.githooks \(was: unset\)/);
    assert.equal(git(fx.consumer, ['config', '--get', 'core.hooksPath']).trim(), '.githooks');
    const second = runSync(fx.consumer);
    assert.match(second.stdout, /hooksPath unchanged/);
  });
});

test('#17: gate tests ship with the gates', () => {
  withFixture({}, (fx) => {
    rmSync(join(fx.consumer, '.omp', 'extensions', 'harness', 'tests'), { recursive: true, force: true });
    const r = runSync(fx.consumer);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(fx.consumer, '.omp', 'extensions', 'harness', 'tests', 'harness-version-check.test.mjs')), 'tests/ must arrive under the synced harness directory');
  });
});

test('regression: identical local and target scripts sync without a hand-off', () => {
  withFixture({ consumerHasNewEntry: true }, (fx) => {
    const r = runSync(fx.consumer);
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout, /own sync script/);
    assert.ok(existsSync(join(fx.consumer, NEW_ENTRY)));
    assert.match(r.stdout, /Synced to harness\/2026\.99/);
  });
});

test('consumer-custom agent survives a sync (agents are listed per file, not swept)', () => {
  withFixture({}, (fx) => {
    const custom = join(fx.consumer, '.omp', 'agents', 'my-domain-agent.md');
    writeFileSync(custom, '---\nname: my-domain-agent\n---\nconsumer-owned\n');
    const r = runSync(fx.consumer);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(custom), 'a consumer agent next to the harness agents must not be deleted by the sync');
    assert.ok(existsSync(join(fx.consumer, '.omp', 'agents', 'verifier.md')), 'harness agents still arrive');
  });
});

// --- Commit gates on sync commits (handoff 2026-09-02, option C) ---
// After a sync the consumer commits a multi-thousand-line diff that risk-assess used to score
// HIGH unconditionally, blocking on backpressure + review evidence every time. The manifest
// written by the sync lets the gates recognise byte-exact copies of the tag and score only
// the remainder. These run the REAL .githooks/pre-commit in the fixture repo.

function commit(consumer, msg) {
  return spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', msg], {
    cwd: consumer, encoding: 'utf-8',
    // hermetic: the gates must not see this test process's session env
    env: cleanEnv({ OMP_COMMIT_WIP: '', HARNESS_DEBUG: '' }),
  });
}

test('AC1: a pure harness-sync commit passes the commit gates with no override files', () => {
  withFixture({}, (fx) => {
    const r = runSync(fx.consumer);
    assert.equal(r.status, 0, r.stderr);
    const manifest = JSON.parse(readFileSync(join(fx.consumer, '.omp', 'extensions', 'harness', 'harness-manifest.json'), 'utf-8'));
    assert.equal(manifest.version, '2026.99');
    assert.ok(Object.keys(manifest.files).length > 20, 'manifest must list the synced files');
    assert.ok(Object.values(manifest.files).every((s) => /^[0-9a-f]{40}$/.test(s)), 'manifest values are blob shas');

    git(fx.consumer, ['add', '-A']);
    const staged = git(fx.consumer, ['diff', '--cached', '--shortstat']);
    assert.match(staged, /\d+ files? changed/, 'precondition: the sync produced a real diff');
    const c = commit(fx.consumer, 'chore: harness-sync 2026.99');
    assert.equal(c.status, 0, `pure sync commit must pass without review-skip/backpressure-skip:\n${c.stdout}\n${c.stderr}`);
    assert.doesNotMatch(c.stderr, /HARNESS BLOCK/);
    // AC3: the exemption is audited as its own event type, consumed by post-commit.
    const audit = readFileSync(join(fx.consumer, 'docs', 'harness', 'audit.jsonl'), 'utf-8');
    const events = audit.trim().split('\n').map((l) => JSON.parse(l));
    const ev = events.find((e) => e.event === 'harness_sync');
    assert.ok(ev, `audit.jsonl must record a harness_sync event, got: ${audit}`);
    assert.equal(ev.meta.version, '2026.99');
    assert.ok(ev.meta.synced_files > 20);
    assert.equal(ev.meta.other_files, 2, 'only harness-meta.json + harness-manifest.json fall outside the manifest');
    assert.ok(!existsSync(join(fx.consumer, '.omp', 'harness-state', 'pending-consume', 'append-audit-harness-sync.json')), 'intent consumed');
  });
});

test('AC2: user code mixed into a sync commit is still scored normally (no bypass)', () => {
  withFixture({}, (fx) => {
    const r = runSync(fx.consumer);
    assert.equal(r.status, 0, r.stderr);
    mkdirSync(join(fx.consumer, 'src'), { recursive: true });
    writeFileSync(join(fx.consumer, 'src', 'big.ts'), Array.from({ length: 150 }, (_, i) => `export const v${i} = ${i};`).join('\n') + '\n');
    git(fx.consumer, ['add', '-A']);
    const c = commit(fx.consumer, 'feat: sneak code in with the sync');
    assert.notEqual(c.status, 0, 'a >100-line code change riding on a sync commit must still be gated');
    assert.match(c.stderr, /HARNESS BLOCK/);
    assert.match(c.stderr, /high risk|review evidence|verification/i);
  });
});

test('AC2b: a tampered synced file (content differs from the tag) is not exempt', async () => {
  // The source repo's own risk-assess (the same code the fixture synced) reads the fixture's
  // manifest and index — no commit needed to observe the verdict.
  const { assessRisk } = await import(pathToFileURL(join(repoRoot, '.omp', 'extensions', 'harness', 'gates', 'risk-assess.mjs')).href);
  withFixture({}, (fx) => {
    const r = runSync(fx.consumer);
    assert.equal(r.status, 0, r.stderr);
    git(fx.consumer, ['add', '-A']);
    const pure = assessRisk(fx.consumer, { all: false, verifiable: true });
    assert.equal(pure.level, 'low', `pure sync must be low, got ${pure.level}: ${pure.reason}`);
    assert.ok(pure.synced.includes('.omp/extensions/harness/gates/risk-assess.mjs'));

    // Edit a synced gate in place: same path as in the manifest, different blob.
    const gate = join(fx.consumer, '.omp', 'extensions', 'harness', 'gates', 'risk-assess.mjs');
    writeFileSync(gate, readFileSync(gate, 'utf-8') + '\nexport const tampered = true;\n');
    git(fx.consumer, ['add', '-A']);
    const risk = assessRisk(fx.consumer, { all: false, verifiable: true });
    assert.ok(!risk.synced.includes('.omp/extensions/harness/gates/risk-assess.mjs'), 'a modified file must not be treated as synced');
    assert.notEqual(risk.level, 'low', `the tampered remainder must be scored, got ${risk.level}: ${risk.reason}`);
    assert.ok(risk.files.includes('.omp/extensions/harness/gates/risk-assess.mjs'));
  });
});

// --- Review 2026-09-05 regressions ---

test('H1: a forged manifest cannot exempt a non-harness path, nor a harness path whose blob differs from the tag', async () => {
  const { assessRisk } = await import(pathToFileURL(join(repoRoot, '.omp', 'extensions', 'harness', 'gates', 'risk-assess.mjs')).href);
  withFixture({}, (fx) => {
    assert.equal(runSync(fx.consumer).status, 0);
    git(fx.consumer, ['add', '-A']);
    git(fx.consumer, ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'sync', '--no-verify']);
    // Attack 1: exempt src/auth.ts by listing its blob in the manifest.
    mkdirSync(join(fx.consumer, 'src'), { recursive: true });
    writeFileSync(join(fx.consumer, 'src', 'auth.ts'), Array.from({ length: 120 }, (_, i) => `export const k${i} = "${i}";`).join('\n') + '\n');
    git(fx.consumer, ['add', '-A']);
    const blob = git(fx.consumer, ['ls-files', '-s', 'src/auth.ts']).split(/\s+/)[1];
    const mPath = join(fx.consumer, '.omp', 'extensions', 'harness', 'harness-manifest.json');
    const manifest = JSON.parse(readFileSync(mPath, 'utf-8'));
    manifest.files['src/auth.ts'] = blob;
    writeFileSync(mPath, JSON.stringify(manifest, null, 2));
    git(fx.consumer, ['add', '-A']);
    let risk = assessRisk(fx.consumer, { all: false, verifiable: true });
    assert.ok(!risk.synced.includes('src/auth.ts'), 'a non-harness path must never be exempt, whatever the manifest says');
    assert.ok(['high', 'critical'].includes(risk.level), `forged manifest must not lower the level, got ${risk.level}: ${risk.reason}`);

    // Attack 2: a harness path with tampered content, manifest sha rewritten to match.
    const gate = '.omp/extensions/harness/gates/risk-assess.mjs';
    writeFileSync(join(fx.consumer, gate), readFileSync(join(fx.consumer, gate), 'utf-8') + '\nexport const evil = 1;\n');
    git(fx.consumer, ['add', '-A']);
    manifest.files[gate] = git(fx.consumer, ['ls-files', '-s', gate]).split(/\s+/)[1];
    writeFileSync(mPath, JSON.stringify(manifest, null, 2));
    git(fx.consumer, ['add', '-A']);
    risk = assessRisk(fx.consumer, { all: false, verifiable: true });
    assert.ok(!risk.synced.includes(gate), 'the tag tree, not the manifest, decides — tampered blob is scored');

    // Attack 3: manifest tree_sha not matching refs/harness/<ver> => exempts nothing.
    manifest.tree_sha = 'f'.repeat(40);
    writeFileSync(mPath, JSON.stringify(manifest, null, 2));
    risk = assessRisk(fx.consumer, { all: false, verifiable: true });
    assert.deepEqual(risk.synced, [], 'manifest tree_sha not matching the local synced-tree ref => no exemption at all');
  });
});

test('M3: a mode-only change to a synced hook is not exempt', async () => {
  const { assessRisk } = await import(pathToFileURL(join(repoRoot, '.omp', 'extensions', 'harness', 'gates', 'risk-assess.mjs')).href);
  withFixture({}, (fx) => {
    assert.equal(runSync(fx.consumer).status, 0);
    git(fx.consumer, ['add', '-A']);
    git(fx.consumer, ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'sync', '--no-verify']);
    git(fx.consumer, ['update-index', '--chmod=-x', '.githooks/pre-commit']);
    const risk = assessRisk(fx.consumer, { all: false, verifiable: true });
    assert.ok(risk.files.includes('.githooks/pre-commit'), 'disarming a hook via mode must be scored, not exempted');
    assert.deepEqual(risk.synced, []);
  });
});

// Publish a new tag from the fixture's source work tree after applying `mutate(workDir)`.
function publishTag(fx, version, mutate) {
  const work = join(fx.root, 'source-work');
  mutate(work);
  git(work, ['add', '-A']);
  git(work, ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '--allow-empty', '-m', `tag ${version}`]);
  git(work, ['tag', '-a', '-m', `harness ${version}`, `harness/${version}`]);
  git(work, ['push', '-q', fx.bare, 'HEAD:refs/heads/main', `refs/tags/harness/${version}`]);
}
const commitNoVerify = (dir, msg) => git(dir, ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', msg, '--no-verify']);

test('upstream deletion: exempt only when the PREVIOUS synced tree carried the path; consumer-owned files under a harness prefix are scored', async () => {
  const { assessRisk } = await import(pathToFileURL(join(repoRoot, '.omp', 'extensions', 'harness', 'gates', 'risk-assess.mjs')).href);
  withFixture({}, (fx) => {
    const OLD = '.omp/extensions/harness/gates/old-gate.mjs';
    // 2026.100 ships old-gate; the consumer syncs it and commits.
    publishTag(fx, '2026.100', (w) => writeFileSync(join(w, OLD), '// shipped then retired\n'.repeat(120)));
    assert.equal(runSync(fx.consumer).status, 0);
    git(fx.consumer, ['add', '-A']); commitNoVerify(fx.consumer, 'sync 100');
    // The consumer also owns a deploy skill under a harness prefix.
    const MINE = '.omp/skills/deploy/run.sh';
    mkdirSync(join(fx.consumer, '.omp', 'skills', 'deploy'), { recursive: true });
    writeFileSync(join(fx.consumer, MINE), '#!/bin/sh\n' + 'echo deploy\n'.repeat(300));
    git(fx.consumer, ['add', '-A']); commitNoVerify(fx.consumer, 'my skill');
    // 2026.101 retires old-gate upstream.
    publishTag(fx, '2026.101', (w) => rmSync(join(w, OLD)));
    assert.equal(runSync(fx.consumer).status, 0);
    assert.ok(!existsSync(join(fx.consumer, OLD)), 'sync removed the retired gate');
    assert.ok(existsSync(join(fx.consumer, MINE)), 'sync must not touch the consumer skill');
    git(fx.consumer, ['add', '-A']);
    let risk = assessRisk(fx.consumer, { all: false, verifiable: true });
    assert.ok(risk.synced.includes(OLD), 'a deletion implied by the previous->current synced trees counts as synced');
    assert.equal(risk.level, 'low', `pure sync incl. upstream deletion must be low, got ${risk.level}: ${risk.reason}`);
    commitNoVerify(fx.consumer, 'sync 101');
    // Round-3: a consumer-EDITED copy of a retired path is not the synced copy — scored.
    publishTag(fx, '2026.102', (w) => writeFileSync(join(w, OLD), '// back for one version\n'.repeat(120)));
    assert.equal(runSync(fx.consumer).status, 0);
    git(fx.consumer, ['add', '-A']); commitNoVerify(fx.consumer, 'sync 102');
    writeFileSync(join(fx.consumer, OLD), '// consumer rewrote this\n'.repeat(300));
    git(fx.consumer, ['add', '-A']); commitNoVerify(fx.consumer, 'consumer edit of a harness file');
    publishTag(fx, '2026.103', (w) => rmSync(join(w, OLD)));
    assert.equal(runSync(fx.consumer).status, 0);
    git(fx.consumer, ['add', '-A']);
    risk = assessRisk(fx.consumer, { all: false, verifiable: true });
    assert.ok(!risk.synced.includes(OLD), 'HEAD held a consumer-edited copy, not the previous synced blob: its deletion is scored');
    assert.ok(risk.files.includes(OLD));
    commitNoVerify(fx.consumer, 'sync 103');
    // Deleting the consumer-owned skill: never in any synced tree => scored (round-2 H).
    git(fx.consumer, ['rm', '-q', MINE]);
    risk = assessRisk(fx.consumer, { all: false, verifiable: true });
    assert.ok(!risk.synced.includes(MINE), 'a consumer-owned file under a harness prefix is not an upstream deletion');
    assert.ok(risk.files.includes(MINE));
    assert.notEqual(risk.level, 'low');
    git(fx.consumer, ['reset', '-q', '--hard']);
    // Deleting a gate the current tree still carries: scored.
    git(fx.consumer, ['rm', '-q', '.omp/extensions/harness/gates/review-gate.mjs']);
    risk = assessRisk(fx.consumer, { all: false, verifiable: true });
    assert.ok(risk.files.includes('.omp/extensions/harness/gates/review-gate.mjs'), 'removing a gate the tag still ships must be scored');
  });
});

test('downgrade: a stale manifest naming the previous ref exempts nothing; only the highest refs/harness/* counts; older refs are pruned', async () => {
  const { assessRisk } = await import(pathToFileURL(join(repoRoot, '.omp', 'extensions', 'harness', 'gates', 'risk-assess.mjs')).href);
  withFixture({}, (fx) => {
    const GATE = '.omp/extensions/harness/gates/review-gate.mjs';
    publishTag(fx, '2026.100', (w) => writeFileSync(join(w, GATE), readFileSync(join(w, GATE), 'utf-8') + '\n// v100\n'));
    assert.equal(runSync(fx.consumer).status, 0);
    git(fx.consumer, ['add', '-A']); commitNoVerify(fx.consumer, 'sync 100');
    const oldManifest = readFileSync(join(fx.consumer, '.omp', 'extensions', 'harness', 'harness-manifest.json'), 'utf-8');
    publishTag(fx, '2026.101', (w) => writeFileSync(join(w, GATE), readFileSync(join(w, GATE), 'utf-8') + '\n// v101\n'));
    assert.equal(runSync(fx.consumer).status, 0);
    git(fx.consumer, ['add', '-A']); commitNoVerify(fx.consumer, 'sync 101');
    const refs = git(fx.consumer, ['for-each-ref', '--format=%(refname)', 'refs/harness/']).trim().split('\n');
    assert.deepEqual(refs.sort(), ['refs/harness/2026.100', 'refs/harness/2026.101'], 'exactly the two newest provenance refs are kept');
    // Attack: check the OLD gate content back out of the previous tree and re-arm the old manifest.
    git(fx.consumer, ['checkout', 'refs/harness/2026.100', '--', GATE]);
    writeFileSync(join(fx.consumer, '.omp', 'extensions', 'harness', 'harness-manifest.json'), oldManifest);
    const risk = assessRisk(fx.consumer, { all: false, verifiable: true });
    assert.deepEqual(risk.synced, [], 'a manifest bound to a non-highest ref must exempt nothing (no downgrade)');
    assert.ok(risk.files.includes(GATE));
  });
});

test('M1/M2: the fetched fast path refuses a forged _HARNESS_SYNC_TMP — an arbitrary dir AND the consumer repo itself — and removes nothing', () => {
  withFixture({}, (fx) => {
    const victim = mkdtempSync(join(tmpdir(), 'victim-'));
    writeFileSync(join(victim, 'precious.txt'), 'do not delete\n');
    const head = git(fx.consumer, ['rev-parse', 'HEAD']).trim();
    for (const [tmpClaim, sha] of [[victim, 'a'.repeat(40)], [fx.consumer, head]]) {
      const r = spawnSync('bash', [join(fx.consumer, 'scripts', 'harness-sync.sh'), '--dry-run'], {
        cwd: fx.consumer, encoding: 'utf-8',
        env: cleanEnv({ _HARNESS_SYNC_FETCHED: '1', _HARNESS_SYNC_TMP: tmpClaim, _HARNESS_SYNC_TAG: '2026.99', _HARNESS_SYNC_SHA: sha, _HARNESS_SYNC_SOURCE: 'x', _HARNESS_SYNC_REPO_ROOT: fx.consumer }),
      });
      assert.notEqual(r.status, 0, `inconsistent hand-off context must be refused (TMP=${tmpClaim})`);
      assert.match(r.stderr, /inconsistent/);
    }
    assert.ok(existsSync(join(victim, 'precious.txt')), 'the EXIT trap must not rm -rf a directory we did not create');
    assert.ok(existsSync(join(fx.consumer, '.git')) && existsSync(join(fx.consumer, 'scripts', 'harness-sync.sh')), 'the consumer repo must survive TMP=REPO_ROOT');
    rmSync(victim, { recursive: true, force: true });
  });
});

test('L: a target tag whose script predates the hand-off protocol is not exec\'d (no clone leak), sync still completes', () => {
  withFixture({}, (fx) => {
    // Strip the protocol marker from the SOURCE tag's script and re-tag.
    const work = join(fx.root, 'source-work');
    const s = join(work, 'scripts', 'harness-sync.sh');
    writeFileSync(s, readFileSync(s, 'utf-8').replace(/_HARNESS_SYNC_FETCHED/g, '_LEGACY_MARKER'));
    git(work, ['add', '-A']);
    git(work, ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'legacy script']);
    git(work, ['tag', '-a', '-f', '-m', 'legacy', 'harness/2026.99']);
    git(work, ['push', '-q', '-f', fx.bare, 'HEAD:refs/heads/main', 'refs/tags/harness/2026.99']);
    // Hermetic leak check: point mktemp at a private TMPDIR so parallel test files cannot
    // perturb the count; anything left behind in it after the run is a leaked clone/self-copy.
    const priv = mkdtempSync(join(tmpdir(), 'hsync-tmpdir-'));
    const r = spawnSync('bash', [join(fx.consumer, 'scripts', 'harness-sync.sh')], {
      cwd: fx.consumer, encoding: 'utf-8', env: { ...process.env, TMPDIR: priv, _HARNESS_SYNC_REEXEC: '', _HARNESS_SYNC_FETCHED: '' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout, /own sync script/, 'no hand-off to a script that cannot honour it');
    assert.deepEqual(readdirSync(priv), [], 'the shallow clone and self-copy must be cleaned up (nothing left in TMPDIR)');
    rmSync(priv, { recursive: true, force: true });
  });
});
