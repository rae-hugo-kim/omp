# Current Scope: gh-loop-dispatch-closeout-record-79 (P2 thread)

**Created**: 2026-10-03
**Seed**: docs/harness/seed.yaml (task_id 20261003-142428-1f5f, v1)
**Thread-ID**: T-20261003142512-22ba
**Thread**: gh-loop #79 worker: dispatch/closeout 기록 + estimate-report §3 + 규모 기반 추천

## Acceptance Criteria
- [x] AC1 — "gh_loop_dispatched·gh_loop_closed 이벤트 2종이 .omp/extensions/harness/gh-loop-record.mjs(dispatch/ingest/close)로 추가되고 스키마가 tests/gh-loop-record.test.mjs로 고정되며, gh-loop SKILL.md Stage 0(모델 질문·마커 + omp-dispatch/v1 튜플)과 Stage 5(closeout 기록)에 기록 단계가 있습니다."
- [x] AC2 — "estimate-report.mjs가 §3 Dispatch(모델×risk/depth/size 셀 → dispatched·closed·리뷰 라운드 중앙값·verifier 비PASS·결정 왕복 중앙값·분 중앙값)를 출력하고 tests/estimate-report.test.mjs가 출력을 byte-for-byte 고정합니다."
- [x] AC3 — "자동 모델 선택을 추가하지 않습니다: 마커·ask 질문 절차가 불변이고, recommend는 한 줄 텍스트만 내며 어떤 코드 경로도 모델을 대신 고르지 않습니다."
- [x] AC4 — "규모 기반 추천: gh-loop-record.mjs recommend가 risk×depth×files 구간 → smol/default/slow/plan 규칙표로 '규모 기반 추천: <id>:<level> …' 한 줄을 내고, 규칙표가 테스트로 고정됩니다(기본값 없음)."
- [x] AC5 — "하네스 suite(node --test .omp/extensions/harness/tests/*.test.mjs) 전부 통과, node scripts/docs-drift 0 errors/0 warnings, 그리고 이 이슈 자체의 dispatch 튜플이 ingest되어 audit.jsonl에 gh_loop_dispatched(issue 79) 행이 있습니다."
