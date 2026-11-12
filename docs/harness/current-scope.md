# Current Scope: harness-skill-tune-inspect-127

**Created**: 2026-11-13
**Seed**: docs/harness/seed.yaml (task_id 20261112-171825-60f2, v1)
**Issue**: #127

## MUST
- 스킬 `.omp/skills/harness-skill-tune/`의 점검 단계(읽기 전용)를 만들고 보고서 하나를 냅니다.
- 결정적으로 판정되는 것만 스크립트로 하고, 판단이 필요한 항목은 스킬 본문의 절차로 둡니다.

## MUST NOT
- 스킬을 수정·개명·삭제·숨김 처리하지 않습니다(`init` 개명 포함).
- `scripts/harness-sync.sh` 화이트리스트에 넣지 않습니다.
- 리포 밖 스킬 파일을 고치지 않고, skill-creator 파일을 반입하지 않습니다.

## Acceptance Criteria
- [x] AC1 — `.omp/skills/harness-skill-tune/SKILL.md`가 있고 frontmatter `name`이 디렉터리명과 같으며 `description`이 있음
- [x] AC2 — 픽스처 세션 디렉터리에서 스킬별 세션 수·읽기 횟수·마지막 사용일·`/skill:` 호출 수, 읽기 0회는 0, 하위 경로 읽기는 그 스킬에 귀속
- [x] AC3 — 세션 디렉터리가 없거나 `command_usage`를 읽을 수 없으면 그 열을 측정 불가로 표시하고 실패 없이 종료
- [x] AC4 — 픽스처에서 예약 이름과 같은 스킬, 출처 간 같은 이름 사본을 각각 지적
- [x] AC5 — 픽스처에서 없는 경로 참조, 없는 `/skill:` 참조, `name`과 디렉터리명 불일치를 각각 지적
- [x] AC6 — 보고서가 지적마다 ID·심각도·스킬·근거(`파일:줄`)·기계적 수정 가능 여부를 담음
- [x] AC7 — `node --test .omp/extensions/harness/tests/*.test.mjs`와 `node scripts/docs-drift` 통과, `CHANGELOG.md` `[Unreleased]`에 항목
