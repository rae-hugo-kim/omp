---
name: harness-skill-tune
argument-hint: "[--repo-prefix <dir>]... [--format md|json] [--out <file>]"
description: Inspects this repo's harness skills and prints one report — per-skill usage counts from omp session transcripts, name collisions with omp reserved names and with same-named skills from other sources, and SKILL.md consistency (frontmatter, referenced paths, skills and agents, size). Read-only; it never edits a skill. Use when the user says "harness-skill-tune", "스킬 점검", "스킬 사용 빈도", "스킬 이름 충돌", "skill audit", or asks which harness skills are unused, colliding, or stale.
---

# harness-skill-tune — 스킬 점검

## Goal

이 리포의 `.omp/skills/`를 점검해 보고서 하나를 냅니다. 보고서는 스킬별 사용 빈도 표와 지적 목록이며, 스킬을 고치는 다음 단계(갱신)의 입력입니다.

지금은 **점검 단계만** 있습니다. 스킬 수정·개명·삭제·숨김은 이 스킬의 일이 아닙니다.

## Non-Negotiables

| Rule | 이유 |
|------|------|
| **읽기 전용** | `check`는 어떤 스킬 파일도 바꾸지 않습니다. 쓰는 것은 `--out`으로 지정한 보고서 파일 하나뿐이고, 그 경로가 실제로 `.omp/skills/` 아래에 떨어지거나 심볼릭 링크면 거부합니다. 지적을 보고 바로 고치지 말고 보고서로 넘깁니다. |
| **지적 대상은 이 리포의 스킬** | 리포 밖 스킬(`~/.omp/agent/skills`, `~/.claude/skills`, `~/.agents/skills` 등)은 충돌 판정의 입력으로만 읽고, 고치지도 지적하지도 않습니다. |
| **소스 리포 전용** | `scripts/harness-sync.sh` 화이트리스트에 없어 소비 리포로 가지 않습니다. 함께 배포되는 테스트는 스킬이 없으면 skip합니다. |
| **결정적 판정만 스크립트로** | 스크립트는 같은 입력에 같은 지적을 냅니다. 설명문 품질처럼 판단이 필요한 항목은 아래 3단계에서 사람이 읽는 절차로 다룹니다. |

## Process

### 1. 점검 실행

```bash
node .omp/skills/harness-skill-tune/scripts/skill-tune.mjs check
```

| 옵션 | 뜻 |
|------|----|
| `--repo-prefix <dir>` (반복 가능) | 리포 범위에 넣을 세션 cwd 접두를 더합니다. 기본값은 리포 루트와 `git worktree list`의 경로입니다. 지워진 워크트리의 세션은 기본값에 잡히지 않으므로, 워크트리를 한 디렉터리 아래에 두는 배치(Orca의 `<workspaces>/<repo>/<worktree>`)라면 그 부모 디렉터리를 넘깁니다. |
| `--agent-dir <dir>` | omp 에이전트 디렉터리입니다. 기본값은 `PI_CODING_AGENT_DIR`, 없으면 `~/.omp/agent`입니다. 세션은 그 아래 `sessions/`, `/skill:` 호출 수는 `agent.db`에서 읽습니다. 따로 옮겼다면 `--sessions-dir`·`--db`로 지정합니다. |
| `--format json` | 보고서 대신 같은 내용의 JSON을 냅니다. |
| `--out <file>` | 표준 출력 대신 파일에 씁니다(`.omp/skills/` 아래와 심볼릭 링크는 거부합니다). |
| `--skill-root <dir>` (반복 가능) | 같은 이름의 사본을 찾을 스킬 디렉터리를 더합니다. 기본값은 에이전트 디렉터리의 `skills/`, `~/.claude/skills`, `~/.agents/skills`, 그리고 `omp skill list --json`이 스킬을 보고한 디렉터리입니다. 훑지 못한 디렉터리는 머리말에 따로 적습니다. |
| `--skill-list-json <file>` | `omp skill list --json`을 직접 실행하는 대신 저장해 둔 출력을 씁니다. |

세션 디렉터리가 없거나 읽을 수 없으면, 또는 `command_usage`를 읽을 수 없으면 그 열을 `측정 불가`로 표시하고 정상 종료합니다. `omp`가 없어 스킬 목록을 얻지 못하면 머리말에 `측정 불가`로 적고, 출처 간 사본은 스킬 디렉터리를 직접 훑은 결과만으로 판정합니다. `reserved-names.json`이나 `expected-absent-paths.json`이 깨진 JSON이면 파일 이름을 알리고 실패합니다(조용히 무시하면 지적이 달라지기 때문입니다).

### 2. 보고서 읽기

머리말은 무엇을 어디서 읽었는지와 예약 이름의 **기준 omp 버전**을 적습니다. 기준 버전이 설치된 omp와 다르면 머리말이 알려 주므로, 지적을 읽기 전에 아래 "예약 이름 기준 갱신"을 먼저 합니다.

**스킬별 표**: 세션 수는 그 스킬을 한 번 이상 읽은 세션 파일 수, 읽기는 `skill://<name>` `read` 호출 수입니다. `skill://<name>/references/x.md` 같은 하위 경로 읽기는 `<name>`에 귀속합니다. 리포 범위는 세션 cwd가 리포 접두 아래인 세션만, 전체 범위는 이 머신의 모든 세션입니다.

