# Current Scope: gh-loop-status-labels-69

**Created**: 2026-10-02
**Seed**: docs/harness/seed.yaml (task_id 20261002-114256-f70f, v1)
**Source**: issue #69, gh-loop

## Acceptance Criteria
- [x] AC1-gh-loop-labels — gh-loop 결정 게이트가 이슈와 PR 양쪽에 `needs-decision`을 붙이고 acted 시 양쪽에서 떼며, 워커 시작 시 `agent-working`을 붙인다고 SKILL.md에 서술된다
- [x] AC2-compr-and-issue-classification — compr가 PR 생성 시 `needs-review`를 붙이고, sum 5.5 등 이슈 생성 경로에 분류 규칙이 있다
- [x] AC3-label-bootstrap — 스킬이 세 라벨을 없으면 만든다(설명·색 고정)
- [x] AC4-fanout-controller-tests — gh-fanout·controller의 `gh-loop:in-progress`/`gh-loop:blocked`가 새 라벨로 전환되고 테스트가 갱신되며, runner에 PR 댓글 ignore 회귀 테스트가 있다
- [x] AC5-verification — `node --test .omp/extensions/harness/tests/*.test.mjs` 전부 통과, `node scripts/docs-drift` OK
- [x] AC6-session-decision — SKILL.md에 세션 직접 결정 경로(R7)가 서술되고, 이슈·PR에 `세션에서 직접 결정함` 댓글(원 질문 링크·결정 요지·지시 원문·`gh-loop:session-decision:<nonce>`, 실행했으면 `acted`)을 남기며, 재개 로직이 그 댓글을 해당 nonce의 답으로 인정하고 러너는 무시한다(회귀 테스트 포함)
- [x] AC7-worker-launch-extension — SKILL.md Stage 0의 워커 기동·재개 명령이 코디네이터의 Orca 상태 확장 경로를 넘기고(`command omp --extension …`), 값이 없을 때의 안내가 서술된다
