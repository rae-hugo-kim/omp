# Current Scope: session-breadcrumb-capture (autonomy Q1) — lean cut

**Created**: 2026-06-18
**Seed**: docs/harness/seed.yaml (`session-breadcrumb-capture`, v1, task_id 20260618-142442-e610)
**Thread goal**: 자율화 Q1 lean cut (option 1, 코어 무위험) — no-LLM breadcrumb 캡처 + session_start docs/sum 표면화 + sum seed 소비 + stale 문서 정정. 이 스레드는 seed AC1·AC3·AC4·AC6의 draw-down. (AC2 compacting / AC5 shutdown은 extension API 확장 필요 → fast-follow.)

## MUST
- breadcrumb-tracker 게이트: tool_result(bash 커밋·검증 / edit·write) → `.omp/harness-state/session-log.jsonl` no-LLM append (AC1)
- breadcrumb-surface 게이트: session_start → 최근 `docs/sum/*.md` 표면화 (AC3)
- sum 스킬이 breadcrumb seed 소비 (AC4)
- stale 문서 정정: session_persistence §Decision·harness-architecture G7/G8·ecc·AGENTS 표 (AC6)

## SHOULD
- 가짜 이벤트 주입 테스트(breadcrumb-tracker 5 / breadcrumb-surface 4), 회귀 무손상

## OUT OF SCOPE (fast-follow — extension API 확장 필요)
- AC2 session.compacting 보존(preserveData) — `index.ts` HarnessExtensionApi에 `session.compacting` 이벤트 추가 필요
- AC5 session_shutdown LLM 금지(flush만) — `session_shutdown` 이벤트 추가 필요
- (turn_end 트리거: 현재 tool_result로 충족; turn-summary는 후속)

## Acceptance Criteria
- [x] AC1 breadcrumb-tracker append (tool_result bash·edit, no-LLM) → session-log.jsonl (tests/breadcrumb-tracker.test.mjs 5건)
- [x] AC3 breadcrumb-surface: session_start docs/sum 표면화 (tests/breadcrumb-surface.test.mjs 4건)
- [x] AC4 sum 스킬이 breadcrumb seed 소비 (`.omp/skills/sum/SKILL.md`)
- [x] AC6 stale 문서 4곳 정정 (session_persistence·harness-architecture·ecc·AGENTS)
- [x] 전체 회귀 203/203, docs-drift 0/0
