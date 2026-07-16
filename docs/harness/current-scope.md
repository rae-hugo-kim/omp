# Current Scope: v17-harness-adaptation (P2 thread)

**Created**: 2026-07-16
**Seed**: docs/harness/seed.yaml (task_id 20260716-115803-9497, v4)
**Thread-ID**: T-20260716132236-5863
**Thread**: v17-adaptation-r4

## Acceptance Criteria
- [x] V1 URI 스킴 원장 오염 0 — r4: 단일 슬래시 거부를 알려진 가상 스킴 allowlist로 정밀화 (r3 adversary medium — `pkg:/danger.ts` 류 정당 POSIX 경로의 게이트·원장 동시 탈락 방지; 미지 스킴은 팬텀으로 안전 열화). 가상 스킴 8종 거부 회귀 유지. r2 라이브 프로브(write xd://retain, 신규 원장 0) 증거 유지.
- [x] V2 xd://ast_edit pre-edit context-gate 유지 — AST_EDIT_DEVICE 정규화 탐지 + 게이트 통합 BLOCK/통과 + `src:/app.ts` 추적 복원 테스트 (r4)
- [x] V3 xd://resolve apply 실파일 추적 — 단위 + 12:07 라이브 프로브 (r4 무영향, 스위트 재확인)
- [x] V4 xd://ast_grep 앵커 read 추적 — 단위 (`pkg:/a.ts` files 추적 복원 포함)
- [x] V5 회귀 0 — 전체 스위트 367/367 그린 (r4 회귀 1건 포함)
- [x] V6 문서 부패 스위프 — docs-drift 그린 (r4는 정규식 정밀화 — 문서 표면 불변)
