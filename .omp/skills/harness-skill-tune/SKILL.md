---
name: harness-skill-tune
argument-hint: "[--repo-prefix <dir>]... [--format md|json] [--out <file>]"
description: Inspects this repo's harness skills and prints one report — per-skill usage counts from omp session transcripts, name collisions with omp reserved names and with same-named skills from other sources, and SKILL.md consistency (frontmatter, referenced paths, skills and agents, size) — then applies that report to the skills. Mechanical findings (a dangling path, skill or agent reference with exactly one correct target) are fixed and reported by finding ID; judgment findings (rename, delete, hide, rewrite a description, restructure, a frontmatter name that differs from the directory) are offered as numbered options with usage numbers and applied only when the user picks one; changed skills are evaluated before/after where possible and the check is re-run. The check is read-only, the update never touches skills outside this repo and never commits. Use when the user says "harness-skill-tune", "스킬 점검", "스킬 갱신", "스킬 사용 빈도", "스킬 이름 충돌", "skill audit", or asks which harness skills are unused, colliding, or stale.
---

# harness-skill-tune — 스킬 점검과 갱신

## Goal

이 리포의 `.omp/skills/`를 점검해 보고서 하나를 내고(점검 단계), 그 보고서의 지적을 스킬에 반영합니다(갱신 단계). 보고서는 스킬별 사용 빈도 표와 지적 목록이며, 갱신 단계는 지적을 기계적·판단 필요로 나눠 기계적인 것은 고치고, 판단이 필요한 것은 사용자가 고른 것만 적용한 뒤 재점검으로 닫습니다.

## Non-Negotiables

| Rule | 이유 |
|------|------|
| **점검은 읽기 전용** | `check`는 어떤 스킬 파일도 바꾸지 않습니다. 쓰는 것은 `--out`으로 지정한 보고서 파일 하나뿐이고, 그 경로가 실제로 `.omp/skills/` 아래에 떨어지거나 심볼릭 링크면 거부합니다. 지적을 보고 바로 고치지 말고 보고서로 넘긴 뒤 갱신 단계에서 다룹니다. |
| **판단 필요 지적은 사용자 선택 없이 적용하지 않음** | 개명·삭제·숨김(`hide: true`)·설명문 재작성·본문 구조 변경은 근거 수치와 번호 붙인 선택지를 제시하고 사용자가 고른 것만 적용합니다. 읽기 0회 스킬도 자동으로 지우거나 숨기지 않습니다. |
| **지적 대상은 이 리포의 스킬** | 리포 밖 스킬(`~/.omp/agent/skills`, `~/.claude/skills`, `~/.agents/skills` 등)은 충돌 판정의 입력으로만 읽고, 고치지도 지적하지도 않습니다. 갱신 단계에서도 리포 밖 파일은 보고만 합니다. |
| **스킬이 직접 커밋하지 않음** | 갱신 단계가 고치는 것은 작업 트리의 `.omp/skills/` 파일과, 그 변경을 적는 `CHANGELOG.md` `[Unreleased]` 항목·README 스킬 표뿐입니다. 하네스 소유 스킬은 소비 리포로 동기화되므로 변경은 일반 PR 경로(`compr`)로 나가고, 이 스킬은 `git add`·`git commit`·`git push`를 실행하지 않습니다. |
| **소스 리포 전용** | `scripts/harness-sync.sh` 화이트리스트에 없어 소비 리포로 가지 않습니다. 함께 배포되는 테스트는 스킬이 없으면 skip합니다. |
| **결정적 판정만 스크립트로** | 스크립트는 같은 입력에 같은 지적을 냅니다. 설명문 품질처럼 판단이 필요한 항목은 사람이 읽는 절차(3·7단계)로 다룹니다. |

## Process — 점검 단계

### 1. 점검 실행

```bash
node .omp/skills/harness-skill-tune/scripts/skill-tune.mjs check
```

