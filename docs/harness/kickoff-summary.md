# Kickoff Summary: v17-harness-adaptation (task_id 20260716-115803-9497)

**Date**: 2026-07-16 · **Mode**: evidence-derived (인터뷰 축약 — 요구가 라이브 프로브로 확정됨, 사용자 승인 "수정 ㄱㄱ")

## 맥락
omp 16.5.0→17.0.1 컷오버가 세션 재기동 사이에 발생했다(사용자 update). v17은 ast_edit/ast_grep을
xd:// 디바이스로 이동시키고 resolve 도구를 xd://resolve 쓰기로 대체했다. 하네스 배선(index.ts)은
v16의 toolName 분기를 기다리므로: ① 원장 오염(session-log/read-log에 `xd:/…` 쓰레기 경로),
② 원장 누락(적용 실파일 미추적 → backpressure 검증 상태가 신선한 척 유지), ③ pre-edit
context-gate 우회 위험(URI 가드만 넣을 경우) — ①②는 라이브 프로브로 실증, ③은 소스 대조로 확정.

## 주요 결정
1. **새 kickoff (새 task_id)** — telemetry seed와 무관한 새 작업단위 (artifact_roles_contract §Growth Policy).
   telemetry 산출물은 wip 체크포인트 커밋 653b302로 git 보존, 재개 시 복원 + thread-scope open.
2. **클린 컷오버** — 단일 바이너리 전제로 pre-v17 shim 미보존 (advisory 합의).
3. **순수 함수 라우팅** — mutationRoute/mutationCallTargets를 read-path.mjs로 추출해
   "xdev 봉투 우선, 파일 타깃 후순" 순서를 테스트로 고정 (RED-first).
4. **pre-edit 불변식 우선** — xd://ast_edit 바디 paths의 context-gate 유지가 URI 가드보다 우선
   (게이트가 느슨해지는 방향의 수정 금지).

## 예외/한계
- index.ts(TS)의 배선 자체는 단위 스위트 밖 — 라이브 프로브(자식 세션)로 검증한다.
