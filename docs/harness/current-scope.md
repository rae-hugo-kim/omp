# Current Scope: autonomy-github-runtime (autonomy Q2 → option A)

**Created**: 2026-06-18
**Seed**: docs/harness/seed.yaml (`autonomy-github-runtime`, v1, task_id 20260618-212940-642a)
**Thread goal**: option-A 런타임 저작 — 검증된 gh-loop을 자율 실행하는 재사용 자산(워크플로 템플릿 + 테스트가능 runner 헬퍼 + 셋업 가이드 + 전파). 라이브 구동은 runner 미설치로 out_of_scope.

## MUST
- `.omp/extensions/harness/gh-loop-runner.mjs` — 이벤트+권한+라벨 → start/resume/ignore 결정, gh seam, 단위테스트 (AC1)
- `templates/` 워크플로 — issue_comment+issues 트리거 → runner 헬퍼 → 에이전트 CLI 헤드리스 (AC2)
- guard policy 실행체 — write+ / 봇·마커 자기제외 / 모호 ignore (AC3)
- runner+secrets 셋업 가이드 — per-project 인프라·결정 명시 (AC4)
- 전파: 템플릿 templates/ + 헬퍼 .omp/extensions/harness/; instantiate-once 문서화 (AC5)
- 머지 자동 금지 유지 (AC6)

## MUST NOT
- 머지 자동화; 라이브 runner 실행/secrets/Codex CI/finding 자동탐지/GitHub-hosted (전부 out_of_scope)

## OUT OF SCOPE
- 라이브 자율 구동(runner 미설치), secrets 프로비저닝, Codex CI 이식, finding 자동탐지, init/migrate instantiate 훅 신설

## Acceptance Criteria
- [x] AC1 runner-decision 헬퍼 + 단위테스트 (start/resume/ignore)
- [x] AC2 templates/ 워크플로 (트리거·가드·에이전트 호출), YAML 유효
- [x] AC3 guard policy 실행체 (권한미달/봇자기/모호 → ignore) 테스트
- [x] AC4 runner+secrets 셋업 가이드 (per-project 인프라/결정)
- [x] AC5 전파 위치(templates/ + .omp/extensions/harness/) + instantiate-once 문서; docs-drift 0/0
- [x] AC6 머지 자동 금지 (헬퍼 테스트 + 템플릿 grep)
