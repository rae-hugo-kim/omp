# Current Scope: audit-score-review-87 (P2 thread)

**Created**: 2026-10-06
**Seed**: docs/harness/seed.yaml (task_id 20261006-092853-c626, v1)
**Thread-ID**: T-20261006092853-c626
**Thread**: gh-loop #87 worker: harness-audit.sh 점수 실효성 검토(전수표·이력·선택지·추천)

## Acceptance Criteria
- [x] AC1 — "docs/harness/audit-score-review-2026-10-06.md에 점수 항목 전수표가 있습니다: 32개 award 항목마다 카테고리·가중치·판정 방식(파일 존재/패턴 grep/파일 개수/실제 동작)·현재 득점·코드 줄 번호를 한 행씩 적고, 방식별 집계를 둡니다."
- [x] AC2 — "점수가 결정에 쓰인 사례 탐색 결과가 명령·출력으로 있습니다: 범프 점수 행(.omp/state/harness-scores.jsonl)·docs/harness/audit.jsonl·docs/sum·이슈·PR 검색의 명령과 결과를 적고, 사례가 없으면 그 사실을 명시합니다."
- [x] AC3 — "(a)(b)(c) 각각의 영향 범위(파일·문서·이슈 AC 목록)와 추천 1개·근거가 문서에 있습니다."
- [x] AC4 — "#86(병합 연구)과의 의존이 문서에 명시되고(점수 처분 전에는 병합 실행 사이클을 열지 않음), 스크립트·규칙·게이트는 변경되지 않습니다(git diff --stat main -- scripts .omp/rules .omp/extensions 가 비어 있음)."
- [x] AC5 — "node scripts/docs-drift 0 errors/0 warnings, 하네스 suite(node --test .omp/extensions/harness/tests/*.test.mjs) 전부 통과, 그리고 이 이슈의 dispatch 튜플이 ingest되어 audit.jsonl에 gh_loop_dispatched(issue 87) 행이 있습니다."
