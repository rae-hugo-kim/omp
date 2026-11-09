---
description: "Minimal scoped diffs, no drive-by refactors, how to report unrelated issues"
---
# Change Control (Scope, Minimal Change, Tidy)

<!-- Harness: context-gate (read-before-edit); scope is via Surgical Changes + PR review -->

## MUST: minimal change first

- Prefer the smallest change that meets the stated goal.
- Avoid adding new abstractions unless needed for the change at hand.
- Scripted edits to repo files are byte-level (`read_bytes`/`write_bytes`, or the `edit` tool). Python `Path.read_text`/`write_text` normalizes CRLF to LF, which turned a 2-line edit of a CRLF rule file into a 364-line diff that `risk-assess` scored high (2026-10-21, #112 ② r2; `docs/sum/session_2026-10-16_adversary-panel-docs-audit-consumer-sync.md` Fix 2). When `git diff --stat` after a scripted edit is larger than expected, suspect line endings first.

## MUST: prevent scope creep

If you notice additional issues beyond the requested scope:

- Note them explicitly
- Propose follow-up work separately
- Do not silently expand the change set

## SHOULD: tidy refactors are separate and reversible

- Prefer keeping refactors small and obviously behavior-preserving.
- If a refactor is non-trivial, propose separating it (or commit separation if applicable).

## Trigger-based: Tidy First (STRUCTURAL vs BEHAVIORAL)

When both structure cleanup and behavior change are needed:

- **SHOULD** do STRUCTURAL first (behavior-preserving refactor), then BEHAVIORAL (feature/bug change).
- **SHOULD** separate commits when the repo uses commits as review units.
- If separation is not feasible (single-commit workflows), you MUST clearly delineate sections in the diff/PR description.

STRUCTURAL examples:

- Renames, extraction, reformatting, moving code without behavior changes
- Test scaffolding that does not change production behavior

BEHAVIORAL examples:

- Changing logic, APIs, outputs, business rules, side effects

## MUST: test-first for code logic when test infrastructure exists (grade shared with `rule://harness-tdd_policy`)

- If test infrastructure exists and the change is code logic, test-first (RED → GREEN → TIDY) is MUST; skipping it needs the user's explicit approval (`rule://harness-tdd_policy` Exception Protocol).
- If test infrastructure does not exist, the change is docs/policy-only, or the existing infrastructure cannot exercise the change at all (automation is not feasible), provide a deterministic alternative verification artifact (manual reproduction procedure, smoke test, or eval case) — no approval needed. When infrastructure exists and the change is code logic, the approval path wins: an infeasibility judgement is the reason stated for approval, not a bypass.

## Self-Check
- [ ] Does every changed line trace directly to the user's request?
- [ ] Would a senior engineer say this change is overcomplicated?
