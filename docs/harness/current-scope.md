# Current Scope: closeout-seed-ac-coverage-122 (P2 thread)

**Created**: 2026-11-19
**Seed**: docs/harness/seed.yaml (task_id 20261118-164530-122a, v3)
**Thread-ID**: T-20261119045956-8710
**Thread**: #122 결정 B — Check 3가 커밋 본과 디스크 본 중 미체크가 많은 쪽을 판정

## 이 스레드의 변경
- `acceptance-gate.mjs` `scopeForCommit`: plain commit·훅 모드에서도 인덱스 본과 디스크 본을 함께 읽어 더 엄격한 쪽을 판정합니다 — 미체크가 많은 쪽이 우선이고, 쓸 수 있는 기록이 없는 본은 전부 체크된 본보다 앞섭니다(사용자 결정 B, 2026-11-19 — 이슈 #122 결정 요청 nonce `1795060302-13217`; 뒤 절반은 리뷰 r4의 medium 지적 반영).
- 닫힌 seed를 `thread-scope open`으로 재개했으므로(v1 done → v2 approved → v3 AC6 수정) AC 6개 전부를 이 head에서 다시 확인했습니다.

## Acceptance Criteria
- [x] AC1 — "두 게이트(acceptance-gate.mjs·backpressure-gate.mjs)의 헤더 주석이 실제 배선(commit-gates.mjs hook mode, .githooks/pre-commit)을 서술합니다." — 재확인: `acceptance-gate.mjs:2-6`·`backpressure-gate.mjs:2`가 그대로이고 스폰 지점은 `commit-gates.mjs:56` 하나입니다.
- [x] AC2 — "acceptance-gate closeout landing이 HEAD의 seed AC id 집합 ⊆ 은퇴 scope의 AC id 집합을 확인하고, 부족하면 빠진 id를 이름으로 내며 BLOCK합니다. seed가 AC id를 갖지 않는 문자열형이면 기존 판정을 유지합니다(fail-open 범위를 테스트로 고정)." — 재확인: `seedAcIds`(`acceptance-gate.mjs:254`)·id 대조(`:368-380`)는 이 스레드에서 바뀌지 않았고 `#122` 테스트 6건이 통과합니다.
- [x] AC3 — "RED→GREEN 회귀 테스트: --ac 부분 scope로 closeout → BLOCK, 전체 AC scope → allow, 문자열형 AC seed → 기존 동작. acceptance-gate.test.mjs 전부 통과합니다." — 재확인: `acceptance-gate.test.mjs` 88건 전부 통과. 이 스레드의 RED는 "#61 reverse", `U9s`의 반대 방향 단계, "#61 a disk copy without a usable record …"가 각각 구현 전 실패(exit 0)한 것으로 확인했습니다.
- [x] AC4 — "harness-harness_integration_contract.md의 #114 잔존면 단락이 기계 강제됨으로 바뀌고 docs/rules/closeout_contract.md §2와 맞습니다." — 재확인: 잔존면 단락(`:58`)은 그대로이고, Check 3 절(`:95`)·요약 항목(`:23`)·`closeout_contract.md` §2 안내·`harness-verification_tests_and_evals.md:11`·CHANGELOG를 두 본 판정에 맞췄습니다.
- [x] AC5 — "하네스 suite 전 항목이 통과하고 node scripts/docs-drift가 0 errors입니다." — `node --test .omp/extensions/harness/tests/*.test.mjs` 840건 통과·실패 없음, `node scripts/docs-drift` `OK (0 errors, 0 warnings)`.
- [x] AC6 — "#61 — Check 3가 커밋이 담는 scope와 디스크의 scope 가운데 미체크가 더 많은 쪽을 판정합니다(plain commit·훅 모드·판정 불가 형태 공통, -a는 워크트리 본): 스테이지된 미체크 + 워크트리 체크 + 코드 변경은 BLOCK, 커밋된 전부-체크 scope + 디스크에만 있는 미체크 scope + 코드 변경도 BLOCK(양방향 회귀 테스트)." — `scopeForCommit`(`acceptance-gate.mjs:534-546`); "#61 staged `- [ ]` + worktree `- [x]` … BLOCK", "#61 reverse: a committed all-[x] scope + an unchecked scope on disk only (`thread-scope open`) … BLOCK"(실제 `thread-scope.mjs` 사용), "#61 a disk copy without a usable record outranks a fully checked staged copy"(헤딩 미인식·체크박스 0개·삭제·읽기 불가 → backstop), 실제 훅 경로는 `hook-gates.test.mjs` `U9s`(plain 차단·`-a` 착지·반대 방향 차단·pathspec 차단).
