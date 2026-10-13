// #58: drive the real extension handlers and inspect persisted verification state.
// Run: node --test .omp/extensions/harness/tests/backpressure-roots.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHarness, ctxFor } from './helpers/harness-handlers.mjs';
import { mkdtempReal } from './helpers/real-tmpdir.mjs';
import { repoIdentity } from '../gates/repo-root.mjs';
import { skipUnless } from './helpers/capabilities.mjs';

const gate = join(dirname(fileURLToPath(import.meta.url)), '..', 'gates', 'backpressure-gate.mjs');
const { handlers } = await loadHarness();
const result = handlers.tool_result[0];
const state = (dir) => join(dir, '.omp', 'harness-state');
const status = (dir) => existsSync(join(state(dir), 'backpressure-status'))
  ? readFileSync(join(state(dir), 'backpressure-status'), 'utf8') : null;
const snapshot = (dir) => Object.fromEntries(['backpressure-status', 'backpressure-last-fail', 'test-history.json']
  .filter((name) => existsSync(join(state(dir), name)))
  .map((name) => [name, readFileSync(join(state(dir), name), 'utf8')]));
const seed = (dir, value) => {
  mkdirSync(state(dir), { recursive: true });
  writeFileSync(join(state(dir), 'backpressure-status'), value);
};
function git(dir, ...args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  const r = spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: dir, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function fixture(t) {
  const root = mkdtempReal('bp-roots-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const A = join(root, 'A'), B = join(root, 'B space'), outside = join(root, 'outside');
  for (const dir of [A, B, outside]) mkdirSync(dir);
  for (const dir of [A, B]) git(dir, 'init', '-q');
  return { root, A, B, outside };
}
async function bash(A, input, exitCode = 0) {
  await result({ toolName: 'bash', input: { env: { CDPATH: '' }, ...input }, isError: false, details: { exitCode } }, ctxFor(A));
}

for (const mode of ['cwd', 'cd']) {
  test(`PASS and FAIL with ${mode} belong to B, never session A`, async (t) => {
    const { A, B } = fixture(t);
    seed(A, 'PASS');
    const before = snapshot(A);
    const input = mode === 'cwd' ? { cwd: B, command: 'node --test' } : { command: `cd '${B}' && node --test` };
    await bash(A, input, 1);
    assert.equal(status(B), 'FAIL');
    assert.match(snapshot(B)['backpressure-last-fail'], /^test: /);
    await bash(A, input);
    assert.equal(status(B), 'PASS');
    assert.equal(snapshot(B)['backpressure-last-fail'], undefined);
    assert.equal(JSON.parse(snapshot(B)['test-history.json']).lastResult, 'PASS');
    assert.deepEqual(snapshot(A), before);
  });
}

test('tool cwd and a relative cd compose; nested cwd records at the toplevel', async (t) => {
  const { A, B } = fixture(t);
  mkdirSync(join(B, 'src'));
  await bash(A, { cwd: '..', command: "cd 'B space/src' && node --test" });
  assert.equal(status(B), 'PASS');
  assert.equal(status(A), null);
  assert.equal(existsSync(state(join(B, 'src'))), false);
});

test('single-worktree lifecycle remains PASS -> UNKNOWN -> FAIL -> PASS', async (t) => {
  const { A } = fixture(t);
  await bash(A, { command: 'node --test' });
  assert.equal(status(A), 'PASS');
  await result({ toolName: 'edit', input: { path: 'src/new.ts' } }, ctxFor(A));
  assert.equal(status(A), 'UNKNOWN');
  await bash(A, { command: 'node --test' }, 1);
  assert.equal(status(A), 'FAIL');
  await bash(A, { command: 'node --test' });
  assert.equal(status(A), 'PASS');
});

test('edit and write invalidate only their target worktree, including new files', async (t) => {
  const { A, B, outside } = fixture(t);
  for (const toolName of ['edit', 'write']) {
    seed(A, 'PASS'); seed(B, 'PASS');
    await result({ toolName, input: { path: join(B, 'new', 'app.ts') } }, ctxFor(A));
    assert.equal(status(B), 'UNKNOWN');
    assert.equal(status(A), 'PASS');
    await result({ toolName, input: { path: join(outside, 'app.ts') } }, ctxFor(A));
    assert.equal(status(outside), null);
    assert.equal(status(A), 'PASS');
  }
});

test('linked worktrees share identity but keep verification and hook verdicts separate', async (t) => {
  const { root, A } = fixture(t);
  writeFileSync(join(A, 'base.txt'), 'base\n');
  git(A, 'add', 'base.txt'); git(A, 'commit', '-qm', 'base');
  const B = join(root, 'linked');
  git(A, 'worktree', 'add', '--detach', B);
  assert.equal(repoIdentity(A), repoIdentity(B));
  // A high-risk staged change makes missing/stale verification observable at the gate.
  writeFileSync(join(B, 'large.ts'), Array.from({ length: 110 }, (_, i) => `export const n${i} = ${i};`).join('\n'));
  git(B, 'add', 'large.ts');
  const hook = () => spawnSync('node', [gate], {
    cwd: A, input: JSON.stringify({ mode: 'hook', session_state: { cwd: B } }), encoding: 'utf8',
  });
  seed(A, 'PASS');
  assert.equal(hook().status, 2, 'A PASS cannot authorize B');
  await bash(A, { cwd: B, command: 'node --test' });
  seed(A, 'FAIL');
  assert.equal(hook().status, 0, 'A FAIL cannot block verified B');
  await result({ toolName: 'edit', input: { path: join(B, 'large.ts') } }, ctxFor(A));
  assert.equal(status(B), 'UNKNOWN');
  assert.equal(status(A), 'FAIL');
  assert.equal(hook().status, 2, 'B edit makes B verification stale');
});

test('unknown shell cwd and non-repo cwd never change backpressure state', async (t) => {
  const { A, B, outside } = fixture(t);
  seed(A, 'PASS'); seed(B, 'FAIL');
  const beforeA = snapshot(A), beforeB = snapshot(B);
  const inputs = [
    { cwd: outside, command: 'node --test' },
    { cwd: join(B, 'missing'), command: 'node --test' },
    { command: 'cd "$TARGET" && node --test' },
    { command: 'cd missing && node --test' },
    { command: `cd '${B}' || node --test` },
    { command: `cd '${B}' && node --test && cd '${A}' && node --test` },
    { command: `bash -c "cd '${B}' && node --test"` },
    { command: `pushd '${B}' && node --test` },
    { command: `if cd '${B}'; then node --test; fi` },
  ];
  for (const input of inputs) {
    await bash(A, input);
    await bash(A, input, 1);
    assert.deepEqual(snapshot(A), beforeA, JSON.stringify(input));
    assert.deepEqual(snapshot(B), beforeB, JSON.stringify(input));
    assert.equal(existsSync(state(outside)), false);
  }
});

test('literal cd respects logical and physical symlink traversal', { skip: skipUnless('symlink') }, async (t) => {
  const { A, B } = fixture(t);
  mkdirSync(join(B, 'src'));
  symlinkSync(join(B, 'src'), join(A, 'link'), 'junction');
  await bash(A, { command: 'cd link/.. && node --test' });
  assert.equal(status(A), 'PASS');
  assert.equal(status(B), null);
  await bash(A, { command: 'cd -P link/.. && node --test' }, 1);
  assert.equal(status(B), 'FAIL');
  assert.equal(status(A), 'PASS');
});

test('device preview/apply invalidate B without resetting A', async (t) => {
  const { A, B } = fixture(t);
  const file = join(B, 'src', 'app.ts');
  for (const applied of [false, true]) {
    seed(A, 'PASS'); seed(B, 'PASS');
    await result({
      toolName: 'write', input: { path: 'xd://ast_edit', content: JSON.stringify({ paths: [file] }) },
      details: { xdev: { tool: 'ast_edit', mode: 'execute', inner: { applied, files: [file] } } },
    }, ctxFor(A));
    assert.equal(status(B), 'UNKNOWN');
    assert.equal(status(A), 'PASS');
  }
});

test('unresolved cwd emits a HARNESS_DEBUG diagnostic without a backpressure record', async (t) => {
  const { A } = fixture(t);
  const logs = [], captured = {};
  // loadHarness above installed the real-index resolver; capture this instance's logger.
  const { default: harness } = await import('../index.ts');
  harness({ on: (name, fn) => { captured[name] = fn; }, logger: { info: (msg) => logs.push(msg) } });
  const prior = process.env.HARNESS_DEBUG;
  process.env.HARNESS_DEBUG = '1';
  try {
    await captured.tool_result({ toolName: 'bash', input: { command: 'cd \"$D\" && node --test' } }, ctxFor(A));
    assert.equal(status(A), null);
    assert.ok(logs.some((msg) => msg.startsWith('HARNESS_DEBUG:') && msg.includes('skipped')));
  } finally {
    if (prior === undefined) delete process.env.HARNESS_DEBUG; else process.env.HARNESS_DEBUG = prior;
  }
});

test('cd does not erase missing or non-directory intermediate components', async (t) => {
  const { A, B } = fixture(t);
  writeFileSync(join(B, 'file'), 'not a directory');
  seed(A, 'PASS'); seed(B, 'PASS');
  for (const flag of ['', '-P ']) {
    for (const component of ['missing', 'file']) {
      await bash(A, { command: `cd ${flag}'${B}/${component}/..' && node --test` }, 1);
      assert.equal(status(A), 'PASS');
      assert.equal(status(B), 'PASS');
    }
  }
});

test('ordinary redirections and non-directory runner options retain PASS and FAIL', async (t) => {
  const { A, B } = fixture(t);
  seed(A, 'PASS');
  for (const command of [
    'node --test 2>&1', 'npm test > out.log', 'npm test >out 2>&1 && echo ok',
    'npm test >& out.log', 'npm test &> out.log',
    'cargo clippy -- -D warnings', 'mvn test -DskipTests',
    'make -fCustom.mk', 'make -f Custom.mk', './configure --prefix=/usr && make',
    'pytest -k "not (slow or network)"', 'node --test --test-name-pattern="foo(bar)"',
    'npm test > "test(output).log"', 'eslint "src/**/*.{ts,tsx}"',
    'prettier --check "**/*.{ts,md}"', 'npm test -- --grep "a|b"',
  ]) {
    await bash(A, { cwd: B, command }, 1);
    assert.equal(status(B), 'FAIL', command);
    await bash(A, { cwd: B, command });
    assert.equal(status(B), 'PASS', command);
    assert.equal(status(A), 'PASS', command);
  }
});

test('surrounding blank lines and shell line continuations preserve verification attribution', async (t) => {
  const { A, B } = fixture(t);
  seed(A, 'PASS');
  for (const command of [
    '\nnode --test', '\r\nnode --test', `\ncd '${B}' && node --test`,
    'node --test\n', 'node --test\r\n', 'node --test \\\n  fixture.test.mjs',
    `cd '${B}' && node --test\n`, `cd \\\n '${B}' && node --test`,
    'node --test --test-name-pattern="foo\\\nbar"',
  ]) {
    await bash(A, { cwd: B, command }, 1);
    assert.equal(status(B), 'FAIL', command);
    await bash(A, { cwd: B, command });
    assert.equal(status(B), 'PASS', command);
    assert.equal(status(A), 'PASS', command);
  }
});

test('CDPATH makes relative cd unknown but cannot retarget structured cwd', async (t) => {
  const { A, B } = fixture(t);
  seed(A, 'PASS'); seed(B, 'PASS');
  const env = { CDPATH: B };
  await bash(A, { command: "cd '../B space' && node --test", env }, 1);
  assert.equal(status(A), 'PASS');
  assert.equal(status(B), 'PASS');
  await bash(A, { cwd: B, command: 'node --test', env }, 1);
  assert.equal(status(A), 'PASS');
  assert.equal(status(B), 'FAIL');
});

test('quoted and escaped literal cd paths keep expansion-looking filename characters', async (t) => {
  const { root, A } = fixture(t);
  seed(A, 'PASS');
  for (const [name, operand] of [
    ['B[1]', "'B[1]'"], ['B[1]', 'B\\[1\\]'], ['B$cash', "'B$cash'"], ['-B', "-- '-B'"],
  ]) {
    const B = join(root, name);
    if (!existsSync(B)) { mkdirSync(B); git(B, 'init', '-q'); }
    const input = { cwd: root, command: `cd ${operand} && node --test` };
    await bash(A, input, 1);
    assert.equal(status(B), 'FAIL', operand);
    await bash(A, input);
    assert.equal(status(B), 'PASS', operand);
    assert.equal(status(A), 'PASS');
  }
});

test('a comment cannot turn the following command line into argument data', async (t) => {
  const { A, B } = fixture(t);
  seed(A, 'FAIL'); seed(B, 'PASS');
  const beforeA = snapshot(A), beforeB = snapshot(B);
  for (const prefix of ['', '\\\n', '\\\n\\\n']) {
    const command = `node --test ${prefix}#x \\\ncd '${B}' && node --test`;
    await bash(A, { command });
    await bash(A, { command }, 1);
    assert.deepEqual(snapshot(A), beforeA);
    assert.deepEqual(snapshot(B), beforeB);
  }
  for (const prefix of ['', '\\\n']) {
    seed(A, 'FAIL');
    await bash(A, { command: `node --test ${prefix}# no directory change` });
    assert.equal(status(A), 'PASS');
  }
});
