# INDEX.md (rules)

## Ownership legend

- `owner: global-harness` → enforced by oh-my-claudecode platform/harness.
- `owner: local-policy` → enforced by this repository’s policy docs and review process.
- Any `MUST` without an explicit owner tag defaults to `owner: local-policy` unless explicitly stated otherwise.

## Conflict resolution order (when global and local diverge)

1. **System/developer/user instructions** (runtime prompt instructions)
2. **Global harness requirements** (`owner: global-harness`)
3. **Repository-local policy** (`owner: local-policy`)
4. **Advisory guidance** (`SHOULD` / `MAY`)

If a local policy conflicts with a global harness rule, follow the global harness rule and document the deviation.
If both global and local guidance exist for the same tool choice, apply global-harness rules first, then local policy ordering.

## Jurisdiction (rules/ vs docs/rules/)

- `rules/` — behavioral rails for how the agent works (applies to all work in this repo).
- `docs/rules/` — output contracts for the mission/seed workflow (kickoff·startdev·closeout 등 해당 워크플로 안에서만 적용).

## Core rails

- Safety & security (hard rails): [`safety_security.md`](../.omp/rules/harness-safety_security.md)
- Agent security (adversarial threats, prompt injection defense): [`agent_security.md`](../.omp/rules/harness-agent_security.md)
- Anti-hallucination & evidence ladder: [`anti_hallucination.md`](../.omp/rules/harness-anti_hallucination.md)
- Repo command discovery (never guess commands): [`repo_command_discovery.md`](../.omp/rules/harness-repo_command_discovery.md)
- Information discovery (breadth-first search before concluding absence): [`information_discovery.md`](../.omp/rules/harness-information_discovery.md)

## Quality rails

- Coding standards (immutability, file limits, input validation): [`coding_standards.md`](../.omp/rules/harness-coding_standards.md)
- Verification (tests + evals + EDD): [`verification_tests_and_evals.md`](../.omp/rules/harness-verification_tests_and_evals.md)
- Change control (minimal change, scope, Tidy First triggers): [`change_control.md`](../.omp/rules/harness-change_control.md)
- TDD policy (RED → GREEN → TIDY): [`tdd_policy.md`](../.omp/rules/harness-tdd_policy.md)
- Code review policy (severity, thresholds, confidence gating): [`code_review_policy.md`](../.omp/rules/harness-code_review_policy.md)
- Quality gates (FORMAT/LINT/TYPECHECK/TEST/BUILD/EVAL): [`quality_gates.md`](../.omp/rules/harness-quality_gates.md)
- Writing style (human-facing tone, 두괄식·번역투 금지): [`writing_style.md`](../.omp/rules/harness-writing_style.md)
- Prompt engineering (LLM 파이프라인 프롬프트 설계·신뢰 경계·게이트 철거): [`prompt_engineering.md`](../.omp/rules/harness-prompt_engineering.md)
- Design contract (저장소 안 디자인 계약 — `design/DESIGN.md`·`tokens.css`만 참조, 리터럴 금지): [`design_contract.md`](../.omp/rules/harness-design_contract.md)

## Tool rails

- MCP server policies (when/how to use): [`mcp_policy.md`](../.omp/rules/harness-mcp_policy.md)
- Hook recipes (OMP extension recipes for quality automation): [`hook_recipes.md`](../.omp/rules/harness-hook_recipes.md)

## Process rails

- Assetization (spec/decision/retro): [`assetization.md`](../.omp/rules/harness-assetization.md)
- Commit & PR discipline: [`commit_and_pr.md`](../.omp/rules/harness-commit_and_pr.md)
- Cycle definition (1사이클 정의 — 인테이크 판정·분할 역제안): [`cycle_definition.md`](../.omp/rules/harness-cycle_definition.md)
- Harness integration contract: [`harness_integration_contract.md`](../.omp/rules/harness-harness_integration_contract.md)

## Operational rails

- Context management (compaction, phase transitions): [`context_management.md`](../.omp/rules/harness-context_management.md)
- Session persistence (cross-session state, context loading): [`session_persistence.md`](../.omp/rules/harness-session_persistence.md)
- Cost awareness (model selection, token efficiency): [`cost_awareness.md`](../.omp/rules/harness-cost_awareness.md)
- Learning policy (when/how to capture learnings): [`learning_policy.md`](../.omp/rules/harness-learning_policy.md)

## Optional

- Documentation policy (language, README vs INDEX, latest-only option): [`documentation_policy.md`](../.omp/rules/harness-documentation_policy.md)

