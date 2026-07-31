# Harness Integration Contract

This document defines the repo-level contract for validating harness integration before an agent claims policy compliance.

## Gate Location

All gates live in `.omp/extensions/harness/gates/` and are wired into the OMP event model by the extension `.omp/extensions/harness/index.ts` (each gate is spawned as a stdin-JSON CLI via `runGate("<gate>.mjs", payload)`; exit 0 = allow, exit 2 = block, stderr `HARNESS WARNING` = advisory).
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
7. `archive-guard` — blocks commits that would ingest local-archive files (`docs/sum`, `docs/reviews`, `docs/brainstorming`); warns on legacy-tracked ones (`tool_call`: bash, via commit-gates). The push-boundary backstop lives in `.githooks/pre-push` (blocks when archives are TRACKED) and the `compush`/`compr` pre-push checks; narrative backup is the private sum-vault (see `rules/doc_standards.md`).
8. Architect verification — independent completion verification (oh-my-claudecode agent, via OMP's task tool)

> **The commit-only gates run at git's boundary, not at the command layer.** `.githooks/pre-commit` invokes `commit-gates.mjs` in hook mode (`{"mode":"hook","hook":"pre-commit"}` on stdin) and it runs `acceptance-gate`, `backpressure-gate`, `review-gate`, `archive-guard` in order against the STAGED INDEX of the repo the hook fired in, blocking (exit 2) if ANY blocks. Each child gets a ~3s budget with SIGKILL; a gate that cannot render a verdict (crash, timeout, signal) BLOCKS fail-closed with a `HARNESS BLOCK [<gate>]` naming the gate and how to run it standalone. This replaces the former `tool_call`-time dispatcher, which had to infer "is this a commit, and against which repo?" from a shell string — six adversarial rounds showed each closed spelling reopened as an equivalent one. Enforcement now needs no spelling knowledge: git runs the hook for real commits only, in the real target repo, for agents and humans alike. `git` exports `GIT_DIR`/`GIT_INDEX_FILE`/`GIT_PREFIX` to hooks (for `commit -a` and pathspec commits `GIT_INDEX_FILE` is a TEMPORARY index holding exactly the commit's content) and the dispatcher inherits them untouched — sanitizing that environment would make those commits look empty. The command layer keeps only `commitBypassTripwire` (in `git-commit-detect.mjs`, called in-process by `index.ts`): it blocks a call that DECLARES a bypass — `--no-verify` (incl. unambiguous abbreviations and the `-n` alias), `core.hooksPath` retargeting via `-c`/`--config-env`/`GIT_CONFIG_KEY_*`, top-level `--git-dir`/`--work-tree`, and repo-retargeting `GIT_*` in the call's own environment. It deliberately does NOT inspect the session's ambient environment: ambient variables apply to git and its hooks alike (they cannot desynchronize the two), and reading them as retargeting once blocked an entire session over credential config (2026-07-27). `destructive-guard` stays a separate advisory hook that scans every command.

> Scope drift is no longer gate-enforced (scope-gate retired). It is handled by the AGENTS.md "Surgical Changes" rule + PR review; `out_of_scope` in seed.yaml is advisory prose the agent reads.

> **Task closeout** (`docs/rules/closeout_contract.md`): when a kickoff'd task lands on main (`compr`/`compush`), it is closed out — `seed.yaml` → `status: done`, `current-scope.md` retired, `task_closed` audit event. This is the **trigger lane** (best-effort, agent-run). The **verification lane** is independent: `docs-drift` warns (never fails) on inconsistent closeout state (orphan scope / half-closed / closeout-pending) at pre-push, not trusting the trigger. The acceptance-gate honors closed seeds (`done`/`superseded` → no active AC). An in-progress checkpoint declares itself with the one-shot flag `.omp/harness-state/commit-wip` or `OMP_COMMIT_WIP=1` — **not** with a `wip:` message prefix, which pre-commit cannot see (the message does not exist yet; see the backstop paragraph below).

> **Non-blocking backstop.** `.githooks/post-commit` and `.githooks/post-merge` observe commits the gates never saw and carry deferred one-shot consumption. On an ALLOW verdict the pre-commit dispatcher writes `.omp/harness-state/gated-commit-token` holding the **attempt identity** on two axes: a `v2` format marker, the approved tree (`git write-tree` on the index git is about to commit), and the HEAD this attempt would sit on. `post-commit` consumes the token only when the landed commit has that exact tree AND that exact parent — the parent axis is **strict**. An `--amend` (whose parent is the approved commit's parent) and any sibling commit on that base carry content the gates never judged, so they are reported as ungated instead of consuming the approval; accepting them wrote audit lines for diffs that never landed (measured in rounds 2–3). On a match, post-commit executes the deferred intents (`review-skip`/`backpressure-skip` unlink, audit append, `commit-wip` clear); otherwise it prints a `HARNESS ADVISORY`. The dispatcher clears the token and every pending intent at the START of each run and on BLOCK, so nothing an unapproved or blocked attempt produced can be replayed. Deferral is what keeps a one-shot override alive when a commit aborts AFTER the verdict (empty message): no commit, no post-commit, nothing consumed. Measured hook matrix (git 2.43.0): `pre-commit` fires for plain/`--amend`/merge-conflict-resolution commits; `post-commit` additionally fires for cherry-pick, revert, and rebase replay but NOT for merge auto-commits, which only `post-merge` observes (distinguishing a real merge from a fast-forward via git's reflog subject); fast-forward rebases and `git stash` create no gated commit at all.

