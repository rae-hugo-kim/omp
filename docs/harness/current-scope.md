# Current Scope: omp1830-friction (P2 thread)

**Created**: 2026-09-24
**Seed**: docs/harness/seed.yaml (task_id 20260924-163908-c420, v1)
**Thread-ID**: T-20260924074001-23a1
**Thread**: omp 18.3.0 friction #40-#43

## Acceptance Criteria
- [x] AC1-async-backpressure — 백그라운드(async/auto-background) bash 결과가 backpressure 상태를 바꾸지 않는다 (#40)
- [x] AC2-read-path-grammar — read-path가 18.3.0 read/write 문법(proc·conflict 스킴, :img 셀렉터)을 인지한다 (#42)
- [x] AC3-hub-retired — 폐기된 hub 툴 참조가 write agent://·wait로 대체된다 (#41)
- [x] AC4-remeasure-1830 — 하네스 실측 주석이 omp 18.3.0 재측정으로 갱신된다 (#43)
- [x] AC5-bump-ready — 네 이슈가 한 커밋으로 하네스 2026.80 범프 준비 상태다 (테스트·CHANGELOG·리뷰·verifier)
