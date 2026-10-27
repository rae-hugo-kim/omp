#!/usr/bin/env node
// harness-version-check.mjs - drift probe (SessionStart + turn-start reminder + post-commit recheck)
// Purpose: Notify when local harness is behind the source remote, and TELL the
// agent to resolve it via /skill:harness-check (resolution beats reporting).
//
// Skip logic: if harness-meta.json has no `source_remote`, this IS the source
// repo. Consumer projects get `source_remote` + `commit_sha` written by the
// bootstrap skill.
//
// Version compare: primary = tag name (harness/YYYY.N), fallback = commit SHA.
// Cache: .omp/state/harness-version-check.json — 24h default window; callers may
// pass a smaller `max_age_ms` in the stdin payload (turn-start/commit rechecks use
// 1h). Failed probes write a short-lived marker (FAILURE_TTL_MS) so per-turn
// callers never re-stall on a dead network every invocation.
//
// Linked worktree (#68): when `git rev-parse --git-dir` != `--git-common-dir` the session runs in a
// `git worktree add` checkout (Orca cards included). The harness files are per-worktree copies, so the
// directive never says harness-check there: it reports BEHIND MAIN (main's committed meta is current →
// merge main's branch here) or STALE (linked worktree) (main is behind too → sync in the main checkout,
// commit, then merge). Cache file: harness-version-check.linked.json (main/single checkouts keep
// harness-version-check.json).

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, renameSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 10 * 60 * 1000;
const NOTICE_TTL_MS = 24 * 60 * 60 * 1000;   // shared by the hooks-inactive and policy-shadow probes
const SHORT_LIVED = 'Ignore this if the worktree is short-lived and will be deleted.';
// A branch name is interpolated into the agent-directed `git merge` line only when it matches this.
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._\/-]*$/;
// Ambient repo-location variables (a hook or wrapper may export them) would redirect the linked-worktree
// git calls away from the session cwd and silently reinstate the pre-#68 directive.
const REPO_ENV_VARS = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_PREFIX', 'GIT_NAMESPACE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES'];
let linkedMemo;   // detectLinkedWorktree(cwd) result, computed at most once and only when something needs it
function getLinked() {
  if (linkedMemo === undefined) linkedMemo = detectLinkedWorktree(cwd);
  return linkedMemo;
}

let stdin = '';
try { stdin = readFileSync(0, 'utf-8'); } catch { /* no stdin is fine */ }
let data = {};
try { data = JSON.parse(stdin); } catch { /* ignore */ }

const force = process.argv.includes('--force');
const cwd = data?.session_state?.cwd || process.cwd();

// Freshness window: stdin payload `max_age_ms` overrides the 24h default (0 = always refetch).
const rawMaxAge = data?.max_age_ms;
const maxAgeMs = typeof rawMaxAge === 'number' && Number.isFinite(rawMaxAge) && rawMaxAge >= 0 ? rawMaxAge : CACHE_TTL_MS;

// Log rotation: rotate hook-debug.log if it exceeds 1MB
const debugLogPath = join(cwd, '.omp', 'harness-state', 'hook-debug.log');
try {
  if (existsSync(debugLogPath) && statSync(debugLogPath).size > 1048576) {
    renameSync(debugLogPath, debugLogPath + '.old');
  }
} catch { /* ignore rotation errors */ }

const metaPath = join(cwd, '.omp/extensions/harness/harness-meta.json');
if (!existsSync(metaPath)) process.exit(0);

let meta;
try { meta = JSON.parse(readFileSync(metaPath, 'utf-8')); } catch { process.exit(0); }
// Hook activation probe (#26): `core.hooksPath` is LOCAL git config, so no file sync
// (init template copy, harness-sync) can ever propagate it. A repo that ships
// `.githooks/` but never pointed git at it has the whole commit/push gate layer
// declared in AGENTS.md silently dead. Runs before the source-repo skip on purpose:
// the probe is one `git config` read and applies to every repo carrying hooks.
emitIfHooksInactive(cwd);
// Policy shadow probe (#35): OMP's native provider (priority 100) REPLACES a root
// AGENTS.md at the same depth when a non-empty `.omp/AGENTS.md` exists, so the harness
// policy is silently absent from the session. Runs before the source-repo skip.
emitIfPolicyShadowed(cwd);

const sourceRemote = meta.source_remote;
if (!sourceRemote) process.exit(0);

