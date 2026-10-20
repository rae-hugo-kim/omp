# Seed Contract

## Purpose
`seed.yaml`은 `kickoff`의 구조화 산출물이며, `startdev`와 후속 검증 단계가 공통으로 읽는 1급 입력이다.

이 문서의 목표는 다음 두 가지다.

- 사람이 읽는 요약과 별개로, 하네스가 기계적으로 해석 가능한 명세 형식을 고정한다.
- `startdev`, 검증, scope drift 점검(Surgical Changes·PR 리뷰), anti-hallucination 규칙이 동일한 기준을 보도록 만든다.

## Scope
이 계약은 `docs/harness/seed.yaml`에 적용된다.

비목표:
- DDD 수준의 복잡한 `ontology_schema`
- event sourcing
- generation loop
- 별도 MCP 백엔드

## Required Fields

필수 필드:

- `version`
- `status`
- `task_id`
- `goal`
- `constraints`
- `acceptance_criteria`
- `out_of_scope`
- `assumptions`
- `risks`
- `references`

## Field Semantics

### `version`
- 정수
- 초기값은 `1`
- 증가 조건은 아래 §생애주기의 "version 규칙" 한 곳에서 정합니다(내용 수정·reopen마다 +1, 생애주기 전이는 면제).

### `task_id`
- 문자열
- kickoff 시 자동 생성
- 형식: `YYYYMMDD-HHMMSS-<4자리 랜덤 hex>`
- 동일 태스크의 재실행 구분에 사용 (audit.jsonl과 연결)
- 수동 편집하지 않는다

### `status`
- 허용값: `draft`, `approved`, `superseded`, `done`
- `kickoff` 직후 기본값은 `draft`
- 각 값의 의미, active 판정, 전이 주체는 아래 §생애주기가 정의합니다.
- `done`: **작업 완료(closeout) 종료상태.** 작업이 끝나 main에 도달했을 때 closeout 절차가 `approved → done`으로 마킹하고 `completed: <YYYY-MM-DD>`를 동반한다. `superseded`(다른 seed로 대체됨)와 구분 — `done`은 "끝남", `superseded`는 "교체됨". **둘 다 종료상태라 acceptance-gate는 active AC로 취급하지 않는다**(닫힌 작업의 AC는 새 작업을 막지 않음).

### `completed`
- 선택 필드. `status: done`일 때만 동반(closeout이 기록).
- 형식: `YYYY-MM-DD` (작업이 완료되어 main에 도달한 날짜).

### `goal`
- 한 문단 또는 짧은 여러 줄 텍스트
- "무엇을 만들거나 바꾸는지"를 결과 중심으로 적는다

### `constraints`
- 문자열 배열
- 반드시 지켜야 하는 기술/운영/정책 제약

### `acceptance_criteria`
- 배열이며 항목은 아래 두 형식 중 하나입니다.
  - **문자열형**: `- 인증 없이 보호 엔드포인트 접근 시 401 반환`
  - **객체형**: `- id: AC1` 뒤에 한 단계 더 들여 쓴 `title:`과 선택 필드(`source:`·`must:`·`verify:` 등)를 둡니다. `title:`이 없으면 `current-scope.md`에 id만 남으므로 씁니다. kickoff의 `source:` 앵커 컨벤션과 `thread-scope.mjs`의 `parseAC`가 이 형식을 읽으며, `thread-scope open --ac <id,…>`로 AC를 골라 여는 기능은 `id`가 있는 객체형에서만 동작합니다.
- 완료 여부를 검증 가능한 문장으로 적는다
- 모호한 표현 대신 관찰 가능한 결과를 쓴다

### `out_of_scope`
- 문자열 배열
- 이번 작업에서 하지 않는 일
- scope drift 방지용 필수 항목

### `assumptions`
- 문자열 배열
- 증거가 아니라 현재 전제하는 사항
- anti-hallucination 규칙과 연결되는 핵심 필드

### `risks`
- 문자열 배열
- 실패 가능성, 회귀 위험, 검증 사각지대

### `references`
- 객체 배열
- 각 객체는 최소 `path`, `reason`을 가진다

예:

```yaml
references:
  - path: docs/harness/kickoff-summary.md
    reason: 원본 킥오프 요약
```

### `estimate`
- 선택 필드 (`.omp/rules/harness-cycle_definition.md` "예상 레코드"). 인터뷰 종료 시점의 **예측**이며 실측이 아니다.
- 객체: `risk` (`low`|`medium`|`high`|`critical` — risk-assess taxonomy, 폭발 반경), `files` (정수), `depth` (`low`|`high` — 추론 깊이, `risk`와 독립 축), `model` (문자열), `effort` (문자열 또는 null).
- kickoff Step 6이 `.omp/harness-state/cycle-estimate`로 파생하고, 커밋 착지 시 review-gate가 실측과 대조해 `audit.jsonl`에 `estimate_vs_actual`로 남긴다. **어떤 게이트 판정에도 관여하지 않는다.**

