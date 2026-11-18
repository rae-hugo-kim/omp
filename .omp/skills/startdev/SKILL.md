---
name: startdev
argument-hint: <epic or task description>
description: Fresh start for implementation with mandatory TDD gates
---

# Startdev - Implementation with Mandatory Gates

## Goal

Start implementation with enforced TDD discipline. No shortcuts.

## Non-Negotiables

| Rule | Violation = STOP |
|------|------------------|
| **No code before test plan** | Gate 1 must pass |
| **No implementation before RED** | Failing test must exist first |
| **No "done" before checklist** | Gate 3 must pass |
| **No scope creep** | Only what's in the epic/task |
| **Discover, don't guess** | Find paths/commands from repo |

## Inputs

- `$ARGUMENTS` — the user-provided argument (appended as `User: <args>`): What to implement
  - `"epic 4"` / `"epic4"` / `"에픽 4"` → find and read epic file
  - `"로그인 기능"` → use as task description
  - seed.yaml이 있으면 `$ARGUMENTS` 없이도 실행 가능

## Workflow with Mandatory Gates

### Phase 0: Context Setup
```
1. If long conversation exists, run /sum (OMP: `/skill:sum`) to save session context
2. Read AGENTS.md
3. Read references/tdd_rules.md
```

### Phase 0.5: Seed Preflight

seed.yaml을 확인하고 유효성을 검증한다. status 판정은 `docs/rules/startdev_seed_contract.md` "Required Preflight Checks"와 `docs/rules/seed_contract.md` §생애주기를 따른다.

```
1. Read docs/harness/seed.yaml
2. 존재하면:
   - YAML 파싱 성공 확인
   - 필수 필드 10개 존재 확인 (version, status, task_id, goal, constraints,
     acceptance_criteria, out_of_scope, assumptions, risks, references)
   - task_id 형식 확인 (YYYYMMDD-HHMMSS-XXXX)
   - acceptance_criteria >= 1개 확인
   - status 확인 (active = `draft` 또는 `approved`):
     - `approved` → 진행
     - `draft` → 착수 전에 `ask` 도구로 사용자에게 seed 승인을 묻는다 → 아래 "draft seed 승인"
     - `done` 또는 `superseded` (종료상태) → seed 무효가 아니라 닫힌 작업이다. 중단하고 아래 "닫힌 seed 재개"의 두 경로를 안내
   - 그 외(필드 누락·파싱 실패 등) 실패 시: "seed.yaml이 유효하지 않습니다. /kickoff를 먼저 실행하세요." 출력 후 중단
3. 없으면:
   - $ARGUMENTS에 epic 패턴이 있으면 → Phase 1 fallback으로 진행
   - 아무 입력도 없으면 → "/kickoff를 먼저 실행하세요." 출력 후 중단
```

#### draft seed 승인 (`draft → approved`)

seed가 `draft`면 착수 전에 사용자에게 seed 승인을 묻습니다. 승인 없이 `approved`로 바꾸지 않습니다.

- **승인**: 승인을 받는 즉시 `status` 한 줄만 `approved`로 바꿔 단독 커밋으로 HEAD에 올린 뒤 진행합니다. kickoff는 산출물을 커밋하지 않으므로 seed가 아직 HEAD에 없으면 이 첫 커밋에 `seed.yaml` 전체(와 kickoff 산출물)가 함께 들어갑니다. kickoff scope의 AC가 모두 미체크라 일반 커밋은 acceptance-gate Check 3가 막으므로 WIP 레인으로 커밋합니다(WIP 면제로 통과한 커밋마다 `acceptance_wip` 감사 행이 1건 남습니다). 이 전이는 `version`을 올리지 않습니다.
  ```bash
  git status --short                      # 다른 변경이 스테이징돼 있지 않은지 확인 (단독 커밋)
  git add docs/harness/seed.yaml          # seed가 아직 HEAD에 없으면 kickoff 산출물(docs/harness/)도 함께
  OMP_COMMIT_WIP=1 git commit -m "docs(harness): seed <task_id>를 approved로 승인합니다"
  ```
