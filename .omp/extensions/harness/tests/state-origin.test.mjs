// tests/state-origin.test.mjs — gate evidence is bound to the worktree that produced it (#111 F9).
//
// Run: node --test .omp/extensions/harness/tests/state-origin.test.mjs
//
// A Copy-on-Write worktree clone (omp `worktree.clone` / PI_SMART_GIT=1) copies every gitignored
// file, `.omp/harness-state/` included, so the new worktree starts with the ORIGIN's
// `backpressure-status=PASS` and read ledger. Each case produces evidence in worktree A through
// the real writer, copies A's state dir into B the way the clone does, and asserts the reader in
// B treats it as absent — paired with A still passing, so a reader that simply blocks everything
// would fail too.
//
// Ledger entries are absolute paths, so a cloned entry for `<A>/src/x.ts` never matched
// `<B>/src/x.ts` in the first place. What a clone does leak is every path that is the SAME from
// both worktrees: a file outside them, and another repo's discipline file (the cross-repo guard's
// proof of "read"). Those are the paths these cases use.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crossRepoMutationVerdict } from '../gates/cross-repo.mjs';
import { readLedger } from '../gates/state-origin.mjs';
import { skipUnless } from './helpers/capabilities.mjs';
import { mkdtempReal } from './helpers/real-tmpdir.mjs';

const GATES = join(dirname(fileURLToPath(import.meta.url)), '..', 'gates');
const stateDir = (dir) => join(dir, '.omp', 'harness-state');

