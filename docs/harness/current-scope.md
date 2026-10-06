# Current Scope: cross-repo-guard-15 (P2 thread)

**Created**: 2026-10-06
**Seed**: docs/harness/seed.yaml (task_id 20261006-064353-6223, v1)
**Thread-ID**: T-20261006064439-84a2
**Thread**: gh-loop #15 worker: cross-repo guard ①②③

## Acceptance Criteria
- [x] AC1 — "세션 리포 밖 파일에 대한 edit/write(및 bash 리터럴 경로 mutation: rm/mv/cp/tee/sed -i/출력 리다이렉션 등)가 대상 리포 규율 파일(AGENTS.md > CLAUDE.md > .cursorrules) read 증명 없이는 tool_call에서 {block:true}로 BLOCK됩니다 (negative test: 미로드 상태의 외부 write/edit/bash → block)."
- [x] AC2 — "대상 리포 규율 파일을 read(read-log.txt에 기록)한 뒤에는 동일 mutation이 통과하고, 규율 파일이 없는 외부 리포는 경고만 남기고 통과합니다 (positive test 쌍)."
- [x] AC3 — "규율·하네스를 가진 외부 리포 대상 git commit/push는 read 증명과 무관하게 BLOCK되고 대상 리포 세션(cwd = 대상 리포) 안내를 출력합니다 — `cd X && git commit`, `git -C X commit`, `git -C X push`, bash -c 래핑 네 형태 모두 (negative test)."
- [x] AC4 — "대상 리포를 정적으로 해석할 수 없는 커밋/푸시 명령(`cd \"$DIR\" && git commit`, `pushd`, `eval`, `env -C`, 커밋이 감지됐는데 대상이 0개)은 fail-closed로 BLOCK되고 해석 불가 사유를 출력합니다 (negative test)."
- [x] AC5 — "docs/harness/acceptance-done은 mtime 기준 24h 뒤 만료됩니다: stale 플래그는 무시되고 'HARNESS WARNING … stale' 경고가 출력되며(negative test: 2일 전 mtime → 미체크 AC로 exit 2), 신선한 플래그는 기존대로 통과합니다. review-skip의 diff-hash 바인딩은 기존 그대로입니다."
- [x] AC6 — "회귀 없음: 세션 리포 내 mutation/commit과 같은 리포의 git 링크드 워크트리(Orca 카드) 대상 edit·commit은 외부 리포로 판정되지 않고 통과하며(positive/negative 쌍: 워크트리 vs 별도 리포), 하네스 suite(node --test .omp/extensions/harness/tests/*.test.mjs) 전부 통과, node scripts/docs-drift 0 errors/0 warnings, 이 이슈의 dispatch 튜플이 audit.jsonl에 gh_loop_dispatched(issue 15)로 있습니다."