- **보류**: 사용자가 승인을 보류하면 `draft`로 진행할 수 있습니다. 다만 closeout은 HEAD seed가 `approved`일 때만 마감하므로 closeout 전에 승인을 받아 같은 방법(그 줄만 단독 커밋, 미체크 AC가 남았으면 WIP 레인)으로 올려야 합니다.

#### 닫힌 seed 재개 (`done`/`superseded`)

종료상태 seed는 무효가 아니라 닫힌 작업입니다. 진행하지 않고 중단한 뒤, 작업의 성격에 따라 두 경로를 안내합니다(`seed_contract.md` §생애주기 "닫힌 seed의 재개").

- **같은 기능의 반복·연장** → `node .omp/extensions/harness/thread-scope.mjs open`으로 그 seed를 제자리에서 reopen한 뒤 다시 시작합니다(`status → approved`, `version +1`, `completed` 제거, `audit.jsonl`에 `seed_reopened`, 같은 `task_id`, `current-scope.md` 재생성). 승인받지 않은 채 종료된 seed(`draft`에서 `superseded`가 된 seed)는 reopen 전에 사용자 승인을 받습니다. reopen 결과도 closeout 전에 HEAD에 있어야 마감할 수 있으며, 새 scope가 미체크라 따로 커밋할 때는 WIP 레인을 씁니다.
- **새 기능** → `/kickoff`(OMP: `/skill:kickoff`)로 새 seed(새 `task_id`)를 만듭니다.

"같은 기능인가"가 애매하면 사용자에게 묻습니다(`docs/rules/scope_self_detect_policy.md`). 안내 문구:

> "이 seed는 닫힌 작업(`<status>`)입니다. 같은 기능의 반복이면 `node .omp/extensions/harness/thread-scope.mjs open`으로 reopen한 뒤 `/startdev`를 다시 실행하고, 새 기능이면 `/kickoff`(OMP: `/skill:kickoff`)로 새 seed를 만드세요."

### Phase 1: Understand

**seed.yaml이 있을 때 (우선):**
```
1. seed.yaml에서 추출:
   - [ ] Goal (goal 필드)
   - [ ] Acceptance criteria (acceptance_criteria)
   - [ ] Scope boundaries (out_of_scope)
   - [ ] Constraints (constraints)
   - [ ] Assumptions to verify (assumptions)
   - [ ] Risks to test (risks)
   - [ ] Reference files (references)
2. 보조 컨텍스트:
   - docs/harness/rubric-report.md → blocking issues 확인
   - docs/harness/kickoff-summary.md → 산문 맥락
3. Output: "## Task Understanding" summary
```

**seed.yaml이 없을 때 (fallback):**
```
1. Find epic file: `glob` **/epic*<number>*.md
2. Extract:
   - [ ] User stories
   - [ ] Acceptance criteria
   - [ ] Scope boundaries (what's NOT included)
3. Output: "## Task Understanding" summary
```

**User confirmation required before proceeding.**

### audit.jsonl 기록

startdev 시작 시 `docs/harness/audit.jsonl`에 append:
```
{"ts":"<ISO>","event":"startdev_started","actor":"assistant","meta":{"seed_version":<N>,"seed_status":"<status>"}}
```

### ⛔ GATE 1: Test Plan (MANDATORY)

**Cannot proceed to implementation without this.**

```markdown
## Test Plan for: <task>

### Unit Tests
- [ ] Test case 1: <input> → <expected>
- [ ] Test case 2: <input> → <expected>

### Edge Cases
- [ ] Empty input
- [ ] Invalid input
- [ ] Boundary values

### Integration Tests (if applicable)
- [ ] <scenario>
```

Use `assets/test_plan_template.md` for full template.

**seed.yaml을 사용한 경우:**
- `acceptance_criteria`의 각 항목 → 최소 1개 테스트 케이스로 매핑
- `risks`의 각 항목 → 최소 1개 엣지 케이스 테스트로 매핑
- `assumptions` 중 코드로 확인 가능한 것 → 검증 테스트 후보

**Output test plan. Get user approval. Then proceed.**

#### Step: Test Plan 저장 (MANDATORY)

승인된 테스트 계획을 표준 경로에 저장한다.

```
1. `write` 도구로 docs/harness/test-plan.md에 저장
2. audit.jsonl에 append:
   {"ts":"<ISO>","event":"test_plan_saved","actor":"assistant","meta":{"task_id":"<id>","path":"docs/harness/test-plan.md"}}
```

