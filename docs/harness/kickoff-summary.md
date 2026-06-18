# Kickoff Summary: session-breadcrumb-capture (autonomy Q1)

**Date**: 2026-06-18 · **task_id**: 20260618-142442-e610 · **Seed**: `docs/harness/seed.yaml`
**원본 상위 문서(ingest source)**: `claudedocs/harness-auto-capture-analysis.md#Q1` (실제 doc-ingest)

> 자율화 레이어의 첫 sub-feature. 틀(intent-ingest-fidelity-framework v1)의 **doc-ingest를 실전 적용**한 결과 — Q1 섹션을 인제스트해 요구 6개 → AC 6개(coverage 6/6, 잔차 0)로 증류, push→pull로 1 residual 해소.

## 동기 (JTBD)
- **Problem**: 세션 재개 비용 + `sum` 호출 비용 + 고아 `docs/sum/` md. auto-memory(영속 사실)는 이미 자동이나 sum md는 안 읽음.
- **Success**: turn_end/tool_result에서 no-LLM breadcrumb 자동 캡처 + session_start 표면화 + sum이 breadcrumb seed 소비. 풀 LLM 요약은 수동 유지(Q1.4).

## 결정 (확정)
- trigger = `turn_end + tool_result` (현 구현은 tool_result), storage = `.omp/harness-state/session-log.jsonl`, scope = option 1.
- **sum ↔ auto-memory = 분리** (RES 해소): auto-memory가 sum md를 읽는 *연계*는 "auto-memory 재구축 금지" 제약과 모순 → session_start 표면화(AC3)만.

## 구현 (lean cut: AC1/3/4/6)
- `breadcrumb-tracker.mjs` (tool_result) — 커밋·테스트 PASS/FAIL·파일변경 append (AC1)
- `breadcrumb-surface.mjs` (session_start) — 최근 docs/sum 표면화 (AC3)
- `sum` 스킬 — breadcrumb seed 소비 (AC4)
- stale 문서 4곳 정정 (AC6)

## Out of scope (fast-follow)
- AC2 session.compacting 보존 · AC5 session_shutdown no-LLM — `index.ts` extension API에 새 라이프사이클 이벤트 추가 필요(코어 변경).

## 다음
seed `draft` → rubric 통과 → 구현(완료) → reviewer/verifier → 커밋. AC2/5 fast-follow는 후속 스레드(seed reopen).
