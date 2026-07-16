# Kickoff Summary: harness-telemetry (Q11)

**Date**: 2026-07-10
**Type**: Feature (하네스 인프라)
**Mode**: doc-ingest (Phase -2) — 원본: `claudedocs/harness-auto-capture-analysis.md#Q11`

### JTBD
- User: 하네스 유지보수자 (rae) — 전 프로젝트에 harness-sync로 배포되는 하네스의 소유자
- Problem: 하네스 자산(게이트/스킬/규칙)이 실제로 얼마나 쓰이고 지켜지는지 측정할 수 없어 하네스 자체를 평가·정리(마찰 게이트 개선, 미사용 자산 퇴역)할 근거가 없다. 기존 로깅(breadcrumb=작업 내용, audit.jsonl=kickoff 이벤트)은 이 축을 커버하지 않는다.
- Success: 중앙 vault∪spool 병합본에서 수동 스크립트 한 번으로 프로젝트×버전별 게이트 기회/차단/회복(마찰 후보)·스킬 사용 빈도·미사용 자산 후보를 뽑을 수 있다.

### Context
- Repo type: 하네스 소스 레포 (docs+게이트, package.json 없음)
- Tech: gates = stdin-JSON node CLI (.mjs), 확장 = OMP extension (index.ts), 테스트 = `node --test tests/*.test.mjs` (342/342 기준선)
- 선례 패턴: breadcrumb-tracker(no-LLM append), sum-vault 백업(fail-open, SUM_VAULT_DIR), audit.jsonl(append-only)
- 전파: `.omp/extensions/harness` 통째 sync(수집 로직 자동 전파), `scripts/`는 비전파(평가 스크립트는 소스 레포 전용으로 충분 — 집계는 vault에서 수행)
- 확인된 사실: omp 16.3.15 task/executor.ts가 preloadedExtensionPaths를 child 세션에 전달 → 서브에이전트 세션에도 확장 재바인딩 (parent 연결 신호만 실측 필요)

### Scope
- MUST: 캡처(runGate execution/decision + tracker kind 분리 + 스킬 3경로 상관-소비 dedup + 세션 identity 5필드 + mermaid in-process), commit-gates child 분해, per-event vault+global spool 이중 append(event_id·project_id), telemetry-report(vault∪spool 병합), capture→report 관통 검증, 문서/전파/회귀
- MUST NOT: blocking 경로 일절, 이벤트별 push, LLM, worker 오귀속
- OUT OF SCOPE: 대시보드/데몬/배치, 실시간 알림, 자동 삭제, 백필, worker 분리 리포팅(v2)

### Acceptance Criteria
seed.yaml의 AC1~AC9 (per-AC source 앵커 = Q11.2/Q11.3-A1~A10 + plan-attack HIGH-4). 요약: 게이트 계측 / commit-gates 분해 / 스킬 3경로 / 세션 경계(오귀속 방지·대체 충족 출구) / 수집(event_id·project_id, vault+spool, 병합 catch-up) / 평가 스크립트(마찰 후보 명명) / in-process 커버리지 / e2e 관통(AC9) / 전파·문서·회귀.

### Backpressure
- Method: 단위테스트(신규 usage writer·collector·report 픽스처) + 기존 게이트 스위트 + docs-drift
- Command: `node --test tests/*.test.mjs` · `scripts/docs-drift`

### 인터뷰 기록 (residual만 — doc-ingest 잔차 3건, 2026-07-10 사용자 결정)
1. 서브에이전트 귀속: v1 main 기준 합산 (오귀속 금지 — worker_session_id 보존, parent 매핑 검증 시만 합산)
2. target_fp: 상대경로 그대로 (vault=private)
3. 평가 실행: 수동 스크립트 (배치/크론 비범위)

### Supersession
이전 seed `autonomy-multisession-controller`(20260619-153030-f28d, status: draft, 구현은 bc30ed0로 출하됨)를 관례대로 대체 — 구 seed는 git 히스토리 보존.

---
Kickoff complete. Ready for implementation.
Next: `/startdev` or manual planning.
