# Current Scope: harness-friction-audit-129

**Created**: 2026-11-13
**Seed**: docs/harness/seed.yaml (task_id 20261113-061313-129f, v1)
**Issue**: #129

## MUST
- 스킬 `.omp/skills/harness-friction/`(절차 1~7)과 결정적 스크립트(구간·수집·모델 참조 생존·기준 갱신)를 만듭니다.
- 18.11.1 → 18.18.6 구간 보고서를 전수 대조로 작성하고 이슈 분할안까지만 냅니다.

## MUST NOT
- `adversary-argon`·`reviewer.md`의 패널 구성·규칙 본문·`modelRoles`를 바꾸지 않습니다.
- 이슈를 직접 만들지 않습니다.
- `scripts/harness-sync.sh` 화이트리스트에 넣지 않습니다.

## Acceptance Criteria
- [x] AC1 — `.omp/skills/harness-friction/SKILL.md`가 있고 frontmatter `name`이 디렉터리명과 같으며 `description`이 있음
- [x] AC2 — 생존 검사가 픽스처에서 해석 안 되는 고정 `model:` 값을 지적하고, 해석되는 고정값·롤 참조(`@advisor`, `["@task", "@default"]`)는 지적하지 않음
- [x] AC3 — 기준 버전 기록(`baseline.json`)이 리포에 있고 스킬 절차 7단계가 감사 뒤 갱신을 지시함
- [x] AC4 — 18.11.1 → 18.18.6 보고서가 PR에 있고 구간 릴리스 26 / 읽은 26이 같으며 `v18.18.4` Antigravity 중지가 `adversary-argon.md`와의 충돌(C1)로 실림
- [x] AC5 — 보고서 §7 사이클 분할안(번호·확인 문장)이 있고 이슈를 만들지 않음
- [x] AC6 — `adversary-argon`·`reviewer.md`의 패널 구성과 규칙 본문이 이 PR에서 바뀌지 않음
- [x] AC7 — `.omp/skills/init/SKILL.md`의 소스 리포 전용 자산 제거 목록에 `.omp/skills/harness-friction/`이 있음
- [x] AC8 — `node --test .omp/extensions/harness/tests/*.test.mjs`(800 pass)와 `node scripts/docs-drift`(OK) 통과, `CHANGELOG.md` `[Unreleased]`에 항목