```yaml
estimate:
  risk: medium
  files: 3
  depth: high
  model: claude-fable-5-1
  effort: high
```

## 생애주기 (status · active · version)

seed의 상태 전이와 "active seed"의 정의는 이 절 한 곳에서 정합니다. `closeout_contract.md`·`startdev_seed_contract.md`·`artifact_roles_contract.md`·`seed_evolution_policy.md`는 이 절을 인용하며, 정의가 어긋나면 이 절과 아래에 적은 코드 동작이 우선합니다.

### 상태와 active 판정

| status | active | closeout 대상 | 근거 코드 |
|---|---|---|---|
| `draft` | 예 | 아니요 | acceptance-gate Check 2·3, `thread-scope.mjs`, docs-drift `closeoutConsistency` |
| `approved` | 예 | 예 | 위와 같음 + closeout 절차(`closeout_contract.md` §1), acceptance-gate closeout landing |
| `done` | 아니요 | — | acceptance-gate Check 2(닫힌 seed) |
| `superseded` | 아니요 | — | acceptance-gate Check 2(닫힌 seed) |

- **active seed**는 `docs/harness/seed.yaml`이 있고 top-level `status`가 `draft` 또는 `approved`인 seed입니다. active seed의 AC는 `current-scope.md` 체크박스로 커밋을 막고(acceptance-gate), `thread-scope open`은 그 seed를 그대로 씁니다. acceptance-gate는 `done`·`superseded`가 아닌 값을 모두 active로 다루므로 `status` 줄이 없거나 허용값이 아닌 seed도 게이트에서는 active입니다. 이런 seed는 위 Validation Rules에서 무효이니 고쳐서 씁니다.
- **closeout 대상은 `approved`뿐입니다.** compr/compush의 closeout 절차는 `approved`만 마감하고, acceptance-gate는 HEAD seed가 `approved`일 때만 closeout landing을 인정하며, docs-drift의 "Closeout pending" 경고도 `approved`에만 납니다. 따라서 `draft` seed는 게이트에는 걸리지만 그대로는 마감되지 않습니다.

### 전이

| 전이 | 주체 | version | 기록 |
|---|---|---|---|
| (생성) → `draft` | kickoff Step 3 | `1` | `seed_generated` |
| (생성) → `approved` | 사용자가 이미 승인한 명세(이슈 본문·handoff 문서·세션 지시)에서 seed를 만드는 에이전트(gh-loop 워커 Stage 2 선례) | `1` | git 커밋 |
| `draft` → `approved` | 사용자 승인을 받은 에이전트가 `status` 한 줄을 수정합니다. 이 전이를 수행하는 스크립트·게이트는 없습니다. | 그대로 | git 커밋 |
| `approved` → `done` | closeout 절차(`closeout_contract.md` §3) | 그대로 | `task_closed` |
| `draft`/`approved`/`done` → `superseded` | 다른 seed로 대체할 때(seed 자리를 새 작업에 넘길 때 포함) 에이전트가 수정합니다. | 그대로 | `seed_superseded`(관행 — 이 이벤트를 쓰는 코드는 없습니다) + git 커밋 |
| `done`/`superseded` → `approved` (reopen) | `thread-scope open` | +1 | `seed_reopened` |

**`draft → approved`**: 사용자가 seed를 구현할 명세로 승인했을 때만 바꿉니다. 시점은 startdev preflight입니다. seed가 `draft`면 착수 전에 사용자에게 seed 승인을 묻고, 승인을 받는 즉시 `status` 한 줄만 `approved`로 바꿔 **단독 커밋으로 HEAD에 올립니다**. 이때는 kickoff가 만든 scope의 AC가 모두 미체크라 acceptance-gate Check 3가 docs 전용 커밋도 막으므로 WIP 레인으로 커밋합니다(`OMP_COMMIT_WIP=1 git commit …` 또는 `.omp/harness-state/commit-wip` — 커밋마다 `acceptance_wip` 감사 행이 1건 남습니다). 승인 없이 `approved`로 바꾸지 않습니다. 사용자가 승인을 보류하면 `draft`로 진행할 수 있지만 그 seed는 마감할 수 없으며, 나중에 승인을 받으면 같은 방법(그 줄만 WIP 레인 단독 커밋)으로 올립니다.

acceptance-gate는 HEAD seed가 `approved`일 때만 closeout landing을 인정하므로, closeout은 워크트리뿐 아니라 HEAD의 seed도 `approved`인지 확인합니다(`closeout_contract.md` §1). 승인받지 못한 `draft` seed나 승인 줄을 아직 커밋하지 않은 seed는 closeout 대상이 아니며, closeout은 그 사실을 advisory로 알리고 건너뜁니다.

**금지 전이**: `approved → draft`(승인 철회는 kickoff 재실행), `draft → done`(closeout은 `approved`만 마감합니다. 승인 전에 끝난 작업을 마감하려면 먼저 사용자 승인을 받아 `approved`를 거칩니다. acceptance-gate는 HEAD가 `approved`가 아닌 seed의 전이를 마감으로 판정하지 않으므로 이 전이를 막지 않으며, 금지는 이 계약으로만 성립합니다 — `closeout_contract.md` §3a), 종료상태(`done`/`superseded`)를 손으로 되돌리기(reopen은 `thread-scope open`만 수행합니다). 첫째와 셋째는 `seed_evolution_policy.md` 금지 사항에도 있습니다.

