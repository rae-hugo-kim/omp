# Current Scope: closeout-seed-ac-coverage-122

**Created**: 2026-11-19
**Seed**: docs/harness/seed.yaml (task_id 20261118-164530-122a, v1)
**Issue**: #122 (+ #61 — 같은 워커가 함께 처리)

## MUST
- `acceptance-gate.mjs` closeout landing이 HEAD seed의 객체형 AC id가 HEAD `current-scope.md` 체크박스의 첫 토큰으로 전부 있는지 확인하고, 빠진 id를 이름으로 내며 거짓 마감으로 BLOCK합니다.
- `acceptance-gate.mjs` Check 3가 커밋이 담는 scope(plain·hook은 인덱스 본, `-a`는 워크트리, 판정 불가 형태는 미체크가 많은 쪽)를 판정합니다.
- 두 게이트의 헤더 주석과 `harness-harness_integration_contract.md`·`docs/rules/closeout_contract.md`를 코드와 맞춥니다.

## MUST NOT
- `thread-scope.mjs`의 동작을 바꾸지 않습니다.
- 객체형 id가 없는 seed의 기존 체크박스 판정과, 커밋이 scope를 담지 않는 경우의 디스크 판정을 바꾸지 않습니다.
- 스킬(kickoff·compr·compush) 문서를 고치지 않습니다(별도 이슈).

## Acceptance Criteria
- [x] AC1 — `acceptance-gate.mjs:2-6`·`backpressure-gate.mjs:2` 헤더가 `.githooks/pre-commit → gates/commit-gates.mjs` hook mode 배선과 `tool_call` 훅이 아님을 서술(스폰 지점은 `commit-gates.mjs:56` 하나 — grep 확인)
- [x] AC2 — `seedAcIds`·closeout id 포함 검사(`acceptance-gate.mjs:241-270,368-380`)가 빠진 id를 전부 이름으로 내며 exit 2; 문자열형·id가 첫 키가 아닌 항목·flow 스타일·블록 없음은 기존 판정(`acceptance-gate.test.mjs` "#122 fail-open boundary")
- [x] AC3 — RED 9건 실패 확인 뒤 GREEN: "#122 closeout of a `thread-scope open --ac` partial thread" → BLOCK(`AC2, AC3` 명시, docs-only·WIP·hook·`-a`), "full scope … lands", "fail-open boundary" 기존 동작; `acceptance-gate.test.mjs` 87건 전부 통과(공용 픽스처 `AC_BLOCK`은 문자열형으로 전환 — 객체형 `AC1` + `- [x] done`은 AC2가 막는 형태)
- [x] AC4 — `harness-harness_integration_contract.md` 잔존면 단락이 "object-form ids mechanically enforced since #122"와 남는 경계 5가지를 적고, `closeout_contract.md` §2 (ii)·마지막 문단·새 §3f가 같은 판정을 서술
- [x] AC5 — `node --test .omp/extensions/harness/tests/*.test.mjs` 829 pass / 0 fail, `node scripts/docs-drift` `OK (0 errors, 0 warnings)`
- [x] AC6 — `scopeForCommit`(`acceptance-gate.mjs:523-549`): "#61 staged `- [ ]` + worktree `- [x]` + staged code -> BLOCK (plain, hook)", 반대 방향은 plain allow·`-a` BLOCK, 판정 불가 형태(pathspec·`bash -c`)는 미체크가 많은 쪽, untracked·intent-to-add는 종전대로 디스크 판정; 실제 훅 경로는 `hook-gates.test.mjs` "U9s"(plain BLOCK·`-a` 착지·pathspec BLOCK — 수정 전 게이트로는 실패 확인)
