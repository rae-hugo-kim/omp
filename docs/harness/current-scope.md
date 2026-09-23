# Current Scope: estimate-vs-actual

**Created**: 2026-09-18
**Seed**: docs/harness/seed.yaml (task_id 20260918-023000-e5a1, v1)
**Source**: docs/harness/handoff_2026-09-21_estimate-vs-actual.md

## Acceptance Criteria
- [ ] AC1-gates-unchanged — 레코드 파일 부재 시 모든 게이트의 allow/block 판정과 stderr 출력이 불변이다
- [ ] AC2-no-verdict-influence — 레코드 파일 존재 여부·내용은 어떤 경우에도 게이트 판정에 영향을 주지 않는다
- [ ] AC3-consume-on-land — hook mode 커밋 착지 시 estimate_vs_actual 이벤트가 정확히 1건 append되고 레코드가 소비된다
- [ ] AC4-malformed-ignored — 형식 오류 레코드는 무시 + stderr 경고 1줄, 차단하지 않는다
- [ ] AC5-intake-rule — rules/cycle_definition.md 출력 형식에 예상 줄이 추가되고 사이클 미만 생략 조항과 충돌하지 않는다
- [ ] AC6-report-deterministic — 리포트가 픽스처에서 결정적으로 같은 표를 출력한다
- [ ] AC7-claudekr-sync — claudedocs/CLAUDEKR.md 동기 여부가 명시된다

## Cycles
1. 레코드 형식 + 규칙 (AC5) — 확인: 가상 지시 인테이크 출력에 `예상:` 줄, `.omp/harness-state/cycle-estimate`에 v1 튜플
2. 게이트 대조 + audit + 소비 (AC1–4) — 확인: hook-gates 픽스처에서 착지 1건/차단 0건/부재 불변
3. 리포트 (AC6) — 확인: 픽스처 5건 → 결정적 두 표
