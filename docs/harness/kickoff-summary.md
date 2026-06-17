# Kickoff Summary: intent-ingest-fidelity-framework

**Date**: 2026-06-17 · **task_id**: 20260617-145852-04c2 · **Seed**: `docs/harness/seed.yaml`
**원본 상위 문서(ingest source)**: `claudedocs/harness-auto-capture-analysis.md` (Q1–Q9 + 설계 초안 v1)

> 이 요약은 사람용. 전체 분석·근거는 위 분석 doc이 SST. 본 kickoff는 그 doc을 **수동 doc-ingest**하여 seed로 증류한 dogfood다.

## 동기 (JTBD)
- **User**: 이 하네스로 작업하는 개발자(본인).
- **Problem**: `sum` 스킬은 수동·고아 문서; kickoff seed는 수기 PRD보다 thin; **반복(P2) 작업은 충실도 게이트가 0** — 대화+sum로만 흘러 추적 안 됨.
- **Success**: "포괄적 상위 문서를 잘 줬을 때 충실하게 구현되는 틀". 편하게 작업해도 알아서 잡고, 빠진 게 있으면 질문으로 되돌려 답을 얻어냄.

## 설계 (v1)
- **모드 = 입력 2신호 자동결정**: active seed 有無(P1 초기화/P2 반복) × 문서 제공 與否(인제스트-우선/인터뷰-우선). 문서 있으면 인터뷰는 구멍 메우개로 축소.
- **볼륨→산출물**: 무게=고도(P1 풀 seed / P2 AC append), 인터뷰 길이=입력 풍부함 역비례.
- **coverage 불변식(한 불변식 두 시점)**: authoring-coverage(seed가 원본 doc 덮나) + runtime-coverage(seed가 지금 하는 일 덮나=L2). 큰 시드면 draw-down으로 대부분 침묵, 벗어날 때만 발화.
- **P2 자가감지 2층**: L1(대화 중 in-agent, silent append/질문) + L2(커밋 시 acceptance-gate backstop). push→pull — 빠진 건 질문으로 당김.
- **역할 3-tier**: `seed`=durable SSOT(체크대상, bounded) · `current-scope`=스레드 작업목표(bounded) · `audit.jsonl`=provenance/satisfaction 원장(유일 성장).

## 핵심 결정
- **(가) seed=feature-unit durable**: 반복은 seed revise + thread-scope, 새 기능이면 새 seed. 스레드 경계는 L1이 겸판.
- **richer 스키마**: per-AC `must`/`should`/`verify`/`source` (기존 seed 선례). `seed_contract.md`(flat)와 drift — 정합은 out_of_scope.
- **첫 슬라이스 = AC4+AC6+AC7** (P2 충실도 최소 루프): 기계적·신뢰가능, 게이트-0 구멍 직접 차단.

## Out of Scope (deferred)
24/7 자율·robo-omp · 멀티세션(Q3) · GitHub 루프(Q2) · auto-memory 재구축(Q1) · CI workflow · seed_contract 정합.

## 다음
seed `draft` → rubric 통과 → (사용자 승인 `approved`) → slice 1 구현(`startdev`).
