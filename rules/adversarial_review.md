# Adversarial Review Policy

<!-- Harness: adversarial gates are automatic triggers, not opt-in -->

이 문서는 하네스 시스템의 적대적 검증(adversarial verification) 계층을 정의한다.
모든 게이트는 자동 트리거이며, CRITICAL 판정 시 다음 단계 진행을 블로킹한다.

관련 문서: [`rules/quality_gates.md`](quality_gates.md), [`rules/harness_integration_contract.md`](harness_integration_contract.md)

---

## 원칙

- **자동 트리거**: 모든 적대적 검증은 해당 단계에 자동 실행된다. 옵트인 아님.
- **CRITICAL 블로킹**: CRITICAL 판정 시 수정 없이 다음 단계로 진행 불가.
- **구조적 증거 수집**: 프레이밍(framing)이 아닌 템플릿 기반 반대 증거를 수집한다. (OMC A/B 테스트 #1240 결론 반영)
- **기존 규칙 확장**: completion-attack은 기존 Mandatory Architect Verification을 대체하지 않고 확장한다.

---

## 3-pass 코드 리뷰 불변식 (실행 토폴로지 공통)

3-pass 적대 리뷰(`.omp/agents/reviewer.md`)는 실행 토폴로지가 둘이다 — depth 0 세션이 reviewer 에이전트를 스폰하거나, task capability를 가진 depth 1 세션이 프로토콜을 직접 수행한다(진입점 우선순위와 디스패치 preflight: [`rules/agent_routing.md`](agent_routing.md)). 어느 토폴로지든 아래 3개 불변식이 동일하게 적용된다 — 수행 주체의 유연성(에이전트든 세션이든)은 게이트 우회가 아니다.

1. **이종성 증거는 실측만**: 사이드카의 models 배열은 자식(adversary) 트랜스크립트의 `model_change` 레코드 실측으로만 기재한다. 자기 신고·thread id·세션 id는 증거가 아니다.
2. **리뷰 수행 세션 ≠ 변경 작성 세션**: 세션이 프로토콜을 직접 수행하는 경로에서 Pass 1(셀프 분석)의 독립성 조건이다. 변경을 작성한 세션이 자기 변경을 Pass 1으로 심사하면 self-review bias 제거라는 프로토콜의 목적이 무너진다.
3. **게이트는 JSON tuple 사이드카만 검증**: review-gate는 `docs/reviews/review-<ts>.json`의 고정 arity tuple만 읽는다. 수행 주체가 무엇이든 증거 형식과 검증 경로는 같다.

부기 — 세션 수행 경로의 모델 회계: Pass 1의 모델은 `@slow`가 아니라 그 세션의 모델이며, 이종성(≥2 distinct family) 판정의 기준 계열도 세션 모델 계열이다.

---

## 3개 게이트 정의

| Gate | 트리거 위치 | 검증 대상 | 담당 에이전트 | 블로킹 조건 |
|------|------------|----------|--------------|------------|
| `plan-attack` | kickoff `seed.yaml` 생성 후 | `seed.yaml` | critic (opus) | 1회차: WARN만, 2회차+: CRITICAL 시 BLOCK |
| `test-attack` | startdev GATE 1 후 | `docs/harness/test-plan.md` | test-engineer (sonnet) | CRITICAL 시 즉시 BLOCK |
| `completion-attack` | startdev GATE 3 후 | 구현 결과 전체 | architect (opus) + security-reviewer (opus) + test-engineer (sonnet) 병렬; 불일치 시 critic (opus) 합의 | CRITICAL 시 BLOCK |

---

## CRITICAL 판정 기준

다음 **3조건을 동시 충족**해야 CRITICAL로 판정한다.

1. 요구사항 미충족, 보안 취약점, 또는 데이터 손실 가능성이 존재한다.
2. 수정 없이 진행하면 후속 단계에서 반드시 실패한다.
3. 구체적 증거를 제시한다 (`file:line` 인용 또는 `seed.yaml` 필드 인용).

3조건 중 하나라도 빠지면 CRITICAL이 아니다.

---

## 심각도 정의

| 심각도 | 판정 기준 | 블로킹 여부 |
|--------|----------|------------|
| **CRITICAL** | 3조건 동시 충족 (위 참고) | 블로킹 |
| **HIGH** | 엣지 케이스 미처리, 성능 문제 | 블로킹 안함 (명시적 해결 권고) |
| **MEDIUM** | 개선 가능하나 동작에는 지장 없음 | 블로킹 안함 |

---

## 블로킹 해제

1. **정상 해제**: CRITICAL 항목 수정 후 해당 게이트 재실행.
2. **사용자 명시적 override**: `docs/harness/audit.jsonl`에 `adversarial_override` 이벤트 기록 후 진행.

---

## 산출물 경로

| 게이트 | 산출물 경로 |
|--------|------------|
| `plan-attack` | `docs/harness/plan-attack-report.md` |
| `test-attack` | `docs/harness/test-attack-report.md` |
| `completion-attack` | `docs/harness/completion-attack-report.md` |
| 감사 로그 (공유) | `docs/harness/audit.jsonl` |

`test-attack-report.md`는 `test-plan.md`와 별도 파일이다. 혼동하지 않는다.

---

## audit.jsonl 이벤트 스키마

기존 `audit.jsonl`의 `{ts, event, actor, meta}` 스키마를 그대로 사용하며,
`adversarial_` 접두사 이벤트로 공존한다.

| event 이름 | 발생 시점 |
|-----------|---------|
| `adversarial_plan_attack` | plan-attack 완료 시 |
| `adversarial_test_attack` | test-attack 완료 시 |
| `adversarial_completion_attack` | completion-attack 완료 시 |
| `adversarial_override` | 사용자 override 발생 시 |

`meta` 필드 포함 항목: `task_id`, `run_count`, `result` (PASS / WARN / BLOCK), `findings` (배열).

예시:

```jsonl
{"ts":"2026-03-31T10:00:00Z","event":"adversarial_plan_attack","actor":"critic","meta":{"task_id":"abc123","run_count":1,"result":"WARN","findings":["seed.yaml: acceptance_criteria 항목 누락 (line 12)"]}}
```

---

## completion-attack과 기존 Architect Verification의 관계

기존 oh-my-claudecode 전역 규칙 "NEVER complete without Architect verification"은 **그대로 유지**된다.

completion-attack은 그 위에 추가 계층을 얹는다:

- architect 에이전트: 기존 역할 유지 (변경 없음)
- security-reviewer (opus): 보안 취약점 관점 추가
- test-engineer (sonnet): 테스트 커버리지·엣지 케이스 관점 추가
- 3개 에이전트 병렬 실행; 판정 불일치 시 critic (opus)이 합의 조정

즉, completion-attack = 기존 architect verification + security + test 관점 병렬화.

---

## 롤아웃 계획

| Phase | 내용 | 전제 조건 |
|-------|------|---------|
| Phase 1 | `plan-attack`만 먼저 도입 | - |
| Phase 2 | `test-attack` + `completion-attack` 추가 | Phase 1 검증 완료 후 |

Phase 2는 Phase 1 운영 결과를 확인한 뒤 활성화한다. 미검증 상태에서 Phase 2를 활성화하지 않는다.

---

## Self-Check

- [ ] 해당 게이트의 트리거 조건이 충족되었는가?
- [ ] CRITICAL 판정 시 3조건 모두 증거와 함께 명시했는가?
- [ ] override 발생 시 `audit.jsonl`에 `adversarial_override` 이벤트를 기록했는가?
- [ ] 산출물 파일이 올바른 경로에 생성되었는가?
- [ ] completion-attack 실행 시 architect 에이전트가 여전히 포함되었는가?
