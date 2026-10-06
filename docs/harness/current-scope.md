# Current Scope: rules-liveness-audit-29 (P2 thread)

**Created**: 2026-10-06
**Seed**: docs/harness/seed.yaml (task_id 20261006-063757-c02e, v1)
**Thread-ID**: T-20261006063847-45e0
**Thread**: gh-loop #29 worker: harness-* 29편 생사 감사(판정표+제안)

## Acceptance Criteria
- [x] AC1 — "docs/harness/rules-liveness-audit-2026-10-06.md에 29편 전수 판정표가 있습니다: 규칙별로 기준 1·2·3 실측값과 생/사/병합 후보 판정, 근거 경로를 한 행씩 적습니다."
- [x] AC2 — "기준 1·2는 문서에 실행 명령과 출력을 그대로 기록합니다: 명령을 리포 루트에서 다시 실행하면 문서의 표와 같은 숫자가 나옵니다."
- [x] AC3 — "기준 3은 audit.jsonl 이벤트·docs/sum 파일명·docs/reviews 사이드카·이슈/댓글 번호를 규칙별로 인용하고, 흔적이 없는 규칙은 '흔적 없음'으로 명시합니다."
- [x] AC4 — "삭제·병합 제안 목록이 감사 문서와 PR 본문에 있고, .omp/rules/harness-*.md 29편은 변경되지 않습니다(git diff --stat main -- .omp/rules 가 비어 있음)."
- [x] AC5 — "node scripts/docs-drift 0 errors/0 warnings, 하네스 suite(node --test .omp/extensions/harness/tests/*.test.mjs) 전부 통과, 그리고 이 이슈의 dispatch 튜플이 ingest되어 audit.jsonl에 gh_loop_dispatched(issue 29) 행이 있습니다."
