// tests/harness-wiring.test.mjs — AC1/AC5 wiring: the hooks must actually SHIP, and the
// docs-drift orphan model must understand that git hooks are enforcement roots.
//
// Why this exists: harness-sync.sh enumerates hook files one by one. A new hook that is
// not listed there reaches no consumer repo, and no fixture test would ever notice
// (fixtures install hooks themselves). That silent gap would make the interim
// "consumers are ungated" window permanent (test-attack C-1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, cpSync, existsSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

// W1: every enforcement hook is on the sync whitelist.
test('W1: harness-sync ships the enforcement hooks', () => {
  const sync = readFileSync(join(repoRoot, 'scripts', 'harness-sync.sh'), 'utf8');
  for (const hook of ['.githooks/pre-commit', '.githooks/post-commit', '.githooks/post-merge', '.githooks/pre-push']) {
    assert.ok(sync.includes(`"${hook}"`), `harness-sync.sh must sync ${hook}`);
  }
});

// W1b: the shipped hooks are executable and reference the dispatcher by its real path.
test('W1b: pre-commit hook is executable and calls the dispatcher', () => {
  const hook = readFileSync(join(repoRoot, '.githooks', 'pre-commit'), 'utf8');
  assert.match(hook, /commit-gates\.mjs/);
  assert.match(hook, /"mode":"hook"/);
  const st = spawnSync('test', ['-x', join(repoRoot, '.githooks', 'pre-commit')]);
  assert.equal(st.status, 0, 'pre-commit must be executable');
});

// W2: the orphan model must (a) accept the current topology and (b) still catch a real
// orphan — a gate file nothing references. Run docs-drift in a copied tree so the canary
// never touches the live repo.
test('W2: docs-drift orphan model accepts hook roots and still catches a real orphan', () => {
  const drift = join(repoRoot, 'scripts', 'docs-drift');
  const clean = spawnSync(process.execPath, [drift], { cwd: repoRoot, encoding: 'utf-8' });
  assert.equal(clean.status, 0, `docs-drift must pass on the real repo: ${clean.stdout}${clean.stderr}`);

  const copy = mkdtempSync(join(tmpdir(), 'driftcanary-'));
  for (const entry of ['scripts', '.omp', '.githooks', 'docs', 'AGENTS.md', 'INDEX.md', 'README.md', 'README.en.md', 'rules', 'checklists', 'templates', 'claudedocs']) {
    const src = join(repoRoot, entry);
    if (existsSync(src)) cpSync(src, join(copy, entry), { recursive: true });
  }
  mkdirSync(join(copy, '.omp', 'extensions', 'harness', 'gates'), { recursive: true });
  writeFileSync(join(copy, '.omp', 'extensions', 'harness', 'gates', 'zz-orphan-canary.mjs'), '// nothing references this\nprocess.exit(0);\n');
  const canary = spawnSync(process.execPath, [join(copy, 'scripts', 'docs-drift')], { cwd: copy, encoding: 'utf-8' });
  assert.match(`${canary.stdout}${canary.stderr}`, /Orphan gate file/, 'a genuinely unreferenced gate must still be reported');
});

