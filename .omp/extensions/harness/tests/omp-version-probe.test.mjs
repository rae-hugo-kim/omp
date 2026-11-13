// omp-version-probe.test.mjs — omp update probe (#31) of gates/harness-version-check.mjs.
//
// At session start the gate compares `omp --version` with the version recorded in
// .omp/state/omp-version.json. Contract under test:
//   - changed version => ONE `HARNESS NOTE` naming old -> new and the record moves; the same version
//     on the next start is silent
//   - the note routes a consumer repo to harness-check and the source repo to harness-friction
//   - no usable record (first run, corrupt, not a version) => record only, no note
//   - omp unrunnable, or no version line in its output => nothing at all (no note, no record write)
//   - only a session start whose output reaches a UI (`has_ui: true` from index.ts) probes; a mid-session
//     recheck, a UI-less session start (`omp -p`, a subagent) or a manual run never notes or records
//   - an `omp/`-prefixed line outranks other version-shaped lines; a hung omp is killed at the timeout
//   - a linked worktree neither notes nor records; the main checkout notes once
//   - the note is still emitted when the record cannot be written
//
// `omp` is always a stub placed FIRST on PATH (or absent from PATH), so no case here reads the host's
// real omp — CI has none. The stub is a #!/bin/sh script, which CreateProcess cannot run: POSIX-only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skipUnless } from './helpers/capabilities.mjs';

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'gates', 'harness-version-check.mjs');
const POSIX_ONLY = process.platform === 'win32' ? 'the omp stub is a #!/bin/sh script (not runnable through CreateProcess)' : false;

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
// and stays silent, so stdout is the omp probe's alone. `linked` makes `repo` a git checkout with
// the meta committed and adds a `git worktree add` checkout at `wt`.
function makeRepo({ consumer = false, linked = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ovp-'));
  const repo = join(root, 'repo');
  mkdirSync(join(repo, '.omp', 'extensions', 'harness'), { recursive: true });
  const meta = { version: '2026.90' };
  if (consumer) {
    git(root, ['init', '-q', '--bare', join(root, 'source.git')]);
    meta.source_remote = `file://${join(root, 'source.git')}`;
  }
  writeFileSync(join(repo, '.omp', 'extensions', 'harness', 'harness-meta.json'), JSON.stringify(meta));
  const fx = { root, repo, wt: join(root, 'wt') };
  if (linked) {
    git(repo, ['init', '-q', '-b', 'trunk']);
    git(repo, ['add', '.omp']);
    git(repo, ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'harness']);
    git(repo, ['worktree', 'add', '-q', '-b', 'feature', fx.wt]);
  }
  return fx;
}

function withRepo(opts, fn) {
  const fx = makeRepo(opts);
  try { return fn(fx); } finally { rmSync(fx.root, { recursive: true, force: true }); }
}

// The default payload is the session start of a session WITH a UI — the only call that probes.
const UI_SESSION_START = { has_ui: true };
function runGate(cwd, env, payload = UI_SESSION_START, timeout) {
  return spawnSync('node', [GATE], {
    input: JSON.stringify({ session_state: { cwd }, ...payload }),
    cwd,
    encoding: 'utf-8',
    env: { ...cleanEnv(), ...env },
    timeout,
  });
}

