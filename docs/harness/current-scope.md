# Current Scope: capability-aware-review-overhaul

**Created**: 2026-07-21
**Seed**: docs/harness/seed.yaml (task_id 20260721-200358-0802, v1)

## MUST

- 에이전트 정의(verifier/reviewer/adversary)의 모델 하드코딩 제거 — 롤 별칭 전환
- reviewer 위임을 high/critical 위험 변경에 한정
- 이종성 증거 실측 계약 (adversary 트랜스크립트 model_change 확인)
- review-gate 3경로 증거 강제 + 무감사 skip 제거
- thread 계열 검증·Verdict 화이트리스트·`git commit -a` TOCTOU 가드

## MUST NOT

- 무감사 우회 경로 재도입
- models: 라인의 추정 기재 (실측만)

## OUT OF SCOPE

- 타 세션 소유 파일 (claudedocs/harness-auto-capture-analysis.md, docs/upstream-issues.md, .serena/)
- upstream(oh-my-pi) 수정·이슈
- human-review 자기선언의 암호학적 검증 (수용된 위협 모델)

## Acceptance Criteria

- [x] AC1 에이전트 3종(verifier/reviewer/adversary) frontmatter가 롤 기반 — 모델 하드코딩 0
- [x] AC2 reviewer 위임이 high/critical 위험 변경에 한정
- [x] AC3 이종성 증거 실측 계약 — adversary 트랜스크립트 model_change 확인, models:는 실측 시에만 기재
- [x] AC4 review-gate 3경로 증거(이종 리뷰/human-review/감사된 override) 강제 + 무감사 skip 제거
- [x] AC5 thread 계열 검증(codex-thread만 gpt 기본값 함의) + Verdict 화이트리스트 + git commit -a TOCTOU 가드
- [x] AC6 review-gate 테스트 71건 포함 전체 399건 그린
