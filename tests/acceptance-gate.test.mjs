// Unit tests for acceptance-gate.mjs (PreToolUse: Bash, git commit).
//
// Run: node --test tests/acceptance-gate.test.mjs
//
// Focus: PR-1 of the closeout/freshen design — a CLOSED seed (`status: done` =
// completed via closeout, `status: superseded` = replaced) carries no ACTIVE
// acceptance criteria, so its AC must NOT gate new/unrelated commits. Regression
// guards keep an `approved` (active) seed enforcing, and the stale-safe warn+pass
// when AC are defined but no current-scope.md tracking file exists.
//
// The gate reads files only (no git), so a plain temp dir suffices — no repo init.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', '.omp', 'extensions', 'harness', 'gates', 'acceptance-gate.mjs');

const AC_BLOCK = 'acceptance_criteria:\n  - id: AC1\n    title: do the thing\n';

function withDir(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'acc-gate-'));
  mkdirSync(join(dir, 'docs', 'harness'), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    writeFileSync(join(dir, 'docs', 'harness', rel), content);
  }
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

function runGate(dir, command = 'git commit -m x') {
  return spawnSync('node', [GATE], {
    input: JSON.stringify({ tool_input: { command }, session_state: { cwd: dir } }),
    cwd: dir,
    encoding: 'utf-8',
  });
}

const UNCHECKED_SCOPE = '# Scope\n\n## Acceptance Criteria\n\n- [ ] not done yet\n';

// --- closed seed (done / superseded) -> no active AC -> allow ---

test('seed status:done -> allow even with an unchecked current-scope (closed task)', () => {
  withDir({ 'seed.yaml': `status: done\ncompleted: 2026-05-21\n${AC_BLOCK}`, 'current-scope.md': UNCHECKED_SCOPE }, (dir) => {
    assert.equal(runGate(dir).status, 0);
  });
});

test('seed status:superseded -> allow (replaced task, AC obsolete)', () => {
  withDir({ 'seed.yaml': `status: superseded\n${AC_BLOCK}`, 'current-scope.md': UNCHECKED_SCOPE }, (dir) => {
    assert.equal(runGate(dir).status, 0);
  });
});

test('quoted status ("done") is recognized as closed -> allow', () => {
  withDir({ 'seed.yaml': `status: "done"\n${AC_BLOCK}`, 'current-scope.md': UNCHECKED_SCOPE }, (dir) => {
    assert.equal(runGate(dir).status, 0);
  });
});

// --- regression: an ACTIVE (approved) seed still enforces ---

test('seed status:approved + unchecked current-scope -> BLOCK (active task still gated)', () => {
  withDir({ 'seed.yaml': `status: approved\n${AC_BLOCK}`, 'current-scope.md': UNCHECKED_SCOPE }, (dir) => {
    assert.equal(runGate(dir).status, 2);
  });
});

// --- WIP bypass: an in-progress commit may pass unmet AC (still warns) ---

test('approved + unchecked + `wip:` message -> allow (WIP bypass), still warns', () => {
  withDir({ 'seed.yaml': `status: approved\n${AC_BLOCK}`, 'current-scope.md': UNCHECKED_SCOPE }, (dir) => {
    const r = runGate(dir, 'git commit -m "wip: partway through"');
    assert.equal(r.status, 0);
    assert.match(r.stderr, /WIP commit/i);
  });
});

test('approved + unchecked + `[wip]` tag (bundled -am) -> allow', () => {
  withDir({ 'seed.yaml': `status: approved\n${AC_BLOCK}`, 'current-scope.md': UNCHECKED_SCOPE }, (dir) => {
    assert.equal(runGate(dir, 'git commit -am "[wip] checkpoint"').status, 0);
  });
});

test('approved + unchecked + a NON-wip message -> BLOCK (bypass is marker-gated)', () => {
  withDir({ 'seed.yaml': `status: approved\n${AC_BLOCK}`, 'current-scope.md': UNCHECKED_SCOPE }, (dir) => {
    assert.equal(runGate(dir, 'git commit -m "feat: done for real"').status, 2);
  });
});

test('precedence: a closed (done) seed + wip message exits via the closed-seed path, not wip', () => {
  withDir({ 'seed.yaml': `status: done\n${AC_BLOCK}`, 'current-scope.md': UNCHECKED_SCOPE }, (dir) => {
    const r = runGate(dir, 'git commit -m "wip: x"');
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.stderr, /WIP commit/i);   // closed-seed early-exit precedes the wip bypass
  });
});

test('seed status:approved + all AC checked -> allow', () => {
  withDir({ 'seed.yaml': `status: approved\n${AC_BLOCK}`, 'current-scope.md': '## Acceptance Criteria\n\n- [x] done\n' }, (dir) => {
    assert.equal(runGate(dir).status, 0);
  });
});

// --- stale-safe: AC defined but no current-scope.md -> warn + pass (not block) ---

test('approved seed with AC but no current-scope.md -> warn + allow (no false block)', () => {
  withDir({ 'seed.yaml': `status: approved\n${AC_BLOCK}` }, (dir) => {
    const r = runGate(dir);
    assert.equal(r.status, 0);
    assert.match(r.stderr, /no current-scope\.md/i);
  });
});

// --- non-commit and no-context cases ---

test('not a git commit -> allow', () => {
  withDir({ 'seed.yaml': `status: approved\n${AC_BLOCK}`, 'current-scope.md': UNCHECKED_SCOPE }, (dir) => {
    assert.equal(runGate(dir, 'git status').status, 0);
  });
});

test('acceptance-done flag overrides a blocking active task', () => {
  withDir({ 'seed.yaml': `status: approved\n${AC_BLOCK}`, 'current-scope.md': UNCHECKED_SCOPE, 'acceptance-done': '' }, (dir) => {
    assert.equal(runGate(dir).status, 0);
  });
});

// --- parser contract: only a top-level, uncommented status closes the seed ---

test('status:done with no space still closes the seed -> allow', () => {
  withDir({ 'seed.yaml': `status:done\n${AC_BLOCK}`, 'current-scope.md': UNCHECKED_SCOPE }, (dir) => {
    assert.equal(runGate(dir).status, 0);
  });
});

test('done seed with NO current-scope.md (the actual repo dogfood shape) -> allow', () => {
  withDir({ 'seed.yaml': `status: done\ncompleted: 2026-05-21\n${AC_BLOCK}` }, (dir) => {
    assert.equal(runGate(dir).status, 0);
  });
});

test('commented / indented status does NOT close an active seed (fail-closed)', () => {
  // A `# status: done` comment or a nested/indented status must not disable the gate;
  // only the real top-level `status: approved` counts -> still blocks unchecked AC.
  withDir({ 'seed.yaml': `# status: done\nstatus: approved\n${AC_BLOCK}`, 'current-scope.md': UNCHECKED_SCOPE }, (dir) => {
    assert.equal(runGate(dir).status, 2);
  });
  withDir({ 'seed.yaml': `meta:\n  status: done\nstatus: approved\n${AC_BLOCK}`, 'current-scope.md': UNCHECKED_SCOPE }, (dir) => {
    assert.equal(runGate(dir).status, 2);
  });
});
