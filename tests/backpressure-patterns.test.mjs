// Unit tests for classifyVerification() — the shared build/test/lint classifier used
// by backpressure-tracker (PostToolUse) and backpressure-failure-tracker.
//
// Run: node --test tests/backpressure-patterns.test.mjs
//
// Regression focus: a `2>&1` (or `>&2`, `&>file`) redirection must NOT be mistaken for
// a backgrounding `&` operator by the top-level splitter, otherwise a reliable `&&`
// chain like `npm test 2>&1 && deploy` is wrongly judged passReliable=false and a real
// PASS is never recorded (fail-safe, but needless friction — it forces a skip override).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyVerification } from '../.omp/extensions/harness/gates/backpressure-patterns.mjs';

test('classifies verification commands by type', () => {
  for (const [cmd, type] of [
    ['npm test', 'test'],
    ['npm t', 'test'],
    ['pnpm test:unit', 'test'],
    ['node --test', 'test'],
    ['node --test tests/x.test.mjs', 'test'],
    ['pytest', 'test'],
    ['python -m pytest', 'test'],
    ['jest', 'test'],
    ['vitest', 'test'],
    ['npm run lint', 'lint'],
    ['tsc --noEmit', 'lint'],
    ['eslint', 'lint'],
    ['npm run build', 'build'],
    ['tsc', 'build'],
    ['make', 'build'],
  ]) {
    const r = classifyVerification(cmd);
    assert.equal(r.isVerification, true, `should be verification: ${cmd}`);
    assert.equal(r.type, type, `type for: ${cmd}`);
  }
});

test('non-verification commands are not classified', () => {
  for (const cmd of [
    'echo "npm test"',          // quoted data
    'grep "npm test" file',
    'git commit -m "run npm test"',
    'npx tsc-alias',            // not tsc
    './make-release.sh',        // not make
    'cd src && ls',
    '',
  ]) {
    assert.equal(classifyVerification(cmd).isVerification, false, `should NOT be verification: ${cmd}`);
  }
});

test('passReliable is true only when success is trustworthy', () => {
  for (const cmd of [
    'npm test',                              // bare
    'npm test && deploy',                    // && chain
    'cd app && npm test',                    // matched segment last, no trailing op
    'npm test > out.log',                    // redirection only
    'npm test 2>&1',                         // fd-dup redirection (the & is NOT an operator)
    'npm test 2>&1 && deploy',               // <-- regression: 2>&1 must not break the && chain
    'npm test >out 2>&1 && echo ok',
    'npm test >& out.log',                   // >& redirection
    'npm test &> out.log',                   // &> redirection
    'bash -c "npm test"',                    // reliable inner
  ]) {
    assert.equal(classifyVerification(cmd).passReliable, true, `should be passReliable: ${cmd}`);
  }
});

test('passReliable is false when an operator can swallow the failure', () => {
  for (const cmd of [
    'npm test || true',          // || swallows failure
    'npm test ; echo ok',        // ; — overall exit is the last command
    'npm test | tee log',        // pipe head exit discarded
    'npm test 2>&1 | tail -5',   // redirection then a real pipe
    'npm test &',                // genuinely backgrounded
    'npm test & echo started',   // backgrounded then next
    'npm test 2>&1 &',           // backgrounded AFTER a redirect — still unreliable
    'npm test \\>& echo ok',     // escaped literal `>` then real backgrounding `&` (not a redirect)
  ]) {
    const r = classifyVerification(cmd);
    assert.equal(r.isVerification, true, `still a verification: ${cmd}`);
    assert.equal(r.passReliable, false, `should NOT be passReliable: ${cmd}`);
  }
});
