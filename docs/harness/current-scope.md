# Current Scope: rules-merge-plan-86 (P2 thread)

**Created**: 2026-10-06
**Seed**: docs/harness/seed.yaml (task_id 20261006-094329-349d, v1)
**Thread-ID**: T-20261006094329-18b1
**Thread**: gh-loop #86 worker: harness-* 규칙 병합 M1–M9 연구(이동표·손실·소비 리포·분할안)

## Acceptance Criteria
- [x] AC1 — "M1–M9 전부에 이동표(절 → 모체 위치)·손실 목록·file:line 근거가 docs/harness/rules-merge-plan-2026-10-06.md에 있고, 폐기가 맞는 쌍은 그 근거(고유 내용이 타처에 있음)와 함께 판정됩니다."
- [x] AC2 — "소비 리포 참조 깨짐 탐색 명령과 결과(이 리포 + 접근 가능한 소비 리포 1곳 이상)가 문서에 기록되고, 마이그레이션 노트 초안(개명표)이 있습니다."
- [x] AC3 — "실행 사이클 분할안이 번호(PR-1…)와 확인 문장을 갖고, #87 결론 선행 조건과 결정 사항(D1…)이 번호로 적혀 사용자가 번호로 승인할 수 있습니다."
- [x] AC4 — "하네스 suite(node --test .omp/extensions/harness/tests/*.test.mjs) 전부 통과, node scripts/docs-drift 0 errors/0 warnings, git diff --stat main -- .omp/rules scripts .omp/extensions 가 비어 있고, 이 이슈의 dispatch 튜플이 ingest되어 audit.jsonl에 gh_loop_dispatched(issue 86) 행이 있습니다."