// Linked worktrees (#68) get their own cache file so a state dir shared with (or copied from) a main
// checkout never serves one mode's cached probe to the other.
const cachePath = join(cwd, '.omp/state', getLinked() ? 'harness-version-check.linked.json' : 'harness-version-check.json');
const now = Date.now();

if (!force && existsSync(cachePath)) {
  try {
    const cached = JSON.parse(readFileSync(cachePath, 'utf-8'));
    const window = cached.failed ? FAILURE_TTL_MS : maxAgeMs;
    // A checkedAt in the FUTURE means the wall clock stepped backwards since the cache was written
    // (WSL2 measured: -1.8s steps). `now - checkedAt` is then negative and satisfies ANY window,
    // including max_age_ms 0 — the caller asked for a refetch and got a stale hit. Treat it as stale.
    const age = now - cached.checkedAt;
    if (cached.checkedAt && age >= 0 && age < window) {
      // A failure marker preserves the last-known remote info (below) — a KNOWN drift
      // keeps being reported through failure windows instead of going silent for
      // FAILURE_TTL_MS; only the re-probe is backed off.
      if (cached.remoteLatestVersion) emitIfDrift(meta, cached);
      process.exit(0);
    }
  } catch { /* stale/corrupt cache — refetch */ }
}

let remote;
try {
  const output = execFileSync(
    'git',
    ['ls-remote', '--tags', sourceRemote, 'refs/tags/harness/*'],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 },
  );
  remote = parseRemoteTags(output);
} catch {
  // Network/auth failure: record a short-lived failure marker so frequent callers
  // (turn-start recheck) back off instead of stalling on ls-remote every time.
  // Carry over the previous cache's remote fields — never clobber last-known-good
  // drift data with a bare marker — and still EMIT a known drift on this very call:
  // a failed probe must never silence a directive we already know applies.
  let keep = {};
  try {
    const prev = JSON.parse(readFileSync(cachePath, 'utf-8'));
    if (prev && typeof prev === 'object') keep = prev;
  } catch { /* no prior cache */ }
  try {
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify({ ...keep, checkedAt: now, failed: true, source: sourceRemote }, null, 2));
  } catch { /* ignore cache write failure */ }
  if (keep.remoteLatestVersion) emitIfDrift(meta, keep);
  process.exit(0);
}

if (!remote?.remoteLatestVersion) process.exit(0);

try {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify({
    checkedAt: now,
    remoteLatestVersion: remote.remoteLatestVersion,
    remoteLatestSha: remote.remoteLatestSha,
    source: sourceRemote,
  }, null, 2));
} catch { /* ignore cache write failure */ }

emitIfDrift(meta, remote);
process.exit(0);

function parseRemoteTags(output) {
  const re = /^([0-9a-f]{40})\s+refs\/tags\/harness\/(\d{4})\.(\d+)(\^\{\})?$/gm;
  let best = null;
  let m;
  while ((m = re.exec(output)) !== null) {
    const [, sha, yr, seq, caret] = m;
    const version = `${yr}.${seq}`;
    const peeled = Boolean(caret);
    // Annotated tags list the tag-object line before the peeled `^{}` line; prefer the
    // peeled COMMIT sha on equal rank — harness-sync stores `rev-parse HEAD` (a commit
    // sha) in meta, so comparing against the tag-object sha would report drift forever.
    if (!best || versionGreater(version, best.version) || (version === best.version && peeled && !best.peeled)) {
      best = { version, sha, peeled };
    }
  }
  return best ? { remoteLatestVersion: best.version, remoteLatestSha: best.sha } : null;
}

// (year, seq) tuple compare — no arithmetic packing, so seq never overflows the year.
function versionParts(v) {
  const m = /^(\d{4})\.(\d+)$/.exec(v || '');
  return m ? [+m[1], +m[2]] : null;
}
function versionGreater(a, b) {
  const x = versionParts(a), y = versionParts(b);
  if (!x || !y) return false;
  return x[0] !== y[0] ? x[0] > y[0] : x[1] > y[1];
}

// Drift classification of the local meta (main/single checkouts): 'stale' = a newer remote tag exists,
// 'drift' = a commit SHA that differs from the remote's, null = current. The linked-worktree path
// classifies on its own (version-aware, see emitLinkedDrift).
function driftKind(m, remoteInfo) {
  const rv = remoteInfo.remoteLatestVersion;
  const rsha = remoteInfo.remoteLatestSha;
  if (versionGreater(rv, m.version)) return 'stale';
  if (m.commit_sha && rsha && m.commit_sha !== rsha) return 'drift';
  return null;
}

