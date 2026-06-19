# Current Scope: autonomy-finding-detection (autonomy Q2.7-4)

**Created**: 2026-06-19
**Seed**: docs/harness/seed.yaml (`autonomy-finding-detection`, v1, task_id 20260619-142403-fddb)
**Thread goal**: gh-loop 입력 자동화 — 소스(breadcrumb FAIL / lint·리뷰 JSON)에서 finding 추출 → dedup/throttle → 이슈 계획. 추출/계획 로직만(생성은 기존 Stage 1); 스케줄은 out_of_scope.

## MUST
- `.omp/extensions/harness/gh-loop-detect.mjs` — `fromBreadcrumb(entries)`→findings + `planIssues(findings,{existing,cap})`→decisions(decideIssue 재사용, 배치 dedup + throttle) + CLI (AC1/AC4)
- breadcrumb 어댑터: FAIL 추출 + **coarse type라 suppression 안 함**(emit + dedup/cap) (AC2)
- 제네릭 `--from json` 입력 (lint/리뷰 확장) (AC3)
- gh-loop SKILL에 auto-detect 진입 명문화 (생성은 기존 Stage 1) (AC5)
- 헬퍼 `.omp/extensions/harness/` 전파 (AC6)

## MUST NOT
- 신규 이슈 생성 로직(기존 Stage 1 재사용), 스케줄/트리거, lint/리뷰 파서 자체, 품질 ML (out_of_scope)

## OUT OF SCOPE
- 언제 자동탐지 도느냐(스케줄/트리거 = option-A·per-project), 라이브 이슈 생성, 외부 파서, finding 우선순위/품질판정

## Acceptance Criteria
- [x] AC1 planIssues 배치 계획(decideIssue 재사용, 배치 dedup, throttle) 단위테스트
- [x] AC2 fromBreadcrumb 모든 FAIL emit(coarse type→suppression 없음) + 동일 type FAIL 제목 동일(dedup) 단위테스트
- [x] AC3 제네릭 `--from json` 입력 CLI 테스트
- [x] AC4 existing-dedup + cap-throttle 단위테스트
- [x] AC5 gh-loop SKILL auto-detect 진입 + Stage 1 재사용 명시
- [x] AC6 헬퍼 위치(.omp/extensions/harness/) + docs-drift 0/0
