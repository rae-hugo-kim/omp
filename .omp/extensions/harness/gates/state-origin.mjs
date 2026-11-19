// state-origin.mjs — binds gate evidence to the directory it was recorded for (#111 F9).
// A helper module (imported, never spawned).
//
// `.omp/harness-state/` is gitignored, and a Copy-on-Write worktree clone (omp `worktree.clone`
// / PI_SMART_GIT=1) copies gitignored files too: the new worktree would start with the origin's
// `backpressure-status=PASS` and read ledger. The two files that UNLOCK a gate therefore carry
// the physical path of the directory that owns the state dir:
//
//   read-log.txt         line 1 `#origin <path>`, then one path per line (as before)
//   backpressure-status  line 1 PASS | FAIL | UNKNOWN (as before), line 2 `<path>`
//
// A reader that finds another origin — or none: a file left by a pre-#111 writer cannot be told
// apart from a clone of one — treats the evidence as absent, and a writer replaces it instead of
// extending it. The cost is one re-read / re-run after an upgrade or after the directory moves;
// it is never a foreign PASS. One-shot flags a human creates by hand (`commit-wip`,
// `docs/harness/*-skip`) cannot carry an origin and stay a documented residual
// (harness_integration_contract "Worktree clones").

import { appendFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const LEDGER_ORIGIN = '#origin ';

function origin(cwd) {
  try { return realpathSync.native(cwd); } catch { return cwd; }
}
const statePath = (cwd, name) => join(cwd, '.omp', 'harness-state', name);
function readText(file) {
  try { return readFileSync(file, 'utf-8'); } catch { return null; }
}

/** Ledger lines recorded for `cwd`, or null when the ledger is missing or foreign. */
function ownLedgerLines(cwd) {
  const lines = (readText(statePath(cwd, 'read-log.txt')) ?? '').split('\n');
  return lines[0] === LEDGER_ORIGIN + origin(cwd) ? lines.slice(1).filter(Boolean) : null;
}

/** Paths recorded as read or written for `cwd` (read-log.txt). Empty when the ledger is missing
 *  or was recorded for another directory. */
export function readLedger(cwd) {
  return new Set(ownLedgerLines(cwd) ?? []);
}

/** Record `paths` in the ledger of `cwd`. Each path is stored as given and in its drive-less,
 *  forward-slash form — the two spellings context-gate looks up. A missing or foreign ledger is
 *  replaced, never extended. */
export function recordReads(cwd, paths) {
  const file = statePath(cwd, 'read-log.txt');
  const own = ownLedgerLines(cwd);
  const seen = new Set(own ?? []);
  let out = '';
  for (const p of paths) {
    const normalized = p.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/');
    if (seen.has(p) || seen.has(normalized)) continue;
    out += `${p}\n${normalized}\n`;
    seen.add(p);
    seen.add(normalized);
  }
  mkdirSync(dirname(file), { recursive: true });
  if (own === null) writeFileSync(file, `${LEDGER_ORIGIN}${origin(cwd)}\n${out}`);
  else if (out) appendFileSync(file, out);
}

/** The verification status recorded for `cwd`: `status` is PASS | FAIL | UNKNOWN, or null when
 *  there is none. `foreign` is true when a status file exists but was recorded for another
 *  directory (its status is then null too). */
export function readBackpressure(cwd) {
  const text = readText(statePath(cwd, 'backpressure-status'));
  if (text === null) return { status: null, foreign: false };
  const [status, recordedFor] = text.split('\n');
  return recordedFor === origin(cwd) ? { status, foreign: false } : { status: null, foreign: true };
}

export function writeBackpressure(cwd, status) {
  const file = statePath(cwd, 'backpressure-status');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${status}\n${origin(cwd)}\n`);
}
