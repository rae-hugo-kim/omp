# Current Scope: v17-harness-adaptation (P2 thread)

**Created**: 2026-07-16
**Seed**: docs/harness/seed.yaml (task_id 20260716-115803-9497, v3)
**Thread-ID**: T-20260716131257-30b2
**Thread**: v17-adaptation-r3

## Acceptance Criteria
- [x] V1 URI 스킴 원장 오염 0 — r3: 단일 슬래시 가드(isVirtualPath)를 read/search 원장 경로(readTarget·searchTrackTargets)까지 전파 (r2 adversary low 해소). r2 증거 유지: write(xd://retain) 라이브 프로브 신규 원장 0. 잔여 팬텀(331-332 xd:/recall)은 구런타임 세션의 in-memory 코드 소산 — HEAD 결함 아님 (r2 verifier 판정).
- [x] V2 xd://ast_edit pre-edit context-gate 유지 — r3: 디바이스 탐지를 AST_EDIT_DEVICE(/^xd:\/{1,2}ast_edit$/i)로 정규화 (r2 adversary medium — 단일 슬래시·대소문자 변형의 게이트 우회 봉합, 회귀 테스트 3형). 게이트 통합 BLOCK/통과 테스트 그린.
- [x] V3 xd://resolve apply 실파일 추적 — 단위 + 12:07 라이브 프로브 (r3 변경 무영향, 스위트로 재확인)
- [x] V4 xd://ast_grep 앵커 read 추적 — 단위 + r3 단일 슬래시 앵커 거부 테스트 추가
- [x] V5 회귀 0 — 전체 스위트 366/366 그린 (r3 회귀 2건 포함)
- [x] V6 문서 부패 스위프 — docs-drift 그린 (r3는 가드 내부 전파 — 문서 표면 불변)