| 옵션 | 뜻 |
|------|----|
| `--repo-prefix <dir>` (반복 가능) | 리포 범위에 넣을 세션 cwd 접두를 더합니다. 기본값은 리포 루트와 `git worktree list`의 경로입니다. 지워진 워크트리의 세션은 기본값에 잡히지 않으므로, 워크트리를 한 디렉터리 아래에 두는 배치(Orca의 `<workspaces>/<repo>/<worktree>`)라면 그 부모 디렉터리를 넘깁니다. |
| `--agent-dir <dir>` | omp 에이전트 디렉터리입니다. 기본값은 `PI_CODING_AGENT_DIR`, 없으면 `~/.omp/agent`입니다. 세션은 그 아래 `sessions/`, `/skill:` 호출 수는 `agent.db`에서 읽습니다. 따로 옮겼다면 `--sessions-dir`·`--db`로 지정합니다. |
| `--format json` | 보고서 대신 같은 내용의 JSON을 냅니다. 갱신 단계의 재점검(9단계)이 이 형식을 씁니다. |
| `--out <file>` | 표준 출력 대신 파일에 씁니다(`.omp/skills/` 아래와 심볼릭 링크는 거부합니다). |
| `--skill-root <dir>` (반복 가능) | 같은 이름의 사본을 찾을 스킬 디렉터리를 더합니다. 기본값은 에이전트 디렉터리의 `skills/`, `~/.claude/skills`, `~/.agents/skills`, 그리고 `omp skill list --json`이 스킬을 보고한 디렉터리입니다. 훑지 못한 디렉터리는 머리말에 따로 적습니다. |
| `--skill-list-json <file>` | `omp skill list --json`을 직접 실행하는 대신 저장해 둔 출력을 씁니다. |

세션 디렉터리가 없거나 읽을 수 없으면, 또는 `command_usage`를 읽을 수 없으면 그 열을 `측정 불가`로 표시하고 정상 종료합니다. `omp`가 없어 스킬 목록을 얻지 못하면 머리말에 `측정 불가`로 적고, 출처 간 사본은 스킬 디렉터리를 직접 훑은 결과만으로 판정합니다. `reserved-names.json`이나 `expected-absent-paths.json`이 깨진 JSON이면 파일 이름을 알리고 실패합니다(조용히 무시하면 지적이 달라지기 때문입니다).

### 2. 보고서 읽기

머리말은 무엇을 어디서 읽었는지와 예약 이름의 **기준 omp 버전**을 적습니다. 기준 버전이 설치된 omp와 다르면 머리말이 알려 주므로, 지적을 읽기 전에 아래 "예약 이름 기준 갱신"을 먼저 합니다.

**스킬별 표**: 세션 수는 그 스킬을 한 번 이상 읽은 세션 파일 수, 읽기는 `skill://<name>` `read` 호출 수입니다. `skill://<name>/references/x.md` 같은 하위 경로 읽기는 `<name>`에 귀속합니다. 리포 범위는 세션 cwd가 리포 접두 아래인 세션만, 전체 범위는 이 머신의 모든 세션입니다. 이 수치가 7단계 선택지의 근거 수치입니다.

**지적 목록**: 지적마다 ID·심각도·스킬·근거(`파일:줄`)·기계적 수정 가능 여부가 있습니다. ID는 코드·스킬·대상에서 만든 해시라 줄이 밀려도 바뀌지 않으므로, 수정 전후 보고서를 ID로 대조합니다(9단계).

| 코드 | 무엇 | 심각도 | 기계적 수정(스크립트 기준) |
|------|------|--------|-------------|
| `NAME-RESERVED` | 스킬 이름이 omp 빌트인 슬래시 명령·별칭·번들 명령과 같음 | medium | 불가 |
| `NAME-RESERVED` | 스킬 이름이 omp CLI 하위 명령과 같음 | low | 불가 |
| `NAME-DUP` | 같은 이름의 스킬이 다른 출처에 있음(로드 목록에 있거나, 스킬 디렉터리에 파일로 있음) | 내용이 다르면 medium, 같으면 low | 불가 |
| `FM-MISSING` | `SKILL.md`나 frontmatter가 없음 | high | 불가 |
| `FM-NAME` | frontmatter `name`이 디렉터리명과 다름 | high | 가능 |
| `FM-DESC` | frontmatter `description`이 없거나 비어 있음 | high | 불가 |
| `REF-PATH` | 본문 인라인 코드가 가리키는 리포 경로가 없음 | medium | 불가 |
| `REF-SKILL` | 본문의 `/skill:` 참조 대상이 이 리포의 스킬에 없음(네임스페이스가 붙은 다른 출처 스킬 참조 포함) | medium | 불가 |
| `REF-AGENT` | 본문이 부르는 에이전트가 `.omp/agents/`와 omp 번들 에이전트에 없음 | medium | 불가 |
| `SIZE` | `SKILL.md`가 500줄을 넘음 | low | 불가 |

