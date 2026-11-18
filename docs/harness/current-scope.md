# Current Scope: skills-kickoff-startdev-contract-align-120

**Created**: 2026-11-19
**Seed**: docs/harness/seed.yaml (task_id 20261119-013200-120a, v1)
**Issue**: #120

## MUST
- `.omp/skills/kickoff/SKILL.md` Step 3.5와 `.omp/skills/startdev/SKILL.md` GATE 1.5·GATE 3.5에서 `critic`·`test-engineer`·`architect` 호출을 없앱니다.
- `startdev/SKILL.md` Phase 0.5에 `draft` seed 승인 절차와 닫힌 seed의 두 재개 경로를 계약 문구대로 넣습니다.

## MUST NOT
- 게이트 코드, `docs/rules/`, `.omp/rules/harness-*.md`, `CHANGELOG.md`를 고치지 않습니다.
- 미승인 롤아웃 Phase 2 단계(test-attack·completion-attack)를 활성화하지 않습니다.

## Acceptance Criteria
- [x] AC1 — 두 스킬에서 `critic`·`test-engineer`·`architect`가 0건(`rg -n -i "\b(critic|test-engineer|architect)\b" .omp/skills/kickoff .omp/skills/startdev` → 매치 없음). Plan Attack은 `task`로 교체(롤아웃 Phase 1, kickoff 완료 조건 아님), GATE 1.5 Test Attack과 GATE 3.5의 Completion Attack은 "현재 미도입(롤아웃 Phase 1 — `plan-attack`만 도입)"으로 명시해 건너뛰고 승인 시 절차의 담당을 `task`·`security-reviewer`·`verifier`로 적음. GATE 3.5의 완료 검증은 `verifier`
- [x] AC2 — `startdev/SKILL.md` "draft seed 승인": 승인 질문(`ask`), `status` 한 줄만 `approved`로 바꾼 단독 커밋, `OMP_COMMIT_WIP=1 git commit`, 보류 시 closeout 전 승인(계약 `startdev_seed_contract.md:37`·`seed_contract.md:141` 문장). 스모크: 미체크 scope + 미추적 approved seed의 docs 커밋이 hook 모드에서 plain exit 2, `OMP_COMMIT_WIP=1` exit 0
- [x] AC3 — `startdev/SKILL.md` "닫힌 seed 재개": 같은 기능 → `node .omp/extensions/harness/thread-scope.mjs open`, 새 기능 → `/kickoff`. 스모크: `done` seed에 `thread-scope.mjs open` → `status: approved`, `version +1`, `completed` 제거, `seed_reopened`, scope 재생성
- [x] AC4 — `node scripts/docs-drift` → `OK (0 errors, 0 warnings)`, `node --test .omp/extensions/harness/tests/*.test.mjs` → 818 pass / 0 fail, 변경 파일은 두 스킬(+ `docs/harness/` 워크플로 산출물)
