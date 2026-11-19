# Current Scope: worktree-clone-state-origin-111

**Created**: 2026-11-19
**Seed**: docs/harness/seed.yaml (task_id 20261118-164328-111a, v1)
**Issue**: #111

## MUST
- `read-log.txt`와 `backpressure-status`를 기록된 디렉터리의 실경로에 묶고(`gates/state-origin.mjs`), 경로가 다르거나 없는 파일은 읽을 때 없는 것으로 취급합니다.
- `commitTargetDir`의 선행 `cd` 처리는 사용자 결정 A(이슈 댓글 `gh-loop:session-decision`, 2026-11-19)대로 `shellWriteTargets` 규칙으로 구현하고 테스트로 고정합니다.
- 통합 계약에 CoW 복제(`worktree.clone`)와 `worktree.onStart` 주의를 기록합니다.

## MUST NOT
- F8의 동작을 사용자 결정 없이 정하지 않습니다.
- 커밋 게이트의 판정 규칙(risk별 BLOCK/WARN, skip 플래그, FAIL 차단)을 바꾸지 않습니다.
- #51(같은 워크트리 세션 격리), 경로 없는 일회성 플래그의 복제 방어, gh-loop/gh-fanout 스킬 본문은 건드리지 않습니다.

## Acceptance Criteria
- [x] AC1 — 복제된 `backpressure-status=PASS`·`read-log.txt` 항목이 새 워크트리에서 증거로 인정되지 않음(`state-origin.test.mjs` "a cloned backpressure PASS does not verify the new worktree", "a cloned read ledger does not prove a read", "a cloned ledger does not prove the other repo's discipline file was read"; 수정 전 RED 5건 → 수정 후 통과)
- [x] AC2 — 사용자 결정 A: `commitTargetDir`가 첫 리터럴 `cd <존재 dir>` 1회(`&&`·`;`)를 따라가고 나머지는 `null`(`git-commit-detect.test.mjs` "ONE literal cd into an existing directory is followed; any other cd stays unknown (#111 F8)"; 핸들러 수준 `commit-landed-handlers.test.mjs` (f2) — B의 해시로 착지, 가려진 차단은 `BLOCKED`; 수정 전 RED 확인)
- [x] AC3 — `harness-harness_integration_contract.md`에 CoW 복제·`worktree.onStart` 주의 기록(Known residual surfaces "Worktree clones carry gitignored state (#111)", §1·§3 State, "Worktree clone (#111)" 문단, Known-Failure Matrix 행)
- [x] AC4 — `node --test .omp/extensions/harness/tests/*.test.mjs` 전 항목 통과(826 pass, 0 fail — 2026-11-19; `node scripts/docs-drift` OK)
