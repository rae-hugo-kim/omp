// state-origin.mjs — binds gate evidence to the directory it was recorded for (#111 F9).
// A helper module (imported, never spawned).
//
// `.omp/harness-state/` is gitignored, and a Copy-on-Write worktree clone (omp `worktree.clone`
// / PI_SMART_GIT=1) copies gitignored files too: the new worktree would start with the origin's
// `backpressure-status=PASS` and read ledger. The two files that UNLOCK a gate therefore carry
// the physical path of the directory that owns the state dir:
//
//   read-log.txt         append-only sections, each opened by `#origin <path>`, one path per line
//   backpressure-status  line 1 PASS | FAIL | UNKNOWN (as before), line 2 `<path>`
//
// Evidence under another origin — or under none: a file left by a pre-#111 writer cannot be told
// apart from a clone of one — does not unlock anything. The cost is one re-read / re-run after
// an upgrade or after the directory moves; it is never a foreign PASS. The origin is a path, not
// a repository identity: a copy mounted at the SAME path is indistinguishable. One-shot flags a
// human creates by hand (`commit-wip`, `docs/harness/*-skip`) cannot carry an origin and stay a
// documented residual (harness_integration_contract "Worktree clones").

import { appendFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const LEDGER_ORIGIN = '#origin ';

/** The physical path evidence is bound to, or null when that path contains a line break. Both
 *  files are line-based, so such a path would spill onto a line of its own — one that can read
 *  as ANOTHER directory's origin. A directory like that therefore holds no evidence: nothing is
 *  recorded in its ledger, and its status carries no origin (never a PASS, still a FAIL). */
function origin(cwd) {
  let dir = cwd;
  try { dir = realpathSync.native(cwd); } catch { /* keep the spelling given */ }
  return /[\r\n]/.test(dir) ? null : dir;
}
const statePath = (cwd, name) => join(cwd, '.omp', 'harness-state', name);

/** The ledger as `cwd` may trust it: `entries` are the lines of the sections opened for this
 *  directory. Lines before any origin line (a pre-#111 ledger) or under another origin (a clone)
 *  are not entries. `opener` is what a writer must append first so that its lines start on a
 *  line of their own, inside a section of its own — or null when `cwd` can hold no evidence. */
function loadLedger(cwd) {
  const dir = origin(cwd);
  if (dir === null) return { entries: new Set(), opener: null };
  let text = '';
  try { text = readFileSync(statePath(cwd, 'read-log.txt'), 'utf-8'); } catch { /* missing or unreadable: no entries */ }
  const header = LEDGER_ORIGIN + dir;
  const entries = new Set();
  let own = false;
  for (const line of text.split('\n')) {
    if (line.startsWith(LEDGER_ORIGIN)) own = line === header;
    else if (own && line) entries.add(line);
  }
  const gap = text && !text.endsWith('\n') ? '\n' : '';          // a last line cut off mid-write
  return { entries, opener: gap + (own ? '' : `${header}\n`) };
}

/** Paths recorded as read or written for `cwd` (read-log.txt). Empty when the ledger is missing,
 *  unreadable, or holds nothing recorded for this directory. */
export function readLedger(cwd) {
  return loadLedger(cwd).entries;
}

/** Record `paths` in the ledger of `cwd`. Each path is stored as given and in its drive-less,
 *  forward-slash form — the two spellings context-gate looks up. The file is only ever appended
 *  to (one write per call), so trackers running at the same time cannot erase each other; lines
 *  recorded for another directory stay in the file and stay untrusted. A path containing a line
 *  break is not recorded: it would write ledger lines of its own, an `#origin` line included. */
export function recordReads(cwd, paths) {
  const { entries: seen, opener } = loadLedger(cwd);
  if (opener === null) return;
  let out = '';
  for (const p of paths) {
    if (/[\r\n]/.test(p)) continue;
    const normalized = p.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/');
    if (seen.has(p) || seen.has(normalized)) continue;
    out += `${p}\n${normalized}\n`;
    seen.add(p);
    seen.add(normalized);
  }
  if (!out) return;
  const file = statePath(cwd, 'read-log.txt');
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, opener + out);
}

/** The verification status `cwd` must honour: `status` is PASS | FAIL | UNKNOWN, or null when
 *  there is none. `foreign` is true when the file was recorded for another directory (or carries
 *  no origin). Provenance is what lets a verdict UNLOCK a commit, so a foreign PASS or UNKNOWN
 *  is no record at all, while a foreign FAIL still stands until this directory records its own
 *  result. A file that exists but cannot be read throws: the gate must not mistake it for "no
 *  record" (which only warns at medium risk). */
export function readBackpressure(cwd) {
  let text;
  try {
    text = readFileSync(statePath(cwd, 'backpressure-status'), 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return { status: null, foreign: false };
    throw err;
  }
  const [status, recordedFor] = text.split('\n');
  if (recordedFor === origin(cwd)) return { status, foreign: false };
  return { status: status === 'PASS' || status === 'UNKNOWN' ? null : status, foreign: true };
}

export function writeBackpressure(cwd, status) {
  const file = statePath(cwd, 'backpressure-status');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${status}\n${origin(cwd) ?? ''}\n`);
}
