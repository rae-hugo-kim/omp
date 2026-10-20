---
description: "3-pass adversarial verification layer: reviewer + heterogeneous adversary + code-reviewer, evidence tuples"
---
# Adversarial Review Policy

<!-- Harness: the only adversarial layer live under OMP is the 3-pass code review (reviewer + adversary panel + code-reviewer); the plan/test/completion-attack steps are documented below with their actual status -->

이 문서는 하네스 시스템의 적대적 검증(adversarial verification) 계층을 정의한다.
**현재 실제로 도는 적대 계층은 "3-pass 코드 리뷰"뿐이다** — `reviewer`가 Pass 2로 adversary 패널 4명, Pass 3로 `code-reviewer`를 스폰하고, 그 결과(JSON tuple 사이드카)를 `review-gate`가 high/critical 커밋에서 요구한다. 아래 "3개 게이트 정의"의 plan/test/completion-attack은 kickoff·startdev 스킬 단계이며, 이 하네스가 보장하는 담당 에이전트가 없어 소비 리포에서는 실행 주체를 전제할 수 없다("도입 상태" 참조). 이 문서의 CRITICAL 판정 기준과 심각도 정의는 두 계층에 공통이고, override 기록은 계층마다 다르다(3-pass 리뷰 = `review-skip` tuple → `review_override`, attack 단계 = `adversarial_override` — "블로킹 해제" 참조).

관련 문서: [`.omp/rules/harness-quality_gates.md`](harness-quality_gates.md), [`.omp/rules/harness-harness_integration_contract.md`](harness-harness_integration_contract.md)

---

## 원칙

