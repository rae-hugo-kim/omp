# Current Scope: dev-discipline-docs-115 (P2 thread)

**Created**: 2026-10-20
**Seed**: docs/harness/seed.yaml (task_id 20261021-091500-115a, v1)
**Thread-ID**: T-20261020162745-eedc
**Thread**: gh-loop #115 worker: dev-discipline docs

## Acceptance Criteria
- [x] AC1 — "TDD의 규범 등급이 하나입니다 — tdd_policy·change_control·checklists/bugfix.md·verification_tests_and_evals가 결정 C(테스트 인프라가 있는 코드 로직 변경은 test-first MUST, 생략은 사용자 명시 승인; 인프라 없음·docs/policy-only·자동화 불가는 승인 없이 결정적 대체 산출물)와 같은 예외 목록을 서술합니다."
- [x] AC2 — "templates/policy_sync_checklist.md와 INDEX.md의 Policy sync process가 claudedocs/CLAUDEKR.md만 동기화하고, CLAUDE_original.md는 동결임을 명시하며, source_commit_hash + status: synced 재스탬프는 AGENTS.md를 건드리지 않는 후속 커밋에서(같은 커밋이면 status: stale) 한다고 서술합니다."
- [x] AC3 — "복잡도 초과(HIGH)·테스트 누락(MEDIUM)의 severity와 verdict 어휘(PASS / PASS WITH NOTES / FAIL)가 harness-code_review_policy 본문·severity 표·checklists/code_review.md·.omp/agents/code-reviewer.md에서 하나입니다."
- [x] AC4 — "e2e 체크리스트 위치가 소비자 공간(docs/checklists/e2e_<feature>.md)으로 바뀌고, eval 저장 경로가 checklists/eval.md와 verification 규칙에서 같습니다(eval/cases/ 구조)."
- [x] AC5 — "node scripts/docs-drift 0 errors, 하네스 suite(node --test .omp/extensions/harness/tests/*.test.mjs) 전 항목 통과, 변경 파일이 .omp/rules/harness-{tdd_policy,change_control,verification_tests_and_evals,code_review_policy,doc_standards}.md·checklists/{bugfix,code_review,eval}.md·templates/policy_sync_checklist.md·INDEX.md·.omp/agents/code-reviewer.md(+ docs/harness/ 워크플로 산출물) 안입니다."
