# Current Scope: harness-skill-tune-update-128

**Created**: 2026-11-13
**Seed**: docs/harness/seed.yaml (task_id 20261113-061221-128a, v1)
**Issue**: #128

## MUST
- `.omp/skills/harness-skill-tune/SKILL.md`에 갱신 단계(분류·기계적 처리·판단 필요 선택지·평가·재점검·보고)를 더합니다.
- 실제 점검이 낸 지적 1건(`REF-PATH-gh-loop-3861db`)을 그 절차로 끝까지 처리하고 재점검으로 확인합니다.
- `.omp/skills/init/SKILL.md`의 소스 리포 전용 자산 제거 목록에 `.omp/skills/harness-skill-tune/`을 더합니다.

## MUST NOT
- 판단 필요 지적을 사용자 선택 없이 적용하지 않습니다. #120이 다루는 REF-AGENT 2건은 고치지 않습니다.
- 리포 밖 스킬을 고치지 않고, 스킬이 직접 커밋하지 않습니다.
- 점검 스크립트와 risk-assess 게이트 코드를 바꾸지 않습니다(게이트는 결정 요청).

## Acceptance Criteria
- [x] AC1 — `SKILL.md`에 갱신 단계가 있고, 기계적·판단 필요의 분류 기준과 각 처리 절차가 적혀 있음
- [x] AC2 — 판단 필요 지적은 사용자 선택 없이 적용하지 않는다고 명시돼 있고, 근거 수치를 담은 선택지 형식 예시가 있음
- [x] AC3 — 평가 단계에 실행 조건, 생략 조건, 결과 기록 형식이 있음
- [x] AC4 — 리포 밖 스킬을 수정하지 않는다는 경계와 스킬이 직접 커밋하지 않는다는 경계가 있음
- [x] AC5 — 커밋에 지적 1건(`REF-PATH-gh-loop-3861db`)을 절차로 처리한 스킬 수정이 있고, 그 트리에서 점검을 돌리면 해당 ID가 나오지 않음(20건 → 19건, 새 지적 0)
- [x] AC6 — `.omp/skills/init/SKILL.md`의 소스 리포 전용 자산 제거 목록에 `.omp/skills/harness-skill-tune/`이 있음
- [x] AC7 — `node --test .omp/extensions/harness/tests/*.test.mjs`(786 pass)와 `node scripts/docs-drift`(0 errors) 통과, `CHANGELOG.md` `[Unreleased]`에 항목
