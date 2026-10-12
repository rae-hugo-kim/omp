# Current Scope: harness-sync-retire-repo-root-canonical-100 (P2 thread)

**Created**: 2026-10-12
**Seed**: docs/harness/seed.yaml (task_id 20261012-173000-100c, v1)
**Thread-ID**: T-20261012082351-e202
**Thread**: gh-loop #100 worker: harness-sync retire REPO_ROOT canonicalization

## Acceptance Criteria
- [x] AC1 — "REPO_ROOT가 _realdir로 정규화되고, git shim으로 `rev-parse --show-toplevel`을 다른 표기로 강제한 fixture에서 hand-off·비hand-off 두 경로 모두 pristine retired 파일이 삭제되는 테스트가 통과하며, 수정 전 코드에서 비hand-off만 FAIL이었다는 근거가 PR에 기록됩니다."
- [x] AC2 — "Linux 전체 suite가 통과하고 skip이 0이며 node scripts/docs-drift가 0 errors/0 warnings입니다."
- [x] AC3 — "비범위가 지켜집니다 — MSYS 경로 변환 일반화·Windows CI·#99 외 sync 로직 변경이 diff에 없고, CHANGELOG [Unreleased]에 항목(Windows 실기 미검증 명시)이 있으며, 이 이슈의 dispatch 튜플이 audit.jsonl에 gh_loop_dispatched(issue 100)로 있습니다."
