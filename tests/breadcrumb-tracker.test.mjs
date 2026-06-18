// Unit tests for breadcrumb-tracker.mjs (seed AC1) — no-LLM session breadcrumb.
// Run: node --test tests/breadcrumb-tracker.test.mjs
// The gate writes <cwd>/.omp/harness-state/session-log.jsonl from session_state.cwd.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', '.omp', 'extensions', 'harness', 'gates', 'breadcrumb-tracker.mjs');

function run(toolName, toolInput, dir) {
  return spawnSync('node', [GATE], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput, session_state: { cwd: dir } }),
    encoding: 'utf-8',
  });
}
function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'breadcrumb-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
function log(dir) {
  const f = join(dir, '.omp', 'harness-state', 'session-log.jsonl');
  return existsSync(f) ? readFileSync(f, 'utf-8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
}

test('bash commit -> commit breadcrumb', () => {
  withDir((dir) => {
    assert.equal(run('Bash', { command: 'git commit -m "feat: x"' }, dir).status, 0);
    const e = log(dir);
    assert.equal(e.length, 1);
    assert.equal(e[0].kind, 'commit');
    assert.match(e[0].cmd, /git commit/);
  });
});

test('bash verification -> test breadcrumb with PASS/FAIL', () => {
  withDir((dir) => {
    run('Bash', { command: 'npm test' }, dir);
    run('Bash', { command: 'npm test', failed: true }, dir);
    const e = log(dir);
    assert.equal(e.length, 2);
    assert.equal(e[0].kind, 'test');
    assert.equal(e[0].result, 'PASS');
    assert.equal(e[1].result, 'FAIL');
  });
});

test('ordinary bash (ls) -> no breadcrumb (noise skipped)', () => {
  withDir((dir) => {
    run('Bash', { command: 'ls -la' }, dir);
    assert.equal(log(dir).length, 0);
  });
});

test('Write -> edit breadcrumb; current-scope.md -> scope', () => {
  withDir((dir) => {
    run('Write', { file_path: join(dir, 'src', 'foo.ts') }, dir);
    run('Write', { file_path: join(dir, 'docs', 'harness', 'current-scope.md') }, dir);
    const e = log(dir);
    assert.equal(e.length, 2);
    assert.equal(e[0].kind, 'edit');
    assert.match(e[0].file, /foo\.ts/);
    assert.equal(e[1].kind, 'scope');
  });
});

test('bad input -> exit 0, no crash, no log', () => {
  withDir((dir) => {
    const r = spawnSync('node', [GATE], { input: 'not json', encoding: 'utf-8' });
    assert.equal(r.status, 0);
  });
});

// --- review fixes (MEDIUM phantom-commit, LOW basename) ---

test('bash commit that FAILED -> result FAIL, no phantom hash', () => {
  withDir((dir) => {
    run('Bash', { command: 'git commit -m x', failed: true }, dir);
    const e = log(dir);
    assert.equal(e.length, 1);
    assert.equal(e[0].kind, 'commit');
    assert.equal(e[0].result, 'FAIL');
    assert.equal(e[0].hash, undefined);
  });
});

test('Write to a prefixed *-current-scope.md -> edit, not scope (basename anchor)', () => {
  withDir((dir) => {
    run('Write', { file_path: join(dir, 'my-current-scope.md') }, dir);
    assert.equal(log(dir)[0].kind, 'edit');
  });
});

// --- no-LLM guarantee (AC1/AC5): the breadcrumb gates must never call a model/network.
// This is what makes AC2/AC5 free — append-per-event to disk (no in-memory state to flush,
// no shutdown LLM summary). Guards against a future regression adding an LLM call. ---

import { dirname as _dir } from 'node:path';
const GATES = _dir(GATE);

test('breadcrumb gates make NO LLM/network call (no-LLM guarantee)', () => {
  for (const g of ['breadcrumb-tracker.mjs', 'breadcrumb-surface.mjs']) {
    const src = readFileSync(join(GATES, g), 'utf-8');
    assert.doesNotMatch(src, /fetch\(|https?:\/\/|\bmodel\b|completion|anthropic|openai|sendMessage/i, `${g} must stay no-LLM`);
  }
});
