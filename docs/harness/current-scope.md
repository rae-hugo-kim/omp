# Current Scope: harness-telemetry (Q11)

**Created**: 2026-07-10
**Seed**: docs/harness/seed.yaml (`harness-telemetry`, v2, task_id 20260710-180439-3771)
**Thread goal**: 각 세션의 하네스 사용(게이트 기회·판정/스킬 호출/세션 메타)·준수를 no-LLM append-only로 캡처, vault+global spool 이중 append로 수집, 배치 집계로 하네스 자체 평가(차단·회복 마찰 후보/스킬 빈도/미사용 후보). 전신 = 분석 doc Q11 (doc-ingest).

## MUST
- usage writer(캡처): runGate 계측(execution/decision 분리, tracker kind 분리) + 스킬 3경로(command/read/message, dedup) + 세션 경계(worker/parent/aggregation_session_id) + mermaid-check in-process 계측 (AC1/AC3/AC4/AC7)
- commit-gates 디스패처 child별 구조화 기록 (AC2)
- 수집: per-event `$SUM_VAULT_DIR/_harness/<project_id>/` append + user-global spool `~/.omp/harness-telemetry-spool/<project_id>/` 미러, event_id·project_id 조인 키, fail-open (AC5)
- 평가: `scripts/telemetry-report` — vault∪spool event_id 병합, 기회/차단/회복(마찰 후보) 집계·스킬 빈도·infra_error 분리·unknown 표기 (AC6)
- capture→report 관통 통합 검증 — 실제 writer 산출물 + 부분 누락 병합 복원, 타 디렉토리 실행 (AC9)
- 전파·문서·회귀: README 한/영 + AGENTS.md 표, docs-drift 0/0, 게이트 스위트 그린 (AC8)

## MUST NOT
- 텔레메트리가 게이트 판정/작업을 막는 어떤 경로도 금지 (전 층 fail-open)
- 이벤트별 git push, LLM 호출, 상시 프로세스
- parent 매핑 불가 worker 이벤트의 main 추측 귀속·폐기

## OUT OF SCOPE
- 대시보드/데몬/정기 배치(ecc2 경계), 실시간 알림, 미사용 자산 자동 삭제, 타 프로젝트 백필, 서브에이전트 세션별 분리 리포팅(v2)

## Acceptance Criteria
- [ ] AC1 게이트 계측 — runGate 이벤트(execution/decision/failure_reason/ms/target_fp) + tracker kind 분리, 단위테스트
- [ ] AC2 commit-gates child 분해 — child별 {gate,status,duration,failure} 구조화, 차단자 식별 단위테스트
- [ ] AC3 스킬 관측 3경로 — command/read/message + invocation_key dedup, 단위테스트
- [ ] AC4 세션 경계 — session_id/parent_session_id/aggregation_session_id, rotate, 오귀속 방지 테스트 + parent 연결 실측 증거(해석 불가 판명 시 관찰 기록+null-잔류 테스트로 대체 충족)
- [ ] AC5 수집 — event_id·project_id 부여, vault+spool 이중 append, vault 유/무 fail-open 단위테스트, event_id 병합 catch-up
- [ ] AC6 평가 스크립트 — 픽스처 기반 집계 단위테스트 (recovery join, infra_error, unknown)
- [ ] AC7 mermaid-check in-process 계측 — 경고 시 usage 이벤트 존재
- [ ] AC9 capture→report 관통 — writer 실산출물 통합 테스트 + 부분 누락 event_id 병합 복원(타 디렉토리 실행)
- [ ] AC8 전파·문서 — README/AGENTS 갱신, docs-drift 0/0, 전체 스위트 그린
