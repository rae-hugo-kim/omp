# Current Scope: adversary-panel-two-135

**Created**: 2026-11-16
**Seed**: docs/harness/seed.yaml (task_id 20261116-053149-135b, v1)
**Issue**: #135 — 사용자 결정 B(2026-11-16, 코디네이터 세션): 패널 2명(`adversary`·`adversary-opus`), `adversary-argon` 퇴역

## MUST
- `adversary-argon.md`를 삭제하고 `reviewer.md`·규칙·스킬·`AGENTS.md`·`CLAUDEKR.md`·`harness-sync.sh`·`CHANGELOG.md`를 5종/2인으로 맞춥니다.
- 패널 절에 결정·근거(v18.18.4 중지, 같은 계열로 조용히 대체된 실측)와 "이종 증거는 `@advisor` 한 곳에 의존"을 사실대로 적습니다.

## MUST NOT
- `@advisor` 롤·`code-reviewer` 모델·`modelRoles`를 바꾸지 않습니다.
- 세 번째 계열(선택지 A·C)을 추가하지 않습니다.
- 게이트·스크립트 로직은 화이트리스트 한 줄 삭제 외에 건드리지 않습니다.

## Acceptance Criteria
- [x] AC1 — `.omp/agents/adversary-argon.md` 삭제, `reviewer.md` `spawns`(3)·패널 표·스폰 템플릿·`wait` 대기 문구(BOTH)·행 스키마 설명·Cross-Validation 소스·element 3 예시·보고 템플릿이 2인 패널
- [x] AC2 — routing :7(5종, sync `:216-221`)/:26/:32/:34/:41(이종 증거 `@advisor` 의존 + 게이트 차단 → 사람 리뷰·override)/:42(2인 + 퇴역 문단), adversarial_review :9/:37/:49, integration_contract :29/:131/:134/:154/:174, harness-check :77, harness-surface :10, AGENTS.md :27/:149, CLAUDEKR.md :38/:149 — 5종/2인
- [x] AC3 — `harness-sync.sh:219` 삭제, CHANGELOG `[Unreleased]` 퇴역 항목 + 소비 리포 `rm .omp/agents/adversary-argon.md` 안내
- [x] AC4 — `adversary-opus.md` 본문 == `adversary.md`(cmp MIRROR_IDENTICAL); 남은 `argon` 참조는 reviewer.md:51(퇴역 날짜 주석)·adversarial_review:37(2026-10-19 프로브 이력)·routing:42(퇴역·#112 이력 문단)·harness-check:77(수동 삭제 안내)·harness-friction SKILL:109(산문 예시)뿐
- [x] AC5 — `friction.mjs models` 지적 0건(AGENT-MODEL·AGENT-PROSE·RULE-MODEL 모두 0)
- [x] AC6 — `node --test .omp/extensions/harness/tests/*.test.mjs` 813/813 pass, `node scripts/docs-drift` OK (0 errors, 0 warnings)
