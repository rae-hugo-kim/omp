// selective-commit-probe.test.mjs — selective-commit probe (#139) of gates/harness-version-check.mjs.
//
// On every call the gate asks `omp config get commit.enabled --json` in the session root and, while the
// answer's `value` is `true`, emits HARNESS SELECTIVE COMMIT ON with the `.omp/config.yml` fix. Contract
// under test:
//   - `value: true` => the reminder, naming the file, the `commit:` key and `enabled: false` — on a session
//     start, a turn-start recheck and a manual run alike, and again on the next call (no notice marker:
//     the reminder stops the moment the file is fixed, like HARNESS STALE)
//   - `value: false` => silent
//   - an omp that does not know the key (`Unknown setting`, exit 1 — omp < 18.20.1), an omp missing
//     from PATH, or a hung omp => silent, exit 0, nothing on stderr
//   - an answer that is not a JSON object with a boolean `true` (the plain, ANSI-wrapped `true` of a
//     FORCE_COLOR shell; a string "true"; garbage) => silent — the probe never guesses
//   - the question is exactly `config get commit.enabled --json`, asked IN the session root (native project
//     settings are `<cwd>/.omp/config.yml`, no ancestor walk), so the probe sees what the session sees
//   - runs before the source-repo skip: the source repo (no `source_remote`) and a consumer both get it
//
// `omp` is always a stub placed FIRST on PATH (or absent from PATH), so no case here reads the host's
// real omp — CI has none. The stub is a #!/bin/sh script, which CreateProcess cannot run: POSIX-only.
// The fixture root is a PHYSICAL path (mkdtempReal): the stub records `$PWD`, which the shell resolves,
// and on macOS the raw tmpdir is a symlinked alias (/var -> /private/var).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync, symlinkSync } from 'node:fs';
import { mkdtempReal } from './helpers/real-tmpdir.mjs';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skipUnless } from './helpers/capabilities.mjs';

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'gates', 'harness-version-check.mjs');
const POSIX_ONLY = process.platform === 'win32' ? 'the omp stub is a #!/bin/sh script (not runnable through CreateProcess)' : false;
const NOTICE = 'HARNESS SELECTIVE COMMIT ON';

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

// Fixture: a plain directory carrying a harness-meta.json — the source repo by default. `consumer`
// adds a `source_remote` pointing at an EMPTY bare repo: the drift probe finds no harness tag there
// and stays silent, so stdout is this probe's alone.
function makeRepo({ consumer = false } = {}) {
  const root = mkdtempReal('scp-');
  const repo = join(root, 'repo');
  mkdirSync(join(repo, '.omp', 'extensions', 'harness'), { recursive: true });
  const meta = { version: '2026.91' };
  if (consumer) {
    git(root, ['init', '-q', '--bare', join(root, 'source.git')]);
    meta.source_remote = `file://${join(root, 'source.git')}`;
  }
  writeFileSync(join(repo, '.omp', 'extensions', 'harness', 'harness-meta.json'), JSON.stringify(meta));
  return { root, repo };
}

function withRepo(opts, fn) {
  const fx = makeRepo(opts);
  try { return fn(fx); } finally { rmSync(fx.root, { recursive: true, force: true }); }
}

function runGate(cwd, env, payload = {}, timeout) {
  return spawnSync('node', [GATE], {
    input: JSON.stringify({ session_state: { cwd }, ...payload }),
    cwd,
    encoding: 'utf-8',
    env: { ...cleanEnv(), ...env },
    timeout,
  });
}

