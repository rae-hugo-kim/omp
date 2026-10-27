# Kickoff Rubric Checklist

## Purpose
이 체크리스트는 `kickoff`가 끝났을 때 바로 구현에 들어가도 되는지 판정하기 위한 최소 기준이다.

판정 축은 5개입니다(명확도 4축 + `coverage`). kickoff 스킬 Step 4와 `docs/rules/kickoff_output_contract.md` Rubric Gate가 같은 5축을 씁니다.

- `goal_clarity`
- `constraint_clarity`
- `success_criteria_clarity`
- `context_clarity`
- `coverage`

## Rating Scale

### HIGH
- 추가 질문 없이 구현/검증 착수 가능

### MEDIUM
- 구현은 가능하나 follow-up 질문 1~2개 권장

### LOW
- 지금 착수하면 오해, 재작업, scope drift 위험 큼

## Checklist

### 1. Goal Clarity
- [ ] 작업 목표를 한 문장으로 설명할 수 있다
- [ ] 결과물이 무엇인지 분명하다
- [ ] 목표가 여러 개로 섞여 있지 않다
- [ ] bug fix / feature / refactor 중 성격이 드러난다

판정:
- HIGH: 위 항목 대부분이 명확함
- MEDIUM: 목표는 알겠지만 경계가 흐림
- LOW: 무엇을 만들지 자체가 모호함

### 2. Constraint Clarity
- [ ] 반드시 지켜야 할 제약이 적혀 있다
- [ ] 기존 시스템/운영 환경 제약이 드러난다
- [ ] 금지사항 또는 비협상 조건이 있다
- [ ] 제약이 `out_of_scope`와 혼동되지 않는다

판정:
- HIGH: 구현 중 지켜야 할 선이 분명함
- MEDIUM: 일부 제약은 보이지만 누락 있음
- LOW: 제약이 거의 없거나 지나치게 추상적임

### 3. Success Criteria Clarity
- [ ] acceptance criteria가 하나 이상 있다
- [ ] 각 AC가 관찰/테스트 가능한 문장이다
- [ ] 완료 여부를 pass/fail로 볼 수 있다
- [ ] "잘", "적절히", "충분히" 같은 모호한 표현이 적다

판정:
- HIGH: 테스트 또는 검증 기준이 분명함
- MEDIUM: 방향은 맞지만 일부 문장이 모호함
- LOW: 완료 판정 기준이 사실상 없음

### 4. Context Clarity
- [ ] 브라운필드라면 관련 파일/패턴이 적혀 있다
- [ ] 그린필드라도 범위와 전제가 적혀 있다
- [ ] references가 실제로 유용한 경로를 가리킨다
- [ ] assumptions가 사실과 구분되어 적혀 있다

판정:
- HIGH: 필요한 맥락이 충분하다
- MEDIUM: 일부 맥락은 있으나 더 확인 필요
- LOW: 맥락이 거의 없어 구현 방향이 흔들릴 수 있음

### 5. Coverage
- [ ] 원본 요구(doc-ingest면 원본 문서의 요구, 인터뷰만 했으면 Scope의 MUST/SHOULD)마다 AC가 1개 이상 매핑돼 있다
- [ ] 매핑하지 않은 요구는 `out_of_scope`에 명시 배제돼 있다
- [ ] doc-ingest로 도출한 AC는 출처 앵커(`source:` 또는 인라인 `src:`)를 가진다
- [ ] 미매핑 잔차가 `rubric-report.md`의 "Unmapped Requirements (Residual)"에 적혀 있다(없으면 "없음")

판정:
- HIGH: 모든 원본 요구가 AC 1개 이상으로 매핑되고 잔차가 0이다
- MEDIUM: 대부분 매핑됐고 소수 잔차를 명시했다
- LOW: 다수 요구가 미매핑이거나 매핑표가 없다

## Decision Rule

- `LOW`가 하나라도 있으면 기본은 follow-up 질문
- `coverage`가 `LOW`면 미매핑 요구를 AC로 추가 추출하거나 `out_of_scope`로 배제한 뒤 재판정한다(잔차 0까지)
- 전부 `HIGH` 또는 `MEDIUM`이면 통과
- override 시 이유를 `rubric-report.md`와 `audit.jsonl`에 남긴다

## Output Stub

```md
# Rubric Result

- goal_clarity: HIGH|MEDIUM|LOW
- constraint_clarity: HIGH|MEDIUM|LOW
- success_criteria_clarity: HIGH|MEDIUM|LOW
- context_clarity: HIGH|MEDIUM|LOW
- coverage: HIGH|MEDIUM|LOW (매핑 <mapped>/<전체 요구 − out_of_scope>, 잔차 <N>)

## Unmapped Requirements (Residual)
- ...

## Blocking Issues
- ...

## Recommended Follow-up
- ...

## Decision
- default_action: proceed | ask_followup_questions
- override_allowed: yes
```