- **3-pass 리뷰는 게이트가 증거를 요구하는 방식으로 강제된다**: high/critical 커밋은 `review-gate`가 2차 관점 증거 없이는 통과시키지 않는다 — 인정되는 증거는 reviewer의 JSON tuple 사이드카, 사람 리뷰 사이드카(`["omp-review-evidence/v1", <hash>, "PASS", null, <이름>, <이름>]`), 감사된 override(`docs/harness/review-skip` tuple → `audit.jsonl` `review_override`) 셋이다(`review-gate.mjs`; 통합 계약 Known-Failure Matrix). reviewer 3-pass는 그 증거를 에이전트가 만드는 경로이며 코드 커밋 앞에 돌리는 것이 SHOULD다(`harness-agent_routing.md`) — 어떤 게이트도 reviewer를 자동 스폰하지 않는다. plan/test/completion-attack 단계의 "자동 실행"은 아래 "도입 상태"의 조건이 충족될 때만 성립한다.
- **CRITICAL 블로킹**: CRITICAL 판정 시 수정 없이 다음 단계로 진행 불가.
- **구조적 증거 수집**: 프레이밍(framing)이 아닌 템플릿 기반 반대 증거를 수집한다. (OMC A/B 테스트 #1240 결론 반영)
- **기존 규칙 확장**: completion-attack은 `verifier`의 독립 완료 검증(`AGENTS.md` Completion Contract)을 대체하지 않고 확장하는 설계다 — 다만 OMP에서는 아직 실행된 적이 없다("도입 상태").
- **우회 경로 변경의 리뷰 입력**: 게이트에 면제·skip·override 경로를 추가하거나 넓히는 변경은 리뷰 컨텍스트에 위조 시나리오를 명시한다 — 신뢰 근거가 워크트리 파일·환경변수처럼 호출자가 쓸 수 있는 곳에 있는가, env로 삭제·실행 경로가 열리는가. (2026-09-05 provenance 게이트: 이 질문으로 이종 리뷰가 HIGH 2건을 잡음 — docs/decisions/001-consumer-safe-sync.md)

---

## 3-pass 코드 리뷰 불변식 (실행 토폴로지 공통)

3-pass 적대 리뷰(`.omp/agents/reviewer.md`)는 실행 토폴로지가 둘이다 — depth 0 세션이 reviewer 에이전트를 스폰하거나, task capability를 가진 depth 1 세션이 프로토콜을 직접 수행한다(진입점 우선순위와 디스패치 preflight: [`.omp/rules/harness-agent_routing.md`](harness-agent_routing.md)). 어느 토폴로지든 아래 3개 불변식이 동일하게 적용된다 — 수행 주체의 유연성(에이전트든 세션이든)은 게이트 우회가 아니다.

1. **이종성 증거는 실측만**: 사이드카의 models 배열은 reviewer 자신의 `model_change` 레코드 **전부**와 자식(adversary 패널의 각 멤버) 트랜스크립트의 **마지막** `model_change`(최종 출력을 낸 모델)를 실측해 기재한다. 자기 신고·thread id·세션 id는 증거가 아니다. 패널(2026-10-19~, [`.omp/rules/harness-agent_routing.md`](harness-agent_routing.md) "adversary 패널")에서는 **완료**(최종 출력에 파싱 가능한 `## Verdict` 라인이 있고 Findings/Clean Areas가 diff의 `file:line`을 하나 이상 인용함 — 거부·블로커 메시지·잘린 보고·`file:line` 없는 verdict는 실패)된 멤버의 마지막 모델만 배열에 들어가고, 이종성은 소스 단위로 판정한다: 완료된 멤버 하나 이상의 마지막 모델이 reviewer의 어느 레코드에도 속하지 않는 계열일 때만 성립하며, reviewer 자신의 교차 계열 폴백과 멤버의 startup selector는 두 번째 계열이 아니다(소스가 하나면 관점도 하나다). 소스별(멤버 4 + self + code-reviewer) 수치는 리뷰와 같은 basename의 `docs/reviews/review-<ts>.panel.jsonl`이 받는다(추적 파일인 `audit.jsonl`에는 리뷰 중 쓰지 않는다 — diff 해시가 어긋난다).
2. **리뷰 수행 세션 ≠ 변경 작성 세션**: 세션이 프로토콜을 직접 수행하는 경로에서 Pass 1(셀프 분석)의 독립성 조건이다. 변경을 작성한 세션이 자기 변경을 Pass 1으로 심사하면 self-review bias 제거라는 프로토콜의 목적이 무너진다.
3. **게이트는 JSON tuple 사이드카만 검증**: review-gate는 `docs/reviews/review-<ts>.json`의 고정 arity tuple만 읽는다. 수행 주체가 무엇이든 증거 형식과 검증 경로는 같다.

4. **Pass 1의 모델도 실측한다 (요청 selector 금지)**: Pass 1의 모델은 실행 중 바뀔 수 있으므로, 사이드카에는 자기 트랜스크립트의 `model_change` 레코드(폴백 포함)를 실측해 기재한다. 요청한 selector를 그대로 적으면 실제로 심사한 모델이 증거에서 빠진다.

   실측 근거(2026-07-30, precommit-gate-enforcement 5라운드 전건): `@slow`(=`anthropic/claude-fable-5`)가 **적대 리뷰의 우회 프로브 단계에서 매번 `Refusal (cyber)`를 반환**했고, `retry.fallbackChains`가 세션을 `anthropic/claude-opus-5`로 옮겨 pass 1의 47~80%가 opus에서 수행됐다. 사이드카 5건 모두 primary만 기재해 이 사실이 증거에서 누락됐다. 계열(anthropic)이 같아 이종성 판정은 불변이었으나, **"기록되지 않은 대체"라는 결함 유형 자체가 발생**했다. 거부는 프로브가 공격 도구로 분류되기 때문이며, 회피 대상이 아니라 회계 대상이다 — 폴백을 막지 말고 기재하라.

5. **디스패치 전 라우팅 프로브**: 이종 리뷰가 필요한 커밋에서 reviewer를 스폰하기 전, 패널 멤버 경로 원샷 프로브(한 줄 응답 + 트랜스크립트 `model_change` 실측 — 2026-10-19 `ProbeSol`/`ProbeOpus`/`ProbeArgon` 4.7~6.9초)로 비주계열 프로바이더 인증을 확인한다. 로컬 크리덴셜 존재("로그인됨" 표시)는 서버측 토큰 유효성의 증거가 아니다 — 유효성은 첫 API 호출에서야 판명된다.

   실측 근거(2026-08-03, docs/sum/session_2026-08-03_pr-cleanup-gate-override-codex-auth.md): openai-codex 토큰이 서버측 회수된 상태에서 adversary/code-reviewer 스폰 5회 전부 1.6~3.9초 만에 0바이트 즉사(`authentication token has been invalidated`), 리뷰어가 7분 완주한 뒤에야 이종성 불성립이 판명되어 감사 오버라이드로 우회했다. 프로브 1회(~5초)가 완주 후 발견보다 싸다.

부기 — 세션 수행 경로의 모델 회계: Pass 1의 모델은 `@slow`가 아니라 그 세션의 모델이며, 이종성(≥2 distinct family) 판정의 기준 계열도 세션 모델 계열이다.

부기 — 가용성 판단: `omp usage`의 100% 표시는 모델을 쓸 수 없다는 증거가 아니다. 2026-09-26 openai-codex 7d 창이 100%로 보였지만 omp는 이를 `warning`으로 분류했고 `gpt-6-astra` 요청은 정상 응답했다. 이종 패스를 포기하거나 우회하기 전에 5번의 원샷 프로브로 확인한다. 불변식 2의 보완(독립 Pass 1)에는 비작성 세션만 있으면 되고, 다른 모델 계열은 필요하지 않다.

---

## 3개 게이트 정의 (스킬 단계 — 하네스 게이트가 아니다)

세 "게이트"는 `.omp/extensions/harness/gates/`의 파일 게이트가 아니라 kickoff(Step 3.5)·startdev(GATE 1.5, GATE 3 후) 스킬의 **프롬프트 단계**다. 설계 당시(Claude Code + oh-my-claudecode 시절 — 이 문서는 2026-06-10 `8f9d689`에서 OMP로 포팅됐다)의 담당 에이전트는 OMC의 `critic`·`test-engineer`·`architect`였다. 이 하네스는 그 에이전트를 배포하지 않고(정의·동기화 대상은 `scripts/harness-sync.sh:216-223`의 7종), omp는 `.claude/agents` 루트를 건너뛰며 Claude 마켓플레이스 플러그인의 `agents/`는 Claude 플러그인/사용자 소스가 켜져 있을 때만 읽는다(`enabledProviders`에 `claude-plugins` 또는 `claude`, 혹은 `CLAUDE_CONFIG_DIR` 설정 — `omp://task-agent-discovery.md:148,159`; 2026-10-20 기준 호스트는 `[]`). 소비 리포에 그 설정을 전제할 수 없으므로 아래 표는 설계와 **하네스가 보장하는 대응 에이전트**를 나란히 적는다.

| Gate | 트리거 위치 | 검증 대상 | 설계 담당(OMC — 하네스 미배포) | 하네스가 보장하는 대응 에이전트 | 블로킹 조건 |
|------|------------|----------|------------------------|------------------------------|------------|
| `plan-attack` | kickoff `seed.yaml` 생성 후 | `seed.yaml` | critic (opus) | `adversary` 패널 멤버(`.omp/agents/adversary*.md` — 코드 리뷰 프롬프트라 seed 공격 템플릿은 호출자가 공급) 또는 `task` | 1회차: WARN만, 2회차+: CRITICAL 시 BLOCK |
| `test-attack` | startdev GATE 1 후 | `docs/harness/test-plan.md` | test-engineer (sonnet) | `task`(테스트 계획 공격 템플릿 공급) | CRITICAL 시 즉시 BLOCK |
| `completion-attack` | startdev GATE 3 후 | 구현 결과 전체 | architect (opus) + security-reviewer (opus) + test-engineer (sonnet) 병렬; 불일치 시 critic (opus) 합의 | `verifier`(AC 대비 누락 — 기존 architect 역할) + OMP 번들 `security-reviewer` + `task`(테스트 커버리지); 합의 조정자는 미정 | CRITICAL 시 BLOCK |

### 도입 상태 (2026-10-20 실측, `docs/harness/audit.jsonl`)

| 단계 | 실행 기록 | 상태 |
|------|-----------|------|
| `plan-attack` | `adversarial_plan_attack` 2건 — 2026-07-10(task 20260710-180439-3771, PASS), 2026-07-29(task 20260729-132948-e510, WARN) — `actor: critic`은 스킬 템플릿이 고정한 값이라(`kickoff/SKILL.md:308`) 어느 에이전트가 실제로 돌았는지의 증거는 아니다 | Phase 1로 도입됐으나 2026-07-29 이후 실행 0건 — 하네스가 보장하는 담당 에이전트 없음 |
| `test-attack` | `adversarial_test_attack` 1건 — 2026-07-30(task 20260729-132948-e510, BLOCK) — actor `test-engineer` | Phase 2(미승인) 상태에서 1회 실행된 기록만 있음; 이후 0건 |
| `completion-attack` | `adversarial_completion_attack` 0건 | 실행된 적 없음 |

OMP에서 이 단계들을 다시 살리려면 kickoff·startdev 스킬의 호출 에이전트를 위 "하네스가 보장하는 대응 에이전트" 열로 바꾸는 별도 작업이 필요하다(이슈 #113 범위 밖 — seed/kickoff 생애주기 묶음; 그때까지 두 스킬은 발견되지 않는 에이전트 이름을 그대로 부른다). 그때까지 이 세 단계는 **완료 조건이 아니며**, `checklists/verify.md`도 이를 요구하지 않는다. 완료 검증 주체는 `verifier`, 코드 품질의 적대 검증은 3-pass 리뷰다.

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
2. **사용자 명시적 override**: attack 단계(plan/test/completion)는 `docs/harness/audit.jsonl`에 `adversarial_override` 이벤트 기록 후 진행. 3-pass 리뷰(`review-gate`)는 이 행을 읽지 않는다 — 그 계층의 override는 `docs/harness/review-skip` tuple이며 게이트가 `review_override`로 기록·소비한다("원칙" 첫 항목, `review-gate.mjs`).
3. **PASS 이후의 low 항목**: 사이드카는 diff 해시에 바인딩되므로 PASS(WITH NOTES)를 받은 diff는 동결하고, 남은 low·문서 정밀도 항목은 커밋 뒤 **별도 docs 커밋**에서 고친다 — 같은 diff를 손대면 해시가 바뀌어 재리뷰 라운드가 필요하다(2026-09-29 #56 r10, `docs/sum/session_2026-09-29_issue56-closeout-ac-record-pr59.md` D4).

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

## completion-attack과 `verifier` 완료 검증의 관계

완료 검증의 주체는 `verifier`다 — `AGENTS.md` Completion Contract와 [`.omp/rules/harness-agent_routing.md`](harness-agent_routing.md)가 요구하는 "AC가 있으면 verifier를 스폰하고 verdict가 도착한 뒤에만 완료 선언"은 **그대로 유지**된다(설계 당시의 OMC 전역 규칙 "NEVER complete without Architect verification"이 이 자리에 있었고, `verifier`가 그 역할을 이어받았다).

completion-attack은 그 위에 추가 계층을 얹는 설계다:

- `verifier`: AC 대비 누락·범위 이탈 확인(기존 architect 역할 — 변경 없음)
- `security-reviewer`(OMP 번들): 보안 취약점 관점 추가
- 테스트 커버리지·엣지 케이스 관점: 설계 담당 `test-engineer`는 OMP에 없으므로 `task` 에이전트에 공격 템플릿을 공급해 대신한다
- 3개 병렬 실행; 판정 불일치 시의 합의 조정자(설계: critic)는 OMP에서 미정

즉, completion-attack = verifier 완료 검증 + security + test 관점 병렬화 — 단, OMP에서 실행된 적은 없다("도입 상태").

---

## 롤아웃 계획과 현재 위치

| Phase | 내용 | 전제 조건 | 현재 위치(2026-10-20) |
|-------|------|---------|----------------------|
| Phase 1 | `plan-attack`만 먼저 도입 | - | 2회 실행 기록(2026-07-10·07-29, audit `actor: critic`); 이후 하네스가 보장하는 담당 에이전트가 없어 0회 |
| Phase 2 | `test-attack` + `completion-attack` 추가 | Phase 1 검증 완료 후 | 미승인. `test-attack`은 2026-07-30 1회 실행 기록이 있으나 Phase 1 검증 완료 판정은 없었다; `completion-attack`은 0회 |

Phase 2는 Phase 1 운영 결과를 확인한 뒤 활성화한다. 미검증 상태에서 Phase 2를 활성화하지 않는다. OMP에서 Phase 1을 다시 살리는 것(kickoff 스킬의 호출 에이전트 교체)은 별도 작업이다.

---

## Self-Check

- [ ] 해당 게이트의 트리거 조건이 충족되었는가?
- [ ] CRITICAL 판정 시 3조건 모두 증거와 함께 명시했는가?
- [ ] override 발생 시 `audit.jsonl`에 `adversarial_override` 이벤트를 기록했는가?
- [ ] 산출물 파일이 올바른 경로에 생성되었는가?
- [ ] completion-attack을 실행했다면 `verifier`의 AC 검증이 포함되었는가? (실행하지 않았다면 verifier verdict만으로 완료 조건을 채운다)
