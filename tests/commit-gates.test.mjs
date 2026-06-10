// Integration tests for commit-gates.mjs — the single PreToolUse:Bash dispatcher that replaces the
// three separate commit-only gate registrations (acceptance/backpressure/review). Audit item #8b.
//
// Run: node --test tests/commit-gates.test.mjs
//
// Verifies: (a) a non-commit short-circuits (the spawn-saving win); (b) on a commit it delegates to
// the three gates in order, first block wins; (c) each gate's block surfaces through the dispatcher.
// The gates themselves are unchanged (covered by backpressure-gate.test.mjs etc.) — here we test the
// dispatcher wiring. Isolated temp git repos with explicit cwd (memory: feedback_shell_test_cwd_isolation).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
