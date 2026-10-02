# gh-fanout Orca 워커 전환을 진행합니다.

- Task: `20261002-151247-0c72`
- Seed: `docs/harness/seed.yaml` version 1
- Source: https://github.com/rae-hugo-kim/omp/issues/66

## Acceptance Criteria

- [x] AC1-orca-spawn: 클레임·Orca 2단계 스폰·준비 확인·실패 롤백·전달 불확실성 처리를 설명합니다.
- [x] AC2-model-extension: 사용자 모델 선택·마커 재사용·R8 확장·단일 핸들을 설명합니다.
- [x] AC3-observe-resume: 비차단 관측·상태 전이·동일 워크트리 재개·소유권 확인 후 정리를 설명합니다.
- [x] AC4-cutover-scope: 현행 RPC·raw git worktree 안내를 제거하고 #71 등 비범위를 지킵니다.
- [x] AC5-verification: 관련 회귀 테스트·docs-drift·링크·정본·규칙 충돌·Orca 읽기/카드 스모크 결과를 기록합니다.
- [x] AC6-docs: CHANGELOG에 #66 변경과 라이브 fan-out 검증 한계를 기록합니다.

## 후속 절차를 따릅니다.

구현·검증 후 체크 완료 seed·scope를 먼저 커밋하고 변경·리뷰 후속·closeout 순서로 착지합니다. 이후 PR 생성·advisory 교차검증·verifier 확인·Stage 5 nonce 결정 요청을 진행합니다. 머지하지 않으며 audit 충돌 방식은 #71에 남깁니다.

## 검증 근거를 기록합니다.

- `node --test .omp/extensions/harness/tests/*.test.mjs`: 653/653 PASS이며 실패·skip은 0건입니다.
- `node scripts/docs-drift`: `OK (0 errors, 0 warnings)`입니다. 초기 실행의 외부 `orca-cli` 상대 링크 오류는 `skill://orca-cli` 참조로 수정했습니다.
- Bash 예시 8개를 `bash -n`으로 확인했고, R8 명령 문자열의 확장 유무·공백/`$(literal)` 경로 argv 보존을 통과했습니다.
- 수정 링크는 정본 gh-loop와 이슈 #71로 연결됩니다. `AGENTS.md`의 승인·최소 범위·검증 규칙, gh-loop의 worker·R8·상태 라벨·nonce·커밋 순서와 대조했습니다.
- `orca-ide status`, `worktree set --worktree active --comment`, `terminal list/show`가 성공했습니다. 현재 워커의 `agentIdentity: "omp"`와 `GPT-6-Astra · xhigh`를 관측했습니다.
- controller CLI의 `plan --cap 1`은 워커 1개와 대기 1개를 반환했고, `scale`의 running=3/cap=3은 `hold`였습니다.
- 새 워커를 기동하는 fan-out E2E·워크트리 삭제는 실행하지 않았습니다. 기존 전역 `~/.claude/skills/gh-fanout/` 미러는 없어 갱신 대상이 없으며 이 PR이 새 전역 설치를 만들지는 않습니다.
