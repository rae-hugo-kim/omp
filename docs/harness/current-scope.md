# Current Scope: session-breadcrumb-capture (autonomy Q1)

**Created**: 2026-06-18 · **Revised**: 2026-06-18 (AC2/AC5 closed)
**Seed**: docs/harness/seed.yaml (`session-breadcrumb-capture`, v2, task_id 20260618-142442-e610)
**Thread goal**: 자율화 Q1 — no-LLM breadcrumb 캡처 + session_start docs/sum 표면화 + sum seed 소비 + stale 문서 정정. AC2/AC5는 **file-based 설계로 충족**(아래).

## MUST
- breadcrumb-tracker 게이트: tool_result(bash 커밋·검증 / edit·write) → `.omp/harness-state/session-log.jsonl` no-LLM append (AC1)
- breadcrumb-surface 게이트: session_start → 최근 `docs/sum/*.md` 표면화 (AC3)
- sum 스킬이 breadcrumb seed 소비 (AC4)
- stale 문서 정정 (AC6)
- AC2/AC5 = file-based append 설계로 충족: breadcrumb이 이벤트마다 디스크에 쓰여 압축(AC2 보존)·종료(AC5 flush)에 무관, shutdown LLM 핸들러 부재(AC5)

## 결정/근거
- AC2/AC5의 원래 flush/preserve·shutdown 핸들러 상상은 **in-memory breadcrumb 전제**였으나, AC1이 **file-based append**를 택해 그 핸들러들이 불요(no-op)가 됨. no-LLM 가드 테스트로 잠금.
- **후속 enhancement(범위 밖)**: 압축-시 breadcrumb 재표면화(mid-session continuity) — live 검증 가능한 OMP compaction-inject API 확인 후.

## Acceptance Criteria
- [x] AC1 breadcrumb-tracker append (tool_result, no-LLM) → session-log.jsonl (5 tests)
- [x] AC2 압축 보존: file-based session-log이 충족(파일은 압축에 불변) — append 테스트 + no-LLM 가드
- [x] AC3 breadcrumb-surface: session_start docs/sum 표면화 (4 tests)
- [x] AC4 sum 스킬이 breadcrumb seed 소비
- [x] AC5 shutdown no-LLM: shutdown 핸들러 부재 + no-LLM 가드 테스트(부재 보장)
- [x] AC6 stale 문서 정정
- [x] 전체 회귀 + docs-drift 0/0
