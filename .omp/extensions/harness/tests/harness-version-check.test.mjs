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
//   - linked worktree (#68; fixture = isolated temp repo + `git worktree add`): BEHIND MAIN when main's
//     COMMITTED meta is current, STALE (linked worktree) otherwise, never /skill:harness-check; main and
//     single checkouts keep the original STALE; the worktree uses its own cache file
//
// Fixture tags are ANNOTATED (`git tag -a`) on purpose: only annotated tags make
// the tag-object sha differ from the commit sha, which is what the peeled-sha
// contract is about. Lightweight tags would vacuously pass the old, broken compare.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skipUnless } from './helpers/capabilities.mjs';

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'gates', 'harness-version-check.mjs');

// Hermetic env: strip ambient GIT_* so a hook-provided GIT_DIR/GIT_INDEX_FILE cannot redirect fixtures.
function cleanEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('GIT_')) env[k] = v;
  return env;
}

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8', env: cleanEnv() });
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

function runGate(cwd, payload = {}, envExtra = {}) {
  const started = Date.now();
  const r = spawnSync('node', [GATE], {
    input: JSON.stringify({ session_state: { cwd }, ...payload }),
    cwd,
    encoding: 'utf-8',
    env: { ...cleanEnv(), ...envExtra },
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

// Clock step backwards (measured on WSL2, 2026-09-23: Date.now() jumped -1.8s between two reads,
// which made the test above flake): a cache whose checkedAt is in the FUTURE made `now - checkedAt`
// negative, which satisfied every window including max_age_ms 0 — the caller asked for a refetch
// and silently got the stale cache. A future checkedAt must be treated as stale.
test('cache window: a checkedAt in the future (clock stepped backwards) never satisfies the window', () => {
  withFixture({ localVersion: '2026.50' }, (fx) => {
    const seed = runGate(fx.consumer);
    assert.match(seed.stdout, /2026\.61/);
    fx.addTag('2026.62');
    const cached = JSON.parse(readFileSync(fx.cachePath, 'utf-8'));
    const futureCheckedAt = Date.now() + 60_000;
    writeFileSync(fx.cachePath, JSON.stringify({ ...cached, checkedAt: futureCheckedAt }));
    const fresh = runGate(fx.consumer, { max_age_ms: 0 });
    assert.match(fresh.stdout, /2026\.62/, 'a future checkedAt must not be treated as a cache hit');
    const after = JSON.parse(readFileSync(fx.cachePath, 'utf-8'));
    // No wall-clock comparison here (that is the very flake under test): the injected value being
    // gone, plus the new tag above, proves the re-probe rewrote the cache.
    assert.notEqual(after.checkedAt, futureCheckedAt, 'the re-probe must rewrite the injected checkedAt');
    assert.equal(after.remoteLatestVersion, '2026.62', 'the rewritten cache carries the re-probed version');
    // And the normal window still works after the rewrite.
    const hit = runGate(fx.consumer, { max_age_ms: 3600000 });
    assert.match(hit.stdout, /2026\.62/);
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

// --- Hook activation probe (#26) ---
// `core.hooksPath` is local git config, so no file sync can propagate it: a consumer
// that ships `.githooks/` but never pointed git at it has every commit/push gate
// silently dead. Contract: `.githooks/` present + hooksPath not resolving to it =>
// one HARNESS HOOKS INACTIVE notice per 24h; already active, no hooks dir, or no
// git work tree => silent. The probe runs BEFORE the source-repo skip.

function gitInit(dir) {
  git(dir, ['init', '-q']);
}

test('hooks inactive: .githooks/ in a git work tree without core.hooksPath emits HOOKS INACTIVE once per window', () => {
  withFixture({ localVersion: '2026.61' }, (fx) => {
    gitInit(fx.consumer);
    mkdirSync(join(fx.consumer, '.githooks'));
    const first = runGate(fx.consumer);
    assert.equal(first.status, 0, 'advisory — exit stays 0');
    const out = first.stdout.trim();
    assert.ok(out.startsWith('HARNESS HOOKS INACTIVE'), `must lead with HARNESS HOOKS INACTIVE, got: ${JSON.stringify(out)}`);
    assert.ok(out.includes('git config core.hooksPath .githooks'), 'notice must carry the exact activation command');
    assert.ok(out.includes('/skill:harness-check'), 'notice must route to the idempotent skill path');
    assert.ok(existsSync(join(fx.consumer, '.omp', 'state', 'harness-hooks-check.json')), 'marker must be written');

    const second = runGate(fx.consumer);
    assert.equal(second.stdout.trim(), '', 'within the 24h window the notice must not repeat (no per-turn nag)');

    const forced = spawnSync('node', [GATE, '--force'], {
      input: JSON.stringify({ session_state: { cwd: fx.consumer } }), cwd: fx.consumer, encoding: 'utf-8', env: cleanEnv(),
    });
    assert.ok(forced.stdout.trim().startsWith('HARNESS HOOKS INACTIVE'), '--force bypasses the notice window');
  });
});

test('hooks active: relative core.hooksPath=.githooks is silent (resolved against the work-tree top)', () => {
  withFixture({ localVersion: '2026.61' }, (fx) => {
    gitInit(fx.consumer);
    mkdirSync(join(fx.consumer, '.githooks'));
    git(fx.consumer, ['config', 'core.hooksPath', '.githooks']);
    const r = runGate(fx.consumer);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '', 'active hooks => no notice');
    assert.ok(!existsSync(join(fx.consumer, '.omp', 'state', 'harness-hooks-check.json')), 'no marker when nothing was emitted');
  });
});

test('hooks re-pointed elsewhere still counts as inactive and names the configured value', () => {
  withFixture({ localVersion: '2026.61' }, (fx) => {
    gitInit(fx.consumer);
    mkdirSync(join(fx.consumer, '.githooks'));
    git(fx.consumer, ['config', 'core.hooksPath', '/tmp/none']);
    const r = runGate(fx.consumer);
    const out = r.stdout.trim();
    assert.ok(out.startsWith('HARNESS HOOKS INACTIVE'));
    assert.ok(out.includes('/tmp/none'), 'notice must show where hooksPath currently points');
  });
});

test('hooks probe is silent without .githooks/ or outside a git work tree', () => {
  withFixture({ localVersion: '2026.61' }, (fx) => {
    // git repo, no .githooks/ => nothing to activate
    gitInit(fx.consumer);
    assert.equal(runGate(fx.consumer).stdout.trim(), '');
  });
  withFixture({ localVersion: '2026.61' }, (fx) => {
    // .githooks/ but not a git work tree (plain directory) => cannot read git config, stay silent
    mkdirSync(join(fx.consumer, '.githooks'));
    const r = runGate(fx.consumer);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '');
  });
});

test('hooks probe runs before the source-repo skip (no source_remote still gets the notice)', () => {
  withFixture({ localVersion: '2026.61', sourceRemote: null }, (fx) => {
    gitInit(fx.consumer);
    mkdirSync(join(fx.consumer, '.githooks'));
    const r = runGate(fx.consumer);
    assert.ok(r.stdout.trim().startsWith('HARNESS HOOKS INACTIVE'), 'source repos carry hooks too — the probe must not be gated behind source_remote');
  });
});

test('hooks active through a symlinked session cwd is silent (real-path comparison)', { skip: skipUnless('symlink') }, () => {
  withFixture({ localVersion: '2026.61' }, (fx) => {
    gitInit(fx.consumer);
    mkdirSync(join(fx.consumer, '.githooks'));
    git(fx.consumer, ['config', 'core.hooksPath', '.githooks']);
    const link = join(fx.root, 'consumer-link');
    symlinkSync(fx.consumer, link);
    const r = runGate(link);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '', 'symlinked cwd must not produce a false HOOKS INACTIVE');
  });
});

// --- Policy shadow probe (#35) ---
// Measured on omp 18.2.5 (`omp -p --no-extensions` marker probes, 2026-09-23): a `.omp/AGENTS.md`
// with ANY bytes (content, a lone newline, whitespace) replaces the same-depth root AGENTS.md; a
// 0-byte file is ignored. Project and user RULES.md are both loaded, so `.omp/RULES.md` is not a
// shadow and is never probed. Contract: root AGENTS.md + non-empty .omp/AGENTS.md => one
// HARNESS POLICY SHADOWED notice per 24h routing to `.omp/rules/`; otherwise silent, no marker.

test('policy shadowed: .omp/AGENTS.md beside a root AGENTS.md emits POLICY SHADOWED once per window', () => {
  withFixture({ localVersion: '2026.61' }, (fx) => {
    writeFileSync(join(fx.consumer, 'AGENTS.md'), '# policy\n');
    writeFileSync(join(fx.consumer, '.omp', 'AGENTS.md'), '# project\n');
    const first = runGate(fx.consumer);
    assert.equal(first.status, 0, 'advisory — exit must stay 0');
    const out = first.stdout.trim();
    assert.ok(out.startsWith('HARNESS POLICY SHADOWED'), `must lead with HARNESS POLICY SHADOWED, got: ${JSON.stringify(out)}`);
    assert.ok(out.includes('.omp/AGENTS.md') && out.includes('.omp/rules/'), 'notice must name the offending file and the replacement location');
    assert.ok(existsSync(join(fx.consumer, '.omp', 'state', 'harness-policy-check.json')), 'marker must be written');

    const second = runGate(fx.consumer);
    assert.equal(second.stdout.trim(), '', 'within the 24h window the notice must not repeat');
  });
});

test('policy shadowed: a whitespace-only or single-newline .omp/AGENTS.md still shadows (size > 0, not trimmed content)', () => {
  for (const body of ['\n', ' \n\n', '\t']) {
    withFixture({ localVersion: '2026.61' }, (fx) => {
      writeFileSync(join(fx.consumer, 'AGENTS.md'), '# policy\n');
      writeFileSync(join(fx.consumer, '.omp', 'AGENTS.md'), body);
      const r = runGate(fx.consumer);
      assert.ok(r.stdout.trim().startsWith('HARNESS POLICY SHADOWED'), `${JSON.stringify(body)} must be reported`);
    });
  }
});

test('policy not shadowed: no root AGENTS.md, a 0-byte .omp/AGENTS.md, or a project .omp/RULES.md are all silent', () => {
  withFixture({ localVersion: '2026.61' }, (fx) => {
    writeFileSync(join(fx.consumer, '.omp', 'AGENTS.md'), '# project\n');  // no root AGENTS.md to shadow
    writeFileSync(join(fx.consumer, '.omp', 'RULES.md'), 'hard\n');         // both RULES.md load: not a shadow
    assert.equal(runGate(fx.consumer).stdout.trim(), '', 'nothing is shadowed => no notice');
    writeFileSync(join(fx.consumer, 'AGENTS.md'), '# policy\n');
    writeFileSync(join(fx.consumer, '.omp', 'AGENTS.md'), '');              // 0 bytes: ignored by the provider
    assert.equal(runGate(fx.consumer).stdout.trim(), '', 'a 0-byte .omp/AGENTS.md shadows nothing');
    assert.ok(!existsSync(join(fx.consumer, '.omp', 'state', 'harness-policy-check.json')), 'no marker when nothing was emitted');
  });
});

// Review 2026-09-23 round 2 (C-3): a marker dated in the FUTURE (clock stepped back, or a
// hand-written suppressor) must not silence the notice — the drift cache applies the same rule.
test('policy shadowed: a future-dated notice marker does not suppress the notice', () => {
  withFixture({ localVersion: '2026.61' }, (fx) => {
    writeFileSync(join(fx.consumer, 'AGENTS.md'), '# policy\n');
    writeFileSync(join(fx.consumer, '.omp', 'AGENTS.md'), '# project\n');
    mkdirSync(join(fx.consumer, '.omp', 'state'), { recursive: true });
    writeFileSync(join(fx.consumer, '.omp', 'state', 'harness-policy-check.json'), JSON.stringify({ notifiedAt: Date.now() + 60 * 60 * 1000 }));
    const r = runGate(fx.consumer);
    assert.ok(r.stdout.trim().startsWith('HARNESS POLICY SHADOWED'), 'a future marker is stale, not a valid window');
  });
});

// ── Linked worktrees (#68) ────────────────────────────────────────────────────────────────────
// Fixture: the consumer dir becomes a real git repo (branch `trunk`) with harness-meta.json
// COMMITTED, plus a `git worktree add` checkout `wt`. `mainCommitted` is the version committed on
// trunk AFTER the worktree was cut (the worktree keeps `wtVersion`), which is exactly the state a
// session in the worktree sees when main has already synced.
function makeLinkedFixture({ wtVersion = '2026.50', mainCommitted = wtVersion, mainBranch = 'trunk', wtExtra = {}, mainExtra = {}, mainSha = null } = {}) {
  const fx = makeFixture({ localVersion: wtVersion });
  const ident = ['-c', 'user.name=t', '-c', 'user.email=t@example.com'];
  const meta = (v, extra) => ({ version: v, source_remote: fx.sourceRemote, ...extra });
  fx.writeMeta(meta(wtVersion, wtExtra));
  git(fx.consumer, ['init', '-q', '-b', mainBranch]);
  git(fx.consumer, ['add', '.omp']);
  git(fx.consumer, [...ident, 'commit', '-q', '-m', `harness ${wtVersion}`]);
  fx.wt = join(fx.root, 'wt');
  git(fx.consumer, ['worktree', 'add', '-q', '-b', 'feature', fx.wt]);
  // `mainSha: 'peeled:<v>'` => main commits the REMOTE's peeled commit sha for that tag.
  const extra = mainSha && mainSha.startsWith('peeled:') ? { ...mainExtra, commit_sha: fx.commitShaOf(mainSha.slice(7)) } : mainExtra;
  if (mainCommitted !== wtVersion || Object.keys(extra).length) {
    fx.writeMeta(meta(mainCommitted, extra));
    git(fx.consumer, ['add', '.omp']);
    git(fx.consumer, [...ident, 'commit', '-q', '-m', `harness ${mainCommitted}`]);
  }
  fx.mainPath = realpathSync(fx.consumer);
  fx.wtCachePath = join(fx.wt, '.omp', 'state', 'harness-version-check.linked.json');
  fx.wtMainModeCachePath = join(fx.wt, '.omp', 'state', 'harness-version-check.json');
  return fx;
}

function withLinkedFixture(opts, fn) {
  const fx = makeLinkedFixture(opts);
  try { return fn(fx); } finally { rmSync(fx.root, { recursive: true, force: true }); }
}

test('linked worktree: main already at the latest tag => BEHIND MAIN, merge here, never harness-check', () => {
  withLinkedFixture({ wtVersion: '2026.50', mainCommitted: '2026.61' }, (fx) => {
    const r = runGate(fx.wt);
    assert.equal(r.status, 0, 'drift is advisory — exit must stay 0');
    const out = r.stdout.trim();
    assert.ok(out.startsWith('HARNESS BEHIND MAIN'), `got: ${JSON.stringify(out)}`);
    assert.ok(out.includes('git merge refs/heads/trunk'), 'must name the main checkout\'s branch as an unambiguous full ref (a same-named tag would win the short form)');
    assert.ok(out.includes('2026.61') && out.includes('2026.50'), 'must name main\'s and this worktree\'s versions');
    assert.ok(!out.includes('/skill:harness-check'), 'a linked worktree must never be routed to /skill:harness-check');
    assert.match(out, /do not run harness-check in a linked worktree/);
    assert.match(out, /short-lived/);
  });
});

test('linked worktree: main is behind too => STALE (linked worktree) naming the main checkout, never harness-check', () => {
  withLinkedFixture({ wtVersion: '2026.50', mainCommitted: '2026.55' }, (fx) => {
    const out = runGate(fx.wt).stdout.trim();
    assert.ok(out.startsWith('HARNESS STALE (linked worktree)'), `got: ${JSON.stringify(out)}`);
    assert.ok(out.includes(fx.mainPath), 'must name the main checkout path so the sync happens there');
    assert.ok(out.includes('2026.61'), 'must name the latest remote version');
    assert.ok(!out.includes('/skill:harness-check'), 'a linked worktree must never be routed to /skill:harness-check');
    assert.match(out, /do not run harness-check in a linked worktree/);
  });
});

test('linked worktree: main\'s COMMITTED meta decides, not its uncommitted working copy', () => {
  withLinkedFixture({ wtVersion: '2026.50', mainCommitted: '2026.55' }, (fx) => {
    // main synced on disk but has not committed: a merge would bring nothing yet.
    fx.writeMeta({ version: '2026.61', source_remote: fx.sourceRemote });
    const out = runGate(fx.wt).stdout.trim();
    assert.ok(out.startsWith('HARNESS STALE (linked worktree)'), `uncommitted sync on main is not "BEHIND MAIN": ${JSON.stringify(out)}`);
  });
});

test('linked worktree: up to date is silent', () => {
  withLinkedFixture({ wtVersion: '2026.61' }, (fx) => {
    assert.equal(runGate(fx.wt).stdout.trim(), '', 'no drift => no output, linked or not');
  });
});

test('main checkout of a repo that has linked worktrees keeps the original STALE directive', () => {
  withLinkedFixture({ wtVersion: '2026.50' }, (fx) => {
    const out = runGate(fx.consumer).stdout.trim();
    assert.ok(out.startsWith('HARNESS STALE: local harness 2026.50'), `got: ${JSON.stringify(out)}`);
    assert.ok(out.includes('/skill:harness-check'), 'the main checkout still routes to harness-check');
    assert.ok(!out.includes('linked worktree'), 'no linked-worktree wording on the main checkout');
  });
});

test('single git checkout (no worktrees) keeps the original STALE directive', () => {
  withFixture({ localVersion: '2026.50' }, (fx) => {
    git(fx.consumer, ['init', '-q', '-b', 'trunk']);
    const out = runGate(fx.consumer).stdout.trim();
    assert.ok(out.startsWith('HARNESS STALE: local harness 2026.50'), `got: ${JSON.stringify(out)}`);
    assert.ok(out.includes('/skill:harness-check'));
  });
});

test('linked worktree: separate cache file; the main-mode cache is never served to a worktree', () => {
  withLinkedFixture({ wtVersion: '2026.50', mainCommitted: '2026.61' }, (fx) => {
    // A fresh main-mode cache pinning a fake remote version must be ignored by the worktree probe.
    mkdirSync(dirname(fx.wtMainModeCachePath), { recursive: true });
    writeFileSync(fx.wtMainModeCachePath, JSON.stringify({ checkedAt: Date.now(), remoteLatestVersion: '2026.99', source: fx.sourceRemote }));
    const out = runGate(fx.wt).stdout.trim();
    assert.ok(out.includes('2026.61') && !out.includes('2026.99'), `worktree must probe for itself, got: ${JSON.stringify(out)}`);
    assert.equal(JSON.parse(readFileSync(fx.wtCachePath, 'utf-8')).remoteLatestVersion, '2026.61', 'worktree writes its own cache file');
    assert.equal(JSON.parse(readFileSync(fx.wtMainModeCachePath, 'utf-8')).remoteLatestVersion, '2026.99', 'the main-mode cache file stays untouched');
    // ...and the worktree's own cache is honored on the next run. A cache HIT leaves the file byte-for-byte
    // alone; a failed re-probe (remote gone) would rewrite it with `failed: true`, and would print the
    // same line from last-known-good — so the output alone cannot tell the two apart.
    const before = readFileSync(fx.wtCachePath, 'utf-8');
    rmSync(fx.sourceRemote.replace('file://', ''), { recursive: true, force: true });
    const again = runGate(fx.wt).stdout.trim();
    assert.ok(again.startsWith('HARNESS BEHIND MAIN') && again.includes('2026.61'), `cache hit must still report: ${JSON.stringify(again)}`);
    assert.equal(readFileSync(fx.wtCachePath, 'utf-8'), before, 'a cache hit must not touch the file (no re-probe, no failure marker)');
  });
});

// Review round 1 (2026-10-13) regressions.
test('linked worktree: main synced PAST the cached remote tag is BEHIND MAIN (SHA is compared only at equal versions)', () => {
  withLinkedFixture({ wtVersion: '2026.50', mainCommitted: '2026.70', mainExtra: { commit_sha: 'a'.repeat(40) } }, (fx) => {
    const out = runGate(fx.wt).stdout.trim();
    assert.ok(out.startsWith('HARNESS BEHIND MAIN'), `main at 2026.70 is ahead of remote 2026.61 and has what a merge needs: ${JSON.stringify(out)}`);
    assert.ok(out.includes('2026.70'));
  });
});

test('linked worktree: same-version SHA drift stays one of the two labels, STALE (linked worktree), never harness-check', () => {
  const wrong = 'f'.repeat(40);
  withLinkedFixture({ wtVersion: '2026.61', wtExtra: { commit_sha: wrong } }, (fx) => {
    const out = runGate(fx.wt).stdout.trim();
    assert.ok(out.startsWith('HARNESS STALE (linked worktree): version matches (2026.61) but commit SHA differs'), `got: ${JSON.stringify(out)}`);
    assert.ok(!out.includes('/skill:harness-check'));
  });
  // ...and BEHIND MAIN when main has already committed the right SHA at that version.
  withLinkedFixture({ wtVersion: '2026.61', wtExtra: { commit_sha: wrong }, mainSha: 'peeled:2026.61' }, (fx) => {
    const out = runGate(fx.wt).stdout.trim();
    assert.ok(out.startsWith('HARNESS BEHIND MAIN'), `got: ${JSON.stringify(out)}`);
    assert.ok(!out.includes('/skill:harness-check'));
  });
});

test('linked worktree: an exotic main branch name is never interpolated into the git merge line', () => {
  withLinkedFixture({ wtVersion: '2026.50', mainCommitted: '2026.61', mainBranch: 'x;touch-pwned$(id)' }, (fx) => {
    const out = runGate(fx.wt).stdout.trim();
    assert.ok(out.startsWith('HARNESS BEHIND MAIN'), `got: ${JSON.stringify(out)}`);
    assert.ok(!out.includes('x;touch') && !out.includes('$(id)') && !out.includes('git merge'), `unsafe ref leaked into the directive: ${JSON.stringify(out)}`);
    assert.match(out, /merge or rebase of the main checkout's current branch/);
  });
});

test('linked worktree: a tag named like the main branch does not shadow the branch when reading main\'s meta', () => {
  withLinkedFixture({ wtVersion: '2026.50', mainCommitted: '2026.61' }, (fx) => {
    git(fx.consumer, ['tag', 'trunk', 'HEAD~1']);   // same name as the branch, on the OLD commit (2026.50)
    const out = runGate(fx.wt).stdout.trim();
    assert.ok(out.startsWith('HARNESS BEHIND MAIN') && out.includes('2026.61'), `branch must win over the tag: ${JSON.stringify(out)}`);
  });
});

test('linked worktree: a detached main HEAD still compares committed meta but never pins its SHA in a merge command', () => {
  withLinkedFixture({ wtVersion: '2026.50', mainCommitted: '2026.61' }, (fx) => {
    git(fx.consumer, ['checkout', '-q', '--detach']);
    const out = runGate(fx.wt).stdout.trim();
    assert.ok(out.startsWith('HARNESS BEHIND MAIN') && out.includes('2026.61'), `got: ${JSON.stringify(out)}`);
    assert.ok(!out.includes('git merge'), `a detached SHA would be stale after main syncs: ${JSON.stringify(out)}`);
  });
});

test('linked worktree: main without a usable committed harness meta ({} / no file) falls back to STALE (linked worktree)', () => {
  for (const mainMeta of [{}, null]) {
    withLinkedFixture({ wtVersion: '2026.50' }, (fx) => {
      const ident = ['-c', 'user.name=t', '-c', 'user.email=t@example.com'];
      if (mainMeta) { fx.writeMeta(mainMeta); git(fx.consumer, ['add', '.omp']); }
      else git(fx.consumer, ['rm', '-q', '.omp/extensions/harness/harness-meta.json']);   // `git rm` stages the deletion itself
      git(fx.consumer, [...ident, 'commit', '-q', '-m', 'main meta unusable']);
      const out = runGate(fx.wt).stdout.trim();
      assert.ok(out.startsWith('HARNESS STALE (linked worktree)'), `${JSON.stringify(mainMeta)}: ${JSON.stringify(out)}`);
      assert.ok(!out.includes('undefined'), 'a version-less meta must not print "main already at undefined"');
    });
  }
});

test('linked worktree: ambient GIT_DIR / GIT_WORK_TREE cannot turn detection off and bring harness-check back', () => {
  withLinkedFixture({ wtVersion: '2026.50', mainCommitted: '2026.61' }, (fx) => {
    const out = runGate(fx.wt, {}, { GIT_DIR: join(fx.mainPath, '.git'), GIT_WORK_TREE: fx.mainPath }).stdout.trim();
    assert.ok(out.startsWith('HARNESS BEHIND MAIN'), `got: ${JSON.stringify(out)}`);
    assert.ok(!out.includes('/skill:harness-check'));
  });
});

test('linked worktree of a BARE main repo: STALE (linked worktree) without inventing a main checkout path', () => {
  withLinkedFixture({ wtVersion: '2026.50' }, (fx) => {
    const bare = join(fx.root, 'main-bare.git');
    git(fx.root, ['clone', '-q', '--bare', fx.consumer, bare]);
    const bwt = join(fx.root, 'bwt');
    git(bare, ['worktree', 'add', '-q', bwt, 'trunk']);
    const r = runGate(bwt);
    assert.equal(r.status, 0);
    const out = r.stdout.trim();
    assert.ok(out.startsWith('HARNESS STALE (linked worktree)'), `got: ${JSON.stringify(out)}`);
    assert.match(out, /main worktree is bare/);
    assert.ok(!out.includes('/skill:harness-check'));
  });
});

// Review round 2 (2026-10-13) regressions.
test('linked worktree: a worktree AHEAD of the cached remote (just merged main\'s newer sync) is silent, not "SHA differs"', () => {
  withLinkedFixture({ wtVersion: '2026.62', wtExtra: { commit_sha: 'a'.repeat(40) } }, (fx) => {
    assert.equal(runGate(fx.wt).stdout.trim(), '', 'version 2026.62 > remote 2026.61: current, whatever the older tag\'s SHA is');
  });
});

test('linked worktree: main BEHIND the worktree is never offered as the cure (no downgrade)', () => {
  // wt 2026.60 is itself stale (remote 2026.61) but newer than main 2026.55: merging main would go backwards.
  withLinkedFixture({ wtVersion: '2026.60', mainCommitted: '2026.55' }, (fx) => {
    const out = runGate(fx.wt).stdout.trim();
    assert.ok(out.startsWith('HARNESS STALE (linked worktree)'), `got: ${JSON.stringify(out)}`);
  });
});

test('linked worktree: at an equal version main must carry the remote\'s SHA to count as the cure for SHA drift', () => {
  withLinkedFixture({ wtVersion: '2026.61', wtExtra: { commit_sha: 'f'.repeat(40) } }, (fx) => {
    // main drops commit_sha: merging it would only erase the sha and silence the drift.
    const ident = ['-c', 'user.name=t', '-c', 'user.email=t@example.com'];
    fx.writeMeta({ version: '2026.61', source_remote: fx.sourceRemote });
    git(fx.consumer, ['add', '.omp']);
    git(fx.consumer, [...ident, 'commit', '-q', '-m', 'main without sha']);
    const out = runGate(fx.wt).stdout.trim();
    assert.ok(out.startsWith('HARNESS STALE (linked worktree)'), `got: ${JSON.stringify(out)}`);
  });
});

test('linked worktree: HOOKS INACTIVE no longer suggests harness-check (core.hooksPath is shared by every worktree)', () => {
  withLinkedFixture({ wtVersion: '2026.61' }, (fx) => {
    mkdirSync(join(fx.wt, '.githooks'));
    writeFileSync(join(fx.wt, '.githooks', 'pre-commit'), '#!/bin/sh\n');
    const out = runGate(fx.wt).stdout.trim();
    assert.ok(out.startsWith('HARNESS HOOKS INACTIVE'), `got: ${JSON.stringify(out)}`);
    assert.ok(out.includes('git config core.hooksPath .githooks'));
    assert.ok(!out.includes('harness-check'), `linked worktree must not be routed to harness-check: ${JSON.stringify(out)}`);
  });
});
