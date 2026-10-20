# Current Scope: docs-verification-authority-113 (P2 thread)

**Created**: 2026-10-20
**Seed**: docs/harness/seed.yaml (task_id 20261020-025000-113a, v1)
**Thread-ID**: T-20261020025000-113a
**Thread**: gh-loop #113 worker: verification authority + gate wiring docs

## Acceptance Criteria
- [x] AC1 — 완료 검증 주체가 코퍼스 전체에서 `verifier` 하나입니다 (통합 계약 #9(구 #8)·§6·startup 5·Fallback·Known-Failure·템플릿이 `verifier`로, `harness-verification_tests_and_evals.md:6-16` 헤더 재작성; 폴백 = "task 툴 부재 → `omp -p` top-level 재실행"(agent_routing "리뷰 진입점" 3과 동일); 변경 파일에서 `architect|critic|test-engineer|librarian|executor|Explore` grep 결과는 adversarial_review "설계 담당/도입 상태"의 역사 서술과 agent_routing:52의 실측 기록뿐).
- [x] AC2 — C6 이름이 MUST 경로에서 사라지거나 치환됐습니다 (AGENTS.md:17·70·139 → verifier/reviewer/scout/task; agent_routing:7·19; information_discovery:30 → `scout`; research_before_implement:15 → read/web_search/scout; verify.md:9-15 → verifier/reviewer 항목; adversarial_review "3개 게이트 정의"에 설계 담당(OMC 미배포)·하네스 보장 대응 에이전트·"도입 상태"(audit.jsonl: plan 2건 2026-07-10/07-29, test 1건 07-30, completion 0건) 표).
- [x] AC3 — `harness-verification_tests_and_evals.md:6-16`이 acceptance(커밋 경계·AC 체크박스·closeout·테스트 미참조, `acceptance-gate.mjs:384-547`)·backpressure(high/critical PASS 기록 요구·medium WARN·FAIL BLOCK, `backpressure-gate.mjs:56-132`)·review-gate·pre-commit 배선(`commit-gates.mjs:56`, `.githooks/pre-commit:58-64`, `index.ts:555-559`)과 일치합니다.
- [x] AC4 — 통합 계약 항목 3·4·8(구 7)이 `.githooks/pre-commit → commit-gates.mjs`로, review-gate가 항목 5로 추가(이하 번호 +1); :49 docs-drift 주장 → `harness-version-check.mjs:324-355` HOOKS INACTIVE·`scripts/docs-drift:17-31`; :67 helper 인벤토리 → import 실측(cross-repo·repo-root·estimate 추가, commit-gates는 import 없음); :84 18.3.0 핀 → 재검증 안 됨·18.11.1·#110 명시; :118 `-a` TOCTOU → hook 모드 pending-consume(`review-gate.mjs:363-365, 571-575, 594-610, 620-633`); :116(bare review-skip)은 `review-gate.mjs:46-47,319`와 일치해 유지.
- [x] AC5 — `claudedocs/CLAUDEKR.md:28·71-73·140` 동기화, 프런트매터 `status: stale`(이 커밋에서 AGENTS.md 해시가 바뀌므로)로 두고 재스탬프(`status: synced` + 새 `source_commit_hash`)는 AGENTS.md를 건드리지 않는 후속 커밋으로 합니다. `node scripts/docs-drift` → `OK (0 errors, 0 warnings)`.
- [x] AC6 — `node --test .omp/extensions/harness/tests/*.test.mjs` → 766 pass / 0 fail / 0 skipped (33.9s). 변경 파일 = 이슈 목록 10개(AGENTS.md, claudedocs/CLAUDEKR.md, harness-{harness_integration_contract,verification_tests_and_evals,agent_routing,adversarial_review,information_discovery,code_review_policy}.md, checklists/{verify,research_before_implement}.md) + 워크플로 산출물(docs/harness/ seed·scope·audit). 코드 파일 0.
