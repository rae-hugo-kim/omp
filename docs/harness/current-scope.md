# Current Scope: agent-title-number-prefix-78 (P2 thread)

**Created**: 2026-10-06
**Seed**: docs/harness/seed.yaml (task_id 20261006-061306-5772, v1)
**Thread-ID**: T-20261006061306-5772
**Thread**: gh-loop #78 worker: 이슈·PR 제목 `#N` 접두 + normalizeTitle 접두 무시

## Acceptance Criteria
- [x] AC1 — "gh-loop Stage 1·gh-fanout 추적 이슈·gh-loop PR(Stage 3/compr)의 생성 절차가 `#N ` 접두를 붙이고 SKILL.md 명령 예시가 이슈는 create→edit 2단계, PR은 닫는 이슈 번호 접두 1단계로 적혀 있습니다."
- [x] AC2 — "gh-loop-issue.mjs의 normalizeTitle이 선행 `#N ` 접두를 무시하고 비교하며(마커 해시 포함) gh-loop-issue.test.mjs가 접두 있는 기존 제목 dedup과 접두 경계 케이스를 고정합니다."
- [x] AC3 — "기존 이슈·PR 제목은 변경하지 않습니다(소급 금지). SKILL 문구에도 명시하고 이 작업은 어떤 기존 제목도 편집하지 않습니다."
- [x] AC4 — "하네스 suite(node --test .omp/extensions/harness/tests/*.test.mjs) 전부 통과, node scripts/docs-drift 0 errors/0 warnings."
