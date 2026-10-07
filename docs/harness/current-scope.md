# Current Scope: windows-runtime-defects-93 (P2 thread)

**Created**: 2026-10-07
**Seed**: docs/harness/seed.yaml (task_id 20261008-030013-1286, v1)
**Thread-ID**: T-20261007180128-1dee
**Thread**: gh-loop #93 worker: Windows runtime defects (review-gate crypto hash, cross-repo isAbsolute)

## Acceptance Criteria
- [x] AC1 — "review-gate가 `shasum`을 호출하지 않고 Node crypto(`createHash('sha256')`)로 `git diff --cached`/`git diff HEAD`의 stdout Buffer를 해시하며, 기존 테스트의 diff_hash 기대값이 그대로 통과하고 shasum 대조 테스트 1건(shasum이 있는 환경에서만 실행, 없으면 사유 skip)이 추가됩니다. `git`이 실패한 경우의 `null`/UNVERIFIED 경로는 유지됩니다(git diff 실패를 주입하는 fail-closed 테스트)."
- [x] AC2 — "cross-repo guard가 `path.isAbsolute`로 절대 경로를 판정하고, Windows 스타일 절대 경로(`C:\\x`, `C:/x`, `\\\\srv\\share`)를 입력하는 단위 테스트가 플랫폼 무관하게 도는 순수 함수 수준으로 추가됩니다. `link/..` 비정규화 계약 테스트는 그대로 통과합니다."
- [x] AC3 — "`git-commit-detect.mjs`·`cross-repo.mjs`에서 `startsWith('/')` 류의 POSIX 절대 경로 가정을 grep한 목록이 PR 본문에 기록되고(수정은 발견분만), 통합 계약 'Cross-repo guard residuals'에 Windows 경로 주의가 한 줄 추가됩니다."
- [x] AC4 — "하네스 suite(node --test .omp/extensions/harness/tests/*.test.mjs, Linux) 전부 통과, node scripts/docs-drift 0 errors/0 warnings. 수정은 게이트 파일(review-gate·cross-repo·git-commit-detect 발견분)과 테스트·계약 한 줄에 한정됩니다."
