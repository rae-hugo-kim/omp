# Current Scope: repo-root-windows-physical-resolve-99 (P2 thread)

**Created**: 2026-10-12
**Seed**: docs/harness/seed.yaml (task_id 20261012-153300-99a7, v1)
**Thread-ID**: T-20261012063859-a892
**Thread**: gh-loop #99 worker: repo-root physicalResolve Windows root generalization

## Acceptance Criteria
- [x] AC1 — "path.win32 주입 테스트에서 physicalResolve('C:\\r\\x')·('C:/r/x')가 C:\\r\\x로 해석되고 UNC 1건이 포함되며 repoToplevel이 fixture(인메모리 fs) 루트를 돌려줍니다 — 수정 전 코드에서 FAIL, 수정 후 PASS가 PR에 기록됩니다."
- [x] AC2 — "POSIX 기존 테스트와 link/.. 계약이 전부 통과하고 Linux 전체 suite의 skip 수가 0입니다."
- [x] AC3 — "통합 계약 Known residual surfaces(cross-repo·Windows native)에 #99 수정과 MSYS 미변환 residual이 기록되고, README ko/en Windows 행의 C:\\… 귀속 문구가 실제 상태(#93 absolutize + #99 repo-root, 실기 미검증)로 정정되며, CHANGELOG [Unreleased]에 항목이 있고 node scripts/docs-drift가 0 errors/0 warnings입니다."
- [x] AC4 — "비범위가 지켜집니다 — MSYS 경로 변환, #100, Windows CI 러너가 diff에 없고, 이 이슈의 dispatch 튜플이 audit.jsonl에 gh_loop_dispatched(issue 99)로 있습니다."