> **Known residual surfaces** (threat model: a hasty agent, not an evasive adversary — these are documented, not defended):
> - `--no-verify` — the human emergency bypass. The tripwire blocks it for agent calls; the post-commit advisory records it. Integration paths (merge auto-commit, cherry-pick, revert, rebase) are deliberately NOT blocked: they move content already gated at its origin commit.
> - **Out-of-jurisdiction repos** — a repo without `core.hooksPath=.githooks` (or without the harness) is not gated. That is the intended semantics (it is also what removed the original cross-repo false blocks), but a consumer repo that has synced the harness without activating hooks is silently ungated until `bootstrap`/`migrate` sets the config.
> - **sparse-checkout (cone)** — dropping `.githooks/` from the worktree makes a RELATIVE `core.hooksPath` resolve to nothing and every hook is silently skipped, with no warning from git. `tests/hook-gates.test.mjs` (I12) pins this behavior so a future mitigation has a failing test to flip.
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
> - **Advisory precision at git's own limits** — the backstop distinguishes a real merge from a fast-forward through git's reflog subject. With `core.logAllRefUpdates=false` there is no subject to read, so a fast-forward onto a merge commit produces one spurious advisory. Noise, never silence.

## Auxiliary Gates and Orphan Detection

Not every `.mjs` in `.omp/extensions/harness/gates/` is invoked from `index.ts` via a direct `runGate(...)` call. Two groups are intentionally indirect:

