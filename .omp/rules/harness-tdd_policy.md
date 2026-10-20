---
description: "RED -> GREEN -> TIDY: MUST for code-logic changes where test infrastructure exists; skipping needs approval, other paths need a deterministic alternative artifact"
---
# TDD Policy

## MUST: test-first for code-logic changes where test infrastructure exists

Code-logic changes in a repo with test infrastructure MUST follow the RED → GREEN → TIDY cycle. Skipping test-first in that case needs the user's explicit approval (Exception Protocol below). Three paths need **no approval** — provide a deterministic alternative verification artifact instead (manual reproduction procedure, smoke test, or eval case; `rule://harness-verification_tests_and_evals`): no test infrastructure in the repo, docs/policy-only changes, and changes the existing infrastructure cannot exercise at all (automation is not feasible — e.g. a non-code surface, a live external system). **Precedence**: when test infrastructure exists and the change is code logic, the approval path wins — "automation is not feasible" is then the reason you state in Exception Protocol step 1, never a bypass. `rule://harness-change_control`, `checklists/bugfix.md` and `rule://harness-verification_tests_and_evals` state the same grade and the same exception list.

## Cycle

### 1. RED (test first)
- Write a failing test that captures the requirement
- Test MUST fail before writing implementation
- One test at a time

### 2. GREEN (minimal pass)
- Write minimal code to make the test pass
- No extra features
- No premature optimization
- No unrelated changes

### 3. TIDY (clean touched code only)
- Rename unclear variables/functions
- Remove obvious duplication in new code
- Fix formatting inconsistencies
- Do NOT restructure existing code
- Do NOT add features

Repeat until the user story is complete.

## Coverage

- **Target**: 80–100% for new/changed code
- **Measure**: Use repo's coverage tool (discover via `repo_command_discovery`)
- **Report**: Include coverage in completion summary

## E2E Test Checklist

For each epic/feature, produce a human-testable checklist:

**Location**: `docs/checklists/e2e_<feature>.md` — consumer space. Never `checklists/`: that directory is harness-owned and replaced wholesale (`rm -rf` + copy) on every `harness-check` sync, so a checklist placed there is deleted by the next sync.

**Format**:
```markdown
# E2E Checklist: <Feature>

## Prerequisites
- [ ] <setup step>

## Test cases

### <User Story 1 title>
**Given** <precondition>
**When** <action>
**Then** <expected>

- [ ] Step 1
- [ ] Step 2
- [ ] Verify: <what to check>

### <User Story 2 title>
...

## Edge cases
- [ ] <edge case>

## Known limitations
- <limitation>
```

## Exception Protocol

Approval is required only when test-first was feasible — test infrastructure exists and the change is code logic — and you want to skip it:
1. State why (legacy constraint, untestable seam, etc.)
2. Propose alternative verification (manual steps, smoke test, eval case)
3. Get the user's explicit approval before proceeding without TDD

No approval is needed when test infrastructure does not exist, the change is docs/policy-only, or the existing infrastructure cannot exercise the change at all: state the alternative deterministic artifact and proceed. If infrastructure exists and the change is code logic, an infeasibility judgement is step 1 above, not this path.
