# Current Scope: gate-friction-48 (P2 thread)

**Created**: 2026-09-25
**Seed**: docs/harness/seed.yaml (task_id 20260925-130157-a48f, v1)
**Thread-ID**: T-20260925130306-d598
**Thread**: issue #48 gate friction ①-⑤

## Acceptance Criteria
- [x] AC1-commit-landed — 커밋이 실제로 landing했을 때만 cycle-boundary 노트·breadcrumb 해시가 나온다 (#48-5, #48-6, #22)
- [ ] AC2-closeout-same-commit — closeout 변경(seed approved→done)이 코드와 같은 커밋에 있으면 acceptance-gate가 allow한다 (#48-1)
- [ ] AC3-review-window — review-gate가 어제 로컬 날짜의 사이드카도 읽는다 — 해시 바인딩이 관련성을 보장 (#48-2)
- [ ] AC4-verify-commands — 프로젝트 고유 검증 명령을 docs/harness/verify-commands.json에 등록하면 backpressure가 인식한다 (#48-3)
- [ ] AC5-post-commit-ac-guidance — 커밋 뒤에만 참인 AC는 규칙(cycle_definition.md)대로 후속 절차로 옮기도록 게이트가 안내한다 (#48-4)
- [ ] AC6-bump-ready — 다섯 사이클이 하네스 2026.82 범프 준비 상태다 (테스트·CHANGELOG·리뷰·verifier)
