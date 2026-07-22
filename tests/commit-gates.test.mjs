// Integration tests for commit-gates.mjs — the single PreToolUse:Bash dispatcher that replaces the
// three separate commit-only gate registrations (acceptance/backpressure/review). Audit item #8b.
//
// Run: node --test tests/commit-gates.test.mjs
//
// Verifies: (a) a non-commit short-circuits (the spawn-saving win); (b) on a commit it delegates to
// the gates in order and runs them ALL; (c) each gate's block surfaces through the dispatcher;
// (d) a gate that does not run cleanly (crash / timeout / spawn failure) BLOCKS — fail-closed,
// owner decision after the 3rd adversarial review (2026-07-22): skipping a broken gate was a full
// review bypass (drive any gate over its 3s child budget with crafted inputs, commit unreviewed).
// The gates themselves are unchanged (covered by backpressure-gate.test.mjs etc.) — here we test the
// dispatcher wiring. Isolated temp git repos with explicit cwd (memory: feedback_shell_test_cwd_isolation).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DISPATCHER = join(dirname(fileURLToPath(import.meta.url)), '..', '.omp', 'extensions', 'harness', 'gates', 'commit-gates.mjs');

const MEDIUM = { 'src/util.ts': 'export const a = 1;\n' };
const CRITICAL = { 'src/auth/login.ts': 'export const login = 1;\n' };
const LOW = { 'docs/notes.md': '# notes\nprose\n' };

function makeRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'cg-disp-'));
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  };
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Test']);
  for (const [rel, content] of Object.entries(files)) {
    const fp = join(dir, rel);
    mkdirSync(dirname(fp), { recursive: true });
    writeFileSync(fp, content);
  }
  git(['add', '-A']);
  return dir;
}

function setStatus(dir, status) {
  const sd = join(dir, '.omp', 'harness-state');
  mkdirSync(sd, { recursive: true });
  writeFileSync(join(sd, 'backpressure-status'), status);
}

