# Current Scope: closeout-ac-record-56

**Created**: 2026-09-29
**Seed**: docs/harness/seed.yaml (task_id 20260929-085219-06dc, v1)
**Source**: issue #56 (#54 Pass 1 M1·LOW)

## Acceptance Criteria
- [x] AC1-unchecked-blocks — HEAD scope에 미체크 AC가 있으면 full closeout을 스테이징해도 BLOCK되고 메시지에 미체크 개수가 나온다
- [x] AC2-checked-lands — 모두 체크된 closeout landing은 기존과 같이 allow된다(기존 closeout 테스트 전부 통과)
- [x] AC3-task-id-match — task_id가 다른 task_closed 행만 추가된 closeout은 closeout으로 인정되지 않는다
- [x] AC4-regression-tests — 위 1·3의 회귀 테스트가 acceptance-gate.test.mjs에 추가된다
- [x] AC5-suite-docs — 전체 하네스 테스트 통과, docs-drift OK, closeout_contract.md §3과 통합 계약의 closeout 서술에 조건이 반영된다
