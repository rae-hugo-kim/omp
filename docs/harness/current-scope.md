# Current Scope: audit-append-only-62

**Created**: 2026-10-01
**Seed**: docs/harness/seed.yaml (task_id 20261001-101549-7cce, v1)
**Source**: issue #62 (PR #59 r4/r8 low), gh-loop

## Acceptance Criteria
- [x] AC1-deleted-row-incomplete — closeout 커밋의 audit.jsonl diff에 기존 행의 삭제(`-` 줄, 헤더 제외)가 하나라도 있으면 §3c를 미완으로 판정하고 사유에 "not append-only"가 나온다
- [x] AC2-append-only-lands — 추가만 있는 기존 closeout landing은 그대로 allow된다(기존 closeout 테스트 전부 통과)
- [x] AC3-regression-test-docs — 회귀 테스트 1건 이상이 acceptance-gate.test.mjs에 추가되고, closeout_contract.md §3c에 append-only 조건이 반영되며 전체 스위트·docs-drift가 통과한다
