# Current Scope — cycle-intake-discipline

seed: cycle-intake-discipline v1 (task_id 20260730-121500-c1in)
thread: 20260730-cycle-intake

## Acceptance Criteria

- [x] AC1 rules/cycle_definition.md 신설 — 정의 3항 + 구성적 판정 + 인테이크 프로토콜 + 지시 채널 + 예시 뱅크 17건, rules/INDEX.md 등재
- [x] AC2 AGENTS.md Cycle intake(L1) + Linked Modules, CLAUDEKR.md 동일 커밋 미러
- [x] AC3 kickoff-detector 메시지 교체 — 스모크 3케이스(발화/억제/비트리거) 통과
- [x] AC4 templates/scratchboard.md 신설 + templates/INDEX.md 등재
- [x] AC5 index.ts 커밋 경계 넛지(non-WIP만) + 배선 테스트 4건, 스위트 417/417 그린

## Verification

- node --test tests/*.test.mjs — 417 pass / 0 fail (2026-07-30)
- kickoff-detector 스모크 3케이스, bun build --no-bundle 트랜스파일 OK
- 3-pass 리뷰: Pass 1 PASS WITH NOTES(low 4, confirmed 0) — docs/reviews/review-2026-07-30-220016.md; Pass 2/3 provider 쿼터로 미수행