// C5: the verdict must be invariant under benign session env pollution — measured in the
// direction the 2026-07-27 incident actually took: a commit that PASSES must keep passing when
// ambient GIT_CONFIG_* appears. (The first version asserted a blocking baseline, so it could not
// detect "newly blocked" at all — review round 3, M5.)
test('C5: an allowed commit stays allowed under ambient GIT_CONFIG_* pollution', () => {
  const dispatcher = join(repoRoot, '.omp', 'extensions', 'harness', 'gates', 'commit-gates.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'envpoll-'));
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  const gitEnv = { ...clean, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  const run = (args, env = gitEnv) => spawnSync('git', args, { cwd: dir, encoding: 'utf-8', env });
  run(['init', '-q']);
  run(['config', 'user.email', 't@example.com']);
  run(['config', 'user.name', 't']);
  mkdirSync(join(dir, 'docs', 'harness'), { recursive: true });
  // All AC checked + docs-only staged => a clean ALLOW baseline.
  writeFileSync(join(dir, 'docs', 'harness', 'current-scope.md'), '# Current Scope\n\n## Acceptance Criteria\n\n- [x] AC1 done\n');
  writeFileSync(join(dir, 'notes.md'), 'docs only\n');
  run(['add', 'notes.md', 'docs']);
  const payload = JSON.stringify({ mode: 'hook', hook: 'pre-commit', session_state: { cwd: dir } });
  const verdict = (env) => spawnSync(process.execPath, [dispatcher], { cwd: dir, input: payload, encoding: 'utf-8', env }).status;
  assert.equal(verdict(gitEnv), 0, 'the docs-only fixture must pass on its own merits');
  const polluted = verdict({
    ...gitEnv,
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'credential.helper', GIT_CONFIG_VALUE_0: 'store',
    GIT_CONFIG_KEY_1: 'credential.useHttpPath', GIT_CONFIG_VALUE_1: 'true',
  });
  assert.equal(polluted, 0, 'ambient credential config must NOT newly block an allowed commit');
});

// W3 (review round 2, medium): `cp` PRESERVES an existing destination's mode, so re-syncing
// over a hook that is already non-executable left it non-executable — and git skips
// non-executable hooks WITHOUT a warning, silently disarming the only blocking surface.
// This pins the `chmod +x` in the sync loop by reading the script's own logic, then proves the
// underlying git behavior in a fixture (so the pin cannot pass on a vacuous truth).
test('W3: harness-sync restores hook executability, and git needs it', () => {
  const sync = readFileSync(join(repoRoot, 'scripts', 'harness-sync.sh'), 'utf8');
  assert.match(sync, /\.githooks\/\*\)\s*chmod \+x/, 'the sync loop must chmod +x the hooks it copies');

  // Ground truth: a non-executable pre-commit is skipped silently by git.
  const dir = mkdtempSync(join(tmpdir(), 'execbit-'));
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  const env = { ...clean, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  const git = (args) => spawnSync('git', args, { cwd: dir, encoding: 'utf-8', env });
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 't']);
  git(['config', 'core.hooksPath', '.githooks']);
  mkdirSync(join(dir, '.githooks'), { recursive: true });
  const hook = join(dir, '.githooks', 'pre-commit');
  writeFileSync(hook, '#!/usr/bin/env bash\necho "HOOK RAN" >&2\nexit 2\n');
  writeFileSync(join(dir, 'f.txt'), 'x\n');
  git(['add', '-A']);
  chmodSync(hook, 0o755);
  const armed = git(['commit', '-m', 'armed']);
  assert.notEqual(armed.status, 0, 'an executable blocking hook must block');
  assert.match(armed.stderr, /HOOK RAN/);
  chmodSync(hook, 0o644);
  const disarmed = git(['commit', '-q', '-m', 'disarmed']);
  assert.equal(disarmed.status, 0, 'git silently skips a non-executable hook — hence the chmod');
  assert.doesNotMatch(disarmed.stderr, /HOOK RAN/);
});

// W4 (review round 2, low): round 1 shipped an extension that did not compile (a call whose
// import had been dropped) and the whole suite stayed green, because the only test touching
// that line asserted source TEXT. This guards the class mechanically.
test('W4: the harness extension has no unresolved identifiers (tsc TS2304)', () => {
  const r = spawnSync('npx', ['--no-install', 'tsc', '--noEmit', '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--allowImportingTsExtensions',
    join('.omp', 'extensions', 'harness', 'index.ts')], { cwd: repoRoot, encoding: 'utf-8', timeout: 120_000 });
  if (r.error || r.status === null) {
    // tsc unavailable offline: the guard is best-effort, never a false failure.
    return;
  }
  const unresolved = `${r.stdout}${r.stderr}`.split('\n').filter((l) => l.includes('TS2304'));
  assert.deepEqual(unresolved, [], `unresolved identifiers in the extension:\n${unresolved.join('\n')}`);
});
