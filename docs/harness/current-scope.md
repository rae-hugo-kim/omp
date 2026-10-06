# Current Scope: harness-ci-archive-leak-backstop-30 (P2 thread)

**Created**: 2026-10-06
**Seed**: docs/harness/seed.yaml (task_id 20261006-064500-30ci, v1)
**Thread-ID**: T-20261006064500-30ci
**Thread**: gh-loop #30 worker: harness-ci.yml(검사 3종) + 템플릿·README + 통합 계약 갱신

## Acceptance Criteria
- [x] AC1 — ".github/workflows/harness-ci.yml이 push(main)·pull_request에서 3 job(archive-leak·harness-suite·docs-drift)을 돌리고, 아카이브 유출 검사는 docs/sum·docs/reviews·docs/brainstorming을 커밋된 트리 기준으로 로컬 .githooks/pre-push 로직을 재사용해 검사합니다."
- [x] AC2 — "templates/github-workflows/harness-ci.yml이 라이브 워크플로와 바이트 동일하고, templates/github-workflows/README.md에 1회 복사 안내와 조정 지점(테스트 경로·브랜치명·Node 버전·docs-drift 소스 전용)이 있으며 루트 README에 CI 단락이 있습니다."
- [x] AC3 — "하네스 suite와 node scripts/docs-drift가 통과하고, 통합 계약 harness-harness_integration_contract.md의 Known residual surfaces가 서버측 백스톱 도입·잔여를 서술하도록 갱신됩니다."
