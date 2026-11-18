# Current Scope: repo-rename-pylon-140

**Created**: 2026-11-19
**Seed**: docs/harness/seed.yaml (task_id 20261118-155334-140a, v1)
**Issue**: #140

## MUST
- `scripts/harness-sync.sh`의 원본 자가 판정이 `origin`의 옛 이름과 새 이름을 모두 원본으로 받고, 기본 소스 주소가 새 이름입니다.
- 살아 있는 스킬(`harness-check`·`init`·`migrate`·`gh-loop`·`gh-fanout`)과 `README.md`·`README.en.md`, `harness-wiring.test.mjs` 픽스처의 옛 이름을 새 이름으로 고칩니다.
- 소비 리포 `source_remote`의 처리(sync가 갱신)를 정하고 `harness-check` 스킬에 적습니다.

## MUST NOT
- 이 체크아웃의 `origin` 주소, 시점 기록 문서(`docs/harness/archive/**`·`audit.jsonl`·CHANGELOG 과거 항목·`docs/handoff/`·`claudedocs/`)의 옛 이름을 바꾸지 않습니다.
- 버전 범프·태그·force-push·머지를 하지 않습니다.

## Acceptance Criteria
- [x] AC1 — `origin`이 옛 이름·새 이름 어느 쪽이어도 원본으로 판정하고 접두만 같은 주소는 판정하지 않음(`harness-sync.test.mjs` "#140: an origin under the old or the new repository name self-skips as the source; a look-alike is synced" — 원본 6개 표기·접두 일치 5개; 임시 clone 스모크: `origin`=새 주소에서 수정 전 스크립트는 `Target: harness/2026.91`로 sync 진행, 수정 후 `This IS the source harness repo`)
- [x] AC2 — `git grep -n 'rae-hugo-kim/omp' -- README.md README.en.md .omp/skills scripts`의 결과가 `scripts/harness-sync.sh:69 SOURCE_REPO_OLD="rae-hugo-kim/omp"` 한 줄(옛 이름도 받는 판정의 정의)
- [x] AC3 — `init/SKILL.md`의 `gh repo create <project-name> --template rae-hugo-kim/pylon`과 `SOURCE_REMOTE="git@github.com:rae-hugo-kim/pylon.git"`(`source_remote` 예시·오류 안내 포함)
- [x] AC4 — `node --test .omp/extensions/harness/tests/*.test.mjs`(820 pass)와 `node scripts/docs-drift`(OK) 통과, `CHANGELOG.md` `[Unreleased]`에 #140 항목, 버전 범프는 머지 뒤 코디네이터가 승인을 받아 실행(PR 본문 "머지 뒤 할 일"에 적음)
- [x] AC5 — PR 본문 "머지 뒤 할 일"에 `git remote set-url origin git@github.com:rae-hugo-kim/pylon.git`과 "그 전에는 새 이름으로 새로 clone한 체크아웃에서 `harness-check`를 돌리지 않는다"는 주의를 적음
