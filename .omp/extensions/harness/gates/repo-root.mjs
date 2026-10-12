// repo-root.mjs — repository toplevel / identity resolution shared by the cross-repo guard
// (#15 ①②) and the effective-cwd state-dir work (#57/#58). A helper module (imported, never
// spawned): pure fs, no git subprocess, so it is cheap enough to run on every edit/write and
// bash tool_call.
//
//   repoToplevel(p)  -> the worktree root containing `p` (nearest ancestor with a `.git` entry,
//                       file or directory), or null outside any repo. A path that does not exist
//                       yet (a file about to be written) is attributed through its first existing
//                       ancestor.
//   repoIdentity(p)  -> the repository `p` belongs to, as the physical path of its COMMON git
//                       dir. A linked worktree (`git worktree add`, Orca cards) has a `.git` FILE
//                       pointing at `<main>/.git/worktrees/<name>`, whose `commondir` names the
//                       shared `<main>/.git` — so every checkout of one repo compares equal, while
//                       a different repo (or a submodule, whose gitdir lives under `.git/modules/`
//                       with no commondir of its own) does not. null outside any repo or when the
//                       `.git` entry cannot be read.
//
// The walk starts from the PHYSICAL path (realpath) of the nearest existing ancestor, so a
// symlink into another repo's subtree (`A/vendor -> B/src`, npm link) resolves to B — a lexical
// walk would find A's `.git` first and attribute B's file to A (review 2026-10-06 C1). The
// toplevel returned is therefore a physical path; the identity is realpath'd too, which is what
// makes two spellings of one repo compare equal.
//
// `physicalResolve` / `repoToplevel` take an `io = { path, fs }` seam so the Windows rule is
// unit-testable on any host (`path.win32` + an in-memory fs); production callers use the host
// defaults. `git-commit-detect.mjs` walks `git -C` / `cd -P` values through the same function.

import * as fs from 'fs';
import { readFileSync, statSync } from 'fs';
import path, { isAbsolute, join, resolve } from 'path';

const HOST = { path, fs };

function physical(p, f = fs) {
  try { return f.realpathSync.native(p); } catch { return p; }
}

/** `v` resolved the way the kernel (and git's chdir) walks it: component by component, following
 *  symlinks at each step, so `link/../x` is the sibling of the LINK TARGET, not of the link (a
 *  lexical `resolve()` would collapse `link/..` first and attribute the file to the wrong repo —
 *  review 2026-10-07 X3; Node's JS `realpathSync` normalizes before walking too, only the
 *  libc-backed `.native` follows the link first). A component that does not exist stays lexical
 *  from there on. An absolute `v` is recognised by `io.path` (`/x` on POSIX; `C:\x`, `C:/x`,
 *  `\\srv\share\x` on Windows — #93/#99; `C:foo` drive-relative is unmodelled and walked
 *  lexically from `C:`) and walked from ITS root — never from a hard-coded `/`, which turned
 *  `C:\r\x` into `\C:\r\x` and attributed every Windows path to no repo (#99). A relative `v`
 *  starts at the physical `from`. `\` splits components only where the platform treats it as a
 *  separator: a POSIX file name may legitimately contain one. */
export function physicalResolve(v, from = process.cwd(), io = HOST) {
  const { path: p, fs: f } = io;
  const { root } = p.parse(v);                     // '' when relative; '/', 'C:\', '\\srv\share\' when absolute
  let cur = root || physical(from, f);
  for (const part of v.slice(root.length).split(p.sep === '\\' ? /[\\/]/ : /\//)) {
    if (part === '' || part === '.') continue;
    cur = part === '..' ? p.dirname(cur) : physical(p.join(cur, part), f);
  }
  return cur;
}

export function repoToplevel(v, io = HOST) {
  if (typeof v !== 'string' || v.length === 0) return null;
  const { path: p, fs: f } = io;
  let cur = physicalResolve(v, process.cwd(), io);
  while (!f.existsSync(cur)) {                     // a path that does not exist yet: its first existing ancestor
    const up = p.dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
  try { if (!f.statSync(cur).isDirectory()) cur = p.dirname(cur); } catch { return null; }
  for (;;) {
    if (f.existsSync(p.join(cur, '.git'))) return cur;
    const up = p.dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
}

export function repoIdentity(p) {
  const top = repoToplevel(p);
  if (top === null) return null;
  const entry = join(top, '.git');
  let gitDir;
  try {
    if (statSync(entry).isDirectory()) {
      gitDir = entry;
    } else {
      const m = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync(entry, 'utf-8'));
      if (!m) return null;
      gitDir = isAbsolute(m[1]) ? m[1] : resolve(top, m[1]);
    }
  } catch {
    return null;
  }
  // A linked worktree's gitdir carries `commondir` (relative to itself) naming the shared dir;
  // a main checkout has no such file.
  try {
    const common = readFileSync(join(gitDir, 'commondir'), 'utf-8').trim();
    if (common) gitDir = isAbsolute(common) ? common : resolve(gitDir, common);
  } catch {
    // main checkout
  }
  return physical(gitDir);
}
