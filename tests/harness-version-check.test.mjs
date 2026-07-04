// harness-version-check.test.mjs — drift probe gate behavior contract.
//
// The gate is a stdin-JSON CLI (exit 0 always; drift => stdout directive). Every
// "remote" in this suite is a local file:// bare git repo, so nothing here ever
// touches the network. Contract under test:
//   - drift (highest remote harness/YYYY.N tag ranks above local version) =>
//     stdout leads with HARNESS STALE and routes resolution via /skill:harness-check
//   - local at (or past) the latest remote tag => silent
//   - annotated tags: on equal version rank the PEELED `^{}` commit sha wins —
//     harness-sync stores `rev-parse HEAD` (a commit sha) in meta, so comparing
//     against the tag-object sha would report DRIFT forever
//   - cache (.omp/state/harness-version-check.json) honors the caller's
//     max_age_ms window; 0 forces a refetch; junk values fall back to the default
//   - a failed probe writes a `failed` marker and subsequent runs back off
//     silently WITHOUT re-probing
//   - no `source_remote` in harness-meta.json (this IS the source repo) => no-op
//
// Fixture tags are ANNOTATED (`git tag -a`) on purpose: only annotated tags make
// the tag-object sha differ from the commit sha, which is what the peeled-sha
// contract is about. Lightweight tags would vacuously pass the old, broken compare.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', '.omp', 'extensions', 'harness', 'gates', 'harness-version-check.mjs');

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

// Fixture: a bare "source" repo carrying annotated harness/* tags + a consumer
// dir whose harness-meta.json points at it via file://.
//   sourceRemote: null  => omit source_remote entirely (source-repo skip case)
//   missingRemote: true => source_remote points at a path that does not exist
function makeFixture({ localVersion, tags = ['2026.60', '2026.61'], sourceRemote, missingRemote = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hvc-'));
  const bare = join(root, 'source.git');
  const work = join(root, 'work');
  const ident = ['-c', 'user.name=t', '-c', 'user.email=t@example.com'];
  git(root, ['init', '-q', '--bare', bare]);
  git(root, ['init', '-q', work]);
  git(work, [...ident, 'commit', '-q', '--allow-empty', '-m', 'seed']);
  const addTag = (v) => {
    git(work, [...ident, 'tag', '-a', '-m', `harness ${v}`, `harness/${v}`]);
    git(work, ['push', '-q', `file://${bare}`, `refs/tags/harness/${v}`]);
  };
  for (const v of tags) addTag(v);

  const consumer = join(root, 'consumer');
  mkdirSync(join(consumer, '.omp', 'extensions', 'harness'), { recursive: true });
  const metaPath = join(consumer, '.omp', 'extensions', 'harness', 'harness-meta.json');
  const writeMeta = (m) => writeFileSync(metaPath, JSON.stringify(m, null, 2));
  let remote = `file://${bare}`;
  if (missingRemote) remote = `file://${join(root, 'no-such-remote.git')}`;
  if (sourceRemote === null) remote = null;
  const meta = { version: localVersion };
  if (remote !== null) meta.source_remote = remote;
  writeMeta(meta);

  return {
    root, consumer, addTag, writeMeta,
    sourceRemote: remote,
    cachePath: join(consumer, '.omp', 'state', 'harness-version-check.json'),
    commitShaOf: (v) => git(work, ['rev-parse', `harness/${v}^{commit}`]).trim(),
    tagObjectShaOf: (v) => git(work, ['rev-parse', `refs/tags/harness/${v}`]).trim(),
  };
}

function withFixture(opts, fn) {
  const fx = makeFixture(opts);
  try { return fn(fx); } finally { rmSync(fx.root, { recursive: true, force: true }); }
}

function runGate(cwd, payload = {}) {
  const started = Date.now();
  const r = spawnSync('node', [GATE], {
    input: JSON.stringify({ session_state: { cwd }, ...payload }),
    cwd,
    encoding: 'utf-8',
  });
  r.durationMs = Date.now() - started;
  return r;
}

test('drift: remote ahead of local emits a HARNESS STALE directive naming the latest remote version', () => {
  withFixture({ localVersion: '2026.50' }, (fx) => {
    const r = runGate(fx.consumer);
    assert.equal(r.status, 0, 'drift is advisory — exit must stay 0');
    const out = r.stdout.trim();
    assert.ok(out.startsWith('HARNESS STALE'), `directive must lead with HARNESS STALE, got: ${JSON.stringify(out)}`);
    assert.ok(out.includes('/skill:harness-check'), 'directive must route resolution through /skill:harness-check');
    assert.ok(out.includes('2026.61'), 'directive must name the latest remote version');
    assert.ok(!out.includes('2026.60'), 'directive must pick the HIGHEST remote tag, not an arbitrary one');
  });
});

test('up to date: local matching the latest remote tag is silent', () => {
  withFixture({ localVersion: '2026.61' }, (fx) => {
    const r = runGate(fx.consumer);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '', 'no drift => no output');
  });
});

