# Current Scope: linked-worktree-version-check-68 (P2 thread)

**Created**: 2026-10-12
**Seed**: docs/harness/seed.yaml (task_id 20261012-190000-68a1, v1)
**Thread-ID**: T-20261012144730-49ec
**Thread**: gh-loop #68 worker: linked worktree version-check

## Acceptance Criteria
- [x] AC1 — "링크드 워크트리 세션에서 STALE 대신 BEHIND MAIN(메인 커밋 meta가 최신) / STALE (linked worktree)(메인도 뒤처짐) 안내가 나오고 /skill:harness-check 지시가 없다 — 격리 임시 리포 + git worktree add fixture 테스트이고 캐시 키 분리(별도 캐시 파일)를 포함한다."
- [x] AC2 — "harness-check 스킬이 링크드 워크트리에서 안내 후 중단하며 --force-worktree로만 진행한다(스킬 문서 + 절차), README ko/en 한 줄과 CHANGELOG [Unreleased] 한 줄이 있다."
- [x] AC3 — "메인 체크아웃·단일 체크아웃·소스 리포·하네스 없는 리포의 기존 출력이 불변(기존 테스트 통과)이고 Linux 전체 suite skip 0, node scripts/docs-drift 0 errors/0 warnings이다."
- [x] AC4 — "비범위가 지켜진다 — scripts/harness-sync.sh 워크트리 모드, 과거 갈라진 소비 리포 복구, index.ts·backpressure-*.mjs·repo-root.mjs 수정이 diff에 없고, 이 이슈의 dispatch 튜플이 audit.jsonl에 gh_loop_dispatched(issue 68)로 있다."
