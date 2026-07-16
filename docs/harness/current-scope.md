# Current Scope: v17-harness-adaptation (P2 thread)

**Created**: 2026-07-16
**Seed**: docs/harness/seed.yaml (task_id 20260716-115803-9497, v2)
**Thread-ID**: T-20260716125843-42b6
**Thread**: v17-adaptation-r2

## Acceptance Criteria
- [x] V1 URI 스킴 원장 오염 0 — xd://·local:// 타깃이 read-log/session-log에 로컬 경로로 기록되지 않음 (단위 + 라이브 프로브). r2: 단일 슬래시 정규화형(`xd:/retain`, session-log:315 반례)도 `URI_SCHEME_PREFIX` 가드로 차단 — write(xd://retain) 라이브 프로브에서 신규 원장 라인 0 실측 (2026-07-16 13:0x, before=after=322).
- [x] V2 xd://ast_edit 호출의 pre-edit context-gate 유지 — 미read 파일 BLOCK(negative) + read 후 통과(positive) 게이트 통합 테스트 (M1 별칭 회귀 포함, 스위트 그린)
- [x] V3 xd://resolve apply 실파일 추적 — write-tracker·backpressure-invalidator·breadcrumb 발화 (단위 + 12:07 라이브 프로브 실파일 edit 기록)
- [x] V4 xd://ast_grep 앵커 read 추적 — inner.files + 렌더 텍스트 폴백 (단위)
- [x] V5 회귀 0 — 전체 스위트 364/364 그린 (기존 342 + xdev 스위트 + M1·r2 회귀)
- [x] V6 문서 부패 스위프 — 제거된 도구 참조(resolve/irc/job/launch/report_finding) 갱신, docs-drift 그린 (r2 코드 변경은 read-path.mjs 내부 가드 — 문서 표면 불변)
