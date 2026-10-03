# #49 작업 범위를 추적합니다.

- task_id: `20261003-004031-0e67`
- seed: `docs/harness/seed.yaml` version 1
- 승인 근거는 이슈 #49 본문의 "승인된 구현 방향 (2026-10-03)"과 세션 직접 결정 댓글입니다.
- 범위는 09-28 ①(harness-core 언어 지시 한 줄과 writing_style 참조 정정)으로 한정합니다.

## Acceptance Criteria

- [x] AC1 — 워크트리 cwd의 `omp -p --no-session` 렌더에서 새 줄 인용을 확인하고, 변경 전 HEAD 사본에서는 `NONE`임을 대조했습니다.
- [x] AC2 — `grep -n '글로벌 규칙' .omp/rules/harness-writing_style.md`가 0건입니다.
- [x] AC3 — audit 점수 51/70 → 51/70, 하네스 suite 653/653, `node scripts/docs-drift` 0 errors/0 warnings입니다.
- [x] AC4 — 변경 파일은 `harness-core.md`·`harness-writing_style.md`·`CHANGELOG.md`와 seed·scope·audit뿐이며 범위 밖 파일은 건드리지 않았습니다.

## 후속 절차를 구분합니다.

PR 생성과 증거 게시는 커밋 후 수행합니다. 이슈·PR 양쪽의 `needs-decision` 전이와 현재 head·nonce 결정 요청 뒤 턴을 종료하며 머지는 하지 않습니다.

## 검증 근거를 기록합니다.

- `node --test .omp/extensions/harness/tests/*.test.mjs`를 변경을 마친 뒤 1회 실행하여 653/653 PASS, fail 0을 확인했습니다.
- `node scripts/docs-drift`는 0 errors, 0 warnings로 통과했습니다.
- AC1 렌더 실측의 명령과 출력은 PR 본문에 기록합니다.