보고서의 "기계적 수정" 열은 **스크립트가 넣을 값을 아는가**입니다(`FM-NAME`은 디렉터리명을 넣을 수 있어 가능, 나머지는 스크립트가 대체 대상을 모릅니다). 갱신 단계의 분류(5단계)는 그와 별개로 **에이전트가 근거로 정답이 하나임을 보일 수 있는가**와 **사용자 가치가 걸리는가**로 판정하므로, 이 열이 "불가"인 `REF-*` 지적이 5단계에서 기계적으로 분류될 수 있고, 반대로 "가능"인 `FM-NAME`은 로더가 frontmatter `name`을 로드 이름으로 쓰기 때문에(`omp skill list --json`의 `name`이 디렉터리명이 아니라 frontmatter 값입니다) 그 값을 바꾸면 개명이라 판단 필요로 다룹니다.

### 3. 판단이 필요한 항목 (스크립트가 하지 않는 것)

보고서를 넘기기 전에 다음을 읽어서 확인하고, 결론을 보고서 아래에 덧붙입니다.

1. **읽기 0회 스킬**: 삭제 후보라고 단정하지 않습니다. 발동 조건이 한 번도 충족되지 않았는지, 설명문이 발동을 못 시키는지, 폐기 조건이 따로 적혀 있는지 봅니다(예: grepai 시범 평가 기준은 `.omp/rules/harness-mcp_policy.md`에 있습니다).
2. **설명문 품질**: `description`이 무엇을 하는지와 언제 쓰는지(사용자가 말할 법한 표현)를 함께 담는지 읽습니다. 스크립트는 존재 여부만 봅니다.
3. **`REF-PATH` 분류**: 지적된 경로가 (a) 실제로 낡은 참조인지 (b) 예시 경로이거나 실행 중에만 생기는 산출물인지 가립니다. (b)는 사유와 함께 `expected-absent-paths.json`에 넣으면 다음 점검부터 억제되고, 머리말의 억제 건수로만 남습니다. gitignore 대상 경로는 호스트마다 있고 없음이 달라 자동으로 억제합니다.
4. **`NAME-DUP` 분류**: 다른 출처의 사본이 하네스가 안내한 미러인지(`docs/rules/closeout_contract.md` §4), 내용이 갈라진 낡은 사본인지 봅니다. 로더는 충돌을 정리한 뒤의 목록만 내므로(사본을 빼거나 꺼진 출처를 건너뜁니다) "로드 목록에 없음"인 사본은 지금은 실행되지 않더라도 설정이 바뀌면 로드될 수 있습니다. 리포 밖 파일은 고치지 않고 보고만 합니다.
5. **패턴이 못 잡는 참조**: 에이전트 참조는 백틱으로 감싼 이름 뒤에 "에이전트"/"agent"가 오는 경우와 영문 이름 바로 뒤에 "에이전트"가 오는 경우만 잡습니다. 경로 참조는 백틱으로 감싼 것만 보고(펜스 코드 블록 안이어도 백틱이 있으면 봅니다), 백틱 없는 경로, 슬래시 없는 파일명, `./`·`../`로 시작하는 상대 경로, 자리표시자나 glob이 붙은 경로(`<…>`, `*`, `{…}`, `$…`, `[…]`)는 보지 않습니다. `/skill:` 참조는 omp 문법대로 이름 하나 또는 네임스페이스와 이름(슬래시 하나)까지만 읽습니다.

### 4. 전달

보고서 전문(또는 `--out` 파일)과 3단계의 결론을 사용자에게 전달합니다. 점검만 요청받았으면 여기서 끝납니다. 갱신까지 요청받았으면(사용자가 "스킬 갱신", "지적 반영"이라고 하거나 처음부터 고치라고 한 경우) 아래 갱신 단계로 이어집니다.

## Process — 갱신 단계