// The stub records how it was asked (argv and cwd) so a case can pin the question, not just the answer.
function ompStubEnv(fx, body) {
  const bin = join(fx.root, 'stub-bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'omp'), `#!/bin/sh\nprintf '%s\\n' "$PWD" "$*" >> "${join(fx.root, 'omp-calls.log')}"\n${body}\n`, { mode: 0o755 });
  return { PATH: `${bin}${delimiter}${process.env.PATH}` };
}
// `omp config get <key> --json` prints `{"key","value","type","description"}` on stdout and exits 0 (the
// plain form is ANSI-wrapped under FORCE_COLOR, which is why the gate asks for JSON); an unknown key (omp
// before 18.20.1) prints `Unknown setting: <key>` on stderr and exits 1 (all measured on 18.22.0, 2026-11-18).
const JSON_QUESTION = 'config get commit.enabled --json';
const answerJson = (value) => JSON.stringify({ key: 'commit.enabled', value, type: 'boolean', description: 'Enable the commit eval prelude and /commit' }, null, 2);
// `raw` is printed verbatim as omp's stdout for the question; `configAnswers` wraps a value in the real shape.
const configPrints = (fx, raw) => ompStubEnv(fx, `case "$*" in "${JSON_QUESTION}") printf '%s\\n' '${raw}';; *) echo "omp/18.22.0";; esac`);
const configAnswers = (fx, value) => configPrints(fx, answerJson(value));
const configUnknown = (fx) => ompStubEnv(fx, `case "$*" in config*) echo "Unknown setting: $3" >&2; exit 1;; *) echo "omp/18.22.0";; esac`);
const calls = (fx) => (existsSync(join(fx.root, 'omp-calls.log')) ? readFileSync(join(fx.root, 'omp-calls.log'), 'utf-8') : '');

test('commit.enabled true: the reminder names the fix and repeats on every call (session start, turn start, manual run)', { skip: POSIX_ONLY }, () => {
  withRepo({}, (fx) => {
    const env = configAnswers(fx, true);
    const payloads = { 'session start': { has_ui: true }, 'turn-start recheck': { max_age_ms: 3_600_000 }, 'manual run': {} };
    for (const [name, payload] of Object.entries(payloads)) {
      const r = runGate(fx.repo, env, payload);
      assert.equal(r.status, 0, `${name}: exit must stay 0: ${r.stderr}`);
      assert.ok(r.stdout.startsWith(NOTICE), `${name}: stdout must lead with the reminder, got: ${r.stdout}`);
      assert.match(r.stdout, /set `enabled: false` under the top-level `commit:` key/, `${name}: the fix must name the key to set, not a block to append`);
      assert.match(r.stdout, /\.omp\/config\.yml/, `${name}: the fix must name the file`);
      assert.match(r.stdout, /new session/, `${name}: the setting takes effect at the next session start`);
      assert.equal(r.stderr, '', `${name}: nothing on stderr`);
    }
    // No notice marker throttles it: the next call reminds again, and nothing of the probe's is left on disk.
    const again = runGate(fx.repo, env, { has_ui: true });
    assert.ok(again.stdout.startsWith(NOTICE), 'a second session start must remind again — the reminder is not a one-shot');
    const stateDir = join(fx.repo, '.omp', 'state');
    const files = existsSync(stateDir) ? readdirSync(stateDir) : [];
    assert.deepEqual(files.filter((f) => f !== 'omp-version.json'), [], 'the probe writes no marker of its own (omp-version.json is the #31 record)');
  });
});

test('the probe asks exactly `config get commit.enabled --json`, in the session root', { skip: POSIX_ONLY }, () => {
  withRepo({}, (fx) => {
    const r = runGate(fx.repo, configAnswers(fx, true));
    assert.ok(r.stdout.startsWith(NOTICE));
    const lines = calls(fx).trim().split('\n');
    const idx = lines.indexOf(JSON_QUESTION);
    assert.ok(idx > 0, `omp must be asked \`${JSON_QUESTION}\`, calls were: ${lines.join(' | ')}`);
    assert.equal(lines[idx - 1], fx.repo, 'the question is asked with cwd = session root, where omp reads <cwd>/.omp/config.yml');
  });
});

test('commit.enabled false is silent', { skip: POSIX_ONLY }, () => {
  withRepo({}, (fx) => {
    const r = runGate(fx.repo, configAnswers(fx, false), { has_ui: true });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout + r.stderr, '', 'no reminder and nothing on stderr');
    assert.ok(calls(fx).includes('config get commit.enabled'), 'the question was still asked');
  });
});

