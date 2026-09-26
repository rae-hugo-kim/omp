---
description: "Repo-level contract for validating harness integration (gates, hooks, evidence, residual risks) before claiming compliance"
---
# Harness Integration Contract

This document defines the repo-level contract for validating harness integration before an agent claims policy compliance.

## Gate Location

All gates live in `.omp/extensions/harness/gates/` and are wired into the OMP event model by the extension `.omp/extensions/harness/index.ts` (each gate is spawned as a stdin-JSON CLI via `runGate("<gate>.mjs", payload)`; exit 0 = allow, exit 2 = block, stderr `HARNESS WARNING` = advisory).
Gates are spawned with `node` resolved from PATH — **never `process.execPath`** from an omp-hosted context: inside OMP, `process.execPath` is the omp binary itself (`index.ts` header comment). This is a MUST for `index.ts` and for anything executed inside an omp session (`eval` cells, ad-hoc reproductions): `spawnSync(process.execPath, [gate], { input: hookJson })` from an `eval` cell is `omp <gate.mjs>` with the hook payload as its prompt — an autonomous session, not a gate run (measured 2026-09-22 during the #33 review, #36: the session edited this repo's gate files and ran `git stash`). Reproduce gates from `bash` with `"$(command -v node)"` against a temp fixture; the `.githooks/pre-commit` node detection does not sit on this path. Node-hosted code is exempt because `process.execPath` IS node there — the dispatcher's child spawns (`commit-gates.mjs`) and tests under `node --test`.
Runtime state is stored in `.omp/harness-state/` (project-local, gitignored).
Gates that emit a debug trace write it to `.omp/harness-state/hook-debug.log` **only when `HARNESS_DEBUG` is set to a non-empty value** (e.g. `HARNESS_DEBUG=1`); off by default, to avoid log noise. Not every gate logs there — `read-tracker`/`write-tracker` write only `read-log.txt`, and `kickoff-detector`/`harness-version-check` don't use it. Gate behavior — what blocks or allows — never depends on `HARNESS_DEBUG`.

## Required Gates and Event Wiring

The following controls are required when harness is available:

1. `context-gate` — blocks edits to unread files (`tool_call`: edit|write|ast_edit)
2. `read-tracker` — records file reads for context-gate (`tool_result`: read)
   - `write-tracker` — records files written for context-gate so a file created this session can be edited without re-reading (`tool_result`: edit|write|ast_edit)
3. `acceptance-gate` — blocks commits with unmet acceptance criteria (`tool_call`: bash, via commit-gates)
4. `backpressure-gate` — blocks commits if build/test/lint failed (`tool_call`: bash, via commit-gates)
5. `backpressure-tracker` — records build/test/lint successes (`tool_result`: bash, exit 0); `backpressure-failure-tracker` records failures (`tool_result`: bash with `isError` or non-zero `details.exitCode`)
6. `kickoff-detector` — reminds about kickoff for new work (`before_agent_start`, message injection)
7. `archive-guard` — blocks commits that would ingest local-archive files (`docs/sum`, `docs/reviews`, `docs/brainstorming`); warns on legacy-tracked ones (`tool_call`: bash, via commit-gates). The push-boundary backstop lives in `.githooks/pre-push` (blocks when archives are TRACKED) and the `compush`/`compr` pre-push checks; narrative backup is the private sum-vault (see `.omp/rules/harness-doc_standards.md`).
8. Architect verification — independent completion verification (oh-my-claudecode agent, via OMP's task tool)

> **The commit-only gates run at git's boundary, not at the command layer.** `.githooks/pre-commit` invokes `commit-gates.mjs` in hook mode (`{"mode":"hook","hook":"pre-commit"}` on stdin) and it runs `acceptance-gate`, `backpressure-gate`, `review-gate`, `archive-guard` in order against the STAGED INDEX of the repo the hook fired in, blocking (exit 2) if ANY blocks. Each child gets a ~3s budget with SIGKILL; a gate that cannot render a verdict (crash, timeout, signal) BLOCKS fail-closed with a `HARNESS BLOCK [<gate>]` naming the gate and how to run it standalone. This replaces the former `tool_call`-time dispatcher, which had to infer "is this a commit, and against which repo?" from a shell string — six adversarial rounds showed each closed spelling reopened as an equivalent one. Enforcement now needs no spelling knowledge: git runs the hook for real commits only, in the real target repo, for agents and humans alike. `git` exports `GIT_DIR`/`GIT_INDEX_FILE`/`GIT_PREFIX` to hooks (for `commit -a` and pathspec commits `GIT_INDEX_FILE` is a TEMPORARY index holding exactly the commit's content) and the dispatcher inherits them untouched — sanitizing that environment would make those commits look empty. The command layer keeps only `commitBypassTripwire` (in `git-commit-detect.mjs`, called in-process by `index.ts`): it blocks a call that DECLARES a bypass — `--no-verify` (incl. unambiguous abbreviations and the `-n` alias), `core.hooksPath` retargeting via `-c`/`--config-env`/`GIT_CONFIG_KEY_*`, top-level `--git-dir`/`--work-tree`, and repo-retargeting `GIT_*` in the call's own environment. It deliberately does NOT inspect the session's ambient environment: ambient variables apply to git and its hooks alike (they cannot desynchronize the two), and reading them as retargeting once blocked an entire session over credential config (2026-07-27). `destructive-guard` stays a separate advisory hook that scans every command.

> Scope drift is no longer gate-enforced (scope-gate retired). It is handled by the AGENTS.md "Surgical Changes" rule + PR review; `out_of_scope` in seed.yaml is advisory prose the agent reads.

> **Task closeout** (`docs/rules/closeout_contract.md`): when a kickoff'd task lands on main (`compr`/`compush`), it is closed out — `seed.yaml` → `status: done`, `current-scope.md` retired, `task_closed` audit event. This is the **trigger lane** (best-effort, agent-run). The **verification lane** is independent: `docs-drift` warns (never fails) on inconsistent closeout state (orphan scope / half-closed / closeout-pending) at pre-push, not trusting the trigger. The acceptance-gate honors closed seeds (`done`/`superseded` → no active AC). An in-progress checkpoint declares itself with the one-shot flag `.omp/harness-state/commit-wip` or `OMP_COMMIT_WIP=1` — **not** with a `wip:` message prefix, which pre-commit cannot see (the message does not exist yet; see the backstop paragraph below).

> **Non-blocking backstop.** `.githooks/post-commit` and `.githooks/post-merge` observe commits the gates never saw and carry deferred one-shot consumption. On an ALLOW verdict the pre-commit dispatcher writes `.omp/harness-state/gated-commit-token` holding the **attempt identity** on two axes: a `v2` format marker, the approved tree (`git write-tree` on the index git is about to commit), and the HEAD this attempt would sit on. `post-commit` consumes the token only when the landed commit has that exact tree AND that exact parent — the parent axis is **strict**. An `--amend` (whose parent is the approved commit's parent) and any sibling commit on that base carry content the gates never judged, so they are reported as ungated instead of consuming the approval; accepting them wrote audit lines for diffs that never landed (measured in rounds 2–3). On a match, post-commit executes the deferred intents (`review-skip`/`backpressure-skip` unlink, audit append, `commit-wip` clear); otherwise it prints a `HARNESS ADVISORY`. The dispatcher clears the token and every pending intent at the START of each run and on BLOCK, so nothing an unapproved or blocked attempt produced can be replayed. Deferral is what keeps a one-shot override alive when a commit aborts AFTER the verdict (empty message): no commit, no post-commit, nothing consumed. Measured hook matrix (git 2.43.0): `pre-commit` fires for plain/`--amend`/merge-conflict-resolution commits; `post-commit` additionally fires for cherry-pick, revert, and rebase replay but NOT for merge auto-commits, which only `post-merge` observes (distinguishing a real merge from a fast-forward via git's reflog subject); fast-forward rebases and `git stash` create no gated commit at all.

> **Estimate-vs-actual (observation only, `.omp/rules/harness-cycle_definition.md` "예상 레코드").** The intake writes `.omp/harness-state/cycle-estimate` — `["omp-estimate/v1", <risk>, <files>, <depth>, <model>, <effort>, <ts>]`. In hook mode `review-gate` (the gate that already runs `risk-assess`) compares it with the measured risk and queues, through the same `pending-consume` protocol as `review_override`/`harness_sync`, one `estimate_vs_actual` audit intent plus an `unlink-cycle-estimate` intent, so the record is recorded and consumed only when the commit lands (a blocked attempt leaves it untouched, and the next attempt re-reads it). The record NEVER enters a verdict: a missing, valid, or malformed record leaves every gate's exit code and BLOCK output byte-identical — a malformed record costs one `HARNESS WARNING` line and stays on disk. `fails_since_estimate` is the count of `test`/`build`/`lint` FAIL entries in `.omp/harness-state/session-log.jsonl` after the record's `ts` (bounded tail read; a failure whose exit code was masked by a pipe is recorded PASS by the tracker and is invisible here — a known limit). Read the data with `node .omp/extensions/harness/estimate-report.mjs`.

> **Known residual surfaces** (threat model: a hasty agent, not an evasive adversary — these are documented, not defended):
> - `--no-verify` — the human emergency bypass. The tripwire blocks it for agent calls; the post-commit advisory records it. Integration paths (merge auto-commit, cherry-pick, revert, rebase) are deliberately NOT blocked: they move content already gated at its origin commit.
> - **Out-of-jurisdiction repos** — a repo without `core.hooksPath=.githooks` (or without the harness) is not gated. That is the intended semantics (it is also what removed the original cross-repo false blocks). `core.hooksPath` is local git config that no file sync carries, so a consumer that synced or `init`-created the harness without activating hooks is silently ungated (#26 measured 9 of 10 consumers). Mitigation, not defense: `harness-version-check.mjs` emits `HARNESS HOOKS INACTIVE` (once per 24h) when `.githooks/` exists but `core.hooksPath` does not resolve to it, `init` now activates hooks before the initial commit, and `harness-sync.sh` sets the config idempotently on every sync.
> - **sparse-checkout (cone)** — dropping `.githooks/` from the worktree makes a RELATIVE `core.hooksPath` resolve to nothing and every hook is silently skipped, with no warning from git. `.omp/extensions/harness/tests/hook-gates.test.mjs` (I12) pins this behavior so a future mitigation has a failing test to flip.
> - **`git stash`** — creates commit objects outside branch history and fires no commit hook.
> - **Concurrent commits** — git serializes them with `index.lock`; the loser fails with git's own `rc=128` message, which is NOT a harness block. Never "fix" it by deleting harness state.
> - **Two-step hooksPath re-pointing** — `git config core.hooksPath /tmp/none` followed by a plain commit is not caught by the tripwire, and must not be: pointing `core.hooksPath` is exactly how `bootstrap`/`migrate` ARM the harness, so the command itself is legitimate. An agent that disarms the repo and then commits is outside the threat model. Note that this also silences the backstop — with hooks re-pointed, `post-commit` does not run either, so such a commit leaves NO advisory. Detection is after the fact: the checklist's `core.hooksPath` step, or `docs-drift` at push time.
> - **`help.autocorrect` + a misspelled verb** — with `help.autocorrect` enabled (opt-in, off by default) git runs `git comit -n` as a commit, which the tripwire does not classify as one; the pre-commit hook is then skipped by the `-n`. Out of the threat model (a hasty agent types the real verb), and the post-commit advisory still fires.
> - **argv-local alias indirection beyond the definition body** — `-c alias.c=commit` and `-c "alias.c=commit --no-verify"` are both read, but an alias whose target is itself another alias, or a shell alias (`!f() { ... }`), is not resolved.
> - **`git rebase --continue` conflict resolution** — resolving a conflict during a rebase can introduce genuinely new content, and that commit path fires neither `pre-commit` nor a blocking gate (only the post-commit advisory). The "already gated at its origin" argument does not cover the resolution itself.
> - **node absence** — the pre-commit hook fails CLOSED (`OMP_NODE_BIN` is the documented escape hatch for nvm/GUI/cron environments where node is not on PATH).
> - **Content already in HEAD is never re-judged** — the gates judge what a commit ADDS relative to HEAD (its staged index), uniformly. `git commit --amend` is therefore gated on the delta it stages, not on the content it inherits, so an amend cannot be used to "re-gate" something that landed via `--no-verify`. This is deliberate: git exposes no amend flag to hooks, and the only observable shape ("nothing staged while a parent exists") is shared by `--allow-empty`, a plain commit with an empty index, and a merge resolved to HEAD's tree — inferring amend from it false-blocked all three while still missing an amend that stages a delta and an amend of a root commit (both measured, review round 2).
> - **Merge-resolution scope** — a conflict-resolution commit is judged against HEAD (its first parent), so the diff includes everything the merge brings in. Those commits were gated at their origin, so the review-evidence demand can be satisfied by the audited override; the alternative (judging nothing) would be worse.
> - **`--no-verify` is watched by DECLARATION, not by outcome** — the tripwire reads what a call declares (flags, retargeting env, argv-local alias bodies). A caller that redefines the verb itself (`-c alias.commit='commit --no-verify'`), defines an alias through `GIT_CONFIG_PARAMETERS` or the `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_n`/`GIT_CONFIG_VALUE_n` channel, or chains alias→alias reaches a bypass the tripwire does not name. All of these are evasive shapes, not hasty ones; the hook boundary is what makes them merely *unannounced* rather than *unenforced* — the post-commit advisory still fires.
> - **Declaration watch is bash-tool-scoped** — the tripwire and destructive-guard read only `tool_call bash` command strings; a shell spawned by any other tool (an `eval` subprocess, an MCP-launched shell) is invisible to them (upstream documents the same boundary for `bash.patterns` — oh-my-pi #8838, 17.3.8). The git-boundary hooks still gate every normal commit regardless of spawn path, so the uncovered shape is specifically an eval-spawned `git commit --no-verify`: it skips the hook AND the watch, leaving only the post-commit advisory. Deliberately documented, not defended — blocking would mean parsing arbitrary eval code (rule-pile growth); the upstream lever, if ever needed, is a `tools.approval.eval` policy.
> - **Advisory precision at git's own limits** — the backstop distinguishes a real merge from a fast-forward through git's reflog subject. With `core.logAllRefUpdates=false` there is no subject to read, so a fast-forward onto a merge commit produces one spurious advisory. Noise, never silence.

## Auxiliary Gates and Orphan Detection

Not every `.mjs` in `.omp/extensions/harness/gates/` is invoked from `index.ts` via a direct `runGate(...)` call. Two groups are intentionally indirect:

- **Helper modules** (imported by other gates or by the extension, never spawned themselves): `git-commit-detect` (shared `isGitCommit` detector imported by `index.ts` and used by `commit-gates`, `acceptance-gate`, `backpressure-gate`, `review-gate`), `risk-assess` (risk classification imported by `review-gate` and `backpressure-gate`), `backpressure-patterns` (shared by `backpressure-tracker` and `backpressure-failure-tracker`), `read-path` (imported by `index.ts` — 라우팅·타깃 추출 순수 함수 층: `readTarget` strips a read selector / filters URLs so read-tracker logs the bare path context-gate compares against; `editTargets`/`mutationCallTargets` resolve mutating-call gate targets incl. the paths inside an `xd://ast_edit` dispatch body; `mutationRoute` classifies v17 xd:// device dispatches on `write` results — URI-scheme targets never enter the ledgers; `resolvedAstEditFiles` extracts the written files from an `xd://resolve` apply envelope).
- **Standalone advisory / lifecycle gates** (wired in `index.ts`, non-blocking): `destructive-guard` (`tool_call`: bash, scans every command), `mcp-gate` (advisory notice on `mcp__*` tool calls), `backpressure-invalidator` (`tool_result`: edit/write; for a staged `ast_edit` (v17 xd:// device dispatch) it runs on the PREVIEW as a safety fallback AND on the real `xd://resolve` apply — marks verification state stale), `harness-version-check` (`session_start` with the 24h default window; ALSO re-run agent-facing with a 1h `max_age_ms` window at `before_agent_start` — merged into the `harness-reminder` message — and after a successful `git commit` on `tool_result`, where drift text is appended to the commit's tool result. Failed probes write a short-lived failure marker so frequent callers back off instead of re-stalling on a dead network).

`scripts/docs-drift` audits this layout. Its orphan check is **reachability-based** from **two enforcement roots**: gates referenced from `.omp/extensions/harness/index.ts` (a `runGate(...)` call or import) AND gates named in a `.githooks/*` script (`getHookScriptRootPaths`) — since the commit gates moved into `.githooks/pre-commit`, the dispatcher and its four children are reachable only through that second root. A gate is also live when reachable from a root via an import / spawn reference (a quoted `*.mjs` literal that resolves to a real gate file), so the helper modules above are live, not orphans. Only a gate that is unreachable from BOTH roots is flagged — a genuinely dead file left after a refactor is still caught (pinned by the orphan-canary case in `.omp/extensions/harness/tests/harness-wiring.test.mjs`). docs-drift is wired into `.githooks/pre-push` and blocks a push on FAIL-severity drift (broken links, a reference doc that claims `status: synced` while stale, a wired gate whose file is missing).

## Gate Verification Requirements

Use concrete checks, not assumptions.

A session keeps the extension it loaded at start: editing `index.ts` or a gate does not swap it in. A live smoke of a changed adapter path therefore runs in a NESTED session — `omp -p --no-session --tools=bash "<one tool call>"` from the same repo — and is judged by the state files (`.omp/harness-state/`) it leaves behind; the outer session can only reproduce the OLD behavior (measured 2026-09-24, #40).

### 1) `context-gate` + `read-tracker` + `write-tracker`

- Files: `.omp/extensions/harness/gates/context-gate.mjs`, `.omp/extensions/harness/gates/read-tracker.mjs`, `.omp/extensions/harness/gates/write-tracker.mjs`
- Log: `.omp/harness-state/hook-debug.log` (written only when `HARNESS_DEBUG` is set)
- State: `.omp/harness-state/read-log.txt` (appended by both `read-tracker` on read and `write-tracker` on edit|write)
- Anchor sources: a `read` of the file, a `grep`/`ast_grep` result that minted a `[path#TAG]` anchor for it, or a `write` this session — all mark the file as read for context-gate. **Passing context-gate is not passing omp's own edit guard**: since omp 18.2.5 `edit.enforceSeenLines` is on by default (`omp config list` → `true`, re-measured on 18.3.0, 2026-09-24), so a hashline edit whose anchor lines were never DISPLAYED (a grep that showed other lines, a structural summary that elided the body) is rejected by the `edit` tool itself. Read the exact range before editing it; the harness only guarantees the file was seen, not the lines.
- Ledger path normalization (`gates/read-path.mjs`): the read selector regex mirrors `omp://tools/read.md` EXACTLY (`:raw`, `:conflicts`, `:img`, `:-N` tail, ranges, `:raw` in either order) and a known-scheme allowlist rejects virtual targets in both `scheme://` and the single-slash `scheme:/` form the event plumbing emits (`xd:/retain`, observed 2026-07-16). Both lists are version-coupled: a selector omp adds (`:img`, 18.2.9) leaves `logo.svg:img` in read-log so editing `logo.svg` false-blocks; a scheme omp adds (`proc://`, `conflict://`, 18.3.0) risks a `<cwd>/proc:/…` phantom. Last mirrored against omp 18.3.0 (2026-09-24, #42); recheck `read.md` on every omp upgrade (`tests/read-path.test.mjs`).

### 2) `acceptance-gate`

- File: `.omp/extensions/harness/gates/acceptance-gate.mjs`
- Log: `.omp/harness-state/hook-debug.log` (written only when `HARNESS_DEBUG` is set)
- Reads: `docs/harness/current-scope.md` (checkboxes), `docs/harness/seed.yaml` (AC), `docs/harness/acceptance-done` (override flag)

### 3) `backpressure-gate` + `backpressure-tracker`

- Files: `.omp/extensions/harness/gates/backpressure-gate.mjs`, `.omp/extensions/harness/gates/backpressure-tracker.mjs`, `.omp/extensions/harness/gates/backpressure-failure-tracker.mjs`
- Log: `.omp/harness-state/hook-debug.log` (written only when `HARNESS_DEBUG` is set)
- State: `.omp/harness-state/backpressure-status`, `.omp/harness-state/test-history.json`
- **Failure recording**: the OMP adapter routes a failed bash `tool_result` to `backpressure-failure-tracker`, so failed build/test/lint runs ARE recorded — `backpressure-gate` sees explicit FAIL state, not just absence of recent success. Failure means `isError: true` OR non-zero `details.exitCode` (OMP keeps `isError` false for non-zero command exits and reports the code in `details.exitCode`; verified empirically). Residual dependence: a failing command that still exits 0 (a runner that swallows the exit code) is recorded as success.
- **Backgrounded runs are NOT recorded** (omp 18.3.0, measured 2026-09-24, #40): a bash call that returns a background-start result — `async: true`, or `bash.autoBackground` (default on, 60s threshold) converting a run that outlived its wait window — carries `details.async.state: "running"`, no `exitCode`, `isError: false`, and the job's outcome is delivered later through `onUpdate` / the async job manager, never as a `tool_result`. The adapter skips BOTH trackers for that event (neither PASS nor FAIL; `backpressure-last-fail` is left as it was) and writes the session breadcrumb as `PENDING`; a backgrounded `git commit` triggers no post-commit drift recheck or cycle-boundary note either. Consequence: a verification that was backgrounded never counts — **rerun it so it completes in the foreground.** A larger `timeout` does NOT do that: auto-background converts any non-PTY run that outlives `min(thresholdMs, timeout − 1s)` regardless of the deadline (live-observed: `sleep 120` with `timeout: 200` still backgrounded). For a verification longer than the threshold, run it with `pty: true` (never auto-backgrounded) or raise `bash.autoBackground.thresholdMs` in the omp config. Do NOT use a named service (`name:`) for verification: its result carries `details.service` only — no `exitCode`, no `isError`, no `details.async` — so it is routed as a plain success (pre-existing hole, not covered by this guard). Before this guard the start result was routed as a success, which recorded a failing `node --test` as PASS and cleared the previous FAIL.
- **A PASS is recorded only from a `passReliable` command** (`backpressure-patterns.mjs`): the verification must be the leading command and its exit must control the shell's exit — no `| grep/tail`, no `;`/`||` chains, no redirection tricks. A piped run still shows up as a `PASS` breadcrumb in `session-log.jsonl` but leaves `backpressure-status` untouched, so a commit right after `node --test … | grep` blocks with "No build/test verification" (measured 2026-09-24). Run the pre-commit verification bare: `node --test .omp/extensions/harness/tests/*.test.mjs`.

### 4) `review-gate`

- File: `.omp/extensions/harness/gates/review-gate.mjs` (spawned via `commit-gates`)
- Log: `.omp/harness-state/hook-debug.log` (written only when `HARNESS_DEBUG` is set)
- Reads: `docs/reviews/review-<today>*.json` — machine evidence is a strict positional JSON tuple `["omp-review-evidence/v1", <diff_hash hex64>, <verdict: PASS|PASS WITH NOTES|FAIL>, <models|null>, <human_reviewed_by|null>, <reviewer>]`; the gate does NOT parse markdown (same-basename `.md` files are human reports — the former line-based CommonMark evidence parser was removed as a non-convergent attack surface). Second-perspective evidence = a MEASURED models array naming >=2 distinct families (written only after transcript-verifying the adversary's resolved family; thread/session ids are NOT evidence) **or** a human identity (never a model name) in the human_reviewed_by position. Validation is JSON.parse + exact arity + per-position type/enum/pattern checks — a tuple has no keys, so duplicate-key last-wins injection is structurally impossible; any malformation invalidates the FILE (ignored + warned, fail-closed). Also reads `docs/harness/review-skip` (audited override, same grammar: `["omp-review-override/v1", <reason>, <approved_by>, <diff_hash|UNVERIFIABLE>]` — commit-diff-bound, consumed on use, audited).
- Writes: `docs/harness/audit.jsonl` — a `review_override` event (`{ts,event,actor,meta}`, cf. `adversarial_override`) when a valid override is consumed
- A **bare** or non-tuple `review-skip` flag no longer bypasses the gate: there is no unaudited escape hatch. An invalid flag fails closed on high/critical with the exact copyable tuple (including the current diff hash) in the BLOCK message.
- Override + `git commit -a` TOCTOU: consuming an override writes `audit.jsonl` (git-tracked) before the commit runs, which `-a` would sweep into the commit and desync the approved hash — so when `audit.jsonl`/`review-skip` is tracked (checked live via `git ls-files`), the override is NOT consumable under `-a/--all`: high/critical fails closed with stage-plus-plain-commit guidance, medium warns and ignores the flag.
- **Sync provenance (consumer repos)**: `harness-sync.sh` writes the copied tag's whitelisted paths as blob/tree objects into the consumer's own object store (from the temp clone, work tree pinned — no network; a tag fetch is impossible from a shallow clone) and pins them with `refs/harness/<ver>`, keeping exactly the two newest versions. `.omp/extensions/harness/harness-manifest.json` (`version`, `tree_sha`, `commit_sha`, file index) is for humans. `risk-assess.mjs` trusts the **ref's tree, not the manifest**: the manifest must name the HIGHEST `refs/harness/*` present and its `tree_sha` must equal that ref's tree, otherwise nothing is exempt (no downgrade via a stale manifest). A changed file is excluded from scoring only when (1) its path is a harness asset path (static list mirroring the sync whitelist — `src/` etc. can never be exempted), and (2) its committed entry (index for a staged commit, worktree content for `-a`, both for an unverifiable form) has the same blob sha **and mode** as `git ls-tree refs/harness/<ver>` at that path, or it deletes a path that the PREVIOUS synced tree carried and the current one does not (an upstream removal — a consumer-owned file under a harness prefix was never in a synced tree, so deleting it is scored). Diffs are taken with `--no-renames` so a deleted path always surfaces. The level is decided by the remainder alone: a pure sync commit scores LOW with no override; user code in the same commit, a synced file edited in place, or a mode-only change is scored as before. Forging the exemption requires writing objects and moving `refs/harness/*` by hand — deliberate, outside the threat model. `review-gate` queues a `harness_sync` audit event (`{version, tag, tree_sha, synced_files, synced, other_files, other, risk}`) in hook mode, consumed by post-commit like `review_override`. The source repo never carries a manifest or provenance ref (sync self-skips there). Known residual: the sync reports the EFFECTIVE `core.hooksPath` after setting it, so a per-worktree override (`extensions.worktreeConfig`) is surfaced as a warning rather than silently claimed.
- **Template bootstrap window (consumer repos, #35)**: the `init` cleanup commit — the SECOND commit of a fresh template clone — deletes hundreds of lines of source-only assets (including a `*credentials*`-named prose doc that scores critical), so it always blocked review-gate and, once overridden, backpressure-gate (its verification cannot be recorded from the parent-directory session that runs init). `risk-assess.mjs` excludes a changed path from scoring only when ALL hold: (1) no ref exists under `refs/harness/` (version-shaped or not), HEAD has no parent (`rev-list --max-count=2` yields one commit), and the repository is **not shallow** (`rev-parse --is-shallow-repository` = false) — checked in that order so an established repo exits after one ref scan and one object lookup; (2) `harness-meta.json` makes the template→consumer transition in this commit — the copy at HEAD carries **no** `bootstrapped_at`/`source_remote` key at all (a partial or empty marker is still "already a consumer"), the copy **as committed** (index for a plain commit, worktree for `-a`, both for an unverifiable form) carries **non-empty** `bootstrapped_at` + `source_remote`; (3) the path is a **deletion of a source-only asset** — under `docs/` or `claudedocs/`, or exactly `scripts/docs-drift` / `CHANGELOG.md`, and never a harness asset path (so `docs/rules/`, `docs/templates/`, `docs/checklists/`, `.omp/extensions/harness/`, `.githooks/`, `rules/` deletions are scored: a bootstrap commit that removes `index.ts` or a hook would otherwise have unwired the gates as "low") — or a non-deleted edit of `README.md`, `README.en.md`, `harness-meta.json`, `docs/glossary.yaml`, `docs/harness/audit.jsonl` (a deletion of one of these is judged by the cleanup rule, never by the edit list). Everything else in that commit (user code, an `AGENTS.md` edit, a harness-asset deletion) is scored as usual; the window closes at the third commit, the first sync, or as soon as HEAD already carries any bootstrap marker — which is what keeps a `--depth 1` clone of an established consumer (count 1, no local `refs/harness/*`, meta already bootstrapped) from re-opening it (3-pass review 2026-09-23). Documented residuals, outside the hasty-agent threat model: a graft/`git replace --graft` that makes a multi-commit never-bootstrapped repo look single-commit, and an `--amend` of the template root commit (same exempt set, not a bypass). Pinned by `.omp/extensions/harness/tests/risk-assess.test.mjs` (bootstrap: …).

### 5) `kickoff-detector`

- File: `.omp/extensions/harness/gates/kickoff-detector.mjs`
- Reads: `docs/harness/kickoff-done` (suppresses reminder if exists)

### 6) Architect verification + Completion Attack Gate

- Provided by oh-my-claudecode `architect` agent (discovered via OMP's task tool)
- Not a file gate — invoked via agent delegation
- **Async delegation**: the `task` spawn is non-blocking — verdicts arrive via async job delivery. Spawning a verification agent (architect/verifier/reviewer) is **not** completion; the main agent MUST receive the verdict before claiming the task done.
- **Extended by completion-attack gate** (see [`.omp/rules/harness-adversarial_review.md`](harness-adversarial_review.md)):
  - architect (기존 역할 유지) + security-reviewer + test-engineer 병렬 실행
  - 불일치 시 critic이 합의 판정
  - CRITICAL 발견 시 블로킹
- Output: `docs/harness/completion-attack-report.md`

## Startup Checklist (Run Before Claiming Compliance)

1. Confirm gates directory exists: `test -d .omp/extensions/harness/gates && echo gates_ok`
2. Confirm all gate files are present:
   ```bash
   for h in context-gate read-tracker write-tracker commit-gates acceptance-gate backpressure-gate review-gate archive-guard backpressure-tracker kickoff-detector; do
     test -f ".omp/extensions/harness/gates/$h.mjs" && echo "$h: ok" || echo "$h: MISSING"
   done
   ```
3. Confirm the extension wires the gates: `grep -c 'runGate(' .omp/extensions/harness/index.ts` (non-zero; the exact count grows as gates are added — do not assert a constant). Both this AND step 2 must pass — wiring without files, or files without wiring, is a failure.
4. Confirm the commit gates are actually ARMED (they run from a git hook, not from the extension):
   ```bash
   test "$(git config core.hooksPath)" = ".githooks" && echo hooksPath_ok || echo "hooksPath: NOT SET — commit gates are inert"
   test -x .githooks/pre-commit && echo pre-commit_ok || echo "pre-commit: MISSING/not executable"
   test -f .githooks/pre-commit -a -f .githooks/post-commit -a -f .githooks/post-merge && echo hooks_present || echo "hooks: INCOMPLETE"
   ```
   A repo that synced the harness without this config is silently ungated — `bootstrap`/`migrate` set it.
5. Confirm Architect agent is available via oh-my-claudecode (OMP task tool)
6. Record harness status in your working notes and final PR report

## Fallback Behavior When a Gate Is Unavailable

If any required gate is unavailable, do not claim fully automated harness compliance for that gate. Apply this downgrade policy:

- Missing `context-gate`:
  - Downgrade from **MUST (automated pre-read enforcement)** to **manual pre-edit read checklist MUST**.
  - Record files read before each edit batch.
- Missing `acceptance-gate`:
  - Downgrade from **MUST (automated acceptance checks)** to **manual acceptance checklist MUST**.
  - Require explicit evidence section with commands, outputs, and file citations.
- Missing `backpressure-gate`:
  - Downgrade from **MUST (automated failure pressure)** to **manual stop-and-review MUST**.
  - After any failed verification, halt feature work until failure is resolved or explicitly risk-accepted.
- Missing Architect verification:
  - Downgrade from **MUST (independent verifier)** to **manual two-pass self-review MUST**.
  - Complete a second-pass review using `checklists/verify.md` before claiming done.

When downgrading, final report MUST include:

- Which gate was unavailable
- How manual checklist substitution was applied
- Remaining residual risk

## Known-Failure Matrix

| Symptom | Likely cause | Safe mitigation |
|---|---|---|
| Gate file not found in `.omp/extensions/harness/gates/` | Partial clone or deleted gate file | Re-clone template or restore from git; if blocked, activate manual checklist downgrade |
| Gate exists but no events in `.omp/harness-state/hook-debug.log` | Debug logging is OFF by default (gated behind `HARNESS_DEBUG`) | An empty/absent log does NOT mean the gate is unwired. Set `HARNESS_DEBUG=1` to enable logging, then verify the `runGate(...)` reference in `.omp/extensions/harness/index.ts` and re-run a benign trigger. |
| `acceptance-gate` repeatedly blocks completion | Missing evidence or unchecked AC in `current-scope.md` | Check off completed criteria or create `docs/harness/acceptance-done` override |
| `review-gate` blocks a high/critical commit | No second-perspective evidence for the effective diff | Run the reviewer agent (writes the `.json` evidence sidecar), write a human-review sidecar (`["omp-review-evidence/v1", <hash>, "PASS", null, <name>, <name>]`), or create an audited override (`docs/harness/review-skip` with `["omp-review-override/v1", <reason>, <approved_by>, <hash>]`). The BLOCK message prints the exact copyable tuples with the real hash. |
| `backpressure-gate` loops on failures | Underlying failing test/check never addressed | Stop retries, fix root cause, then re-run once with documented rationale |
| `context-gate` blocks unexpectedly | `read-log.txt` missing or stale | Read the file first; if persistent, check `read-tracker` is wired in `.omp/extensions/harness/index.ts` |
| Architect log missing for completed task | oh-my-claudecode not installed or architect agent unavailable | Run manual two-pass verification and mark Architect as downgraded in report |

## Copy-Paste Verification Template

Use this in PR descriptions or completion reports:

```md
### Harness Verification
- context-gate: [active | unavailable->manual] (evidence: `<command/log snippet>`)
- acceptance-gate: [active | unavailable->manual] (evidence: `<command/log snippet>`)
- backpressure-gate: [active | unavailable->manual] (evidence: `<command/log snippet>`)
- Architect verification: [active | unavailable->manual] (evidence: `<command/log snippet>`)

### Downgrades (if any)
- Gate: `<name>`
- Manual checklist used: `<checklist/steps>`
- Residual risk: `<brief note>`
```