test('local ahead of remote is silent (comparison is strictly remote > local)', () => {
  withFixture({ localVersion: '2026.99' }, (fx) => {
    const r = runGate(fx.consumer);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '', 'a locally-newer harness must not be reported as stale');
  });
});

test('annotated tags: version match + commit_sha == peeled commit is silent (no false DRIFT)', () => {
  withFixture({ localVersion: '2026.61' }, (fx) => {
    const commit = fx.commitShaOf('2026.61');
    assert.notEqual(commit, fx.tagObjectShaOf('2026.61'),
      'fixture must use ANNOTATED tags (tag object != commit) or this test proves nothing');
    fx.writeMeta({ version: '2026.61', commit_sha: commit, source_remote: fx.sourceRemote });
    const r = runGate(fx.consumer);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '',
      'the gate must compare the PEELED ^{} commit sha, not the annotated tag-object sha');
  });
});

test('version match but genuinely different commit_sha still reports HARNESS DRIFT', () => {
  withFixture({ localVersion: '2026.61' }, (fx) => {
    fx.writeMeta({ version: '2026.61', commit_sha: '0'.repeat(40), source_remote: fx.sourceRemote });
    const r = runGate(fx.consumer);
    assert.equal(r.status, 0);
    const out = r.stdout.trim();
    assert.ok(out.startsWith('HARNESS DRIFT'),
      `the sha fallback must still fire on a real mismatch, got: ${JSON.stringify(out)}`);
    assert.ok(out.includes('/skill:harness-check'), 'directive must route resolution through /skill:harness-check');
  });
});

test('cache window: a fresh cache pins the remote version; max_age_ms 0 forces a refetch', () => {
  withFixture({ localVersion: '2026.50' }, (fx) => {
    const seed = runGate(fx.consumer);
    assert.match(seed.stdout, /2026\.61/, 'seed run must probe and report the current latest');
    assert.ok(existsSync(fx.cachePath), 'a successful probe must persist its result');

    fx.addTag('2026.62'); // published mid-window

    const hit = runGate(fx.consumer, { max_age_ms: 3600000 });
    assert.equal(hit.status, 0);
    assert.match(hit.stdout, /2026\.61/, 'inside the window the CACHED remote version must win');
    assert.ok(!hit.stdout.includes('2026.62'), 'a cache hit must not re-probe the remote');

    const fresh = runGate(fx.consumer, { max_age_ms: 0 });
    assert.match(fresh.stdout, /2026\.62/, 'max_age_ms 0 must bypass the cache and see the new tag');
  });
});

