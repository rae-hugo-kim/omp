# Current Scope: intent-ingest-fidelity-framework — Slice 1 (P2 충실도 루프)

**Created**: 2026-06-17
**Seed**: docs/harness/seed.yaml (`intent-ingest-fidelity-framework`, v1, task_id 20260617-145852-04c2)
**Thread goal**: 반복(P2) 작업이 충실도 게이트 안으로 들어오게 하는 **최소 루프** — active-seed thread-scope 재생성 + audit 추적 + L2 backstop. seed AC4·AC6·AC7의 draw-down (active-seed 한정).

## MUST
- active seed에서 `thread-scope.mjs open`으로 `current-scope.md` 재생성 + `thread_opened` provenance (seed AC4, active 부분)
- `acceptance-gate` L2 backstop: 코드변경 커밋인데 커버하는 active AC 없으면 차단 (docs/wip/draw-down은 통과) (seed AC6)
- `audit.jsonl` provenance/verdict 스키마: `thread_opened`/`thread_closed` = `{thread_id, seed_task_id, seed_version, ac_targeted, verdict}` (seed AC7, audit 부분)

## SHOULD
- 기존 `tests/` 회귀 통과 유지 (acceptance-gate + 신규 thread-scope)

## MUST NOT
- L1 자가감지(seed AC5)·doc-ingest(AC1)·coverage rubric(AC2)을 이 슬라이스에서 구현
- `seed_contract.md` 스키마 정합 시도

## OUT OF SCOPE
- **closed(done/superseded)-seed reopen** — `seed_evolution_policy.md`("재개=새 kickoff")와 충돌하는 terminal-state 변경 → 정책 결정 필요(analysis Q10). slice 1은 active(draft/approved) seed 한정.
- **commit-message thread/task_id 링크** — 커밋 컨벤션 → AC8(role-tiering 계약)에서 명문화.
- seed AC1(doc-ingest), AC2(coverage rubric), AC3(per-AC source 자동화), AC5(L1 자가감지), AC8(계약문서), AC9(verifier coverage) — 후속 슬라이스.

## Acceptance Criteria
- [x] active seed에서 `thread-scope.mjs open` → `current-scope.md` 재생성 + `thread_opened` 기록 (tests/thread-scope.test.mjs + 실제 9-AC seed smoke)
- [x] active AC 미커버 코드 커밋 시도 → L2 backstop 차단 (tests: closed/no-scope + medium/high/critical risk)
- [x] draw-down(커버) / docs-only / wip / no-seed 커밋 → 통과 (tests)
- [x] `audit.jsonl`에 `{thread_id, seed_task_id, seed_version, ac_targeted, verdict}` 기록 (tests: thread_opened/thread_closed)
- [x] 기존 acceptance-gate 테스트 회귀 통과 (전체 189/189)
