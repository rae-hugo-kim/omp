# Current Scope: seed-lifecycle-contract-114

**Created**: 2026-10-20
**Seed**: docs/harness/seed.yaml (task_id 20261020-025203-da34, v1)
**Issue**: #114

## MUST
- 문서를 코드(acceptance-gate.mjs·thread-scope.mjs·scripts/docs-drift)와 kickoff 스킬에 맞춥니다.

## MUST NOT
- 게이트·스크립트·스킬 코드를 바꾸지 않습니다.
- 허용 목록(docs/rules/·docs/templates/·docs/checklists/·harness-harness_integration_contract.md 잔존면 1단락·docs/harness/ 워크플로 산출물) 밖 파일을 바꾸지 않습니다.

## Acceptance Criteria
- [x] AC1 — seed 템플릿 task_id·estimate, kickoff 출력 계약·rubric 템플릿·체크리스트 5차원과 산출물 7종
- [x] AC2 — active seed·draft→approved 전이를 seed_contract §생애주기 한 곳에 정의하고 closeout·startdev·artifact_roles가 인용
- [x] AC3 — 닫힌 seed 재개 규칙과 version 규칙 통일(startdev preflight 포함)
- [x] AC4 — closeout §2 seed 전체 AC 요구 + integration contract 잔존면
- [x] AC5 — docs-drift 0 errors, 하네스 suite 전 항목 통과, 변경 파일 허용 목록 안