- **Helper modules** (imported by other gates or by the extension, never spawned themselves): `git-commit-detect` (shared `isGitCommit` detector imported by `index.ts` and used by `commit-gates`, `acceptance-gate`, `backpressure-gate`, `review-gate`), `risk-assess` (risk classification imported by `review-gate` and `backpressure-gate`), `backpressure-patterns` (shared by `backpressure-tracker` and `backpressure-failure-tracker`), `read-path` (imported by `index.ts` — 라우팅·타깃 추출 순수 함수 층: `readTarget` strips a read selector / filters URLs so read-tracker logs the bare path context-gate compares against; `editTargets`/`mutationCallTargets` resolve mutating-call gate targets incl. the paths inside an `xd://ast_edit` dispatch body; `mutationRoute` classifies v17 xd:// device dispatches on `write` results — URI-scheme targets never enter the ledgers; `resolvedAstEditFiles` extracts the written files from an `xd://resolve` apply envelope).
- **Standalone advisory / lifecycle gates** (wired in `index.ts`, non-blocking): `destructive-guard` (`tool_call`: bash, scans every command), `mcp-gate` (advisory notice on `mcp__*` tool calls), `backpressure-invalidator` (`tool_result`: edit/write; for a staged `ast_edit` (v17 xd:// device dispatch) it runs on the PREVIEW as a safety fallback AND on the real `xd://resolve` apply — marks verification state stale), `harness-version-check` (`session_start` with the 24h default window; ALSO re-run agent-facing with a 1h `max_age_ms` window at `before_agent_start` — merged into the `harness-reminder` message — and after a successful `git commit` on `tool_result`, where drift text is appended to the commit's tool result. Failed probes write a short-lived failure marker so frequent callers back off instead of re-stalling on a dead network).

`scripts/docs-drift` audits this layout. Its orphan check is **reachability-based** from **two enforcement roots**: gates referenced from `.omp/extensions/harness/index.ts` (a `runGate(...)` call or import) AND gates named in a `.githooks/*` script (`getHookScriptRootPaths`) — since the commit gates moved into `.githooks/pre-commit`, the dispatcher and its four children are reachable only through that second root. A gate is also live when reachable from a root via an import / spawn reference (a quoted `*.mjs` literal that resolves to a real gate file), so the helper modules above are live, not orphans. Only a gate that is unreachable from BOTH roots is flagged — a genuinely dead file left after a refactor is still caught (pinned by the orphan-canary case in `tests/harness-wiring.test.mjs`). docs-drift is wired into `.githooks/pre-push` and blocks a push on FAIL-severity drift (broken links, a reference doc that claims `status: synced` while stale, a wired gate whose file is missing).

## Gate Verification Requirements

Use concrete checks, not assumptions.

### 1) `context-gate` + `read-tracker` + `write-tracker`

- Files: `.omp/extensions/harness/gates/context-gate.mjs`, `.omp/extensions/harness/gates/read-tracker.mjs`, `.omp/extensions/harness/gates/write-tracker.mjs`
- Log: `.omp/harness-state/hook-debug.log` (written only when `HARNESS_DEBUG` is set)
- State: `.omp/harness-state/read-log.txt` (appended by both `read-tracker` on read and `write-tracker` on edit|write)

### 2) `acceptance-gate`

- File: `.omp/extensions/harness/gates/acceptance-gate.mjs`
- Log: `.omp/harness-state/hook-debug.log` (written only when `HARNESS_DEBUG` is set)
- Reads: `docs/harness/current-scope.md` (checkboxes), `docs/harness/seed.yaml` (AC), `docs/harness/acceptance-done` (override flag)

### 3) `backpressure-gate` + `backpressure-tracker`

- Files: `.omp/extensions/harness/gates/backpressure-gate.mjs`, `.omp/extensions/harness/gates/backpressure-tracker.mjs`, `.omp/extensions/harness/gates/backpressure-failure-tracker.mjs`
- Log: `.omp/harness-state/hook-debug.log` (written only when `HARNESS_DEBUG` is set)
- State: `.omp/harness-state/backpressure-status`, `.omp/harness-state/test-history.json`
- **Failure recording**: the OMP adapter routes a failed bash `tool_result` to `backpressure-failure-tracker`, so failed build/test/lint runs ARE recorded — `backpressure-gate` sees explicit FAIL state, not just absence of recent success. Failure means `isError: true` OR non-zero `details.exitCode` (OMP keeps `isError` false for non-zero command exits and reports the code in `details.exitCode`; verified empirically). Residual dependence: a failing command that still exits 0 (a runner that swallows the exit code) is recorded as success.

### 4) `review-gate`

- File: `.omp/extensions/harness/gates/review-gate.mjs` (spawned via `commit-gates`)
- Log: `.omp/harness-state/hook-debug.log` (written only when `HARNESS_DEBUG` is set)
- Reads: `docs/reviews/review-<today>*.json` — machine evidence is a strict positional JSON tuple `["omp-review-evidence/v1", <diff_hash hex64>, <verdict: PASS|PASS WITH NOTES|FAIL>, <models|null>, <human_reviewed_by|null>, <reviewer>]`; the gate does NOT parse markdown (same-basename `.md` files are human reports — the former line-based CommonMark evidence parser was removed as a non-convergent attack surface). Second-perspective evidence = a MEASURED models array naming >=2 distinct families (written only after transcript-verifying the adversary's resolved family; thread/session ids are NOT evidence) **or** a human identity (never a model name) in the human_reviewed_by position. Validation is JSON.parse + exact arity + per-position type/enum/pattern checks — a tuple has no keys, so duplicate-key last-wins injection is structurally impossible; any malformation invalidates the FILE (ignored + warned, fail-closed). Also reads `docs/harness/review-skip` (audited override, same grammar: `["omp-review-override/v1", <reason>, <approved_by>, <diff_hash|UNVERIFIABLE>]` — commit-diff-bound, consumed on use, audited).
- Writes: `docs/harness/audit.jsonl` — a `review_override` event (`{ts,event,actor,meta}`, cf. `adversarial_override`) when a valid override is consumed
- A **bare** or non-tuple `review-skip` flag no longer bypasses the gate: there is no unaudited escape hatch. An invalid flag fails closed on high/critical with the exact copyable tuple (including the current diff hash) in the BLOCK message.
- Override + `git commit -a` TOCTOU: consuming an override writes `audit.jsonl` (git-tracked) before the commit runs, which `-a` would sweep into the commit and desync the approved hash — so when `audit.jsonl`/`review-skip` is tracked (checked live via `git ls-files`), the override is NOT consumable under `-a/--all`: high/critical fails closed with stage-plus-plain-commit guidance, medium warns and ignores the flag.

### 5) `kickoff-detector`

- File: `.omp/extensions/harness/gates/kickoff-detector.mjs`
- Reads: `docs/harness/kickoff-done` (suppresses reminder if exists)

### 6) Architect verification + Completion Attack Gate

- Provided by oh-my-claudecode `architect` agent (discovered via OMP's task tool)
- Not a file gate — invoked via agent delegation
- **Async delegation**: the `task` spawn is non-blocking — verdicts arrive via async job delivery. Spawning a verification agent (architect/verifier/reviewer) is **not** completion; the main agent MUST receive the verdict before claiming the task done.
- **Extended by completion-attack gate** (see [`rules/adversarial_review.md`](adversarial_review.md)):
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