입력은 점검 단계의 보고서(지적 ID·근거·스킬별 수치)입니다. 보고서 없이 스킬을 고치지 않습니다.

**갱신에 들어가기 전에, 스킬을 하나라도 고치기 전에** 기준을 보존합니다 — 1단계와 같은 옵션으로 JSON 보고서를 임시 디렉터리에 저장하고, 고칠 가능성이 있는 스킬의 `SKILL.md`를 그 디렉터리에 복사합니다. 9단계의 전후 대조와 8단계의 "수정 전"이 이 사본을 씁니다(git 상태를 되돌려 다시 만들 수 없으므로 순서가 중요합니다). `TUNE_OUT` 값은 보고서에 적어 두고, 셸이 바뀌면 그 절대 경로를 다시 대입합니다. `trap … EXIT`로 지우지 않습니다 — 명령마다 셸 사본을 쓰는 실행 환경에서는 블록이 끝나자마자 기준이 사라집니다. 10단계가 끝난 뒤 `rm -rf "$TUNE_OUT"`으로 지웁니다.

```bash
TUNE_OUT=$(mktemp -d); echo "$TUNE_OUT"
node .omp/skills/harness-skill-tune/scripts/skill-tune.mjs check --format json --out "$TUNE_OUT/before.json"   # 1단계와 같은 --repo-prefix 등 옵션
mkdir -p "$TUNE_OUT/before" && cp .omp/skills/<name>/SKILL.md "$TUNE_OUT/before/<name>.md"                      # 고칠 스킬마다
```

### 5. 분류

지적마다 둘 중 하나로 분류하고 그 근거를 적습니다.

| 분류 | 기준 | 해당 코드 |
|------|------|-----------|
| **기계적** | 정답이 하나이고 그 근거를 리포에서 보일 수 있으며 사용자 가치가 걸리지 않음 | `REF-PATH`·`REF-SKILL`·`REF-AGENT` 가운데 (ㄱ) 대상의 이동·개명이 git 이력(`git log --all --follow -- <경로>`, `git log -S'<참조 문자열>'`)으로 확인되거나, (ㄴ) 같은 자산을 리포의 다른 문서가 이미 한 가지 방식으로 가리키거나(예: 리포 밖에 설치된 스킬은 `skill://<name>`), (ㄷ) `omp skill list --json`·`.omp/agents/`가 대상의 현재 이름·위치를 보고하는 것. |
| **판단 필요** | 선택지가 둘 이상이거나 사용자 가치가 걸림 | 개명·삭제·숨김(`hide: true`)·설명문 재작성·본문 구조 변경 전부(`NAME-RESERVED`, `NAME-DUP`, `FM-MISSING`, `FM-DESC`, `SIZE`). `FM-NAME` — 로더는 frontmatter `name`을 로드 이름으로 쓰므로 그 값을 디렉터리명에 맞추는 것은 `/skill:<name>`이 바뀌는 개명이고, 디렉터리를 `name`에 맞춰 옮기는 것도 선택지입니다. 참조를 지울지 다른 문서로 바꿀지 고를 수 있는 `REF-*` — 대상이 리포에 존재한 적이 없거나, 존재했다가 삭제됐는데 대체가 하나로 정해지지 않는 경우(되살릴지 지울지는 사용자 몫입니다). 3단계 3항에서 예시 경로·런타임 산출물로 가려진 `REF-PATH`의 `expected-absent-paths.json` 등재(다음 점검부터 영구 억제되므로 사유를 보여 주고 고르게 합니다). |

분류와 무관하게 다음은 고치지 않고 보고만 합니다. **리포 밖 스킬**에 대한 지적(`NAME-DUP`의 사본 쪽 — 사본이 하네스가 안내한 미러이면 `closeout_contract.md` §4의 복사 절차를 가리킵니다), **다른 열린 이슈가 다루는 지적**(그 이슈 번호를 적습니다), **소비 리포에 영향이 있어 별도 이슈가 필요한 변경**(동기화되는 스킬의 개명 등).

### 6. 기계적 지적 처리

분류 근거를 다시 확인한 뒤 `edit`로 고칩니다. 지적된 줄만 바꾸고 인접 서술은 손대지 않습니다. 처리한 지적은 보고서의 "해결한 지적" 표에 ID·변경 전후·근거로 적습니다.