**지적 목록**: 지적마다 ID·심각도·스킬·근거(`파일:줄`)·기계적 수정 가능 여부가 있습니다. ID는 코드·스킬·대상에서 만든 해시라 줄이 밀려도 바뀌지 않습니다.

| 코드 | 무엇 | 심각도 | 기계적 수정 |
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

### 3. 판단이 필요한 항목 (스크립트가 하지 않는 것)

보고서를 넘기기 전에 다음을 읽어서 확인하고, 결론을 보고서 아래에 덧붙입니다.

1. **읽기 0회 스킬**: 삭제 후보라고 단정하지 않습니다. 발동 조건이 한 번도 충족되지 않았는지, 설명문이 발동을 못 시키는지, 폐기 조건이 따로 적혀 있는지 봅니다(예: grepai 시범 평가 기준은 `.omp/rules/harness-mcp_policy.md`에 있습니다).
2. **설명문 품질**: `description`이 무엇을 하는지와 언제 쓰는지(사용자가 말할 법한 표현)를 함께 담는지 읽습니다. 스크립트는 존재 여부만 봅니다.
3. **`REF-PATH` 분류**: 지적된 경로가 (a) 실제로 낡은 참조인지 (b) 예시 경로이거나 실행 중에만 생기는 산출물인지 가립니다. (b)는 사유와 함께 `expected-absent-paths.json`에 넣으면 다음 점검부터 억제되고, 머리말의 억제 건수로만 남습니다. gitignore 대상 경로는 호스트마다 있고 없음이 달라 자동으로 억제합니다.
4. **`NAME-DUP` 분류**: 다른 출처의 사본이 하네스가 안내한 미러인지(`docs/rules/closeout_contract.md` §4), 내용이 갈라진 낡은 사본인지 봅니다. 로더는 충돌을 정리한 뒤의 목록만 내므로(사본을 빼거나 꺼진 출처를 건너뜁니다) "로드 목록에 없음"인 사본은 지금은 실행되지 않더라도 설정이 바뀌면 로드될 수 있습니다. 리포 밖 파일은 고치지 않고 보고만 합니다.
5. **패턴이 못 잡는 참조**: 에이전트 참조는 백틱으로 감싼 이름 뒤에 "에이전트"/"agent"가 오는 경우와 영문 이름 바로 뒤에 "에이전트"가 오는 경우만 잡습니다. 경로 참조는 백틱으로 감싼 것만 보고(펜스 코드 블록 안이어도 백틱이 있으면 봅니다), 백틱 없는 경로, 슬래시 없는 파일명, `./`·`../`로 시작하는 상대 경로, 자리표시자나 glob이 붙은 경로(`<…>`, `*`, `{…}`)는 보지 않습니다.

### 4. 전달

보고서 전문(또는 `--out` 파일)과 3단계의 결론을 사용자에게 전달합니다. 이 스킬은 여기서 끝납니다.

## 예약 이름 기준 갱신

예약 이름은 `reserved-names.json`에 스냅샷으로 커밋돼 있고, `omp_version`이 기준 버전입니다. 설치된 omp에는 빌트인 슬래시 명령 목록을 내는 CLI가 없어서, 스냅샷은 업스트림 저장소의 해당 버전 태그 소스와 설치된 omp의 출력에서 만듭니다(정확한 출처는 파일의 `sources` 필드에 있습니다).

```bash
node .omp/skills/harness-skill-tune/scripts/skill-tune.mjs refresh-reserved
```

- 설치된 `omp`와 인증된 `gh`가 필요합니다. 네트워크로 업스트림 태그를 읽습니다.
- 이 명령이 쓰는 파일은 `reserved-names.json` 하나입니다. 바뀐 내용은 diff로 확인하고 커밋합니다.
- 네 목록(빌트인 명령, 번들 명령, CLI 하위 명령, 번들 에이전트) 가운데 하나라도 최소 개수에 못 미치면 업스트림 소스나 omp 출력 형식이 바뀐 것으로 보고 파일을 쓰지 않고 실패합니다.

## Verification

```bash
node --test .omp/extensions/harness/tests/harness-skill-tune.test.mjs
```

픽스처 세션·스킬 디렉터리로 빈도 집계, `측정 불가` 경로, 이름 충돌, 본문 정합, 보고서 형식을 확인합니다.

## 한계

- 읽기 횟수에는 재읽기와 실패한 읽기가 들어갑니다. 한 호출이 세션 기록에 두 레코드로 남는 것은 tool call id로 한 번만 셉니다.
- 전체 범위는 이름으로만 귀속하므로 다른 리포나 다른 출처의 같은 이름 스킬 읽기가 섞입니다.
- `/skill:` 호출 수는 머신 전체 합산입니다. `command_usage`에 프로젝트 구분이 없습니다.
- 모델이 스킬을 읽은 것은 `read` 호출로, `/skill:` 직접 호출은 `command_usage`로 따로 셉니다. 직접 호출이 `read` 호출로도 남는지는 확인하지 않았으므로 두 수를 더하지 않습니다.
- 에이전트 디렉터리는 `PI_CODING_AGENT_DIR`과 기본 경로만 따릅니다. omp 프로필이나 XDG 배치로 세션·`agent.db`가 다른 곳에 있으면 `--sessions-dir`·`--db`로 지정합니다.