function emitIfDrift(localMeta, remoteInfo) {
  if (getLinked()) { emitLinkedDrift(localMeta, remoteInfo); return; }

  const kind = driftKind(localMeta, remoteInfo);
  if (!kind) return;

  const lv = localMeta.version;
  const rv = remoteInfo.remoteLatestVersion;
  if (kind === 'stale') {
    console.log(`HARNESS STALE: local harness ${lv} → remote ${rv}. Before starting the next task, run /skill:harness-check to sync (working tree dirty? ask the user first). Do not silently ignore this.`);
  } else {
    console.log(`HARNESS DRIFT: version matches (${lv}) but commit SHA differs from source. Before starting the next task, run /skill:harness-check (working tree dirty? ask the user first).`);
  }
}

// Linked worktree (#68): the harness files are per-worktree copies, so syncing here forks them from
// main and the next merge conflicts on every harness file (measured on chats/bonefish: 14 conflicts).
// The right path is "sync once in the main checkout and commit, then merge into the worktree" — so this
// never points at harness-check. Compares against the harness-meta.json COMMITTED on the main
// checkout's branch (what a merge would bring), not its working copy. Two labels only: BEHIND MAIN
// (merging main would cure the drift) and STALE (linked worktree) (it would not, or main is unknown).
// (Module constants live at the top: this module runs top-level code before reaching these function
// declarations, and a const is not hoisted.)
function emitLinkedDrift(localMeta, remoteInfo) {
  const linked = getLinked();
  const lv = localMeta.version;
  const rv = remoteInfo.remoteLatestVersion;
  const rsha = remoteInfo.remoteLatestSha;
  // Version-aware: a worktree AHEAD of the (possibly cached) remote probe — e.g. right after merging a
  // main that synced past the last cached tag — is current; comparing its SHA to the older tag's would
  // send the user back to main for a no-op sync.
  let kind = null;
  if (versionGreater(rv, lv)) kind = 'stale';
  else if (!versionGreater(lv, rv) && localMeta.commit_sha && rsha && localMeta.commit_sha !== rsha) kind = 'drift';
  if (!kind) return;

  const mainMeta = readMainMeta(linked);
  const how = mergePhrase(linked);
  if (mainCures(mainMeta, localMeta, remoteInfo, kind)) {
    const mainAt = mainMeta.version === lv && mainMeta.commit_sha ? `${mainMeta.version} (${String(mainMeta.commit_sha).slice(0, 7)})` : mainMeta.version;
    console.log(`HARNESS BEHIND MAIN: this linked worktree has harness ${lv}, main already at ${mainAt}. Run ${how} here; do not run harness-check in a linked worktree (each worktree would sync its own copy and diverge from main). ${SHORT_LIVED}`);
    return;
  }
  const where = linked.bare ? 'the worktree you treat as main (this repo\'s main worktree is bare, so there is no main checkout)'
    : linked.path ? `the main checkout ${JSON.stringify(linked.path)}` : 'the main checkout';
  const what = kind === 'stale' ? `local harness ${lv} → remote ${rv}` : `version matches (${lv}) but commit SHA differs from source`;
  console.log(`HARNESS STALE (linked worktree): ${what}. Sync in ${where} and commit there, then bring it here with ${how}; do not run harness-check in a linked worktree. ${SHORT_LIVED}`);
}

// Would merging main's committed meta cure this worktree's drift?
//  - main behind the worktree: no (nothing to merge, and the worktree must not be told to downgrade).
//  - main ahead: yes when main itself is not behind the latest remote tag. SHA is compared only at EQUAL
//    versions (metaCurrent) — main synced past a cached/outdated probe is current.
//  - equal versions: only a SHA drift can be cured, and only by main carrying the remote's SHA itself —
//    a main meta WITHOUT commit_sha would just delete the sha and silence the drift.
function mainCures(main, local, remoteInfo, kind) {
  if (!main) return false;
  if (versionGreater(local.version, main.version)) return false;
  if (versionGreater(main.version, local.version)) return metaCurrent(main, remoteInfo);
  const rsha = remoteInfo.remoteLatestSha;
  return kind === 'drift' && Boolean(rsha) && main.commit_sha === rsha;
}