test('failure backoff: dead remote is silent, exits 0, records failed marker, then skips the re-probe', () => {
  withFixture({ localVersion: '2026.50', missingRemote: true }, (fx) => {
    rmSync(fx.cachePath, { force: true });

    const first = runGate(fx.consumer);
    assert.equal(first.status, 0, 'probe failure must never break the caller');
    assert.equal(first.stdout.trim(), '', 'probe failure must be silent');
    const marker = JSON.parse(readFileSync(fx.cachePath, 'utf-8'));
    assert.equal(marker.failed, true, 'failure must be recorded so frequent callers back off');
    assert.ok(Number.isFinite(marker.checkedAt), 'failure marker must carry a timestamp');

    const second = runGate(fx.consumer);
    assert.equal(second.status, 0);
    assert.equal(second.stdout.trim(), '', 'backoff hit must stay silent');
    assert.ok(second.durationMs < 2000, `backoff hit must be fast (no probe), took ${second.durationMs}ms`);
    const after = JSON.parse(readFileSync(fx.cachePath, 'utf-8'));
    assert.equal(after.checkedAt, marker.checkedAt, 'backoff hit must NOT re-probe — marker stays untouched');
  });
});

test('source repo (no source_remote in meta) is a silent no-op', () => {
  withFixture({ localVersion: '2026.50', sourceRemote: null }, (fx) => {
    const r = runGate(fx.consumer);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '');
    assert.ok(!existsSync(fx.cachePath), 'the source repo must neither probe nor write a cache');
  });
});

test('invalid max_age_ms (negative, string) behaves like the default window, not always-refetch', () => {
  withFixture({ localVersion: '2026.50' }, (fx) => {
    const seed = runGate(fx.consumer); // populate cache at 2026.61
    assert.match(seed.stdout, /2026\.61/);
    fx.addTag('2026.62');

    for (const bad of [-1, 'soon']) {
      const r = runGate(fx.consumer, { max_age_ms: bad });
      assert.equal(r.status, 0);
      assert.match(r.stdout, /2026\.61/,
        `max_age_ms=${JSON.stringify(bad)} must fall back to the default window (cache hit)`);
      assert.ok(!r.stdout.includes('2026.62'),
        `max_age_ms=${JSON.stringify(bad)} must NOT be coerced into an always-refetch`);
    }
  });
});

test('failure preserves last-known drift: marker keeps remote fields and STALE keeps being reported', () => {
  withFixture({ localVersion: '2026.50' }, (fx) => {
    // (1) healthy probe seeds a drift cache
    const seed = runGate(fx.consumer);
    assert.ok(seed.stdout.trim().startsWith('HARNESS STALE'), 'seed probe must report the known drift');
    const good = JSON.parse(readFileSync(fx.cachePath, 'utf-8'));
    assert.equal(good.remoteLatestVersion, '2026.61');

    // (2) the remote dies; max_age_ms 0 forces a re-probe, which fails
    fx.writeMeta({ version: '2026.50', source_remote: `file://${join(fx.root, 'gone.git')}` });
    const failing = runGate(fx.consumer, { max_age_ms: 0 });
    assert.equal(failing.status, 0, 'a failed re-probe must never break the caller');
    assert.ok(failing.stdout.trim().startsWith('HARNESS STALE'),
      'a KNOWN drift must survive a failed re-probe (last-known-good), not go silent');
    const marker = JSON.parse(readFileSync(fx.cachePath, 'utf-8'));
    assert.equal(marker.failed, true, 'the failed probe must still be recorded for backoff');
    assert.equal(marker.remoteLatestVersion, '2026.61',
      'the failure marker must PRESERVE the previous remote fields, not clobber them');

    // (3) within FAILURE_TTL the backoff window keeps reporting the drift without re-probing
    const backoff = runGate(fx.consumer);
    assert.equal(backoff.status, 0);
    assert.ok(backoff.stdout.trim().startsWith('HARNESS STALE'),
      'the backoff window must keep reporting the known drift, not go silent for FAILURE_TTL');
    const after = JSON.parse(readFileSync(fx.cachePath, 'utf-8'));
    assert.equal(after.checkedAt, marker.checkedAt, 'the backoff hit must NOT re-probe — marker stays untouched');
  });
});
