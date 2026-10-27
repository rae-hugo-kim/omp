# Kickoff Output Contract

## Purpose
`kickoff`는 인터뷰를 끝내는 것으로 완료되지 않는다. 후속 단계가 바로 사용할 수 있는 산출물을 남겨야 완료다.

이 문서는 `kickoff`가 생성해야 하는 결과물과 최소 품질 기준을 정의한다.

## Required Outputs

`kickoff` 종료 시 아래 7개 파일이 있어야 합니다. 정본은 kickoff 스킬(`.omp/skills/kickoff/SKILL.md` "Completion: Save & Signal"·"State Management")이며 이 목록은 그와 같습니다.

1. `docs/harness/kickoff-done` — Step 1
2. `docs/harness/kickoff-summary.md` — Step 2
3. `docs/harness/seed.yaml` — Step 3
4. `docs/harness/plan-attack-report.md` — Step 3.5
5. `docs/harness/rubric-report.md` — Step 4
6. `docs/harness/current-scope.md` — Step 6
7. `docs/harness/audit.jsonl` — 전 과정 append

조건부 산출물은 두 가지입니다. seed에 `estimate`가 있으면 `.omp/harness-state/cycle-estimate`(Step 6, 커밋 대상 아님)를 쓰고, `README.md`에 placeholder 마커가 있으면 그 파일을 채우며 그때 `README.en.md`도 자기 마커가 있을 때만 채웁니다(Step 8 — `README.md`에 마커가 없으면 둘 다 건드리지 않습니다).

## Output Roles

### `kickoff-done`
- kickoff 완료 플래그
- `kickoff-detector`가 이 파일을 보고 "/kickoff 먼저" 리마인더를 끕니다.

### `kickoff-summary.md`
- 사람 중심 문서
- 맥락, 의사결정 이유, 예외사항 설명

### `seed.yaml`
- 하네스 중심 문서
- `startdev`와 후속 자동화 입력
- 스키마는 `seed_contract.md`, 템플릿은 `docs/templates/seed.template.yaml`입니다. kickoff는 `status: draft`로 쓰며, 이후 전이는 `seed_contract.md` §생애주기를 따릅니다.

### `plan-attack-report.md`
- 적대적 계획 검증(Plan Attack Gate) 결과
- CRITICAL·HIGH·MEDIUM 발견과 PASS·WARN·BLOCK 판정을 남깁니다(`.omp/rules/harness-adversarial_review.md`).
- 스킬 Step 3.5가 만드는 산출물이지만, `harness-adversarial_review.md` "도입 상태"에 따라 하네스가 담당 에이전트를 보장하지 않는 동안 Plan Attack은 **kickoff 완료 조건이 아닙니다**. 그래서 이 파일과 `adversarial_plan_attack` 행은 Plan Attack을 실행했을 때만 요구합니다.

### `rubric-report.md`
- kickoff 품질 판정 보고서
- 무엇이 충분한지/부족한지 기록
- 형식은 `docs/templates/rubric-report.template.md`입니다.

### `current-scope.md`
- seed의 Scope와 AC를 체크박스로 옮긴 파생물(seed가 원본)
- acceptance-gate가 이 체크박스로 active seed의 커밋을 판정합니다. 이 파일이 없으면 active seed 위의 코드 변경 커밋(risk `medium` 이상)을 acceptance-gate backstop이 막으므로(WIP·override 제외) kickoff가 반드시 만듭니다. 이후 스레드에서는 `thread-scope open`이 재생성합니다(`artifact_roles_contract.md`).

### `audit.jsonl`
- append-only 감사 로그
- 상태 전이와 override 흔적 기록

## Completion Definition

아래를 모두 만족해야 `kickoff completed`로 간주한다.

- Required Outputs 중 `plan-attack-report.md`를 뺀 6개 파일이 모두 있음(`plan-attack-report.md`는 Plan Attack을 실행했을 때만 — 위 Output Roles)
- `audit.jsonl`에 `kickoff_completed`·`seed_generated`·`rubric_evaluated` 기록(Plan Attack을 실행했으면 `adversarial_plan_attack`도)
- Rubric Gate 5개 차원이 모두 `HIGH`/`MEDIUM`이거나 override 기록이 있음

## Rubric Gate

5차원 rubric(명확도 4축 + `coverage`):

- `goal_clarity`
- `constraint_clarity`
- `success_criteria_clarity`
- `context_clarity`
- `coverage` — 원본 요구가 AC로 빠짐없이 옮겨졌는가. doc-ingest 시에는 요구→AC 매핑률, 인터뷰만 했을 때는 Scope(MUST/SHOULD)→AC 매핑률로 잽니다. 미매핑 잔차는 `rubric-report.md`의 `coverage` 줄과 "Unmapped Requirements (Residual)" 목록에 남깁니다.

판정 기준표와 측정 방법은 kickoff 스킬 Step 4, 항목별 점검은 `docs/checklists/kickoff_rubric_checklist.md`에 있습니다.

운영 규칙:

- 하나라도 `LOW`면 기본 동작은 추가 질문
- `coverage`가 `LOW`면 미매핑 요구를 AC로 추가 추출하거나 `out_of_scope`로 명시 배제한 뒤 다시 판정합니다(잔차 0까지).
- 전부 `HIGH` 또는 `MEDIUM`이면 통과
- `LOW`가 있어도 사용자가 명시적으로 원하면 override 가능

## Override Rule

override가 발생하면 아래를 반드시 남긴다.

- `rubric-report.md`에 override 사유
- `audit.jsonl`에 override 이벤트

예:

```json
{"event":"seed_override_approved","meta":{"reason":"Proceeding despite LOW success criteria clarity"}}
```

## Failure Conditions

아래 중 하나라도 해당하면 `kickoff`는 미완료다.

- Required Outputs 중 `plan-attack-report.md`를 뺀 6개 중 하나라도 없음
- 필수 필드 누락
- rubric 결과가 없거나 5개 차원 중 하나라도 빠짐
- `LOW`가 있는데 follow-up 또는 override 기록이 없음
- Plan Attack을 실행해 `BLOCK`이 나왔는데 보완 또는 `adversarial_override` 기록이 없음
- `kickoff-summary.md`와 `seed.yaml`이 서로 다른 목표를 가리킴

## Recommended Flow

kickoff 스킬의 Step 순서와 같습니다.

1. 인터뷰 진행
2. `kickoff-done` 플래그 생성
3. 요약 생성
4. `seed.yaml` 구조화
5. Plan Attack 실행
6. rubric 5차원 판정
7. 부족하면 추가 질문(또는 override)
8. `current-scope.md` 생성
9. audit 기록
10. README placeholder 채우기(조건부)

## Revision Rule

별도 `seed revision` 스킬은 만들지 않는다.

revision이 필요하면:

- `kickoff --revision docs/harness/seed.yaml`
- 또는 기존 seed를 컨텍스트로 재실행

결과:

- `kickoff-summary.md` 갱신
- `seed.yaml` 갱신
- `rubric-report.md` 재생성
- `current-scope.md` 동기화(seed가 원본 — `seed_evolution_policy.md` §수정 절차 4)
- `audit.jsonl`에 `seed_revised` 기록(`version` 증가는 `seed_contract.md` §생애주기의 version 규칙)

## Notes

- kickoff의 목표는 예쁜 문서를 만드는 것이 아니라, 후속 단계의 오해를 줄이는 것이다.
- 산문과 구조화 명세는 둘 다 필요하다.