function metaCurrent(m, remoteInfo) {
  const rv = remoteInfo.remoteLatestVersion;
  const rsha = remoteInfo.remoteLatestSha;
  if (versionGreater(rv, m.version)) return false;
  if (versionGreater(m.version, rv)) return true;
  return !(m.commit_sha && rsha && m.commit_sha !== rsha);
}

// The branch name reaches an agent-directed command line, and git allows `;`, `$()`, backticks in refs:
// only a conservative charset is interpolated (as the unambiguous `refs/heads/<branch>` — a same-named
// tag would win the short form); anything else, a detached main (its SHA is stale once main syncs) or a
// bare main falls back to prose.
function mergePhrase(l) {
  if (l.branch && SAFE_REF.test(l.branch)) return `\`git merge refs/heads/${l.branch}\` (or rebase)`;
  if (l.bare || !l.path) return 'a merge or rebase of the branch you treat as main';
  if (!l.branch) return 'a merge or rebase of the main checkout\'s HEAD commit (it is detached)';
  return 'a merge or rebase of the main checkout\'s current branch';
}

// Linked-worktree probe via git itself (not repo-root.mjs): `--git-dir` != `--git-common-dir` is the
// definition of a linked worktree, and the main checkout's path + branch need `git worktree list`
// anyway — repo-root's pure-fs `repoIdentity` only says "same repo", not "which one is main".
// Returns null for a main checkout, a single checkout, a non-repo, or any git failure (the pre-#68
// behavior). Otherwise { root, path, branch, show, bare }: the session root, the main worktree's path
// (null when bare), its branch (null when detached/bare) and the unambiguous object spec for its
// committed meta (`refs/heads/<branch>`, or the detached SHA — a short name could be shadowed by a tag).
// (SAFE_REF and REPO_ENV_VARS live with the other constants at the top — same TDZ reason as SHORT_LIVED.)
function repoEnv() {
  const env = { ...process.env };
  for (const k of REPO_ENV_VARS) delete env[k];
  return env;
}
function detectLinkedWorktree(root) {
  const run = (args) => execFileSync('git', ['-C', root, ...args],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000, env: repoEnv() });
  try {
    const [gitDir, commonDir] = run(['rev-parse', '--git-dir', '--git-common-dir']).split('\n');
    if (!gitDir || !commonDir) return null;
    const real = (p) => { try { return realpathSync(resolve(root, p)); } catch { return resolve(root, p); } };
    if (real(gitDir) === real(commonDir)) return null;
  } catch { return null; }

  // The first `git worktree list --porcelain` entry is always the main worktree.
  const info = { root, path: null, branch: null, show: null, bare: false };
  try {
    const first = run(['worktree', 'list', '--porcelain']).split(/\r?\n\r?\n/)[0].split(/\r?\n/);
    for (const line of first) {
      if (line.startsWith('worktree ')) info.path = line.slice('worktree '.length);
      else if (line.startsWith('branch refs/heads/')) { info.branch = line.slice('branch refs/heads/'.length); info.show = `refs/heads/${info.branch}`; }
      else if (line.startsWith('HEAD ') && !info.show) info.show = line.slice('HEAD '.length);   // detached until a branch line says otherwise
      else if (line === 'bare') info.bare = true;
    }
    if (info.bare) { info.path = null; info.branch = null; info.show = null; }
  } catch { /* unknown main: the STALE (linked worktree) wording still applies without a path */ }
  return info;
}

// meta committed on the main worktree's branch/HEAD; null when unreadable or not a harness meta
// (no harness there, git failure, `{}`/array/version-less JSON). Reads through the session root: refs
// and objects are shared by every worktree of the repo. The main checkout may itself sit on an
// unrelated feature branch — "main" here means whatever that checkout has committed.
function readMainMeta(info) {
  if (!info.show) return null;
  try {
    const raw = execFileSync('git', ['-C', info.root, 'show', `${info.show}:.omp/extensions/harness/harness-meta.json`],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000, env: repoEnv() });
    const m = JSON.parse(raw);
    return m && typeof m === 'object' && versionParts(m.version) ? m : null;
  } catch { return null; }
}

