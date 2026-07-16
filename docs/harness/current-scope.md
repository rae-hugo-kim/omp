# Current Scope: v17-harness-adaptation (P2 thread)

**Created**: 2026-07-16
**Seed**: docs/harness/seed.yaml (task_id 20260716-115803-9497, v1)
**Thread-ID**: T-20260716115859-8ec6
**Thread**: v17-adaptation

## Acceptance Criteria
- [x] V1 URI 스킴 원장 오염 0 — xd://·local:// 타깃이 read-log/session-log에 로컬 경로로 기록되지 않음 (단위 + 라이브 프로브) ✓ xdev-dispatch 단위 + 라이브 프로브: 신규 xd:/ 원장 항목 0
- [x] V2 xd://ast_edit 호출의 pre-edit context-gate 유지 — 미read 파일 BLOCK(negative) + read 후 통과(positive) 게이트 통합 테스트 ✓ context-gate 통합 테스트 BLOCK→read→통과
- [x] V3 xd://resolve apply 실파일 추적 — write-tracker·backpressure-invalidator·breadcrumb 발화 (단위 + 라이브 프로브에서 실파일 edit 기록) ✓ 라이브 프로브: session-log에 probe 실파일 edit 기록
- [x] V4 xd://ast_grep 앵커 read 추적 — inner.files + 렌더 텍스트 폴백 (단위) ✓ xdev-dispatch: inner.files + [path#TAG] 폴백
- [x] V5 회귀 0 — 기존 342 테스트 + 신규 xdev 스위트 전부 그린 ✓ 코드 회귀 0 — 361/362 + docs-drift의 유일 WARN은 "Closeout pending"(AC 전체 체크 + seed:approved의 설계된 생애주기 신호, verifier 확인) — 본 커밋 직후 closeout에서 362/362로 해소
- [x] V6 문서 부패 스위프 — 제거된 도구 참조(resolve/irc/job/launch/report_finding) 갱신, docs-drift 그린 ✓ 활성 표면(rules·agents·skills·AGENTS·README) grep 잔여 0 — agent_routing·harness_integration_contract 갱신. 예외: claudedocs/harness-auto-capture-analysis.md의 irc/job 언급은 telemetry 스레드(20260710) 소유 미커밋 문서 — 해당 스레드 재개 시 v17 전면 재대조 필수(계측 지점 이동 포함), notepad에 인계 기록
