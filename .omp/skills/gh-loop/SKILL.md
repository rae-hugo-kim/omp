---
name: gh-loop
argument-hint: [finding description | issue number to resume]
description: Runs a finding→issue→fix→PR→cross-verify→HITL loop on GitHub (autonomy Q2, option-D PoC). Use when the user says "gh-loop", "이슈 루프", "finding을 이슈로", "자율 수정 루프", "issue fix loop", or wants a finding turned into an issue, fixed, PR'd, and cross-verified with a human decision gate. NEVER auto-merges.
---

# gh-loop — Finding → Issue → Fix → PR → Cross-verify → HITL

## Goal

발견사항을 GitHub 이슈로 만들고, 수정하고, PR을 열고, 교차검증한 뒤, **판단이 필요한 지점에서 멈춰 사용자에게 묻는** 반자율 루프. GitHub(이슈/PR/라벨/댓글)이 곧 상태저장소이자 버스다 — 루프는 프로세스를 점유하지 않고 **stateless-resumable**하다.

이것은 **option-D PoC**다 (analysis `claudedocs/harness-auto-capture-analysis.md#Q2`): 단일 세션에서 네가 킥오프하고, 결정점에선 이슈에 질문을 남기고 **턴을 종료**한다. 준비되면 `/gh-loop <issue-number>`로 재호출해 재개한다. 완전 자율 런타임(GitHub Actions/runner = 옵션 A)은 검증 후 별도 작업이다.

## Non-Negotiables

| Rule | Violation = STOP |
|------|------------------|
| **머지 절대 자동 금지** | 교차검증은 advisory일 뿐. 에이전트는 **자율 단계로 머지하지 않는다**; `gh pr merge`는 **PR별 명시적 인간 승인**(이슈/PR 댓글)이 있을 때만 그 지시로 실행한다. |
| **블로킹 대기 금지** | 결정점에선 질문을 이슈에 게시하고 **턴 종료**. 프로세스를 붙잡고 폴링/sleep 하지 않는다. |
| **dedup/throttle** | 이슈 생성 전 항상 `gh-loop-issue.mjs`로 중복·상한을 판정. 동일 finding 이슈 폭주 금지. |
| **사용자 응답 최우선** | 재개 시 이슈 댓글의 최신 사용자 지시를 memory/계획보다 우선한다 (CLAUDE.md "user > memory"). |
| **파괴 작업 가드** | force-push·history 재작성·대량 삭제는 advisory에 그치지 않고 사용자 확인. |

## Inputs

- `$ARGUMENTS`:
  - **finding 설명** (산문) → 새 루프 시작 (Stage 1부터).
  - **이슈 번호** (예: `42`) → 그 이슈에서 **재개** (needs-decision 응답 처리 또는 다음 단계).
  - 비어 있음 → 사용자에게 finding 또는 재개할 이슈를 묻는다.

## Prerequisites (discover, don't assume)

```bash
gh auth status                 # gh CLI 인증 (compr이 gh pr create로 쓰는 것과 동일)
gh repo view --json nameWithOwner -q .nameWithOwner
```

미인증 → `gh auth login` 안내 후 중단. autopilot/ralph·reviewer 등 재사용 자산은 OMC/하네스가 제공(아래 Reuse Map).

## Process

### Stage 1 — Finding → Issue (dedup + throttle)

1. 루프 라벨을 보장하고(없으면 생성, 멱등) 열린 루프 이슈를 수집한다 (dedup 입력):
   ```bash
   gh label create gh-loop --description "gh-loop automated" --color BFD4F2 2>/dev/null || true
   gh label create needs-decision --description "awaiting human decision" --color D93F0B 2>/dev/null || true
   gh issue list --state open --label gh-loop --json number,title,labels,body --limit 100
   ```
   새 repo엔 라벨이 없어 `--label gh-loop` 조회가 곧장 실패하므로 **먼저 보장**한다 (라이브 검증에서 확인된 게이트).
2. 생성 여부를 **헬퍼**로 판정한다 (gh 호출은 seam, 결정은 테스트된 로직). finding 텍스트는 **변수로** 넘기고 쉘 라인에 직접 보간하지 않는다. `--out`으로 결과를 파일로 받아 **jq 없이**(node만) 소비한다:
   ```bash
   node .omp/extensions/harness/gh-loop-issue.mjs decide --kind finding \
     --title "$FINDING_TITLE" --body "$FINDING_BODY" --label "$SEV" \
     --cap 5 --created "$CREATED" --existing-json "$EXISTING_JSON" \
     --out /tmp/ghloop > /dev/null
   action=$(cat /tmp/ghloop/action)
   ```
   - `action == "skip"` → 중복. 기존 이슈에 코멘트만 남기고 종료.
   - `action == "block"` → 상한 도달(런당 `--created` 또는 열린 루프 이슈 수). 멈추고 사용자에게 보고.
   - `action == "create"` → payload 파일로 생성한다. **finding 텍스트를 쉘 명령줄에 보간하지 말 것** — `$(...)`·백틱·따옴표가 그대로 실행된다:
     ```bash
     label_args=()
     while IFS= read -r l; do label_args+=(--label "$l"); done < /tmp/ghloop/labels
     gh issue create --title "$(cat /tmp/ghloop/title)" \
       --body-file /tmp/ghloop/body.md "${label_args[@]}"
     ```
     `"$(cat …/title)"` 전개 결과는 재스캔되지 않아 finding의 `$(...)`/백틱이 무력화되고, `--body-file`은 본문을 명령줄 밖으로 빼며, 배열 `"${label_args[@]}"`는 각 라벨을 한 인자로 안전 전달한다(공백 라벨 포함). `body.md`엔 dedup 마커가 박혀 다음 런이 같은 finding을 재검출한다.

