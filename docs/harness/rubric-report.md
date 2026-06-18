# Rubric Report: autonomy-github-runtime (autonomy Q2 → option A)

**Date**: 2026-06-18 · **Seed**: `docs/harness/seed.yaml` v1 · **task_id**: 20260618-212940-642a
**Mode**: doc-ingest ← `claudedocs/harness-auto-capture-analysis.md#Q2.7-3,Q2.9` (+ confirmed gh-loop guard policy)

## 판정 (4 clarity + coverage)

| 차원 | 판정 | 근거 |
|---|---|---|
| `goal_clarity` | HIGH | 결과 중심 — 워크플로 템플릿 + 테스트가능 runner 헬퍼 + 가이드 + 전파; 라이브 deferral 명시 |
| `constraint_clarity` | HIGH | 저작만/templates 전파/헬퍼 추출/guard 실행체/머지 자동금지/het 리뷰 — 실행가능 |
| `success_criteria_clarity` | HIGH | AC1–6 전부 `verify` 보유(단위테스트·YAML lint·grep·docs-drift) |
| `context_clarity` | HIGH | source 앵커 + 선례(gh-loop-issue.mjs, harness-sync templates/ 전파) |
| **`coverage`** | **HIGH** | Q2.7-3/Q2.9 요구 → AC 6개 + 명시 out_of_scope, 잔차 0 (아래) |

## coverage 매핑

| 요구 (source) | 귀속 |
|---|---|
| 워크플로 + issue_comment 트리거로 재개 자동화 (Q2.7-3) | AC1(로직)+AC2(템플릿) |
| guard policy 실행체화 (gh-loop 확정 정책) | AC3 |
| runner+secrets per-project 인프라 (Q2.1) | AC4 |
| templates/ instantiate-once 전파 (Q2.9) | AC5 |
| 머지 자동 금지 유지 | AC6 |
| 라이브 runner 실행·secrets·Codex CI·finding 자동탐지·GitHub-hosted·instantiate 훅 구현 | **out_of_scope** |

**미매핑 잔차**: 0. **open decision 없음** — substrate/template-home/runtime-logic/agent-cli/live-exec 전부 confirmed(분석문서 + per-project 축 분리).

## Decision
- default_action: pass (전 차원 HIGH, 잔차 0)
- 비고: 라이브 구동은 runner 미설치라 out_of_scope(완결성 계약: stub 미배포). 검증가치 = **테스트가능 runner 헬퍼**(guard 실행체) + 워크플로 구조검증. 위험 변경이라 커밋 전 **연속 이종 리뷰** 필수. 구현 착수.
