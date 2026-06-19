# Current Scope: autonomy-multisession-controller (autonomy Q3)

**Created**: 2026-06-19
**Seed**: docs/harness/seed.yaml (`autonomy-multisession-controller`, v1, task_id 20260619-153030-f28d)
**Thread goal**: Q3 멀티세션 = Q2 루프의 exec 엔진. 얇은 컨트롤러가 이슈를 worktree-격리 `omp --mode rpc` 워커로 fan-out, GitHub=관측·조정 평면, 동적 스케일(cap 기본 3). 테스트가능 결정로직 + worktree/RPC 배선 저작; 라이브 N워커는 옵션. tmux 없음.

## MUST
- `.omp/extensions/harness/gh-loop-controller.mjs` — `planPool`/`nextScale`/`assign` 결정로직(gh/git/spawn seam) + 단위테스트 (AC1/AC2/AC3)
- 컨트롤러 스킬: worktree-per-worker + `omp --mode rpc` spawn + 이벤트 모니터 + 정리 절차 (AC4)
- GitHub 관측: 라벨(상태)+코멘트(마일스톤, gh-loop-issue throttle 재사용)+트래킹 이슈; 머지 자동금지 (AC5)
- 전파: 헬퍼 `.omp/extensions/harness/`; 신규 스킬이면 PATHS+README (AC6)

## MUST NOT
- 라이브 N워커 E2E(옵션), 24/7 컨트롤러, 워커 직접통신, rpc 프로토콜 변경, 데몬/대시보드 제품화(ecc2)

## OUT OF SCOPE
- 라이브 다중구동(비용 N배), 24/7 상시(robo-omp/cloud), 워커↔워커 실시간 통신, 대시보드/데몬

## Acceptance Criteria
- [x] AC1 planPool(tasks,signals,cap)→할당계획(신호↑→워커↑≤cap, cap 캡[정수], 빈입력, 거대 changedFiles 클램프) 단위테스트
- [x] AC2 nextScale(state,signals,cap)→up/down/hold/retire(부하→up≤cap, idle→down, 분수cap floor) 단위테스트
- [x] AC3 assign→중복할당 방지(claim된 이슈·배치 내 중복·string/number 정규화 skip) 단위테스트
- [x] AC4 스킬: worktree-per-worker + RPC spawn + claim 롤백 + 크래시 재조정 절차 명시
- [x] AC5 GitHub 라벨/코멘트(마일스톤 coalescing)/트래킹 이슈 edit + 머지 자동금지 명시
- [x] AC6 헬퍼 위치/스킬 PATHS+README 등록 + docs-drift 0/0