### Stage 2 — Issue → Fix (재사용, 신규 구현 없음)

생성/지정된 이슈를 작업 단위로 **autopilot**(또는 복잡하면 **ralph**)에 넘긴다. 하네스 게이트(context/acceptance/backpressure/review)가 그 안에서 그대로 작동한다. 새 수정 엔진을 만들지 않는다 — 기존 실행 substrate를 배선만 한다 (analysis Q2.4).

### Stage 3 — Fix → PR

`compr` 스킬 절차로 브랜치·커밋·PR을 만든다 (`gh pr create`, `.omp/skills/compr/SKILL.md`). PR 본문에 `Closes #<issue>`를 넣어 이슈와 연결한다.

### Stage 4 — PR → Cross-verify (**advisory**)

PR에 대해 교차검증을 1패스 돌린다 — 결과는 **참고용**이지 머지 게이트가 아니다:
- `reviewer` 에이전트 (`.omp/agents/reviewer.md`) — 적대적 다중패스 리뷰.
- 이종 모델 2차 의견: `adversary` 에이전트 (`.omp/agents/adversary.md`) 또는 OMC `ccg`(claude+codex+gemini).
- 결과 요약을 파일로 써서 PR 코멘트로 게시한다 (`gh pr comment <pr> --body-file /tmp/ghloop-review.md`) — 본문을 쉘 명령줄에 보간하지 않는다.

### Stage 5 — Decision Gate → HITL (the crux)

판단이 필요하면 (예: 교차검증이 HIGH+ 이슈 제기 / 스키마·API 파괴 변경 / 머지 직전 / 파괴 작업) **자동 진행하지 않는다**:

1. 구조화 질문을 **기존 finding 이슈에 코멘트로** 게시하고 `needs-decision` 라벨을 단다. (독립 결정 이슈가 필요하면 헬퍼 `--kind decision`으로 생성 — `needs-decision` 라벨·마커 자동 부여.) 질문 본문은 **파일로** 써서 보간을 피한다:
   ```
   ## Decision needed
   **Context**: <무엇을, 왜 멈췄는지 — PR/이슈 링크>
   **Question**: <하나의 명확한 질문>
   **Options**:
   - A) <…> — tradeoff
   - B) <…> — tradeoff
   **Recommendation**: <기본안 + 근거>
   ```
   ```bash
   gh issue comment <issue> --body-file /tmp/ghloop-question.md
   gh issue edit <issue> --add-label needs-decision
   ```
2. **턴을 종료**한다 (option D: 프로세스를 붙잡지 않음). 사용자에게: "이슈 #N에 결정 요청을 남겼습니다. 답을 댓글로 남기신 뒤 `/gh-loop N`으로 재개하세요."

**재개** (`$ARGUMENTS` = 이슈 번호):
1. `issue://<n>` 로 이슈+댓글을 읽는다 (SQLite 캐시; author 포함).
2. 에이전트 자신이 단 질문이 아니라 **그 이후의 최신 _사용자_ 코멘트**를 최우선 지시로 취급한다 (memory/이전 계획과 충돌하면 사용자 우선).
3. 결정에 따라 해당 Stage를 잇는다. 재개 동작이 **성공한 뒤에** `needs-decision` 라벨을 제거한다 (`gh issue edit <n> --remove-label needs-decision`) — 도중 실패 시 라벨이 남아 미결 상태가 보존된다.
4. 머지 결정이면: PR별 명시적 인간 승인이 있을 때만 그 지시로 `gh pr merge` 실행. 자율 단계로는 절대 머지하지 않는다.

## Loop Safety

- **이슈 상한** = 헬퍼 `--cap`(기본 5). 런당 생성 수(`--created`)가 cap에 도달하거나 **열린 gh-loop 이슈 수가 cap에 도달**하면 `block` — 후자는 호출자 카운팅을 신뢰하지 않는 관측 기반 백스톱.
- **반복 한도**: 같은 이슈에서 fix→verify가 N회(기본 3) 수렴 실패면 멈추고 `needs-decision`으로 사용자에게.
- 파괴 작업은 advisory를 넘어 사용자 확인 (Non-Negotiables).

## Reuse Map (stage → asset → 위치 / provenance)

| Stage | Asset | 위치 |
|---|---|---|
| 1 finding→issue (dedup/throttle/label) | `gh issue create` + 헬퍼 | **harness(신규)**: `.omp/extensions/harness/gh-loop-issue.mjs` |
| 2 issue→fix | autopilot / ralph + 하네스 게이트 | **OMC**(전역 스킬) + `.omp/extensions/harness/gates/` |
| 3 fix→PR | `gh pr create` (compr 절차) | **harness**: `.omp/skills/compr/SKILL.md` |
| 4 cross-verify (advisory) | reviewer · adversary · ccg/codex | **harness**: `.omp/agents/{reviewer,adversary,verifier}.md` · **OMC**: ccg/codex |
| 5 decision gate / resume | `needs-decision` 라벨 + `issue://` read | 본 스킬 컨벤션 + `gh` CLI |

## Substrate note

- **지금(option D)**: 단일 세션, 수동 킥오프·재호출. 본 레포가 만드는 건 **재사용 자산**(이 스킬 + 헬퍼)이고, 실제 실행은 각 프로젝트에서 이 스킬을 호출해 일어난다.
- **검증 후(option A, 별도 작업)**: `.github/workflows/` + self-hosted runner + `issue_comment` 트리거로 재개를 자동화. 본 PoC의 범위 밖.

## State

루프 상태는 **GitHub에 산다** — 이슈/PR 상태, `gh-loop`/`needs-decision` 라벨, 댓글. 별도 로컬 상태 파일을 만들지 않는다 (재개는 이슈 번호만으로 충분).