### 닫힌 seed의 재개

`status`가 `done`/`superseded`인 seed에 다시 작업할 때는 작업의 성격으로 경로를 고릅니다.

- **같은 기능의 반복·연장**: `thread-scope open`이 그 seed를 제자리에서 reopen합니다(`status → approved`, `version +1`, `completed` 제거, `audit.jsonl`에 `seed_reopened`). `task_id`는 그대로입니다. reopen은 `status`를 곧바로 `approved`로 만들므로, 승인받지 않은 채 종료된 seed(`draft`에서 `superseded`가 된 seed)는 reopen 전에 사용자 승인을 받습니다. reopen 결과도 closeout 전에 HEAD에 있어야 마감할 수 있으며, 새 scope가 미체크라 따로 커밋할 때는 WIP 레인을 씁니다.
- **새 기능**: 새 `kickoff`로 새 seed(새 `task_id`)를 만듭니다.

"같은 기능인가"는 L1 자가감지(`scope_self_detect_policy.md`, `artifact_roles_contract.md` Growth Policy의 스레드 경계)가 판단하며, 애매하면 사용자에게 묻습니다. startdev 계약의 preflight도 같은 두 경로를 따릅니다(`startdev_seed_contract.md`).

### version 규칙

- 초기값은 `1`입니다.
- **내용 수정마다 +1**: `status`·`completed` 밖의 필드를 바꾸는 수정은 모두 `version`을 1 올리고 `seed_revised`를 기록합니다(절차는 `seed_evolution_policy.md`).
- **reopen마다 +1**: `thread-scope open`의 reopen이 올리고 `seed_reopened`를 기록합니다.
- **생애주기 전이는 면제**: `status`(와 `done`의 `completed`)만 바꾸는 `draft → approved`·`approved → done`·`→ superseded`는 `version`을 올리지 않습니다. 내용 revision이 아니라 상태 전이이며 `task_closed` 또는 git 커밋이 기록합니다.

## Authoring Rules

- `goal`은 하나여야 한다. 여러 목표를 한 파일에 섞지 않는다.
- `constraints`와 `out_of_scope`는 분리한다.
- `acceptance_criteria`는 최소 1개 이상이어야 한다.
- `assumptions`는 사실처럼 쓰지 말고 전제로 명시한다.
- `risks`는 없더라도 빈 배열로 남긴다.
- `references`는 가능하면 실제 파일 경로를 가리킨다.

## Validation Rules

아래 조건을 만족하지 않으면 유효하지 않다.

- YAML 파싱 가능
- 필수 필드 10개 모두 존재 (version, status, task_id, goal, constraints, acceptance_criteria, out_of_scope, assumptions, risks, references)
- `task_id` 형식 일치 (`YYYYMMDD-HHMMSS-XXXX`)
- `acceptance_criteria` 길이 >= 1
- `out_of_scope`, `assumptions`, `risks`, `references`는 배열
- `status`가 허용값 중 하나

## Operational Rules

- `kickoff`는 `seed.yaml`을 생성하거나 갱신한다.
- `startdev`는 `seed.yaml`을 우선 입력으로 읽는다.
- `seed.yaml`이 없을 때 `startdev`는 입력에 epic 패턴이 있으면 seed 없는 fallback 경로(startdev Phase 1 fallback)로 진행하고, 입력이 없으면 중단한 뒤 `kickoff`를 요구합니다. seed가 있는데 Validation Rules를 어기면 중단합니다(`startdev_seed_contract.md`).
- 사람이 읽는 설명은 `kickoff-summary.md`에 남기고, 실행 판단은 `seed.yaml` 기준으로 한다.

## Anti-Patterns

- 산문만 길고 `acceptance_criteria`가 비어 있는 seed
- 제약과 비범위를 섞어 쓰는 seed
- 가정을 증거처럼 서술하는 seed
- 참조 파일 없이 추상 문장만 있는 seed

## Minimal Example

```yaml
version: 1
status: draft
task_id: "20260401-143000-a1b2"

goal: >
  기존 API에 토큰 기반 인증을 추가한다.

constraints:
  - 공개 엔드포인트 동작은 유지한다
  - 수동 검증 절차를 남긴다

acceptance_criteria:
  - 인증이 필요한 엔드포인트는 인증 없이 401을 반환한다
  - 유효한 토큰으로 요청 시 정상 응답을 반환한다

out_of_scope:
  - OAuth 도입

assumptions:
  - 기존 서버 구조에 인증 미들웨어를 추가할 수 있다

risks:
  - 공개 엔드포인트까지 실수로 보호될 수 있다

references:
  - path: docs/harness/kickoff-summary.md
    reason: 원본 요약
```
