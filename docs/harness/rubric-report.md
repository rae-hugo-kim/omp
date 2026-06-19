# Rubric Report: autonomy-multisession-controller (autonomy Q3)

**Date**: 2026-06-19 · **Seed**: `docs/harness/seed.yaml` v1 · **task_id**: 20260619-153030-f28d
**Mode**: doc-ingest ← `claudedocs/harness-auto-capture-analysis.md#Q3` (+ 5 locked design decisions)

## 판정 (4 clarity + coverage)

| 차원 | 판정 | 근거 |
|---|---|---|
| `goal_clarity` | HIGH | 결과 중심 — 테스트가능 컨트롤러 로직 + worktree/RPC 배선; 라이브 N워커 deferral 명시 |
| `constraint_clarity` | HIGH | rpc 워커/worktree 격리/GitHub 버스/로컬 tier/cap 3/ecc2 경계/het — 전부 실행가능 |
| `success_criteria_clarity` | HIGH | AC1–6 전부 `verify`(단위테스트·스킬 절차·docs-drift) |
| `context_clarity` | HIGH | Q3 전체 + 기존 자산(gh-loop-issue/runner/detect)·omp://rpc 앵커 |
| **`coverage`** | **HIGH** | Q3 요구 → AC 6개 + 명시 out_of_scope, 잔차 0; **open decision 0**(5개 전부 사용자 confirmed) |

## coverage 매핑
| 요구 (source) | 귀속 |
|---|---|
| 워커 풀 shape 결정 (Q3.4/Q3.5) | AC1 |
| 동적 스케일 (Q3.5) | AC2 |
| GitHub 조정·중복할당 방지 (Q3.6) | AC3 |
| worktree 격리 + RPC spawn substrate (Q3.1/Q3.2) | AC4 |
| GitHub 관측(라벨/코멘트/트래킹) + 머지 자동금지 | AC5 |
| 전파 | AC6 |
| 라이브 N워커·24/7·워커직접통신·rpc 프로토콜·데몬화 | **out_of_scope** |

**미매핑 잔차**: 0. **open decision 0** — worker_runtime/tier/observability/concurrency/build_scope 전부 사용자 confirmed.

## Decision
- default_action: pass (전 차원 HIGH, 잔차 0, 결정 0미결)
- 비고: 컨트롤러 결정로직(planPool/nextScale/assign)은 단위테스트로 완결 검증(gh/git/spawn seam). 라이브 N워커는 비용 N배라 옵션. ecc2 경계(얇은 오케스트레이터) 준수. 커밋 전 연속 이종 리뷰. 구현 착수.
