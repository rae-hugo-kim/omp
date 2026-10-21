# Startdev Seed Contract

## Purpose
`startdev`는 자유 형식 산문을 해석하는 단계가 아니라, `kickoff`가 만든 구조화 명세를 실행 계획으로 바꾸는 단계다.

이 문서는 `startdev`가 `docs/harness/seed.yaml`을 어떻게 읽고 사용할지 정의한다.

## Primary Input

기본 입력 파일:

```text
docs/harness/seed.yaml
```

보조 입력 파일:

- `docs/harness/kickoff-summary.md`
- `docs/harness/rubric-report.md`

우선순위:

1. `seed.yaml`
2. `rubric-report.md`
3. `kickoff-summary.md`

## Required Preflight Checks

`startdev` 시작 전에 아래를 확인한다.

- `seed.yaml` 존재(없을 때는 아래 "seed가 없을 때" 규칙을 따릅니다)
- YAML 파싱 성공
- 필수 필드 존재
- `acceptance_criteria` 최소 1개
- `status`가 active(`draft` 또는 `approved`)인지 확인합니다. active의 정의는 `seed_contract.md` §생애주기입니다.
  - `approved`면 진행합니다.
  - `draft`면 착수 전에 사용자에게 seed 승인을 묻습니다. 승인을 받는 즉시 `status` 한 줄만 `approved`로 바꿔 단독 커밋으로 HEAD에 올린 뒤 진행합니다(seed가 아직 커밋되지 않았으면 `seed.yaml` 전체가 함께 들어갑니다). kickoff scope의 AC가 모두 미체크라 일반 커밋은 acceptance-gate Check 3가 막으므로 WIP 레인(`OMP_COMMIT_WIP=1 git commit …`)으로 커밋합니다(`seed_contract.md` §생애주기 `draft → approved`). 사용자가 승인을 보류하면 `draft`로 진행할 수 있지만, closeout은 HEAD seed가 `approved`일 때만 마감하므로 closeout 전에 승인을 받아 같은 방법으로 올려야 합니다.
  - `done`/`superseded`(종료상태)면 seed 무효가 아니라 닫힌 작업이므로 중단하고 `seed_contract.md` §생애주기 "닫힌 seed의 재개"의 두 경로를 안내합니다. 같은 기능의 반복이면 `thread-scope open`으로 그 seed를 제자리 reopen(`approved`, `version +1`, `seed_reopened`, 같은 `task_id`)한 뒤 다시 시작하고, 새 기능이면 새 `kickoff`로 새 seed(새 `task_id`)를 만듭니다.

seed가 있는데 위 검사(파싱·필수 필드·AC·status 허용값)에 실패하면:
- 바로 중단
- `kickoff` 또는 `kickoff --revision`을 요구

seed가 없을 때는 입력에 epic 패턴이 있으면 seed 없는 fallback 경로로 진행하고, 입력이 없으면 중단한 뒤 `kickoff`를 요구합니다(`seed_contract.md` Operational Rules).

현재 startdev 스킬(`.omp/skills/startdev/SKILL.md` Phase 0.5)은 이 절과 두 군데가 다릅니다. `draft`를 승인 질문 없이 진행하고, 종료상태 seed에서는 새 `kickoff`만 안내합니다. 스킬 문구를 이 계약에 맞추는 일은 #114 범위 밖이라 후속 이슈로 남깁니다. 그 전이라도 같은 기능의 반복이면 `thread-scope open` 경로를 쓸 수 있고(`seed_contract.md` §생애주기), `draft` seed는 closeout 전에 승인을 받아 `approved` 줄을 HEAD에 올려야 마감됩니다.

## How Each Field Is Used

### `goal`
- 구현 목표의 기준점
- 작업 중 scope drift 판단 기준

### `constraints`
- 비협상 구현 제약
- TDD, 검증, 변경통제 판단에 우선 반영

### `acceptance_criteria`
- TODO/checklist의 소스
- 테스트 플랜의 기본 단위
- 최종 완료 판단의 기준

### `out_of_scope`
- 이번 작업에서 하지 않는 일 (prose). scope drift 방지용
- 에이전트가 구현 중 다시 읽어 자체 제한 (자동 차단 게이트 아님 — scope-gate 폐기됨)

### `assumptions`
- anti-hallucination 검토 입력
- 구현 전에 확인하거나 명시적으로 유지할 전제

### `risks`
- 테스트 우선순위 후보
- 회귀/엣지케이스 탐색 출발점

### `references`
- 브라운필드 탐색 출발점
- 관련 파일과 문서를 좁히는 힌트

## Required Startdev Outputs

`startdev`는 최소한 아래를 내부적으로 또는 문서적으로 생성할 수 있어야 한다.

- acceptance criteria 체크리스트
- 구현 계획 또는 테스트 계획
- scope guard 기준
- assumption 확인 목록
- risk 기반 검증 포인트

## Operational Rules

- `acceptance_criteria`는 가능한 한 개별 작업 단위로 쪼갠다.
- `out_of_scope`는 구현 중 다시 읽을 수 있어야 한다.
- `assumptions` 중 확인이 필요한 것은 초기에 질문 또는 검토 대상으로 올린다.
- `risks`는 검증 순서나 테스트 작성 우선순위에 반영한다.

## Failure Modes

아래 상황은 즉시 중단하거나 수정 요청 대상으로 본다.

- `goal`이 추상적이라 구현 결과가 보이지 않음
- `acceptance_criteria`가 테스트 불가능한 문장뿐임
- `out_of_scope`가 비어 있음
- `assumptions`가 너무 많아 사실상 미정 사항이 대부분임

## Recommended Startdev Behavior

1. `seed.yaml` 파싱
2. 필수 필드 검증
3. `acceptance_criteria`를 구현/테스트 체크리스트로 변환
4. `constraints`와 `out_of_scope`를 guardrail로 노출
5. `assumptions`를 사전 확인 목록으로 정리
6. `risks`를 검증 항목 후보로 정리
7. 구현 착수

## Example

예를 들어 아래 seed가 있으면:

```yaml
acceptance_criteria:
  - 인증 없이 보호 엔드포인트 접근 시 401 반환
  - 유효한 토큰으로 요청 시 정상 응답

out_of_scope:
  - OAuth 도입

risks:
  - 공개 엔드포인트까지 보호될 수 있음
```

`startdev`는 최소한 다음과 같이 읽어야 한다.

- 테스트 1: 무인증 요청 -> 401
- 테스트 2: 유효 토큰 요청 -> 정상 응답
- scope 주의: OAuth 설계로 새로 새지 말 것
- 위험 검증: 공개 엔드포인트 회귀 테스트 추가
