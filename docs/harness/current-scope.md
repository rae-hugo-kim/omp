# Current Scope: adversary-panel-112

**Created**: 2026-10-19
**Seed**: docs/harness/seed.yaml (task_id 20261019-134500-112a, v1)
**Source**: issue #112 (사용자 결정 2026-10-19)

## Acceptance Criteria
- [x] AC1 — 세 미러 파일 본문이 adversary.md와 바이트 동일, frontmatter model 고정 (실측: Python 비교 `{'adversary-sol': True, 'adversary-opus': True, 'adversary-argon': True}`)
- [x] AC2 — reviewer.md Pass 2 패널 batch 스폰·자신+멤버별 model_change 실측(실행된 모델 전부)·완료/failed 정의·소스별 .panel.jsonl 스키마(finding별 also)·Cross-Validation 소스·element 3 소스 단위 규칙·element 4/5 고정값 명시, 규칙 2편·CHANGELOG과 정합 (패널 r1 FAIL 2 high·6 medium, r2 FAIL 2 high, r3 FAIL 2 high 반영)
- [x] AC3 — 라이브 스폰 3종 요청 모델로 해결 (ProbeSol/ProbeOpus/ProbeArgon 트랜스크립트 model_change 마지막 레코드 = openai-codex/gpt-5.6-sol · anthropic/claude-opus-5-5 · google-antigravity/gemini-4-argon, fallback=False)
- [x] AC4 — review-gate modelFamily: gpt/claude/gemini, `gemini-4-argon-disabled`→null (tests/review-gate.test.mjs 회귀 케이스 추가); docs-drift 0 errors(경고 1 = 이 scope의 closeout 안내); suite 전 항목 pass

## Cycles
1. 패널 도입 (AC1–4) — 확인: reviewer 실전 실행 r1~r4(docs/reviews/review-2026-10-19-{153715,155534,161139,163005}.*)에서 4멤버 전원 완료·fallback 0, r4부터 소스별 panel 행 6건
2. 모델 확정 — 별도 seed (#112 후속)