```markdown
| ID | 스킬 | 변경 | 근거 |
|---|---|---|---|
| REF-PATH-gh-loop-3861db | `gh-loop` | 리포 경로 .omp/skills/orca-cli/SKILL.md → `skill://orca-cli` (설치형) | `omp skill list --json`이 orca-cli를 `~/.agents/skills`(agents:user)로 보고, `.omp/skills/gh-fanout/SKILL.md`:28이 같은 자산을 `skill://orca-cli`로 참조, 리포 이력에 그 경로가 없음 |
```

예시의 변경 전 경로는 지적 대상이므로 백틱 없이 적습니다 — 백틱으로 감싸면 이 문서 자체가 다음 점검에서 `REF-PATH`로 잡힙니다(9단계의 "새 지적" 검사가 그것을 잡습니다).

### 7. 판단 필요 지적 — 선택지 제시

지적마다 **근거 수치**(스킬별 표의 리포·전체 읽기 수와 마지막 사용일, `/skill:` 호출 수, 충돌 상대와 그 출처·내용 동일 여부, 줄 수)와 **번호 붙인 선택지**를 적어 사용자에게 제시하고, 고른 것만 적용합니다. 호출 0회 스킬을 자동으로 지우거나 숨기지 않습니다. 선택지에는 항상 "그대로 둠"이 포함되고, 권장안과 이유를 한 줄로 적습니다.

```markdown
### NAME-RESERVED-init-56a689 — `init` (medium)
근거(2026-11-13 이 호스트 실측): 리포 읽기 2회(마지막 2026-10-14) · 전체 읽기 11회 · `/skill:` 호출 1회(2026-10-14) · 충돌 상대 omp 번들 명령 `/init`(기준 omp 18.18.6) · 사본 `~/.omp/agent/skills/init`(내용 다름, 로드 이름 `agent/init`)
1. `omp-init`으로 개명 — 소비 리포로 동기화되는 스킬이라 별도 이슈에서 영향 범위를 정한 뒤 실행
2. `hide: true`로 숨김 — `/skill:init`은 남고 자동 발동만 멈춤(지적은 남습니다 — 이름이 같기 때문입니다)
3. 그대로 둠 — 다음 점검에서 다시 봄
권장: 1(별도 이슈) — 번들 명령과 같은 이름은 사용자가 어느 쪽이 실행될지 알 수 없습니다.
```

사용자가 고르기 전에는 아무것도 적용하지 않습니다. 선택의 결과는 둘로 갈립니다.

- **해결**: 선택이 지적의 원인을 없애는 편집(개명·삭제·설명문 작성·참조 정정 등)이면 6단계처럼 고치고 "해결한 지적" 표에 선택 번호와 함께 적습니다. 9단계에서 그 ID가 사라져야 합니다.
- **수용**: 선택이 지적을 남기는 결과(그대로 둠, `hide: true` — 이름 지적은 이름만 보므로 남습니다, 별도 이슈로 넘김, 보고만)이면 편집이 있어도 없어도 "수용한 지적" 표에 ID·선택·사유로 적습니다. 9단계는 이 ID가 남아 있어도 통과이고, 다음 점검에서 다시 나옵니다(`REF-PATH`의 `expected-absent-paths.json` 등재 선택은 해결입니다. 이름 지적에는 억제 수단이 없습니다).

사용자가 고르지 않은 지적은 선택지 그대로 보고서에 남깁니다.

### 8. 평가 (가능한 경우)

**실행 조건**: 6·7단계에서 `description`이나 본문의 절차를 바꾼 스킬. 참조 경로 한 곳을 정정한 것처럼 동작이 달라지지 않는 변경은 9단계의 재점검이 검증이므로 평가를 생략하고 그 사유를 적습니다.

**방법**: 설명문의 발동 표현에서 대표 프롬프트 2~3개를 만들고, 프롬프트마다 `task` 서브에이전트를 둘 돌려 비교합니다 — 수정 전(갱신 전에 보존한 `$TUNE_OUT/before/<name>.md`의 절대 경로를 프롬프트에 적어 그 파일을 읽고 따르게 함) 대 수정 후(작업 트리 `.omp/skills/<name>/SKILL.md`의 절대 경로), 또는 스킬 없음(본문을 주지 않음) 대 수정 후. 비교하는 것은 **넘긴 본문을 따른 결과**(절차의 어느 단계까지 따랐는지, 산출물 형식)입니다. 설명문 매칭에 따른 자동 발동 여부는 서브에이전트가 같은 작업 트리의 현재 스킬 목록을 보므로 옛 설명문으로는 측정할 수 없어 비교 항목에서 뺍니다. 판정 기준은 프롬프트와 함께 미리 적고, 서브에이전트에는 리포의 어떤 파일도 만들거나 바꾸지 말고 결과를 답으로만 내라고 명시합니다.

**생략 조건**(사유를 적고 생략): 대표 프롬프트를 만들 수 없음(발동 표현이 없거나 입력이 실제 리포 상태에 묶여 있음), 스킬이 원격·저장소 상태를 바꿈(`compr`, `compush`, `gh-loop`, `gh-fanout`, `init`, `migrate`, `harness-check` 등 — 서브에이전트가 절차를 따르면 실제로 커밋·push·이슈 생성이 일어납니다), 스킬의 절차가 작업 트리에 산출물을 씀(`kickoff`·`startdev`의 seed·scope, `sum`의 `docs/sum/` 등 — "바꾸지 말라"는 지시 하나에 기대지 않습니다), 동작이 달라지지 않는 참조 정정.

**기록 형식**:

```markdown
| 스킬 | 프롬프트 | 전 | 후 | 판정 |
|---|---|---|---|---|
| `<name>` | "<설명문의 발동 표현 하나>" | 절차 2단계에서 멈춤 | 4단계까지 따르고 표 형식으로 냄 | 개선 |
| `gh-loop` | — | — | — | 생략: 저장소 상태를 바꾸는 스킬 |
```

### 9. 재점검

수정 뒤 점검을 다시 돌려, 해결한 지적 ID가 사라졌고 새 지적이 생기지 않았는지 갱신 전에 저장한 `before.json`과 ID 집합으로 대조합니다. 인수로 넘기는 ID는 **해결한 지적**(6단계 표, 7단계의 해결 선택)만이고, 수용한 지적은 넘기지 않습니다. 넘긴 ID가 `before.json`에 없으면(오타, 다른 보고서의 ID) 실패합니다. 새 지적이 나오면 그것을 5단계로 돌립니다 — 이번 수정이 만든 것이면 고치고(개명은 지적 ID의 스킬 부분을 바꾸므로 같은 지적이 새 ID로 다시 나옵니다), 사용자가 수용하면 그 ID를 `TUNE_ALLOW_NEW`(쉼표 구분)로 넘겨 다시 대조하고 "수용한 지적" 표에 적습니다.

```bash
node .omp/skills/harness-skill-tune/scripts/skill-tune.mjs check --format json --out "$TUNE_OUT/after.json"   # before.json과 같은 옵션
node -e '
  const ids = (p) => new Set(JSON.parse(require("fs").readFileSync(p, "utf8")).findings.map((f) => f.id));
  const after = ids(process.argv[1]), before = ids(process.argv[2]);
  const fixed = process.argv.slice(3);
  const unknown = fixed.filter((id) => !before.has(id));
  const left = fixed.filter((id) => after.has(id));
  const allowNew = new Set((process.env.TUNE_ALLOW_NEW || "").split(",").filter(Boolean));
  const added = [...after].filter((id) => !before.has(id) && !allowNew.has(id));
  const gone = [...before].filter((id) => !after.has(id));
  if (unknown.length || left.length || added.length) {
    console.error("기준에 없는 ID:", unknown.join(", ") || "없음", "/ 남은 지적:", left.join(", ") || "없음", "/ 새 지적:", added.join(", ") || "없음");
    process.exit(1);
  }
  console.log(`재점검 통과: ${before.size}건 → ${after.size}건 / 사라진 ID: ${gone.join(", ") || "없음"}`);
