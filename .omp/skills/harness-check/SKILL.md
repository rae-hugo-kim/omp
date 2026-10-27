---
name: harness-check
argument-hint: "[--dry-run] [--audit] [--force-worktree]"
description: Check harness version drift and auto-sync from the source remote. Use when the user says "harness-check", "harness version", "하네스 버전", or wants to retrofit/update harness files from the source repo.
---

# Harness Check - Version Drift + Auto-Sync

## Goal

One command that both **reports drift** and **resolves it** by overwriting local harness files from the source remote. Remote wins unconditionally.

## Inputs

- `$ARGUMENTS` — the user-provided argument (appended as `User: <args>`):
  - (empty) — check + sync (default)
  - `--dry-run` — show what would be overwritten, no changes
  - `--audit` — also run a deterministic 7-category quality audit after sync
  - `--force-worktree` — proceed even from a **linked git worktree** (normally the skill stops there, see Detect mode); the skill asks the user for the reason first

## Constraints

| Rule | Rationale |
|------|-----------|
| Source repo self-skip | If `origin` remote matches `rae-hugo-kim/omp`, this IS the source — nothing to do |
| Remote wins | Local tuning is explicitly out of scope; overwrite without merge |
| Whitelist only | Only harness asset paths are overwritten — user code (`docs/`, `src/`, etc.) is never touched |
| Preserve `bootstrapped_at` | Keep the original first-registration timestamp |
| Stop in a linked worktree (#68) | The harness files are per-worktree copies: syncing in a linked worktree forks them from main and the later merge conflicts on every harness file (chats/bonefish measured 14 conflicts). Sync once in the main checkout, commit, then merge into the worktree. Only `--force-worktree` overrides |

## Process

### 1. Detect mode

```bash
cat .omp/extensions/harness/harness-meta.json 2>/dev/null || echo "missing"
git remote get-url origin
```

| Mode | Condition |
|------|-----------|
| **source repo** | `origin` URL matches `rae-hugo-kim/omp` |
| **unregistered** | meta has no `source_remote` field (and origin doesn't match source) |
| **registered** | meta has `source_remote` field |
| **linked worktree** (#68) | `git rev-parse --git-dir` ≠ `--git-common-dir`. Takes precedence over `registered`/`unregistered`; the **source repo** self-skip still wins first |

#### Linked worktree: stop (unless `--force-worktree`)

```bash
# ambient GIT_DIR/GIT_WORK_TREE would redirect every git call below (the gate strips them too)
unset GIT_DIR GIT_WORK_TREE
# linked iff the two resolve to different directories (equal in a main or single checkout)
[ "$(cd "$(git rev-parse --git-dir)" && pwd -P)" != "$(cd "$(git rev-parse --git-common-dir)" && pwd -P)" ] && echo linked
git worktree list --porcelain | sed -n '1,3p'     # first entry = the main checkout (path + branch); `bare` instead of `branch` = a bare main with no checkout
git show refs/heads/<main-branch>:.omp/extensions/harness/harness-meta.json   # what main has COMMITTED (full ref: a same-named tag must not shadow the branch)
git ls-remote --tags "$(node -e 'console.log(require("./.omp/extensions/harness/harness-meta.json").source_remote)')" 'refs/tags/harness/*'   # latest remote harness/* tag to compare against
```

In a linked worktree **do not run `scripts/harness-sync.sh`**. Print one of these and stop (the `session_start` gate `harness-version-check.mjs` prints the same two directives):

- main's committed `version` is ahead of this worktree **and** not behind the latest remote `harness/*` tag (at an equal version main must carry the remote tag's commit SHA itself; a worktree already ahead of main or of the remote is never told to merge) → `HARNESS BEHIND MAIN: main already at <X> — run git merge refs/heads/<main-branch> here; do not run harness-check in a linked worktree.`
- main is behind the remote too (or has no committed meta) → `HARNESS STALE (linked worktree): sync in the main checkout <main-path> and commit there, then merge here.` With a bare main there is no main checkout: name the worktree the user treats as main instead.

Only put a branch name into a `git merge` line if it is plain (`[A-Za-z0-9._/-]`); git allows `;`, `$()` and backticks in branch names, so otherwise describe the branch in prose. A short-lived worktree that will be deleted can ignore the notice. With `--force-worktree`, first ask the user why a per-worktree sync is wanted (it will diverge from main), note the reason in the report, then continue to step 2.

### 2. Run the sync script

```bash
bash scripts/harness-sync.sh [--dry-run]
```

The script:
- Self-skips in the source repo
- Falls back to `git@github.com:rae-hugo-kim/omp.git` if no `source_remote` (unregistered case)
- Fetches the latest `harness/*` tag from remote
- Shallow-clones that tag into a temp dir, then **hands execution to that tag's own `scripts/harness-sync.sh`** (#24) so the whitelist applied is the target version's, not the consumer's stale copy — a new whitelist entry lands on the first sync
- Overwrites whitelist paths (`.omp/rules/harness-*.md` (file glob — stale `harness-*` files pruned, other `.omp/rules/` files kept), `checklists/`, `templates/`, `AGENTS.md`, `.omp/extensions/harness/`, the six harness agents in `.omp/agents/` (per file — reviewer, verifier, code-reviewer, adversary and its two panel mirrors; consumer agents next to them are kept, and a retired harness agent such as `adversary-sol.md` is not removed — delete it by hand; the synced suite no longer fails on it (W3 checks agent coverage only in the source repo)), `.githooks/*`, `scripts/harness-*.sh`, harness skill dirs)
- Retires the legacy `rules/` directory (ADR 002): removes only files whose blob matches the previous synced tree (`refs/harness/<prev>`), keeps consumer-edited/added files with an advisory, and removes nothing when no previous tree is recorded — the advisory tells you to fix project docs that link `rules/<name>.md` (→ `.omp/rules/harness-<name>.md`, see the migrate skill)
- Rewrites `harness-meta.json` with new version/SHA + preserved `bootstrapped_at`
- Sets `core.hooksPath=.githooks` when `.githooks/` exists and git is not already pointing at it (idempotent). This is local git config that no file sync can carry, so a repo registered before `bootstrap` gained the step is otherwise disarmed forever (#26) — the `HARNESS HOOKS INACTIVE` session/turn notice from `harness-version-check.mjs` routes here.
- Clears the `harness-version-check` and `harness-hooks-check` caches

#### Windows native: upgrading from 2026.86 or earlier

The 2026.87 `.gitattributes` pins `*.sh` and `.githooks/*` to LF, but it **does not convert files that are already checked out with CRLF**. A 2026.86-or-earlier Windows checkout therefore may have a CRLF `scripts/harness-sync.sh`, and `bash scripts/harness-sync.sh` stops at once with `$'\r': command not found` / `set: pipefail: invalid option name`. Work around it once by running a CR-stripped copy from a real temp file (not `bash <(…)`: the script re-copies `$0` to a temp file and re-execs it, and a pipe has already been partly consumed by then, so the copy would lose the script's first lines). WSL does not avoid this by itself — a bash in WSL fails on the same CRLF file, so use the same temp-copy command there. Add `--dry-run` to the first run if unsure. After the sync, confirm `*.sh text eol=lf` and `.githooks/* text eol=lf` are in the consumer's `.gitattributes` (it is not a sync target), then re-normalize:

```bash
lf=$(mktemp) && tr -d '\r' < scripts/harness-sync.sh > "$lf" && bash "$lf"; rc=$?; rm -f "$lf"; [ "$rc" -eq 0 ]   # only when the script itself is CRLF
git add --renormalize .omp scripts .githooks '*.sh' && git status   # commit what it lists (blobs that were committed with CRLF)
# --renormalize rewrites the index only; with no uncommitted changes, rewrite the CRLF working-tree files too
# (uncommitted edits to these files are lost):
git ls-files -z -- '*.sh' '.githooks/*' | xargs -0 sh -c 'rm -f -- "$@" && git checkout -- "$@"' _
git ls-files --eol -- '*.sh' '.githooks/*'                   # expect w/lf everywhere
```

### 3. Report

| Outcome | Report |
|---------|--------|
| Source repo | "Source harness repo — no sync needed" |
| Unregistered → synced | "Retrofitted to harness/<version> from default source" |
| Registered, up to date | "Harness was already at latest (harness/<version>) — files re-synced anyway" |
| Registered, drift → synced | "Synced local <old> → remote <new>" |
| `--dry-run` | List of paths that would be overwritten (+ `RETIRE rules/` when a legacy copy would be retired) |
| Network failure | "Could not reach remote. Check `source_remote` URL and network" |

## Verification

```bash
cat .omp/extensions/harness/harness-meta.json
git config --get core.hooksPath   # → .githooks
git status --short
node --test .omp/extensions/harness/tests/*.test.mjs   # gate tests ship with the gates (#17)
```

Confirm `version`, `commit_sha`, `updated` reflect the remote's latest; review changes before committing.

### 4. Quality audit (when `--audit` flag passed)

After sync (or instead of it, if invoked separately), run the deterministic quality scorer:

```bash
bash scripts/harness-audit.sh           # full breakdown
bash scripts/harness-audit.sh --terse   # one-line per category + TOTAL
```

Outputs 7 categories × 0..10 (total 0..70):
- `tool_coverage`, `context_efficiency`, `quality_gates`, `memory_persistence`,
  `eval_coverage`, `security_guardrails`, `cost_efficiency`

Use the score to track harness quality across versions and to surface concrete gaps (each missing item is listed with its category).

## Error Handling

| Condition | Action |
|-----------|--------|
| `git clone` fails | Report network/auth error; do not touch local files |
| No `harness/*` tags on remote | Report error; do not touch local files |
| Source repo detected | Self-skip, exit 0 |
| Dry-run flag | Show paths, exit before any write |

## Notes

- This skill does **not** commit the synced files. After sync, review with `git status` and commit when ready.
- For scheduled drift detection (no sync), the `session_start` gate `harness-version-check.mjs` (run by the harness extension) continues to report drift at session start without acting.