function git(dir, ...args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  const r = spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: dir, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

function repo(dir, files = {}) {
  mkdirSync(dir);
  git(dir, 'init', '-q', '-b', 'main');
  for (const [rel, content] of Object.entries(files)) writeFileSync(join(dir, rel), content);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
}

/** Worktree A (main checkout) and B (a linked worktree of it), each with a staged code file:
 *  >100 lines by default, so backpressure-gate assesses the pending commit as high risk
 *  (no verification = BLOCK); a short one is medium risk (no verification = WARN, allowed). */
function fixture(t, lines = 120) {
  const root = mkdtempReal('state-origin-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const A = join(root, 'A'), B = join(root, 'B');
  repo(A);
  git(A, 'worktree', 'add', '-q', B, '-b', 'card');
  for (const dir of [A, B]) {
    writeFileSync(join(dir, 'big.ts'), 'export const x = 1;\n'.repeat(lines));
    git(dir, 'add', 'big.ts');
  }
  return { root, A, B };
}

/** What the CoW clone does to the state dir: a byte-for-byte copy into the new worktree. */
const clone = (from, to) => cpSync(stateDir(from), stateDir(to), { recursive: true });

function hook(name, cwd, tool_input) {
  return spawnSync('node', [join(GATES, name)], { input: JSON.stringify({ tool_input, session_state: { cwd } }), cwd, encoding: 'utf8' });
}
const commitGate = (cwd) => hook('backpressure-gate.mjs', cwd, { command: 'git commit -m x' });
const editGate = (cwd, file) => hook('context-gate.mjs', cwd, { file_path: file });
const recordPass = (cwd) => assert.equal(hook('backpressure-tracker.mjs', cwd, { command: 'npm test' }).status, 0);
const recordRead = (cwd, file) => assert.equal(hook('read-tracker.mjs', cwd, { file_path: file }).status, 0);

test('a cloned backpressure PASS does not verify the new worktree; its own run does', (t) => {
  const { A, B } = fixture(t);
  recordPass(A);
  assert.equal(commitGate(A).status, 0, 'the origin worktree keeps its own PASS');

  clone(A, B);
  const cloned = commitGate(B);
  assert.equal(cloned.status, 2, 'a PASS recorded in A must not allow a high-risk commit in B');
  assert.match(cloned.stderr, /HARNESS BLOCK/);

  recordPass(B);
  assert.equal(commitGate(B).status, 0, 'a verification run in B itself is accepted');
  assert.equal(commitGate(A).status, 0, 'A is untouched by what B recorded');
});

test('a status file with no origin (pre-#111 writer, or a clone of one) is not a PASS', (t) => {
  const { A } = fixture(t);
  mkdirSync(stateDir(A), { recursive: true });
  writeFileSync(join(stateDir(A), 'backpressure-status'), 'PASS');
  assert.equal(commitGate(A).status, 2, 'an unbound PASS cannot be told apart from a cloned one');
});

test('a FAIL needs no origin to block: one from a pre-#111 writer or carried by a clone still stands', (t) => {
  const { A, B } = fixture(t, 1);
  assert.equal(commitGate(B).status, 0, 'medium risk with no record at all is only warned about');
  mkdirSync(stateDir(A), { recursive: true });
  writeFileSync(join(stateDir(A), 'backpressure-status'), 'FAIL');
  assert.equal(commitGate(A).status, 2, 'an unbound FAIL is still a failed verification');

  assert.equal(hook('backpressure-failure-tracker.mjs', A, { command: 'npm test' }).status, 0);
  clone(A, B);
  assert.equal(commitGate(B).status, 2, 'a FAIL recorded in A is not downgraded to "no record" in B');
});

test('a status file the gate cannot read is not "no record"', (t) => {
  const { A } = fixture(t, 1);
  mkdirSync(join(stateDir(A), 'backpressure-status'), { recursive: true });   // EISDIR, whatever the uid
  assert.notEqual(commitGate(A).status, 0, 'an unreadable status must not downgrade to a warning');
});

test('a cloned read ledger does not prove a read in the new worktree', (t) => {
  const { root, A, B } = fixture(t);
  const shared = join(root, 'shared.ts'), other = join(root, 'other.ts');
  for (const f of [shared, other]) writeFileSync(f, 'export const y = 1;\n');
  recordRead(A, shared);
  assert.equal(editGate(A, shared).status, 0, 'the origin worktree keeps its own ledger');

  clone(A, B);
  assert.equal(editGate(B, shared).status, 2, 'a read recorded in A must not unlock the edit in B');

  recordRead(B, other);
  assert.equal(editGate(B, other).status, 0, 'a read in B itself is accepted');
  assert.equal(editGate(B, shared).status, 2, 'recording in B does not adopt the cloned entries');
  assert.equal(editGate(A, shared).status, 0, 'A is untouched by what B recorded');
});

test('a ledger with no origin is not trusted, and write-tracker records beside it without adopting it', (t) => {
  const { root, A } = fixture(t);
  const legacy = join(root, 'legacy.ts'), mine = join(root, 'mine.ts');
  for (const f of [legacy, mine]) writeFileSync(f, 'export const y = 1;\n');
  mkdirSync(stateDir(A), { recursive: true });
  writeFileSync(join(stateDir(A), 'read-log.txt'), `${legacy}\n`);
  assert.equal(editGate(A, legacy).status, 2, 'an unbound ledger cannot be told apart from a cloned one');

  assert.equal(hook('write-tracker.mjs', A, { file_path: mine }).status, 0);
  assert.equal(editGate(A, mine).status, 0, 'a write in this worktree is accepted');
  assert.equal(editGate(A, legacy).status, 2, 'the unbound entries are not adopted');
});

test('recording over a cloned ledger only appends, so trackers running at once cannot erase each other', (t) => {
  const { root, A, B } = fixture(t);
  const seed = join(root, 'seed.ts'), mine = join(root, 'mine.ts');
  recordRead(A, seed);
  clone(A, B);
  const log = join(stateDir(B), 'read-log.txt');
  const before = readFileSync(log, 'utf8');
  recordRead(B, mine);
  const after = readFileSync(log, 'utf8');
  assert.ok(after.length > before.length && after.startsWith(before), 'the bytes already in the file are never rewritten');
  const ledger = readLedger(B);
  assert.deepEqual([ledger.has(mine), ledger.has(seed)], [true, false], 'B trusts its own entry and not the cloned one');
});

test('a path with a line break cannot write ledger lines of its own, an origin line included', (t) => {
  const { root, A, B } = fixture(t);
  const smuggled = join(root, 'smuggled.ts'), shared = join(root, 'shared.ts');
  recordRead(A, join(root, 'plain.ts'));
  recordRead(A, `${join(root, 'x')}\n${smuggled}`);
  recordRead(A, `${join(root, 'y')}\n#origin ${B}\n${shared}`);
  assert.equal(readLedger(A).has(smuggled), false, 'not an entry where it was recorded');
  clone(A, B);
  assert.equal(readLedger(B).has(shared), false, 'and not a section opened for the clone');
});

test('a cloned ledger does not prove the other repo\'s discipline file was read (cross-repo guard)', (t) => {
  const { root, A, B } = fixture(t);
  const external = join(root, 'external');
  repo(external, { 'AGENTS.md': '# external rules\n', 'b.txt': 'b\n' });
  const target = join(external, 'b.txt');
  recordRead(A, join(external, 'AGENTS.md'));
  assert.equal(crossRepoMutationVerdict(target, A), null, 'the session that read the discipline file may edit');

  clone(A, B);
  assert.match(crossRepoMutationVerdict(target, B)?.block ?? '', /HARNESS BLOCK/, 'the clone has not read it');
});

test('evidence recorded through a symlinked spelling of the worktree is still its own', { skip: skipUnless('symlink') }, (t) => {
  const { root, A } = fixture(t);
  const link = join(root, 'link');
  symlinkSync(A, link);
  recordPass(link);                                // a session whose cwd is the link
  assert.equal(commitGate(A).status, 0, 'the pre-commit hook runs from the physical toplevel and must see that PASS');
});