function setScope(dir, content) {
  const p = join(dir, 'docs', 'harness', 'current-scope.md');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

function runDispatcher(dir, command = 'git commit -m x', env = {}) {
  return spawnSync('node', [DISPATCHER], {
    input: JSON.stringify({ tool_input: { command }, session_state: { cwd: dir } }),
    cwd: dir,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
  });
}

function withRepo(files, fn) {
  const dir = makeRepo(files);
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('non-commit command short-circuits — no gate child is spawned', () => {
  withRepo(CRITICAL, (dir) => {
    setStatus(dir, 'UNKNOWN');                 // would block IF a gate ran
    // With HARNESS_DEBUG=1, any gate child that ran would write hook-debug.log (children inherit the
    // dispatcher's env). A non-commit must short-circuit BEFORE spawning any child, so no log appears.
    const r = runDispatcher(dir, 'ls -la', { HARNESS_DEBUG: '1' });
    assert.equal(r.status, 0, 'non-commit must exit 0 without delegating');
    assert.equal(existsSync(join(dir, '.omp', 'harness-state', 'hook-debug.log')), false,
      'no child gate ran (no hook-debug.log even with HARNESS_DEBUG=1)');
  });
});

test('commit with all gates passing → exit 0 (low-risk docs commit)', () => {
  withRepo(LOW, (dir) => {
    assert.equal(runDispatcher(dir).status, 0, 'docs-only commit passes all gates');
  });
});

test('commit blocked by backpressure (critical + UNKNOWN) surfaces through the dispatcher', () => {
  withRepo(CRITICAL, (dir) => {
    setStatus(dir, 'UNKNOWN');
    const r = runDispatcher(dir);
    assert.equal(r.status, 2, 'dispatcher must propagate a gate block (exit 2)');
    assert.match(r.stderr, /HARNESS BLOCK/, 'the blocking gate\'s message is surfaced');
  });
});

test('commit with PASS status + medium risk → exit 0 (review only warns on medium)', () => {
  withRepo(MEDIUM, (dir) => {
    setStatus(dir, 'PASS');
    assert.equal(runDispatcher(dir).status, 0);
  });
});

test('acceptance gate blocks FIRST (ordering: acceptance → backpressure → review)', () => {
  withRepo(MEDIUM, (dir) => {
    setStatus(dir, 'PASS');                    // so backpressure would NOT block — proves acceptance ran first
    setScope(dir, '# Scope\n\n## Acceptance Criteria\n\n- [ ] unfinished task\n');
    const r = runDispatcher(dir);
    assert.equal(r.status, 2, 'unchecked AC must block');
    assert.match(r.stderr, /acceptance criteria not met/i, 'the acceptance gate is the one that blocked');
  });
});

test('invalid JSON input does not crash (exit 0)', () => {
  withRepo(MEDIUM, (dir) => {
    const r = spawnSync('node', [DISPATCHER], { input: 'not json', cwd: dir, encoding: 'utf-8' });
    assert.equal(r.status, 0);
  });
});

test('review-gate block (critical + PASS + no review doc) surfaces through the dispatcher', () => {
  withRepo(CRITICAL, (dir) => {
    setStatus(dir, 'PASS');             // acceptance allows (no scope), backpressure PASS allows...
    const r = runDispatcher(dir);       // ...review-gate blocks: critical risk, no review doc today
    assert.equal(r.status, 2, 'review-gate (the last gate) must block a critical commit lacking a review');
    assert.match(r.stderr, /require review/i, 'the review gate is the blocker');
  });
});

test('runs ALL gates: a downstream skip flag is consumed even when an earlier gate blocks', () => {
  // Proves run-all (not stop-at-first-block): acceptance blocks, but backpressure still runs and
  // consumes its one-shot skip flag, so the flag cannot survive to silently bypass a later retry.
  withRepo(MEDIUM, (dir) => {
    setStatus(dir, 'PASS');
    setScope(dir, '# Scope\n\n## Acceptance Criteria\n\n- [ ] unfinished\n');   // acceptance blocks
    const skip = join(dir, 'docs', 'harness', 'backpressure-skip');
    writeFileSync(skip, '');
    const r = runDispatcher(dir);
    assert.equal(r.status, 2, 'acceptance still blocks the commit');
    assert.equal(existsSync(skip), false, 'backpressure ran and consumed its skip flag (run-all)');
  });
});

// --- fail-closed on a broken gate (owner decision, 3rd adversarial review 2026-07-22) ------------
// A gate that cannot render a verdict must BLOCK, not be skipped: with the prior fail-open, making
// any gate crash or exceed its child budget was equivalent to disabling commit review entirely.

test('a CRASHING gate blocks the commit (fail-closed) and the message names the gate + standalone debug', () => {
  withRepo(LOW, (dir) => {
    // Occupy .omp/harness-state with a regular FILE: with HARNESS_DEBUG=1 every gate's first log()
    // append throws ENOTDIR uncaught -> non-zero exit. The staged LOW files would otherwise pass
    // every gate (see the all-gates-passing test above), so any block comes from the fail-closed path.
    mkdirSync(join(dir, '.omp'), { recursive: true });
    writeFileSync(join(dir, '.omp', 'harness-state'), 'not a directory');
    const r = runDispatcher(dir, 'git commit -m x', { HARNESS_DEBUG: '1' });
    assert.equal(r.status, 2, 'a crashed gate must fail closed');
    assert.match(r.stderr, /HARNESS BLOCK: commit gate '.*' did not run cleanly/);
    assert.match(r.stderr, /failing closed/);
    assert.match(r.stderr, /Debug it standalone/, 'the block must teach how to debug the gate in isolation');
  });
});

test('a HANGING gate is killed at its child budget and blocks the commit (fail-closed timeout)', () => {
  withRepo(MEDIUM, (dir) => {
    // A FIFO where backpressure-gate expects its status file: its readFileSync blocks forever, the
    // dispatcher kills the child at CHILD_TIMEOUT_MS (~3s), and the timeout must BLOCK, not skip —
    // budget exhaustion was the attack vector behind both 3rd-review CRITICALs.
    const sd = join(dir, '.omp', 'harness-state');
    mkdirSync(sd, { recursive: true });
    execSync(`mkfifo ${join(sd, 'backpressure-status')}`);
    const r = runDispatcher(dir);
    assert.equal(r.status, 2, 'a timed-out gate must fail closed');
    assert.match(r.stderr, /commit gate 'backpressure-gate\.mjs' did not run cleanly \(ETIMEDOUT\)/);
  });
});

test('timeout+attempted exit 0 still blocks: ETIMEDOUT error axis is fail-closed and SIGKILL is uncatchable', () => {
  withRepo(LOW, (dir) => {
    // Preload only the REAL review-gate child. It suppresses that gate's clean process.exit(0),
    // keeps the event loop alive past CHILD_TIMEOUT_MS, and would catch the old default SIGTERM to
    // exit 0. Before the fix spawnSync returned {status:0, signal:null, error:ETIMEDOUT} and the
    // status-only dispatcher allowed the commit. SIGKILL now bypasses the handler, and ETIMEDOUT
    // independently makes the actual dispatcher fail closed.
    const preload = join(dir, 'timeout-exit0-preload.mjs');
    writeFileSync(preload, [
      `if ((process.argv[1] || '').endsWith('/review-gate.mjs')) {`,
      `  const realExit = process.exit.bind(process);`,
      `  process.exit = () => {};`,
      `  const hold = setInterval(() => {}, 60_000);`,
      `  process.on('SIGTERM', () => { clearInterval(hold); realExit(0); });`,
      `}`,
    ].join('\n'));
    const r = runDispatcher(dir, 'git commit -m x', {
      NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`,
    });
    assert.equal(r.status, 2, 'timeout+attempted exit 0 must not pass the commit');
    assert.match(r.stderr, /commit gate 'review-gate\.mjs' did not run cleanly \(ETIMEDOUT\)/);
  });
});

test('signal-only gate death blocks and the diagnostic names the signal (not exit null)', () => {
  withRepo(LOW, (dir) => {
    // Kill only the REAL acceptance-gate child during its preload. spawnSync reports
    // {status:null, signal:'SIGKILL', error:undefined}; this pins both the signal decision axis and
    // the diagnostic priority r.error?.code -> r.signal -> exit status.
    const preload = join(dir, 'signal-kill-preload.mjs');
    writeFileSync(preload, [
      `if ((process.argv[1] || '').endsWith('/acceptance-gate.mjs')) {`,
      `  process.kill(process.pid, 'SIGKILL');`,
      `}`,
    ].join('\n'));
    const r = runDispatcher(dir, 'git commit -m x', {
      NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`,
    });
    assert.equal(r.status, 2, 'signal termination must fail closed');
    assert.match(r.stderr, /commit gate 'acceptance-gate\.mjs' did not run cleanly \(SIGKILL\)/);
    assert.doesNotMatch(r.stderr, /exit null/);
  });
});