test('an omp without the key (`Unknown setting`, exit 1 — omp < 18.20.1) is silent, exit 0', { skip: POSIX_ONLY }, () => {
  withRepo({}, (fx) => {
    const r = runGate(fx.repo, configUnknown(fx), { has_ui: true });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout + r.stderr, '', 'no reminder, and omp\'s stderr must not leak into the session-start note');
    assert.ok(calls(fx).includes('config get commit.enabled'), 'the question was asked and answered with exit 1');
  });
});

// Only a JSON object whose `value` is the boolean true reminds. The plain `true` an older caller would
// compare is exactly what FORCE_COLOR wraps in ANSI codes (`\e[32mtrue\e[39m`, measured; NO_COLOR does
// not undo it), a string "true" is not a YAML boolean, and a false reminder would nag a checkout that is
// already configured — so every other shape stays silent.
test('only a JSON `value: true` reminds — plain, ANSI-wrapped, string, or malformed answers are silent', { skip: POSIX_ONLY }, () => {
  // Each entry is the stub's stdout for the question: a literal, or a printf FORMAT (real ESC bytes).
  const answers = {
    'plain true': { literal: 'true' },
    'ANSI-wrapped true (FORCE_COLOR)': { format: '\\033[32mtrue\\033[39m\\n' },
    'string "true"': { literal: answerJson('true') },
    'value 1': { literal: answerJson(1) },
    'no value key': { literal: JSON.stringify({ key: 'commit.enabled' }) },
    'empty': { literal: '' },
    'truncated JSON': { literal: '{"key": "commit.enabled", "value": tr' },
  };
  for (const [name, answer] of Object.entries(answers)) {
    withRepo({}, (fx) => {
      const env = answer.format
        ? ompStubEnv(fx, `case "$*" in "${JSON_QUESTION}") printf '${answer.format}';; *) echo "omp/18.22.0";; esac`)
        : configPrints(fx, answer.literal);
      const r = runGate(fx.repo, env);
      assert.equal(r.status, 0, `${name}: exit must stay 0`);
      assert.equal(r.stdout + r.stderr, '', `${name}: must stay silent`);
    });
  }
});

// PATH holds ONLY a node symlink: `omp` is absent no matter where the host installed it (it may sit
// beside node or git), which is the CI case.
test('omp missing from PATH is silent, exit 0', { skip: POSIX_ONLY || skipUnless('symlink') }, () => {
  withRepo({}, (fx) => {
    const bin = join(fx.root, 'node-only-bin');
    mkdirSync(bin);
    symlinkSync(process.execPath, join(bin, 'node'));
    const r = runGate(fx.repo, { PATH: bin }, { has_ui: true });
    assert.equal(r.status, 0, `exit must stay 0: ${r.stderr}`);
    assert.equal(r.stdout + r.stderr, '', 'no reminder and no error output');
  });
});

// The probe bounds `omp config get` with a hard kill: an omp that ignores SIGTERM must not hold the gate
// (and the session start behind it) until the process gives up on its own, 20s later here.
test('a hung omp that ignores SIGTERM is cut off at the probe timeout — silent, exit 0', { skip: POSIX_ONLY }, () => {
  withRepo({}, (fx) => {
    const r = runGate(fx.repo, ompStubEnv(fx, "trap '' TERM; exec sleep 20"), {}, 10_000);
    assert.equal(r.status, 0, `the gate must return on its own well inside 10s (signal: ${r.signal})`);
    assert.equal(r.stdout + r.stderr, '', 'no reminder and no error output');
  });
});

test('runs before the source-repo skip: the source repo and a consumer are both reminded', { skip: POSIX_ONLY }, () => {
  withRepo({}, (fx) => {
    assert.ok(runGate(fx.repo, configAnswers(fx, true)).stdout.startsWith(NOTICE), 'source repo (no source_remote)');
  });
  withRepo({ consumer: true }, (fx) => {
    assert.ok(runGate(fx.repo, configAnswers(fx, true)).stdout.startsWith(NOTICE), 'consumer repo (source_remote set)');
  });
});