### GATE 1.5: Test Attack (적대적 검증 — 현재 미도입, 건너뜀)

**현재 미도입(롤아웃 Phase 1 — `plan-attack`만 도입)입니다. 이 단계를 건너뛰고 Phase 2(RED)로 진행합니다.** `test-attack`은 롤아웃 Phase 2(미승인)이고 완료 조건이 아닙니다. 정책: [`.omp/rules/harness-adversarial_review.md`](../../../.omp/rules/harness-adversarial_review.md) ("도입 상태"·"롤아웃 계획과 현재 위치")

아래는 롤아웃 Phase 2가 승인됐을 때의 절차입니다(승인 전에는 실행하지 않습니다). 담당은 OMP 번들 `task` 에이전트이며 테스트 계획 공격 템플릿은 호출자가 공급합니다.

```
1. `task` 에이전트 호출 (`task` 도구):
   - docs/harness/test-plan.md + docs/harness/seed.yaml을 입력으로 제공
   - 구조적 공격 템플릿:
     a) "이 테스트가 놓치는 실패 시나리오"
     b) "이 엣지 케이스 목록에 빠진 것"
     c) "이 테스트가 통과해도 버그가 남는 경우"
   - 각 발견에 심각도 부여 (CRITICAL / HIGH / MEDIUM)
   - CRITICAL 판정 기준: 3조건 동시 충족
     (1) 요구사항 미충족/보안 취약점/데이터 손실 가능성
     (2) 수정 없이 진행하면 후속 단계에서 반드시 실패
     (3) 구체적 증거 제시 (test-plan.md 항목 또는 seed.yaml 필드 인용)
2. 결과를 docs/harness/test-attack-report.md에 저장 (원본 test-plan.md와 분리)
3. audit.jsonl에 append:
   {"ts":"<ISO>","event":"adversarial_test_attack","actor":"task","meta":{"task_id":"<id>","run_count":<N>,"result":"<PASS|BLOCK>","findings":[...]}}
4. 판정:
   - CRITICAL 발견 → BLOCK (테스트 계획 보완 필요)
     - 사용자가 "그냥 진행해" → override 허용
     - audit.jsonl에 adversarial_override 이벤트 기록
   - CRITICAL 없으면 → PASS → Phase 2(RED) 진행
```

### Phase 2: RED - Write Failing Test

```
1. Write FIRST test (smallest unit)
2. Run test → MUST FAIL
3. If test passes → STOP, test is wrong
4. Commit: "test: add failing test for <feature>"
```

**Show failing test output before proceeding.**

### Phase 3: GREEN - Minimal Implementation

```
1. Write MINIMUM code to pass the test
2. No extra features
3. No "while I'm here" improvements
4. Run test → MUST PASS
5. Commit: "feat: implement <feature>"
```

**Check against `references/anti_patterns.md` before proceeding.**

### Phase 4: TIDY - Clean Only What You Touched

```
1. Only files you modified
2. Only structural changes
3. Run tests → MUST PASS
4. Commit: "refactor: tidy <what>"
```

### ⛔ GATE 2: Cycle Check

Before next feature:
- [ ] Test exists and passes?
- [ ] Implementation is minimal?
- [ ] No scope creep?

**Repeat Phase 2-4 for each test case in the plan.**

### ⛔ GATE 3: Completion Checklist

**Cannot declare "done" without all checks passing.**

```markdown
## Completion Checklist

### Tests
- [ ] All planned tests implemented
- [ ] All tests passing
- [ ] Edge cases covered

### Code Quality
- [ ] No hardcoded values
- [ ] No TODO comments left
- [ ] No console.log / print debugging

### Scope
- [ ] Only requested features implemented
- [ ] No extra "improvements"
- [ ] Matches acceptance criteria

### Ready for Review
- [ ] Commits are atomic (one thing per commit)
- [ ] Commit messages are clear
- [ ] No merge conflicts
```

Use `references/implementation_checklist.md` for full checklist.

### ⛔ GATE 3.5: 완료 검증 (`verifier`) — Completion Attack은 현재 미도입

