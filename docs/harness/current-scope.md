# Current Scope: autonomy-github-hitl-loop (autonomy Q2)

**Created**: 2026-06-18
**Seed**: docs/harness/seed.yaml (`autonomy-github-hitl-loop`, v1, task_id 20260618-171252-5e29)
**Thread goal**: 자율화 Q2 — finding→issue→fix→PR→cross-verify→HITL 루프의 재사용 하네스 자산을 option-D PoC 티어로 저작(스킬+헬퍼+컨벤션+전파). 런타임(옵션 A Actions/runner)은 검증 후 별도 seed.

## MUST
- 루프 스킬 `.omp/skills/gh-loop/SKILL.md` — finding→issue→fix→PR→cross-verify→HITL 5단계(option D, 단일세션·수동 재호출) (AC1)
- needs-decision HITL 컨벤션 스킬 자체수록 — 구조화 질문 게시 + 라벨 + 세션 종료/재개 + 사용자응답 최우선 (AC2)
- finding→issue 헬퍼 — dedup/throttle/라벨, gh 호출 seam, 단위테스트 (AC3)
- 머지 자동금지 불변식 + 교차검증 advisory + 루프 반복 한도 (AC4)
- 기존 자산 재사용 명문화(autopilot/ralph·gh pr create·reviewer/adversary/ccg/codex), 재구현 금지 (AC5)
- harness-sync.sh PATHS 등록 + 신규 스킬 docs 반영 (AC6)

## SHOULD
- 스킬에 결정점 예시(머지 전·스키마 변경·파괴 작업 등) 명시로 캘리브레이션 가이드

## MUST NOT
- 머지 자동화 (절대) — 교차검증은 advisory만
- 옵션 A 런타임/Codex CI/finding 자동탐지/옵션 B 데몬/라이브 GitHub 실행 (전부 out_of_scope)

## OUT OF SCOPE
- 옵션 A 런타임: `.github/workflows/` + self-hosted runner + issue_comment 트리거 (검증 후 별도 seed)
- Codex CI 이식, finding 자동 탐지, 옵션 B 로컬 데몬, 라이브 이슈/PR 생성 실행

## Acceptance Criteria
- [x] AC1 루프 스킬 신설 (option D 5단계, frontmatter 유효, 기존 포맷 부합)
- [x] AC2 needs-decision HITL 컨벤션 스킬 자체수록 (질문 포맷·라벨·종료/재개·사용자응답 최우선)
- [x] AC3 finding→issue 헬퍼 dedup/throttle/라벨 단위테스트 통과 (gh seam)
- [x] AC4 머지 자동금지 불변식 + 루프 한도 명시 (+ throttle 테스트)
- [x] AC5 기존 자산 재사용 명문화 + 인용 자산 레포 실재 확인
- [x] AC6 harness-sync PATHS 등록 + docs-drift 0/0
