# Current Scope: gh-loop-dispatch-mode-65

**Created**: 2026-10-02
**Seed**: docs/harness/seed.yaml (task_id 20261002-060410-86ff, v1)
**Source**: issue #65, handoff docs/handoff/handoff_2026-10-02_gh-loop-dispatch-mode.md, gh-loop

## Acceptance Criteria
- [x] AC1-dispatch-mode — SKILL.md에 dispatch 모드(모델 ask → 워커 기동 → 프롬프트 → 즉시 복귀 → 재개 → 정리)가 R2 1~8대로 서술되고, 코디네이터가 `check --wait`/폴링을 하지 않는다고 명시된다
- [x] AC2-worker-mode — worker 모드(마커·재귀 금지·자기 워크트리 삭제 금지·보고 채널·결정 지점 턴 종료)가 R3대로 서술된다
- [x] AC3-spike-recorded — R4 스파이크 결과(omp가 `--model`을 받는지)가 실측 근거와 함께 SKILL.md·CHANGELOG에 기록되고, 1순위/폴백 경로가 그 결과를 따른다
- [x] AC4-nonnegotiables-fanout — Non-Negotiables에 "코디네이터는 코드를 만지지 않는다"가 있고, 2026-10-01에 추가된 커밋 순서 문단이 유지된다; gh-fanout에 후속 이슈 링크 한 줄
- [x] AC5-verification — `node --test .omp/extensions/harness/tests/*.test.mjs` 전부 통과, `node scripts/docs-drift` OK, handoff 문서가 커밋에 포함, PR 본문에 `Closes #65`