function ompStubEnv(fx, body) {
  const bin = join(fx.root, 'stub-bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'omp'), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return { PATH: `${bin}${delimiter}${process.env.PATH}` };
}
const ompAt = (fx, version) => ompStubEnv(fx, `echo "omp/${version}"`);
const recordPath = (dir) => join(dir, '.omp', 'state', 'omp-version.json');
function writeRecord(dir, content) {
  mkdirSync(dirname(recordPath(dir)), { recursive: true });
  writeFileSync(recordPath(dir), typeof content === 'string' ? content : JSON.stringify(content));
}
const recorded = (dir) => JSON.parse(readFileSync(recordPath(dir), 'utf-8')).version;
const STALE = JSON.stringify({ version: '18.18.4' });

test('a recorded version that differs from `omp --version` emits ONE HARNESS NOTE, moves the record, then stays silent', { skip: POSIX_ONLY }, () => {
  withRepo({}, (fx) => {
    writeRecord(fx.repo, STALE);
    const env = ompAt(fx, '18.18.6');

    const first = runGate(fx.repo, env);
    assert.equal(first.status, 0, 'advisory — exit stays 0');
    const lines = first.stdout.trim().split('\n');
    assert.equal(lines.length, 1, `exactly one notice line, got: ${JSON.stringify(first.stdout)}`);
    assert.ok(lines[0].startsWith('HARNESS NOTE: omp '), `must lead with HARNESS NOTE, got: ${JSON.stringify(lines[0])}`);
    const from = lines[0].indexOf('18.18.4');
    assert.ok(from !== -1 && lines[0].indexOf('18.18.6') > from, `notice must name old -> new, got: ${JSON.stringify(lines[0])}`);
    assert.equal(recorded(fx.repo), '18.18.6', 'the record must move to the current version');

    const second = runGate(fx.repo, env);
    assert.equal(second.stdout.trim(), '', 'restarting on the same version must be silent');
    assert.equal(recorded(fx.repo), '18.18.6');
  });
});

test('the notice routes a consumer repo to harness-check and the source repo to harness-friction', { skip: POSIX_ONLY }, () => {
  withRepo({ consumer: true }, (fx) => {
    writeRecord(fx.repo, STALE);
    const out = runGate(fx.repo, ompAt(fx, '18.18.6')).stdout;
    assert.ok(out.includes('/skill:harness-check'), `consumer notice must route to harness-check, got: ${JSON.stringify(out)}`);
    assert.ok(!out.includes('harness-friction'), 'the friction audit is a source-repo skill — a consumer does not carry it');
  });
  withRepo({}, (fx) => {
    writeRecord(fx.repo, STALE);
    const out = runGate(fx.repo, ompAt(fx, '18.18.6')).stdout;
    assert.ok(out.includes('/skill:harness-friction'), `source notice must route to harness-friction, got: ${JSON.stringify(out)}`);
    assert.ok(!out.includes('harness-check'), 'the source repo has nothing to sync from');
  });
});

test('a first run (no record) records the current version without a notice', { skip: POSIX_ONLY }, () => {
  withRepo({}, (fx) => {
    const r = runGate(fx.repo, ompAt(fx, '18.18.6'));
    assert.equal(r.stdout.trim(), '', 'nothing to compare against — no notice');
    assert.equal(recorded(fx.repo), '18.18.6', 'the baseline must be recorded for the next start');
  });
});

// A record the probe cannot trust (corrupt JSON, wrong type, not a version, absurdly long) is the
// first-run case: nothing reliable to name as the "old" version, so it is replaced silently.
test('an unreadable record is treated as a first run — replaced, never echoed', { skip: POSIX_ONLY }, () => {
  const overlong = { version: `1.2.3-${'a'.repeat(5000)}` };
  for (const bad of ['{not json', 'null', '{}', { version: 18 }, { version: 'latest; rm -rf ~' }, overlong]) {
    withRepo({}, (fx) => {
      writeRecord(fx.repo, bad);
      const label = JSON.stringify(bad).slice(0, 60);
      const r = runGate(fx.repo, ompAt(fx, '18.18.6'));
      assert.equal(r.stdout.trim(), '', `record ${label} must not produce a notice`);
      assert.equal(recorded(fx.repo), '18.18.6', `record ${label} must be replaced`);
    });
  }
});

// An `omp/`-prefixed line is the version line and outranks everything else; without one, the first
// line shaped like a version is used. Text after the version and unrelated lines are ignored, so a
// cosmetic change to `omp --version` does not silently switch the probe off, and a banner naming
// ANOTHER version ("omp 18.20.0 is available") is not mistaken for the installed one.
test('the version is read from a version line with trailing text, a `v` prefix, CRLF, or a banner line before it', { skip: POSIX_ONLY }, () => {
  const stubs = {
    'trailing build info': 'echo "omp/18.19.0 (canary linux-x64)"',
    'bare v-prefixed version': 'echo "v18.19.0"',
    'CRLF line ending': 'printf "omp/18.19.0\\r\\n"',
    'banner line first': 'echo "A newer omp 18.20.0 is available"; echo "omp/18.19.0"',
    'version-shaped banner before the omp/ line': 'echo "omp 18.20.0 is available"; echo "omp/18.19.0"',
    'bare-version banner before the omp/ line': 'echo "18.20.0 released - run omp update"; echo "omp/18.19.0"',
    'prerelease with build metadata': 'echo "omp/18.19.0-rc.1+build.5"',
  };
  for (const [name, body] of Object.entries(stubs)) {
    withRepo({}, (fx) => {
      writeRecord(fx.repo, STALE);
      const out = runGate(fx.repo, ompStubEnv(fx, body)).stdout.trim();
      const want = name === 'prerelease with build metadata' ? '18.19.0-rc.1+build.5' : '18.19.0';
      assert.ok(out.includes(`18.18.4 -> ${want} `), `${name}: notice must name ${want}, got: ${JSON.stringify(out)}`);
      assert.equal(recorded(fx.repo), want, `${name}: record must hold ${want}`);
    });
  }
});

test('an omp that fails or prints no version changes nothing — no notice, no record write, exit 0', { skip: POSIX_ONLY }, () => {
  const stubs = {
    'exits non-zero': 'exit 3',
    'prints a version but fails': 'echo "omp/18.18.6"; exit 1',
    'fails loudly on stderr': 'echo "omp: fatal" >&2; exit 1',
    'prints no version': 'echo "omp: unknown option --version"',
    'prints a version with a dangling separator': 'echo "omp/18.18.6-"',
    'prints nothing': ':',
  };
  for (const [name, body] of Object.entries(stubs)) {
    withRepo({}, (fx) => {
      const env = ompStubEnv(fx, body);
      const fresh = runGate(fx.repo, env);
      assert.equal(fresh.status, 0, `${name}: exit must stay 0`);
      assert.equal(fresh.stdout, '', `${name}: no notice`);
      assert.equal(fresh.stderr, '', `${name}: nothing on stderr either (session start surfaces both streams)`);
      assert.ok(!existsSync(recordPath(fx.repo)), `${name}: no record may be created from an unread version`);

      writeRecord(fx.repo, STALE);
      const again = runGate(fx.repo, env);
      assert.equal(again.status, 0);
      assert.equal(again.stdout + again.stderr, '', `${name}: no notice with a stale record either`);
      assert.equal(readFileSync(recordPath(fx.repo), 'utf-8'), STALE, `${name}: the record must stay byte-identical`);
    });
  }
});

// PATH holds ONLY a node symlink: `omp` is absent no matter where the host installed it (it may sit
// beside node or git), which is the CI case.
test('omp missing from PATH changes nothing — no notice, no record write, exit 0', { skip: POSIX_ONLY || skipUnless('symlink') }, () => {
  withRepo({}, (fx) => {
    const bin = join(fx.root, 'node-only-bin');
    mkdirSync(bin);
    symlinkSync(process.execPath, join(bin, 'node'));
    writeRecord(fx.repo, STALE);
    const r = runGate(fx.repo, { PATH: bin });
    assert.equal(r.status, 0, `exit must stay 0: ${r.stderr}`);
    assert.equal(r.stdout + r.stderr, '', 'no notice and no error output');
    assert.equal(readFileSync(recordPath(fx.repo), 'utf-8'), STALE, 'the record must stay byte-identical');
  });
});

// The probe bounds `omp --version` with a hard kill: an omp that ignores SIGTERM must not hold the
// gate (and the session start behind it) until the process gives up on its own, 20s later here.
test('a hung omp that ignores SIGTERM is cut off at the probe timeout — no notice, no record write, exit 0', { skip: POSIX_ONLY }, () => {
  withRepo({}, (fx) => {
    writeRecord(fx.repo, STALE);
    const r = runGate(fx.repo, ompStubEnv(fx, "trap '' TERM; exec sleep 20"), undefined, 10_000);
    assert.equal(r.status, 0, `the gate must return on its own well inside 10s (signal: ${r.signal})`);
    assert.equal(r.stdout + r.stderr, '', 'no notice and no error output');
    assert.equal(readFileSync(recordPath(fx.repo), 'utf-8'), STALE, 'the record must stay byte-identical');
  });
});

// Only a session start whose output reaches a person probes: index.ts passes `has_ui: true` from
// session_start when the session has a UI (drift-recheck-wiring.test.mjs). Every other call must
// leave the one-shot alone — no note AND no record write: the turn-start and post-commit rechecks
// hand gate stdout to the AGENT, a headless `omp -p` or subagent session start has no UI (measured
// 2026-11-13: ctx.hasUI is false there, so the note would only reach the logger), and a manual run
// carries no flag at all.
test('a call without `has_ui: true` (recheck, UI-less session start, manual run) neither notes nor records, leaving the notice for the next UI session start', { skip: POSIX_ONLY }, () => {
  withRepo({}, (fx) => {
    const env = ompAt(fx, '18.18.6');
    const others = {
      'mid-session recheck': { max_age_ms: 60 * 60 * 1000 },
      'UI-less session start': { has_ui: false },
      'no flag at all': {},
      'a truthy non-boolean flag': { has_ui: 'true' },
    };
    for (const [name, payload] of Object.entries(others)) {
      assert.equal(runGate(fx.repo, env, payload).stdout.trim(), '', `${name}: no notice`);
      assert.ok(!existsSync(recordPath(fx.repo)), `${name}: must not create the baseline`);
    }

    writeRecord(fx.repo, STALE);
    for (const [name, payload] of Object.entries(others)) {
      assert.equal(runGate(fx.repo, env, payload).stdout.trim(), '', `${name}: must not emit the notice`);
      assert.equal(readFileSync(recordPath(fx.repo), 'utf-8'), STALE, `${name}: must not move the record`);
    }

    const start = runGate(fx.repo, env);
    assert.ok(start.stdout.trim().startsWith('HARNESS NOTE: omp '), `the next session start still owes the notice, got: ${JSON.stringify(start.stdout)}`);
  });
});

// Linked worktrees neither note nor record: the note belongs to the main checkout, which emits it
// once per repo (rationale in the gate, at emitIfOmpChanged).
test('a linked worktree neither notes nor records; the main checkout emits the notice once', { skip: POSIX_ONLY }, () => {
  withRepo({ linked: true }, (fx) => {
    const env = ompAt(fx, '18.18.6');
    const noRecord = runGate(fx.wt, env);
    assert.equal(noRecord.stdout.trim(), '', `got: ${JSON.stringify(noRecord.stdout)}`);
    assert.ok(!existsSync(recordPath(fx.wt)), 'a linked worktree keeps no record of its own');

    writeRecord(fx.wt, STALE);
    writeRecord(fx.repo, STALE);
    const wt = runGate(fx.wt, env);
    assert.equal(wt.stdout.trim(), '', `a stale record inside the worktree must not trigger a notice: ${JSON.stringify(wt.stdout)}`);
    assert.equal(readFileSync(recordPath(fx.wt), 'utf-8'), STALE, 'the worktree must not touch a record it finds');
    assert.equal(readFileSync(recordPath(fx.repo), 'utf-8'), STALE, 'a worktree session must not spend the main checkout\'s notice');

    const main = runGate(fx.repo, env);
    assert.ok(main.stdout.trim().startsWith('HARNESS NOTE: omp '), `the main checkout owes the notice, got: ${JSON.stringify(main.stdout)}`);
    assert.equal(runGate(fx.repo, env).stdout.trim(), '', 'and emits it once');
  });
});

// A record that cannot be written must not cost the notice: it is emitted anyway and repeats at the
// next session start (at-least-once). root ignores file modes, so the case cannot be staged there.
const ROOT_SKIP = process.getuid?.() === 0 ? 'root ignores the read-only record this case relies on' : false;
test('a record that cannot be written still gets the notice, on every session start', { skip: POSIX_ONLY || ROOT_SKIP }, () => {
  withRepo({}, (fx) => {
    writeRecord(fx.repo, STALE);
    chmodSync(recordPath(fx.repo), 0o444);
    const env = ompAt(fx, '18.18.6');
    for (const attempt of ['first', 'second']) {
      const r = runGate(fx.repo, env);
      assert.equal(r.status, 0, `${attempt} start: exit must stay 0`);
      assert.ok(r.stdout.trim().startsWith('HARNESS NOTE: omp '), `${attempt} start must emit the notice, got: ${JSON.stringify(r.stdout)}`);
      assert.equal(r.stderr, '', `${attempt} start: the write failure must not surface as an error`);
    }
    assert.equal(readFileSync(recordPath(fx.repo), 'utf-8'), STALE, 'precondition: the record really was unwritable');
  });
});
