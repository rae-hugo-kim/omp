#!/usr/bin/env node
// commit-gates.mjs - single PreToolUse:Bash dispatcher for the commit-only gates.
//
// Replaces three separate hook registrations (acceptance-gate, backpressure-gate, review-gate) with
// ONE. The overwhelming majority of Bash commands are not commits, so this performs the single
// isGitCommit check and exits — one node spawn per non-commit Bash instead of three (audit item #8b).
//
// On an actual `git commit` it runs ALL registered gates, in registration order, feeding each the
// same stdin. It runs all of them (rather than stopping at the first block) so that every gate
// evaluates and consumes its own one-shot skip flag deterministically, and all warnings surface in a
// single pass — matching an all-hooks-run model. The commit is blocked (exit 2) if ANY gate blocks.
// A gate that does not exit cleanly (crash / timeout / spawn failure) ALSO blocks — FAIL-CLOSED.
// These gates are safety boundaries: treating a broken gate as passing (the prior per-hook fail-open
// stance, "a broken gate must not block commits") meant driving any gate over its time/output budget
// with crafted inputs was a full review bypass. Owner decision after the 3rd adversarial review
// (2026-07-22): a gate that cannot render a verdict blocks the commit, and the dispatcher prints
// which gate failed, why, and how to debug it standalone. The gates are unchanged and still
// independently runnable; this only unifies their registration. destructive-guard stays a SEPARATE
// hook — it scans every command, not just commits, so it must keep running on non-commit Bash too.

import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isGitCommit } from './git-commit-detect.mjs';

const raw = readFileSync(0, 'utf-8');

let data;
try {
  data = JSON.parse(raw);
} catch {
  console.error('HARNESS WARNING: Hook received invalid input, skipping check.');
  process.exit(0);
}

const command = data?.tool_input?.command || '';

// The one cheap check for the common case. Not a commit -> nothing to gate, single spawn done.
if (!isGitCommit(command)) process.exit(0);

const here = dirname(fileURLToPath(import.meta.url));
const GATES = ['acceptance-gate.mjs', 'backpressure-gate.mjs', 'review-gate.mjs', 'archive-guard.mjs'];

// Each child gets its own ~3s budget (matching the old per-gate timeout) so one slow/hung gate can't
// starve the others or blow the dispatcher's outer budget; the harness extension (index.ts) gives the
// dispatcher 15s (COMMIT_GATES_TIMEOUT_MS) to cover the four sequential runs. SIGKILL is deliberate:
// with spawnSync's default SIGTERM, a child can catch/ignore termination, report exit 0 after the
// timeout (status=0 + error=ETIMEDOUT), or keep spawnSync blocked indefinitely. An uncatchable kill
// makes the budget a hard ceiling; the result's error/signal axes still decide fail-closed below.
const CHILD_TIMEOUT_MS = 3000;

let blocked = false;
for (const gate of GATES) {
  const r = spawnSync(process.execPath, [join(here, gate)], {
    input: raw,
    encoding: 'utf-8',
    timeout: CHILD_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    maxBuffer: 4 * 1024 * 1024,
  });
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status === 2) {
    blocked = true;
  } else if (r.status === 0 && !r.error && !r.signal) {
    // A clean exit 0 is the ONLY allow result. spawnSync result axes are independent: notably a
    // timed-out child can catch SIGTERM and return status=0 while error.code remains ETIMEDOUT.
  } else {
    // crash (non-zero), timeout/ENOBUFS/EPIPE (r.error, even with status 0), signal termination, or
    // spawn failure — fail CLOSED. A gate that cannot render a verdict must not be treated as
    // passing: skipping it would let anyone (or anything) that can crash or stall a gate commit
    // unreviewed. Owner decision, 3rd adversarial review 2026-07-22; timeout+exit0 gap sealed after
    // the 4th review.
    blocked = true;
    const why = r.error?.code || r.signal || `exit ${r.status}`;
    console.error(`HARNESS BLOCK: commit gate '${gate}' did not run cleanly (${why}); failing closed — a gate that cannot render a verdict must not pass the commit.`);
    console.error(`Debug it standalone from the repo root: node ${join(here, gate)} <<< '{"tool_input":{"command":"git commit -m x"},"session_state":{"cwd":"'"$PWD"'"}}' — fix or restore the gate, then retry the commit.`);
  }
}

process.exit(blocked ? 2 : 0);
