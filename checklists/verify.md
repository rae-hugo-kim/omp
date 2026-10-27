# Verification Checklist

- [ ] Fastest relevant gate was run first (or explained why not)
- [ ] Commands are repo-discovered (not guessed)
- [ ] For user-impacting behavior: at least one reproducible verification artifact exists
- [ ] Any skipped gates are listed with rationale and risk
- [ ] Evidence is cited for version/command/API claims

## Independent Verification

- [ ] `verifier` agent spawned via the `task` tool when acceptance criteria exist, its verdict has actually arrived before the completion claim, and the verdict is `PASS` (`FAIL` / `INCOMPLETE` = not done) — `AGENTS.md` Completion Contract; a session without `task` reports BLOCKED and escalates to a top-level `omp -p` run (`rule://harness-harness_integration_contract` "Fallback Behavior")
- [ ] high/critical code change: `review-gate` evidence exists for the committed diff — the `reviewer` 3-pass sidecar (`docs/reviews/review-<ts>.json`, run before the code commit), a human-review sidecar, or an audited override with its reason (`rule://harness-agent_routing`, `rule://harness-harness_integration_contract` "4) review-gate")
- [ ] any `review_override` / `adversarial_override` used is recorded in `docs/harness/audit.jsonl`

(The plan-attack / test-attack / completion-attack steps are not completion conditions under OMP — see `rule://harness-adversarial_review` "도입 상태".)


## Docs/Policy-Only Change Mode

Use this mode when changes are limited to markdown/policy navigation/template edits with no runtime behavior impact.

- [ ] Eligibility confirmed: docs/policy/template files only; no code/config/schema/dependency changes
- [ ] Deterministic artifacts captured:
  - [ ] Link integrity check (edited links/anchors resolve)
  - [ ] Cross-reference check (references point to canonical docs)
  - [ ] Rule conflict checklist (no contradictions with `AGENTS.md` and linked rules)
- [ ] Evidence block prepared for docs-only PR:
  - [ ] Changed files listed
  - [ ] Before/after intent documented
  - [ ] Manual validation steps + outcomes included
- [ ] Policy risk level assigned (low / medium / high)
- [ ] Mandatory reviewers identified:
  - [ ] Medium: policy owner/maintainer + verification owner
  - [ ] High: policy owner/maintainer + verification owner + project/repo owner