' "$TUNE_OUT/after.json" "$TUNE_OUT/before.json" <해결한 지적 ID>...
```

남은 지적이나 새 지적이 있으면 그 ID를 보고서에 적고, 수정을 되돌리거나 7단계 선택지로 돌립니다. "사라진 ID"에 넘기지 않은 ID가 있으면 어떤 수정이 그것을 없앴는지 확인해 해결 표에 더합니다.

### 10. 보고와 전달

점검 보고서 아래에 "갱신" 절을 덧붙여 사용자에게 전달합니다. 절은 여섯 부분입니다 — **해결한 지적**(6단계 표, 7단계의 해결 선택 포함), **수용한 지적**(7단계의 수용 선택), **선택지**(7단계, 사용자가 아직 고르지 않은 것), **평가**(8단계 표 또는 생략 사유), **재점검**(9단계 결과: 전후 건수, 사라진 ID, 새 ID), **보고만**(5단계의 리포 밖·다른 이슈·별도 이슈 항목).

변경은 작업 트리에 남기고, 갱신 단계가 써 둔 `CHANGELOG.md` `[Unreleased]` 항목·README 스킬 표와 함께 사용자가 일반 경로(`compr`)로 커밋·PR합니다 — 하네스 소유 스킬은 소비 리포로 동기화되기 때문입니다. 이 스킬은 git 상태를 바꾸지 않습니다.

## 예약 이름 기준 갱신

예약 이름은 `reserved-names.json`에 스냅샷으로 커밋돼 있고, `omp_version`이 기준 버전입니다. 설치된 omp에는 빌트인 슬래시 명령 목록을 내는 CLI가 없어서, 스냅샷은 업스트림 저장소의 해당 버전 태그 소스와 설치된 omp의 출력에서 만듭니다(정확한 출처는 파일의 `sources` 필드에 있습니다).

```bash
node .omp/skills/harness-skill-tune/scripts/skill-tune.mjs refresh-reserved
```

- 설치된 `omp`와 인증된 `gh`가 필요합니다. 네트워크로 업스트림 태그를 읽습니다.
- 이 명령이 쓰는 파일은 `reserved-names.json` 하나입니다. 바뀐 내용은 diff로 확인하고 일반 커밋 경로로 올립니다(이 스킬은 커밋하지 않습니다).
- 다섯 목록(빌트인 명령, 그 별칭, 번들 명령, CLI 하위 명령, 번들 에이전트) 가운데 하나라도 최소 개수에 못 미치면 업스트림 소스나 omp 출력 형식이 바뀐 것으로 보고 파일을 쓰지 않고 실패합니다.

## Verification

```bash
node --test .omp/extensions/harness/tests/harness-skill-tune.test.mjs
```

픽스처 세션·스킬 디렉터리로 빈도 집계, `측정 불가` 경로, 이름 충돌, 본문 정합, 보고서 형식을 확인합니다. 갱신 단계는 스크립트가 아니라 절차라 테스트가 없고, 9단계의 재점검이 각 갱신의 검증입니다.

## 한계

- 읽기 횟수에는 재읽기와 실패한 읽기가 들어갑니다. 한 호출이 세션 기록에 두 레코드로 남는 것은 tool call id로 한 번만 셉니다.
- 전체 범위는 이름으로만 귀속하므로 다른 리포나 다른 출처의 같은 이름 스킬 읽기가 섞입니다.
- `/skill:` 호출 수는 머신 전체 합산입니다. `command_usage`에 프로젝트 구분이 없습니다.
- 모델이 스킬을 읽은 것은 `read` 호출로, `/skill:` 직접 호출은 `command_usage`로 따로 셉니다. 직접 호출이 `read` 호출로도 남는지는 확인하지 않았으므로 두 수를 더하지 않습니다.
- 에이전트 디렉터리는 `PI_CODING_AGENT_DIR`과 기본 경로만 따릅니다. omp 프로필이나 XDG 배치로 세션·`agent.db`가 다른 곳에 있으면 `--sessions-dir`·`--db`로 지정합니다.
- 갱신 단계의 분류는 에이전트 판단입니다. 같은 지적이라도 근거(git 이력, 다른 문서의 참조 방식)가 없으면 판단 필요로 보내므로, 기계적으로 분류한 지적은 보고서의 근거 열로 검토합니다.
- 8단계 평가는 서브에이전트 실행이라 비결정적입니다. 프롬프트당 1회 비교이므로 결과는 참고이고, 설명문 변경을 되돌릴지는 사용자가 정합니다.
