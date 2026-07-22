# Current Scope: review-topology-preflight-rules

**Created**: 2026-07-22

## MUST

- rules/agent_routing.md :29 단락을 진입점 우선순위 + 디스패치 preflight MUST + capability 조건 + 블로킹 caller 응답 불능 실측 기록으로 재서술
- .omp/agents/reviewer.md에 Pass 0 preflight(무산출 즉시 종료 계약) 신설, 기존 sibling 공급 폴백 문구 교체, Constraints/Failure_Modes 정합 갱신
- rules/adversarial_review.md에 토폴로지 공통 불변식 3개 명문화 (+ 세션 수행 경로 모델 회계 부기)
- AGENTS.md reviewer 불릿에 preflight 한 줄 + claudedocs/CLAUDEKR.md 미러 동일 커밋 갱신
- CHANGELOG.md Unreleased 항목 추가

## SHOULD

- CLAUDEKR.md reviewer 불릿의 구식 서술(마크다운 증거)을 현행(JSON tuple 사이드카)으로 함께 현행화

## MUST NOT

- 코드 변경 (.mjs, 게이트, 테스트)
- maxRecursionDepth 상향을 규칙 본문에 해법으로 기재
- 2단계 DAG 경로의 표준 편입
- push

## OUT OF SCOPE

- 타 세션 소유 파일 (claudedocs/harness-auto-capture-analysis.md, docs/upstream-issues.md, .serena/)
- upstream(oh-my-pi) 수정

## Acceptance Criteria

- [x] AC1 진입점 우선순위 문서화 (agent_routing.md — 3단계 + preflight MUST + 실측 기록)
- [x] AC2 reviewer preflight 무산출 즉시 종료 (reviewer.md Pass 0 + 폴백 교체)
- [x] AC3 불변식 3개 명문화 (adversarial_review.md + 모델 회계 부기)
- [x] AC4 scripts/docs-drift 그린 (0 errors)
- [x] AC5 CLAUDEKR 미러 동기화 (AGENTS.md와 동일 커밋)
