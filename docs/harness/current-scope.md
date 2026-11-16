# Current Scope: bootstrap-source-only-skills-134

**Created**: 2026-11-16
**Seed**: docs/harness/seed.yaml (task_id 20261116-052656-134a, v1)
**Issue**: #134

## MUST
- `risk-assess.mjs`의 부트스트랩 창이 `.omp/skills/harness-skill-tune/`·`.omp/skills/harness-friction/`의 삭제를 소스 전용 자산 삭제로 다룹니다.
- `init/SKILL.md`의 두 항목을 삭제로 바꾸고 Phase 5 예외 서술을 코드와 맞춥니다.

## MUST NOT
- 다른 `.omp/skills/` 경로의 하네스 자산 판정과 부트스트랩 창의 다른 조건을 바꾸지 않습니다.
- `scripts/harness-sync.sh` 화이트리스트를 바꾸지 않습니다.

## Acceptance Criteria
- [x] AC1 — 창 안 커밋이 두 디렉터리를 삭제해도 risk가 high로 오르지 않음(`risk-assess.test.mjs` "deleting the two source-only skill directories inside the window is cleanup -> low"; 템플릿 사본 스모크: 수정 전 high → 수정 후 low)
- [x] AC2 — 동기화 스킬(`compr`)·접두만 같은 형제 삭제와 창 밖 두 디렉터리 삭제는 예외 없음(`risk-assess.test.mjs` "a synced skill or a prefix-sharing sibling … is scored", "outside the window … scored (high)")
- [x] AC3 — `init/SKILL.md` Phase 2-5의 두 항목이 `→ 삭제`, Phase 5 예외 서술이 코드와 일치(`harness-wiring.test.mjs` W3d가 상수 ↔ PATHS ↔ init 본문을 대조)
- [x] AC4 — `node --test .omp/extensions/harness/tests/*.test.mjs`(817 pass)와 `node scripts/docs-drift`(OK) 통과, `CHANGELOG.md` `[Unreleased]`에 #134 항목