GATE 3 통과 후 실행한다. 정책: `AGENTS.md` Completion Contract, [`.omp/rules/harness-adversarial_review.md`](../../../.omp/rules/harness-adversarial_review.md) ("completion-attack과 `verifier` 완료 검증의 관계")

#### 1. `verifier` 완료 검증 (MANDATORY — AC가 있으면)

```
1. `task` 도구로 verifier 에이전트 스폰 (.omp/agents/verifier.md):
   - acceptance_criteria 각 항목의 구현 증거 확인
   - constraints 위반·out_of_scope 이탈 여부 확인
2. 스폰은 완료가 아니다 — verdict가 도착할 때까지 완료를 선언하지 않는다
3. 판정:
   - PASS → 완료 선언 가능
   - FAIL / INCOMPLETE → 미완료. 지적을 수정한 뒤 verifier 재실행
```

`task` 도구가 없는 세션은 자체 검증으로 대신하지 않고 "검증 BLOCKED"로 보고합니다(`.omp/rules/harness-harness_integration_contract.md` "Fallback Behavior When a Gate Is Unavailable").

#### 2. Completion Attack (적대적 검증 — 현재 미도입, 건너뜀)

**현재 미도입(롤아웃 Phase 1 — `plan-attack`만 도입)입니다. 이 계층을 건너뜁니다.** `verifier` 완료 검증 위에 보안·테스트 관점을 병렬로 얹는 설계이며, 롤아웃 Phase 2(미승인)이고 OMP에서 실행된 적이 없습니다. 완료 조건이 아니므로 `verifier`의 `PASS` verdict만으로 완료 조건을 채웁니다.

아래는 롤아웃 Phase 2가 승인됐을 때의 절차입니다(승인 전에는 실행하지 않습니다). `verifier`를 **대체하지 않고 확장**합니다.

```
1. verifier와 병렬로 에이전트 호출 (`task` 도구):
   a) security-reviewer (OMP 번들): "보안 관점에서 이 구현을 깨뜨릴 수 있는가?"
      - 입력 검증, 인증/인가, 데이터 노출 점검
   b) task (테스트 커버리지 공격 템플릿 공급): "테스트 커버리지가 충분한가?"
      - test-plan.md 대비 실제 구현된 테스트 비교
      - 누락된 엣지 케이스 식별
2. 각 발견에 심각도 부여 (CRITICAL / HIGH / MEDIUM)
   - CRITICAL 판정 기준: 3조건 동시 충족 (harness-adversarial_review.md 참조)
3. 불일치 판정:
   - 전원 PASS → PASS
   - 에이전트 간 CRITICAL 판정이 엇갈릴 때의 합의 조정자는 미정 (harness-adversarial_review.md) — 롤아웃 Phase 2 승인 때 정한다
4. 결과를 docs/harness/completion-attack-report.md에 저장
5. audit.jsonl에 append:
   {"ts":"<ISO>","event":"adversarial_completion_attack","actor":"verifier+security-reviewer+task","meta":{"task_id":"<id>","run_count":<N>,"result":"<PASS|BLOCK>","findings":[...]}}
6. 판정:
   - CRITICAL → BLOCK (수정 필요)
     - 사용자 override → audit.jsonl에 adversarial_override 이벤트 기록
   - CRITICAL 없으면 → PASS
```

## Output Format

```markdown
## Implementation Complete

### Task
<what was implemented>

### Test Coverage
- Unit tests: N
- Edge cases: N
- All passing: ✓

### Commits
1. `abc1234` — test: ...
2. `def5678` — feat: ...
3. `ghi9012` — refactor: ...

### Checklist
- [x] All gates passed
- [x] No anti-patterns detected

### Next Steps
<if any follow-up needed>
```

## References (load as needed)

- `references/tdd_rules.md` — RED→GREEN→TIDY cycle details
- `references/implementation_checklist.md` — Full completion checklist
- `references/anti_patterns.md` — "대충 구현" detection
- `assets/test_plan_template.md` — Test plan template
- `docs/rules/seed_evolution_policy.md` — 구현 중 seed.yaml 수정 규칙
- `docs/glossary.yaml` — 프로젝트 용어집

## Patterns Applied

`constraints_first`, `explicit_output_schema`, `reason_act_loop`, `safety_guard`, `iteration_limit`
