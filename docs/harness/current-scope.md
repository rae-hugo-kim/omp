# Current Scope: worktree-clone-state-origin-111 (P2 thread)

**Created**: 2026-11-21
**Seed**: docs/harness/seed.yaml (task_id 20261118-164328-111a, v3)
**Thread-ID**: T-20261121122639-1eec
**Thread**: 리뷰 r3 지적 반영 (#111, 결정 B)

## Acceptance Criteria
- [x] AC1 — 복제된 `backpressure-status=PASS`·`read-log.txt` 항목이 새 워크트리에서 증거로 인정되지 않음(`state-origin.test.mjs` "a cloned backpressure PASS does not verify the new worktree; its own run does", "a cloned read ledger does not prove a read in the new worktree", "a cloned ledger does not prove the other repo's discipline file was read (cross-repo guard)" — 2026-11-21 재실행 통과)
- [x] AC2 — 사용자 결정 A: `commitTargetDir`가 첫 리터럴 `cd <존재 dir>` 1회를 따라가고 나머지는 `null`(`git-commit-detect.test.mjs` "ONE literal cd into an existing directory is followed; any other cd stays unknown (#111 F8)", `commit-landed-handlers.test.mjs` (f2))
- [x] AC3 — 통합 계약에 CoW 복제·`worktree.onStart` 주의 기록(`harness-harness_integration_contract.md` Known residual surfaces "Worktree clones carry gitignored state (#111)", §1·§3 State, "Worktree clone (#111)" 문단, Known-Failure Matrix 행 — rebase 뒤에도 유지됨을 verifier가 확인)
- [x] AC4 — `node --test .omp/extensions/harness/tests/*.test.mjs` 전 항목 통과(855 pass, 0 fail — 2026-11-21, base `83f8d9f`; `node scripts/docs-drift` OK)
- [x] AC5 — 리뷰 r3 지적 반영: (a) 자기 경로에 줄바꿈이 든 디렉터리는 장부에 아무것도 적지 않고 상태에 경로를 싣지 않음(`state-origin.test.mjs` "a ledger written from a directory whose path holds a line break opens no section for another directory", "a status written from a directory whose path holds a line break is nobody's PASS, and still its own FAIL" — 수정 전 RED 확인), (b) 통합 계약 `4. backpressure-gate` 요약이 "남의 `PASS`/`UNKNOWN`은 기록 없음, `FAIL`은 누가 적었든 차단"으로 §3 State와 일치, (c) 개행 없이 끝난 장부에 덧붙여도 항목이 온전함("appending to a ledger whose last line was cut off does not glue the new entry onto it" — 수정 전 RED 확인), (d) 줄바꿈 경로 테스트에 양성 대조 추가(단독·배치의 정상 경로가 기록됨), (e) `builtin cd wt; git commit` → `wt`를 F8 테스트의 추적 목록에 고정
