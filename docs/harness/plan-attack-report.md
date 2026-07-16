# Plan Attack Report: harness-telemetry (task_id 20260710-180439-3771)

**Date**: 2026-07-10 · **Run**: 1 · **Critic**: critic 에이전트 (Opus, adversarial 승격 — index.ts 게이트 배선 + commit-gates 디스패처 실코드 검사 포함)
**판정**: **PASS** (CRITICAL 0 · HIGH 4 · MEDIUM 4) — run_count=1 → 비차단. HIGH/MEDIUM 8건 전부 seed에 반영 완료(아래 amend 열).

## Findings

| # | Sev | 공격 요지 | seed 반영 (2026-07-10) |
|---|---|---|---|
| 1 | HIGH | recovery-join이 false-block과 정상 준수 흐름을 구분 불가 — "오차단 시그널" 명명은 지표 의미 역전 | goal·AC6 재명명: recovery-join = **마찰(friction) 시그널**, false-block 판정 아님(인간 리뷰 후보 제시) |
| 2 | HIGH | worker(session_stop 미발화)+vault append 실패 → 중앙 데이터 영구 누락, 로컬 미러는 머신별이라 중앙 목적 무력 | AC5: 모든 이벤트 `event_id` 부여 + report/sync가 local∪central을 **event_id 병합·dedup**(파일 존재 복사 아님), 잘린 꼬리 skip+경고 |
| 3 | HIGH | AC4 live 증거(positive-only)가 parent 매핑 불가 판명 시 충족 불가 → acceptance 출구 없음 | AC4 verify 분기화: 해석 가능 시 사례 1건 / 불가 판명 시 관찰 기록+null-잔류 테스트로 **대체 충족** |
| 4 | HIGH | 층별 unit·픽스처만 — writer↔report 스키마 seam 불일치가 전 AC 통과 가능 | **AC9-e2e-seam 신설**: 실제 writer 산출물 관통 통합 테스트 + 부분 누락 병합 복원 케이스 |
| 5 | MED | fail-open writer drop → false '미사용 자산' 오분류 | out_of_scope 문구: '미사용'은 확정 아닌 **후보**(fail-open drop 특성 명시) |
| 6 | MED | invocation_key 구성 미정의 → 과대/과소 병합 | AC3: **상관-소비 모델** 확정(interactive 발급→custom message consume, RPC=message id, read=tool_call id) + 만료 처리 verify |
| 7 | MED | usage 파일 retention 정책 부재 | out_of_scope에 명시(세션당 1파일·완결형, 수동 프루닝, v2) |
| 8 | MED | R3 완화 근거가 실제 파일 키(aggregation)와 불일치, main+worker 공유 케이스 미분석 | R3 재서술: O_APPEND 단문 원자성+in-process 직렬화, 로컬 vault 전제 명시 |

## 사전 해소 확인 (critic 인정)
프라이버시(상대경로+private vault+gitignore 실측) · 관측자 효과(R1/R5) · vault 가용성(AC5 fail-open) · 준수 측정 한계(A6 unknown) · getSessionId/getSessionFile API 실존 · session_stop main-only 근거.

## 총평 (critic)
"이례적으로 성숙한 seed. CRITICAL 후보는 모두 사전 해소 확인. 남은 위협은 측정 타당성 축 — 특히 HIGH-1이 지표 신뢰성의 근간이라 실행 전 amend 권고." → 본 보고서 작성 시점에 8/8 반영 완료.
