# Current Scope: changelog-unreleased-promotion-47 (P2 thread)

**Created**: 2026-10-06
**Seed**: docs/harness/seed.yaml (task_id 20261006-060940-4a7c, v1)
**Thread-ID**: T-20261006061419-2aa3
**Thread**: changelog-unreleased-promotion-47

## Acceptance Criteria
- [x] AC1 — `tests/harness-version-bump.test.mjs` 7건(승격·빈 Unreleased·CHANGELOG 없음·하네스 무변경 no-op·--dry-run 2건·dirty CHANGELOG 중단)이 격리 임시 리포에서 통과했고, 실제 CHANGELOG 사본 스모크에서 [Unreleased]의 37항목이 `## [2026.86] - 2026-10-06` 한 절로 승격되며 빈 `[Unreleased]`가 남았습니다. 실제 트리의 `--dry-run`은 status·HEAD·태그·CHANGELOG 해시가 불변이었습니다.
- [x] AC2 — CHANGELOG 3행이 범프 때 승격, 소급 분할 없음, 2026.65~2026.85의 한 덩어리 승격, 2026.64 이하의 태그 기준 생성을 기술합니다.
- [x] AC3 — 변경을 마친 뒤 `node --test .omp/extensions/harness/tests/*.test.mjs`를 1회 실행해 678/678 pass, fail 0이고 `node scripts/docs-drift`는 0 errors, 0 warnings입니다.
