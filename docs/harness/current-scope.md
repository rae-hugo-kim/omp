# Current Scope: windows-fifo-probe-triage-98 (P2 thread)

**Created**: 2026-10-12
**Seed**: docs/harness/seed.yaml (task_id 20261012-142500-98f1, v1)
**Thread-ID**: T-20261012054226-6f47
**Thread**: gh-loop #98 worker: Windows FIFO probe + failure triage + upgrade docs

## Acceptance Criteria
- [x] AC1 — "win32에서 mkfifo exit 0 뒤 lstat ENOENT(또는 FIFO 아님)는 throw가 아니라 사유 있는 capability 없음(skip 사유)이 되고 POSIX에서는 여전히 throw하며, 플랫폼을 주입해 양쪽을 tests/capabilities.test.mjs가 고정하고 Linux 전체 suite의 skip 수는 0으로 유지됩니다."
- [x] AC2 — "29건 실패 묶음 분류표(테스트 파일:행 / 분류 / 근거 / 처분)가 PR 본문과 #98 댓글에 있고, 런타임 결함으로 분류된 항목은 별도 이슈 번호를 가지며, 실기 확정이 불가능한 항목은 '실기 재검증 필요'로 표시됩니다."
- [x] AC3 — "harness-check 스킬과 README ko/en에 Windows 업그레이드 재정규화 단락(git add --renormalize .omp scripts .githooks, sync 스크립트가 CRLF일 때의 우회)이 있고 node scripts/docs-drift가 0 errors/0 warnings입니다."
- [x] AC4 — "비범위가 지켜집니다 — 분류표의 런타임 결함 수정, 테스트 재설계, Windows CI 러너 추가가 diff에 없고, 이 이슈의 dispatch 튜플이 audit.jsonl에 gh_loop_dispatched(issue 98)로 있습니다."
