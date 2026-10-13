# Current Scope: gh-loop-conditional-auto-merge-105 (P2 thread)

**Created**: 2026-10-13
**Seed**: docs/harness/seed.yaml (task_id 20261013-043500-105a, v1)
**Thread-ID**: T-20261013042239-791e
**Thread**: gh-loop #105 worker: conditional auto-merge

## Acceptance Criteria
- [x] AC1 — "SKILL 코디네이터 절에 조건 1~6·반드시 질문 목록·`## 정책에 따라 자동 머지` 기록 양식(auto-merged 마커)이 있고, 워커 Stage 5 양식이 조건 체크리스트를 포함하며, 발행·force-push·브랜치 보호 항상 승인제 문장이 있습니다."
- [x] AC2 — "통합 계약(harness-harness_integration_contract)에 HITL 머지 예외 조건 1단락이 있고, gh-fanout 순차 처리 절에 참조 1줄이 있으며, CHANGELOG [Unreleased]에 항목이 있습니다."
- [x] AC3 — "node scripts/docs-drift가 0 errors/0 warnings이고 하네스 suite(node --test .omp/extensions/harness/tests/*.test.mjs)가 통과합니다(문서만이라 변화 없음)."
- [x] AC4 — "비범위가 지켜집니다 — 자동 발행·범프 승인 생략·option A 러너·gh-loop-record.mjs 이벤트 추가·코드 파일 수정이 diff에 없고, 이 이슈의 dispatch 튜플이 audit.jsonl에 gh_loop_dispatched(issue 105)로 있습니다."
