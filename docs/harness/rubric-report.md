# Rubric Report: autonomy-github-hitl-loop (autonomy Q2)

**Date**: 2026-06-18 · **Seed**: `docs/harness/seed.yaml` v1 · **task_id**: 20260618-171252-5e29
**Mode**: doc-ingest (real) ← `claudedocs/harness-auto-capture-analysis.md#Q2` (L108-165)

## 판정 (4 clarity + coverage)

| 차원 | 판정 | 근거 |
|---|---|---|
| `goal_clarity` | HIGH | 결과 중심 goal — option-D PoC 자산(스킬+헬퍼+컨벤션+전파), 런타임 deferral 명시 |
| `constraint_clarity` | HIGH | 8개 제약 실행가능 — 저작만/머지 자동금지/HITL 종료/dedup/재사용/PATHS 등록 |
| `success_criteria_clarity` | HIGH | AC1–6 전부 `verify` 보유, 관찰가능(스킬 포맷·헬퍼 단위테스트·PATHS grep·docs-drift) |
| `context_clarity` | HIGH | source 앵커 + 레포 선례 grounding(compr `gh pr create` L90, harness-sync PATHS L92-119) |
| **`coverage`** | **HIGH** | Q2 요구 → AC 6개 매핑 + 명시 out_of_scope, 미매핑 잔차 0 (아래) |

## coverage 매핑 (원본 Q2 요구 ↔ AC)

| Q2 요구 (source) | 귀속 |
|---|---|
| 루프 스킬 finding→issue→fix→PR→cross-verify→HITL (Q2.0/Q2.3-D/Q2.7-2) | AC1 |
| needs-decision HITL 컨벤션 + stateless-resumable + 사용자응답 최우선 (Q2.2/Q2.4) | AC2 |
| finding→issue dedup/throttle/라벨 (Q2.4/Q2.5) | AC3 |
| 머지 자동금지·교차검증 advisory·루프 한도 (Q2.5) | AC4 |
| issue→fix→PR→cross-verify 기존자산 재사용 (Q2.4) | AC5 |
| 신규 스킬 harness-sync 전파 (Q2.8/Q2.9) | AC6 |
| 옵션 A 런타임(Actions/runner/issue_comment) (Q2.7-3) | **out_of_scope** (검증 후 별도 seed) |
| Codex CI 이식 (Q2.5) · finding 자동탐지 (Q2.7-4) · 옵션 B 데몬 (Q2.3-B) · 라이브 실행 (Q2.0) | **out_of_scope** |

**미매핑 잔차**: 0. 모든 Q2 요구가 AC≥1 또는 out_of_scope. **open decision 없음** — Q2.7 staging + Q2.1 축분리가 substrate/artifact/detection/finding-source/repo 포크를 PoC 기준 이미 해소.

## Decision
- default_action: pass (전 차원 HIGH, 잔차 0)
- override_used: no
- 비고: doc-ingest. 런타임(옵션 A)은 레포에 runner/`.github/` 부재로 라이브 검증 불가 → 명시 out_of_scope(완결성 계약: stub 미배포). PoC = 자산+헬퍼 단위테스트(gh seam)로 완결 검증. 구현 착수.