// Emit at most once per NOTICE_TTL_MS (marker: .omp/state/harness-hooks-check.json)
// unless --force. Silent when: no `.githooks/` dir, not a git work tree, or
// core.hooksPath already resolves to that directory. Never throws, never exits.
function emitIfHooksInactive(root) {
  const hooksDir = join(root, '.githooks');
  if (!existsSync(hooksDir)) return;

  let top;
  try {
    top = execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
  } catch { return; }
  if (!top) return;

  let configured = '';
  try {
    configured = execFileSync('git', ['-C', root, 'config', '--get', 'core.hooksPath'],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
  } catch { /* unset => exit 1 => stays '' */ }
  // A relative hooksPath is resolved by git against the work-tree top. Compare REAL paths:
  // `--show-toplevel` is canonical while `root` may be a symlinked session cwd (review 2026-09-05).
  const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
  if (configured && real(resolve(top, configured)) === real(hooksDir)) return;

  const markerPath = join(root, '.omp/state/harness-hooks-check.json');
  if (noticeThrottled(markerPath)) return;
  writeNoticeMarker(markerPath, { configured: configured || null });

  const state = configured ? `points at \`${configured}\`` : 'is not set';
  // core.hooksPath is repo-common config: in a linked worktree a one-time `git config` covers every worktree,
  // and harness-check must not be suggested there (#68).
  const fix = getLinked()
    ? 'run `git config core.hooksPath .githooks` (local git setting shared by every worktree of this repo — file sync alone cannot carry it)'
    : 'run `git config core.hooksPath .githooks` (local git setting — file sync alone cannot carry it) or /skill:harness-check, whose sync sets it idempotently and verifies the effective value';
  console.log(`HARNESS HOOKS INACTIVE: .githooks/ exists but core.hooksPath ${state}, so the pre-commit/pre-push gates declared in AGENTS.md never run. Before the next commit, ${fix}.`);
}

// Emit at most once per NOTICE_TTL_MS (marker: .omp/state/harness-policy-check.json)
// unless --force. Silent when there is nothing to shadow. Never throws, never exits.
//
// Measured on omp 18.2.5 (`omp -p --no-extensions` marker probes, 2026-09-23):
//   - a `.omp/AGENTS.md` with ANY bytes — content, a single newline, whitespace only — displaces
//     the same-depth root AGENTS.md; only a 0-byte file is ignored by the native provider. The
//     probe therefore keys on size > 0, never on trimmed content (review round 4).
//   - a project `.omp/RULES.md` and the user `~/.omp/agent/RULES.md` are BOTH loaded (the docs'
//     "same rule name RULES, user wins" collision no longer holds), so `.omp/RULES.md` is a valid
//     consumer extension point and is NOT probed.
function emitIfPolicyShadowed(root) {
  if (!existsSync(join(root, 'AGENTS.md'))) return;
  let st;
  try { st = statSync(join(root, '.omp', 'AGENTS.md')); } catch { return; }
  if (!st.isFile() || st.size === 0) return;   // a directory of that name is not a context file

  const markerPath = join(root, '.omp/state/harness-policy-check.json');
  if (noticeThrottled(markerPath)) return;
  writeNoticeMarker(markerPath, { file: '.omp/AGENTS.md' });

  console.log('HARNESS POLICY SHADOWED: `.omp/AGENTS.md` exists, so OMP\'s native provider (priority 100) replaces `AGENTS.md` at the same depth — the harness policy is NOT in this session\'s context. Move its content to `.omp/rules/<project>-context.md` (frontmatter `alwaysApply: true`), delete `.omp/AGENTS.md`, then restart the session (/new) so the policy loads (AGENTS.md "Consumer extension points").');
}

// Notice window shared by the health probes: true when a marker inside NOTICE_TTL_MS exists and
// --force is absent. A stale, corrupt, or FUTURE-dated marker (wall clock stepped back, or a
// hand-written suppressor) re-emits — same rule as the drift cache above.
function noticeThrottled(markerPath) {
  if (force || !existsSync(markerPath)) return false;
  try {
    const marker = JSON.parse(readFileSync(markerPath, 'utf-8'));
    const age = Date.now() - marker.notifiedAt;
    return Boolean(marker.notifiedAt) && age >= 0 && age < NOTICE_TTL_MS;
  } catch { return false; }
}

function writeNoticeMarker(markerPath, extra) {
  try {
    mkdirSync(dirname(markerPath), { recursive: true });
    writeFileSync(markerPath, JSON.stringify({ notifiedAt: Date.now(), ...extra }, null, 2));
  } catch { /* ignore marker write failure */ }
}
