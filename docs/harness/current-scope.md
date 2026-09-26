# Current Scope: policy-retiering

**Created**: 2026-09-26
**Seed**: docs/harness/seed.yaml (task_id 20260926-041251-0aa9, v1)
**Source**: docs/decisions/002-policy-layer-retiering.md, issue #50

## Acceptance Criteria
- [x] AC1-adr-landed — ADR 002와 영속 사이클 큐(seed + current-scope)가 첫 커밋으로 착지한다
- [x] AC2-sync-prefix-glob — harness-sync.sh가 .omp/rules/harness-*.md 접두사 글롭 항목을 소비자 파일 비접촉으로 동기화한다
- [ ] AC3-rules-moved — rules/*.md 28편이 .omp/rules/harness-<name>.md로 이동하고 규칙집으로 노출된다
- [ ] AC4-harness-core — .omp/rules/harness-core.md(alwaysApply)가 매 요청에 실린다
- [ ] AC5-agents-md-slim — AGENTS.md가 색인·집행 표로 축약되고 rules/가 제거된다
- [ ] AC6-consumer-migration — harness-check/migrate가 소비 리포의 rules/ 고아를 제거하고 링크 치환을 안내한다
- [ ] AC7-personality — templates/PERSONALITY.md가 bootstrap으로 ~/.omp/agent/에 복사된다
- [ ] AC8-closeout-probe — 이슈 #50 완료 기준 1–5가 종합 프로브로 확인되고 PR이 열린다

## Cycles
1. ADR 랜딩 + 큐 생성 (AC1) — 확인: `git log -1 --stat`에 세 파일
2. sync 접두사 글롭 + W3 (AC2) — 확인: 픽스처 sync 후 consumer-x 잔존·harness-old 삭제·harness-wiring 통과
3. rules/ 28편 git mv + frontmatter + 링크 치환 (AC3) — 확인: `omp -p` 프로브에서 `rule://harness-writing_style` 본문, W4·docs-drift 통과
4. harness-core.md (AC4) — 확인: `omp -p` 프로브 출력에 마커 문장
5. AGENTS.md 축약 + INDEX 흡수 + rules/ 제거 + CLAUDEKR (AC5) — 확인: `ls rules` 부재, AGENTS.md에 rules/ 링크 0건, harness-audit 점수 비하락
6. harness-check/migrate 고아 제거 (AC6) — 확인: 픽스처 소비 리포에서 rules/ 부재 + 안내 출력
7. PERSONALITY.md + bootstrap (AC7) — 확인: 임시 HOME 복사 + A/B 프로브에 "Fragments when clearer" 부재
8. 종합 프로브 + verifier + compr PR (AC8) — 확인: PR URL

## Held (의도적 보류)
- TTSR `condition` 도입 — ADR 부속 5, 별도 사이클
- 이슈 #50 완료 기준 6(blender 재측정) — 머지 뒤 절차
