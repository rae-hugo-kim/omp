# Handoff 2026-10-16 — omp 18.11.1 누적 패치(18.3.1~18.11.1) 대비 하네스 마찰 감사

- 발신: omp 리포 세션 (2026-10-16, 호스트 설치 버전 `omp 18.10.4`, 대조 대상 `v18.3.1` ~ `v18.11.1`)
- 수신: omp 리포(하네스 SoT) 후속 작업 세션 (사이클 ①~③ 분할 제안)
- 상태: 분석 완료, 구현 미착수 (이슈 미발행)
- 역할: `seed.yaml`의 전신(pre-seed 입력) — kickoff 또는 이슈 발행 후 권위는 `docs/harness/seed.yaml`로 넘어갑니다 (`docs/rules/artifact_roles_contract.md` §Handoff).

## 한 줄 요약

하네스의 마지막 정식 마찰 감사 기준선인 `omp 18.3.0`(2026-09-24, 이슈 #40~#43) 이후 `18.3.1`부터 `18.11.1`(2026-10-15)까지 누적된 28개 릴리즈와 현행 `omp` 바이너리·내장 문서(`omp://`)를 대조해 발견한 **게이트 런타임 결함 4건, 서브에이전트·오케스트레이션 계약 충돌 4건, 워크트리·확장 기능 충돌 3건, 문서·주석 드리프트 5건**을 정리하고 후속 사이클 분할안을 제안합니다.

---

## 배경 및 버전 기준선

1. **직전 마찰 감사 기준선**: `omp 18.3.0` (`docs/harness/archive/20260924-omp1830-friction/seed.yaml`, 이슈 #40~#43, 하네스 `2026.80`).
2. **현재 워크스테이션 설치 버전**: `omp 18.10.4` (2026-10-13 발행).
3. **업스트림 최신 릴리즈**: `omp 18.11.1` (2026-10-15 발행, 직전 `18.11.0`은 2026-10-14 발행).
4. `18.3.1` ~ `18.11.1` 사이에 `read`(jq `?q=` 쿼리, 신규 내부 URL 스킴 4종), `write`(`[path#TAG]` 래퍼 자동 해제), `edit`(파일명 내 `#` 허용, 768B 초과 잘린 줄 `:raw` 강제), `bash`(`env` 입력 제거, 비-0 종료 시 `isError: true`, CoW 워크트리 복제), `task`(`solutionSpace` 필수화, `speculativeLaunch`, `task.structured: false` 기본값 전환, 서브에이전트 빌드/테스트 실행 금지 지침), 컨텍스트 디스커버리(`contextFiles.extra`, `RULES@project` 분리, `/tmp` 비-git 루트 차단)가 변경되었습니다.

---

## 1. 18.10.4 → 18.11.0 / 18.11.1 직결 변경점

현재 설치된 `18.10.4`에서 `18.11.1`로 업데이트할 때 바로 적용되는 변경 사항입니다.

| 버전 | 영역 | 업스트림 변경 내용 | 하네스·운영 영향 |
|---|---|---|---|
| `18.11.1` | Antigravity / Argon | `gemini-4-argon`이 `thinkingBudget` 대신 `thinkingLevel`(`low`, `medium`, `high`만 허용)을 보내도록 수정 (#15643), `disabled: true` 모델 로스터 제외 (#15684), 은퇴된 `gemini-3.5-flash`/`gemini-3-flash` 제거 (#15445) | 주력 모델(`google-antigravity/gemini-4-argon`) 요청 실패 해소. 단, `gh-loop`·`gh-fanout` 워커 기동 시 Argon에 `xhigh`/`max`/`minimal`을 넘기면 거부됩니다. |
| `18.11.1` | Subagent / IRC | 서브에이전트가 `write agent://<id>`로 오너에게 메시지를 보낸 뒤 wake 턴을 마칠 때 거짓 `"no output"` 에러가 나던 버그 수정 (#15834), `/jobs`에 서브에이전트 백그라운드 잡 트리 표시 (#15854) | `.omp/rules/harness-agent_routing.md:40`의 `write agent://<id>` + `wait` 후속 질의 경로가 안정화됩니다. |
| `18.11.1` | `read` / `grep` | 닫힌 `read :raw:A-B` 범위가 요청 줄만 반환 (#15810), `local://`·`artifact://`에서도 JSON/JSONL `?q=` 필터·페이지네이션 작동 (#15767), `grep`/`ast_grep`의 디렉터리 매칭 글롭(`dir/*`, `src/{a,b}`)이 하위 디렉터리까지 재귀 검색 (#15760) | 로컬 JSON/JSONL `?q=` 읽기가 `read-path.mjs`에서 스트립되지 않아 `context-gate` false-block을 유발합니다(§2 F1). |
| `18.11.0` | Hashline `edit` | `read`나 `grep`에서 컬럼 제한(768B)으로 잘린 줄을 편집하려 하면 **`:raw`로 전체 줄을 읽기 전까지 `edit`를 거부** (#15649) | 긴 줄이 많은 `CHANGELOG.md`·`.omp/rules/harness-harness_integration_contract.md` 편집 시 일반 `read`/`grep`만으로는 `edit`가 거부되므로 `:raw` 범위 읽기가 필수입니다. |
| `18.11.0` | Project Discovery | 공유 임시 루트(`/tmp`, `/var/tmp` 등) 아래의 비-git(unanchored) 작업 디렉터리나 외부 계정 `~/.omp`에서 `.omp` 확장·규칙·컨텍스트 파일·스킬 로드를 차단 (#15719) | `/tmp` 아래에서 `git init` 없이 `omp -p`로 하네스 확장·규칙을 프로브하면 `.omp`가 로드되지 않습니다(`.omp/rules/harness-harness_integration_contract.md:75` 주의). |
| `18.11.0` | Agent `structured` | 에이전트 frontmatter에 `structured: true` 추가 — 전역 `task.structured`(18.10.2부터 기본 `false`)가 꺼져 있어도 해당 에이전트는 `yield`와 출력 스키마 검증을 유지 (#15717) | unstructured 기본값 전환과 맞물려 서브에이전트 종료 규칙에 영향을 줍니다(§3 F6). |

---

## 2. 게이트·어댑터 코드 마찰 지점 (`gates/read-path.mjs`, `gates/git-commit-detect.mjs`, `index.ts`)

### F1. [높음] `read`의 `?q=` 쿼리 미스트립으로 인한 `context-gate` False-Block
- **근거**:
  - 업스트림: `18.7.0`에서 `read`에 JSON/JSONL 인프로세스 jq 쿼리(`file.json?q=<jq-filter>&raw=true&compact=true&offset=&limit=`)가 추가되었고(`18.8.7`·`18.11.1` 확장), 이미지(`logo.png?q=<question>`)와 SQLite(`db.sqlite:table?limit=20`, `db.sqlite?q=SELECT...`)도 `?` 쿼리를 받습니다(`omp://tools/read.md` Inputs / Modes).
  - 바이너리 확인(`18.10.4` `splitJsonQueryTarget` / `ReadTool`): `ReadTool`은 `?` 앞의 파일 경로를 해석하고 결과의 `event.details.resolvedPath`에 실제 로컬 파일 절대 경로를 담아 반환합니다.
  - 하네스: `.omp/extensions/harness/gates/read-path.mjs:27-29, 41-45`의 `readTarget(input, cwd)`는 `input.path`에서 콜론 기반 `READ_SELECTOR`만 제거합니다.
- **증상**: 에이전트가 `read({ path: "package.json?q=.scripts" })` 또는 `read({ path: "docs/harness/audit.jsonl?q=.event&limit=5" })`를 실행하면 `.omp/harness-state/read-log.txt`에 `<cwd>/package.json?q=.scripts`라는 유령 경로가 기록됩니다. 이후 `package.json`을 `edit`/`write`하면 `context-gate`가 읽지 않은 파일로 판정해 차단합니다.
- **해결 방향**: `readTarget()`에서 쿼리 스트링(`?` 이후) 및 SQLite/아카이브 콜론 셀렉터를 처리하거나, `index.ts:616-619`(`tool_result` `read`)에서 `event.details?.resolvedPath`(가상 경로가 아닌 로컬 경로일 때)를 우선 사용하고 `readTarget(event.input, ctx.cwd)`을 폴백으로 둡니다. 또한 `READ_SELECTOR`에 바이너리 `splitPathAndSel`(`ko`)과 동일하게 대소문자 무시(`/i`) 및 `:-N+C`(`-\d+(?:[-+]\d+)?`)를 반영합니다.

### F2. [높음] `write`의 복사된 `[path#TAG]` 래퍼 미해제로 인한 `context-gate` 우회 및 원장 오염
- **근거**:
  - 업스트림: `omp://tools/write.md`(Inputs / Flow 1: `"WriteTool.execute() unwraps a copied [path#TAG] argument"`) 및 바이너리 `unwrapHashlineHeaderPath`(`ese`) 확인 결과, `write`에 `path: "[src/foo.ts#1A2B]"`를 넘기면 래퍼를 벗기고 실제 `src/foo.ts`에 기록합니다.
  - 하네스: `.omp/extensions/harness/gates/read-path.mjs:164-167`의 `editTargets("write", input, cwd)`는 `input.path`를 그대로 `localFileTarget`에 넘깁니다.
- **증상**:
  1. `tool_call` 시점에 `context-gate.mjs:42`(`!existsSync(filePath)`)가 디스크에 `<cwd>/[src/foo.ts#1A2B]`가 없으므로 신규 파일로 판정해 **읽지 않은 기존 파일 `src/foo.ts` 덮어쓰기를 허용(게이트 우회)** 합니다. `cross-repo` 가드 역시 엉뚱한 경로를 검사합니다.
  2. `tool_result` 시점에 `write-tracker`와 `backpressure-invalidator`가 `<cwd>/[src/foo.ts#1A2B]`를 기록하여, 이후 `src/foo.ts`를 `edit`할 때 `context-gate`가 false-block합니다.
- **해결 방향**: `read-path.mjs`의 `localFileTarget`(또는 `editTargets("write", ...)` 및 `readTarget`) 입구에서 `WriteTool`의 `unwrapHashlineHeaderPath`와 동일한 규칙으로 외곽 `[path#TAG]` 래퍼를 먼저 벗깁니다.

### F3. [중간] `URI_SCHEME_PREFIX`의 신규 내장 스킴 4종 누락
- **근거**:
  - 업스트림: `omp://tools/read.md`(L175 "Internal URLs") 기준 `InternalUrlRouter` 내장 스킴은 `agent`, `artifact`, **`attachment`**(`18.3.1`), **`cfg`**(`18.3.1`), `conflict`, `history`, `issue`, `local`, `mcp`, `memory`, `omp`, `pr`, `proc`, `rule`, **`security`**, `skill`, `ssh`, **`vault`**, `xd` 총 19종입니다.
  - 하네스: `.omp/extensions/harness/gates/read-path.mjs:59-60`의 `URI_SCHEME_PREFIX`에는 `attachment`, `cfg`, `security`, `vault` 4종이 빠져 있습니다.
- **증상**: `cfg://`와 `vault://`는 `write` 대상이 될 수 있는 스킴이므로, 이벤트 배관에서 단일 슬래시(`cfg:/...`, `vault:/...`)로 정규화될 경우 로컬 파일(`<cwd>/cfg:/...`)로 오판되어 원장에 유입됩니다.
- **해결 방향**: `URI_SCHEME_PREFIX` 정규식에 `attachment|cfg|security|vault`를 추가하고 `tests/read-path.test.mjs`에 양쪽 슬래시 형태(`://`, `:/`) 회귀 테스트를 추가합니다.

### F4. [낮음] `SEARCH_ANCHOR_HEADER`의 파일명 내 `#` 미허용
- **근거**:
  - 업스트림: `18.4.1`(#13428 `fix(hashline): accepted '#' in tagged header paths`)에서 파일 경로 자체에 `#`이 포함된 경우(예: yadm `config##Linux`)도 해시라인 헤더로 허용합니다.
  - 하네스: `.omp/extensions/harness/gates/read-path.mjs:126`의 `SEARCH_ANCHOR_HEADER = /^\[([^\]\n#]+)#[0-9A-Fa-f]{4,}\]\s*$/gm`는 `[^\]\n#]+`로 경로 안의 `#`을 거부합니다.
- **해결 방향**: 캡처 그룹을 `^\[([^\]\n]+)#[0-9A-Fa-f]{4,}\]\s*$`로 완화하여 마지막 `#TAG` 앞까지의 경로에 `#`이 포함될 수 있게 합니다.

---

## 3. 서브에이전트·오케스트레이션 마찰 지점

### F5. [높음] 서브에이전트 빌드/테스트 실행 금지 지침(`18.4.12`) vs `verifier.md`·`reviewer.md` 충돌
- **근거**:
  - 업스트림: `18.4.12`("Changed subagents to skip their own builds, tests, and smoke runs and leave verification to the main agent, avoiding CPU spikes from many subagents verifying at once")부터 `task` 프롬프트에 **`Every task MUST skip build/lint/tests/formatters mid-flight; run once afterward.`** 지침이 상시 주입됩니다.
  - 하네스: `.omp/agents/verifier.md:29, 61-65, 80, 125-126`은 `"Run actual commands (build/test) — don't trust cached status alone"`을 MUST로 요구하며, `.omp/agents/reviewer.md:85`도 자식 에이전트가 검증 명령을 실행할 때 파이프를 쓰지 말라고 안내합니다.
- **증상**:
  1. `verifier`가 시스템 프롬프트의 `task` 규칙(테스트 실행 금지)과 에이전트 프롬프트(테스트 직접 실행 필수) 사이에서 모순된 지시를 받습니다.
  2. 서브에이전트가 같은 워크트리에서 테스트를 돌리면 `.omp/harness-state/backpressure-status`와 `test-history.json`을 부모 세션과 공유해 상태 경합을 일으킵니다.
- **해결 방향**:
  - 방향 A: 메인 에이전트가 `verifier`를 스폰하기 직전에 포그라운드에서 검증 명령을 실행해 `.omp/harness-state/backpressure-status`(`PASS`)와 `test-history.json`을 갱신하고, `verifier.md`는 기본적으로 그 실측 로그·상태와 산출물·AC 대조를 검증하되, 상태가 `PASS`가 아닐 때만 예외적으로 실행하거나 FAIL을 반환하도록 개정합니다.
  - 방향 B: `verifier`만은 검증 전용 에이전트임을 명시해 시스템 프롬프트의 일반 구현 서브에이전트 규칙("mid-flight 생략")에 대한 명시적 예외 문구를 `verifier.md`에 넣고, 실행 시 반드시 파이프 없는 정식 명령만 쓰도록 고정합니다. (`reviewer`/`adversary`/`code-reviewer`는 리뷰 전용이므로 테스트 실행을 하지 않도록 명시합니다.)

### F6. [중간] `task` 스키마의 `solutionSpace` 필수화(`18.3.4`) 및 `task.structured: false` 기본값 전환(`18.10.2`)
- **근거**:
  - 업스트림: `18.3.4`에서 `task` 항목의 `complexity`가 제거되고 **`solutionSpace`가 필수(`required: ["task", "solutionSpace"]`)** 로 추가되었습니다. 또한 `18.10.2`에서 `task.structured` 기본값이 `false`로 바뀌어 일반 `task` 서브에이전트에서 `yield` 도구가 빠지고 마지막 텍스트 메시지가 곧 반환값이 되며, **마지막 텍스트 메시지 없이 종료된 서브에이전트는 실패(`Fails unstructured task runs that conclude without a final message`)** 처리됩니다(`18.11.0` #15717에서 에이전트 frontmatter `structured: true` 옵션 추가).
  - 하네스: `.omp/agents/reviewer.md:50-57, 74-81`의 Pass 2(`AdversaryReview`)·Pass 3(`CodeReviewerPass`) 스폰 예시에 `solutionSpace` 필드가 빠져 있습니다.
- **해결 방향**: `reviewer.md`의 Pass 2/3 `task({...})` 예시에 `solutionSpace` 필드를 추가하고, `reviewer.md` `<Output_Format>`에 "`.md`와 `.json` 사이드카 파일을 `write`한 뒤 반드시 최종 응답 메시지로 리뷰 요약과 Verdict를 출력하고 종료할 것(파일 쓰기만으로 턴을 끝내면 unstructured subagent가 실패 처리됨)"을 명시합니다.

### F7. [중간] 하네스 확장 로드 시 `task.speculativeLaunch`(`18.4.3`) 및 Speculative Read 자동 비활성화
- **근거**:
  - 업스트림: `18.4.3`에서 배치 `task` 스트리밍 중 완료된 항목부터 즉시 기동하는 `task.speculativeLaunch`(기본 `true`)와 로컬 `read` 선행 실행이 추가되었습니다.
  - 바이너리 확인(`18.10.4` `packages/coding-agent/src/speculation/host.ts`의 `authorizeLaunch`):
    ```js
    function c6(u) {
      return u.hasHandlers("tool_call") || u.hasHandlers("tool_result") || u.hasHandlers("tool_approval_requested") || u.hasHandlers("tool_approval_resolved");
    }
    ```
    확장 러너에 `tool_call`이나 `tool_result` 핸들러가 하나라도 등록되어 있으면 툴 종류를 불문하고 `{ allowed: false, reason: "active extension lifecycle handler" }`를 반환합니다.
- **증상**: `.omp/extensions/harness/index.ts`가 `tool_call`/`tool_result`를 구독하므로 하네스가 있는 모든 리포에서 `task.speculativeLaunch`가 작동하지 않습니다.
- **해결 방향**: 하네스 코드만으로는 우회할 수 없는 업스트림 구조(전역 boolean 체크)이므로, `.omp/rules/harness-harness_integration_contract.md`의 Known residual surfaces에 이 사실을 기록하고 필요 시 업스트림(`can1357/oh-my-pi`)에 툴별 핸들러 스코프 또는 speculative launch 허용 플래그를 제안합니다.

### F8. [낮음] `commitTargetDir`의 선행 `cd <dir> &&` 미추적
- **근거**:
  - `.omp/extensions/harness/gates/git-commit-detect.mjs:886`의 `commitTargetDir()`는 `CWD_SHIFTERS`(`cd` 등)가 하나라도 있으면 `null`을 반환합니다. 반면 `shellWriteTargets`(`cross-repo.mjs`)와 `verificationCwd`(#58 `backpressure`)는 선행 리터럴 `cd <dir> &&` 1회를 추적합니다.
- **증상**: 같은 리포의 링크드 워크트리에 `cd <worktree> && git commit -m "..."`를 실행하면 `cross-repo`는 통과하지만 `index.ts:239`의 `snapshotHead`가 스냅샷을 찍지 못해(`commit.landed === null`), 커밋 착지 판정이 reflog 대신 exit code 폴백으로 떨어집니다.
- **해결 방향**: `commitTargetDir`도 `verificationCwd`/`shellWriteTargets`와 동일하게 선행 리터럴 `cd <existing-dir> &&` 1회를 허용하도록 정합화할지 결정합니다.

---

## 4. 워크트리·확장 기능 마찰 지점

### F9. [높음] CoW 워크트리 복제(`PI_SMART_GIT=1` / `worktree.clone`, `18.4.3`) 시 `.omp/harness-state/` 오염
- **근거**:
  - 업스트림: `18.4.3`의 `PI_SMART_GIT=1` 및 `omp://tools/bash.md`(Flow 5)의 `worktree.clone` 설정이 활성화되면 `bash`에서 실행하는 `git worktree add`가 체크아웃 전체를 Copy-on-Write 복제하여 **`node_modules/`뿐 아니라 모든 gitignored 파일을 새 워크트리에 그대로 복제**합니다.
  - 하네스: `.omp/harness-state/`(`backpressure-status`, `read-log.txt`, `gated-commit-token` 등)와 `docs/reviews/`는 모두 gitignored입니다.
- **증상**: CoW 복제로 만들어진 링크드 워크트리에 메인 워크트리의 `backpressure-status=PASS`와 `read-log.txt`가 그대로 복사되어, **새 워크트리에서 파일을 읽지 않고 편집하거나 테스트를 실행하지 않고 커밋해도 게이트가 통과**합니다(#58 격리 계약 위반).
- **해결 방향**:
  - `read-tracker`/`write-tracker`/`context-gate` 및 `backpressure-tracker`/`backpressure-gate`가 상태 파일을 읽고 쓸 때 워크트리의 실경로(`realpathSync(cwd)`) 헤더나 메타 필드를 검증해 다른 워크트리에서 복제된 상태 파일을 무효(stale/untrusted)로 취급하거나,
  - 최소한 `.omp/rules/harness-harness_integration_contract.md` 및 `gh-loop`/`gh-fanout`에 `PI_SMART_GIT=1` / `worktree.clone` 사용 시 `.omp/harness-state/` 초기화 주의사항을 명시합니다.
  - 아울러 `18.8.6`에 추가된 `worktree.onStart: true` 사용 시 모든 세션이 링크드 워크트리로 기동되어 #68 `harness-check` 가드에 걸리는 점도 함께 안내합니다.

### F10. [중간] `tool_result`의 `additionalContext`(`18.3.1` / `18.4.4`) 미사용
- **근거**:
  - 업스트림: `18.3.1` 및 `18.4.4`(#13267)에서 확장 `tool_result` 반환값에 `additionalContext` 필드가 추가되어, 툴 출력(`content`)을 변조하지 않고 developer 채널로 모델에게 후속 지시를 보낼 수 있습니다.
  - 하네스: `.omp/extensions/harness/index.ts:499, 674`는 여전히 `{ content: [...(event.content ?? []), { type: "text", text: ... }] }`로 `event.content`를 직접 덮어씁니다.
- **해결 방향**: `index.ts`의 `ToolResultPatch`에서 `additionalContext` 지원 여부를 확인해 전환하거나 병행할지 검토합니다(단, 기존 단위 테스트 `tests/harness-wiring.test.mjs` 등이 반환된 `content` 배열을 검사하므로 테스트 계약과 함께 변경해야 합니다).

### F11. [낮음] `bash.gitGuard`(`18.8.7`)와 `acceptance-gate` 복구 안내 문구의 상호작용
- **근거**:
  - 업스트림: `18.8.7`에서 추가된 `bash.gitGuard`(기본 `off`)를 켜면 `bash` 도구가 `git stash`, `git reset --hard`, 그리고 워킹트리 파일을 덮어쓰는 `git checkout`/`switch`/`restore`를 거부합니다(언스테이징 `git restore --staged`는 허용).
  - 하네스: `.omp/extensions/harness/gates/acceptance-gate.mjs`의 false-closeout 차단 안내 메시지는 `git restore --staged --worktree -- <paths>`를 안내합니다.
- **해결 방향**: `bash.gitGuard`가 켜진 환경에서는 `--worktree` 복원이 차단될 수 있으므로 안내 문구 또는 통합 계약에 참고 사항으로 기록합니다.

---

## 5. 문서·주석·설정 드리프트 (D1~D5)

| ID | 대상 파일 (라인) | 현재 하네스 서술 | `18.11.1` / `omp://` 실제 동작 및 정정 내용 |
|---|---|---|---|
| **D1** | `AGENTS.md:32`, `claudedocs/CLAUDEKR.md:43` | `.omp/RULES.md`와 `~/.omp/agent/RULES.md`가 둘 다 고정 이름 `RULES`를 써서 사용자 파일에 가려진다(`omp://context-files.md` 인용)고 서술 | 현행 `omp://context-files.md`("Sticky rules vs normal context"): **`User and project candidates have distinct rule names: RULES and RULES@project. Both can load together.`** 업스트림에서 이름이 분리되어 양쪽이 공식적으로 함께 로드됩니다. |
| **D2** | `.omp/rules/harness-mcp_policy.md:8`, `.omp/rules/harness-context_management.md:103`, `.omp/skills/bootstrap/SKILL.md:116` | `"Claude Code의 ~/.claude.json은 OMP가 읽지 않는다"`고 단정 | 현행 `omp://mcp-config.md`("Imported tool configs"): OMP는 `~/.claude.json`, `~/.claude/mcp.json`, 프로젝트 `.claude/.mcp.json`을 우선순위 3위로 자동 변환·로드합니다(사용자 `~/.omp/agent/AGENTS.md`의 서술이 맞음). OMP 고유 관리는 `~/.omp/agent/mcp.json` 또는 `.omp/mcp.json`을 권장하되, `~/.claude.json`도 읽는다는 사실로 바로잡아야 합니다. |
| **D3** | `.omp/extensions/harness/index.ts:83-85`, `.omp/rules/harness-harness_integration_contract.md:103`, `.omp/rules/harness-hook_recipes.md:33` | `bash` 도구가 비-0 종료 시 `isError`를 `false`로 유지하고 `details.exitCode`만 설정한다고 서술 | 현행 `omp://tools/bash.md`(Outputs / Errors): 비-0 종료 및 타임아웃은 **`isError: true`로 반환**되며 `details.exitCode`도 함께 담깁니다. `bashRunFailed()` 코드 자체는 둘 다 검사하므로 안전하나 주석·문서를 현행화해야 합니다. |
| **D4** | `.omp/extensions/harness/index.ts:536-550, 649`, `.omp/rules/harness-harness_integration_contract.md` | `bash` 도구의 구조화 입력 `event.input?.env`를 추출해 게이트로 전달 | `18.4.4`에서 `bash` 도구의 `env` 파라미터가 제거되었습니다(`omp://tools/bash.md`: `"There is no env input"`). 방어적 폴백 코드는 유지하되 주석에 `18.4.4` 제거 사실을 명시합니다. |
| **D5** | `AGENTS.md:29-36`, `claudedocs/CLAUDEKR.md:40-46`, `.omp/rules/harness-harness_integration_contract.md:82-83, 104` | 실측 기준선이 `omp 18.3.0 (2026-09-24)`에 머물러 있고, `18.8.8`(#15147)의 `contextFiles.extra`(`AGENTS.local.md` 등) 미언급 | `18.11.1` 기준으로 실측 주석을 갱신하고, Consumer extension points 표에 `contextFiles.extra`를 안내할지 검토합니다. |

---

## 6. 사이클 분할 제안 (`rule://harness-cycle_definition`)

변경 성격(게이트 런타임 코드 vs 에이전트·문서 정합 vs 워크트리 CoW 상태 격리)이 다르므로 아래 3개 사이클로 나누어 진행하는 것을 제안합니다.

| 사이클 | 범위 | 산출물 | 확인 문장 (1줄) |
|---|---|---|---|
| **사이클 ① (게이트 경로·스킴 동기화)** | F1(`read` `?q=` 스트립), F2(`write` `[path#TAG]` 언래핑), F3(`URI_SCHEME_PREFIX` 4종 추가 + `READ_SELECTOR` `/i`·`:-N+C`), F4(`SEARCH_ANCHOR_HEADER` 경로 내 `#` 허용) | `.omp/extensions/harness/gates/read-path.mjs`, `.omp/extensions/harness/tests/read-path.test.mjs` | `node --test .omp/extensions/harness/tests/read-path.test.mjs`가 F1~F4 신규 케이스를 포함해 전부 통과한다. |
| **사이클 ② (에이전트·문서·주석 18.11.1 정합화)** | F5(`verifier.md`/`reviewer.md` 테스트 실행 규칙 정리), F6(`reviewer.md` `solutionSpace` 및 최종 텍스트 응답 명시), F7(`speculativeLaunch` 잔존면 기록), F11(`bash.gitGuard` 참고), D1~D5 문서·주석 갱신 + `CLAUDEKR.md` 동기화 | `.omp/agents/{reviewer,verifier}.md`, `.omp/rules/harness-{harness_integration_contract,mcp_policy,context_management,hook_recipes}.md`, `.omp/skills/bootstrap/SKILL.md`, `.omp/extensions/harness/index.ts`(주석), `AGENTS.md`, `claudedocs/CLAUDEKR.md` | `node scripts/docs-drift`가 0 warning/error로 통과하고 전체 하네스 테스트 스위트가 통과한다. |
| **사이클 ③ (선택 — 워크트리 CoW 복제 시 상태 격리 보강)** | F9(`PI_SMART_GIT=1` / `worktree.clone` 사용 시 `.omp/harness-state/` 복제 방어) 및 F8(`commitTargetDir` 선행 `cd` 정합화) | `.omp/extensions/harness/gates/{backpressure-*,read-tracker,write-tracker,context-gate,git-commit-detect}.mjs` 및 테스트 | 다른 워크트리 경로에서 복제된 `.omp/harness-state/`가 새 워크트리에서 `PASS`/읽음 증거로 인정되지 않음이 단위 테스트로 증명된다. |

---

## 7. 수용 기준 후보 (사이클 ①+② 통합 또는 개별 seed용)

- [ ] **AC1 (`read-path.mjs` 쿼리·래퍼·스킴·앵커 보강)**:
  - `readTarget({ path: 'package.json?q=.scripts' }, CWD)` 및 `.jsonl?q=...&limit=5`, `logo.png?q=...`, `db.sqlite?q=...`가 쿼리 스트링을 벗긴 로컬 파일 경로를 반환한다.
  - `editTargets('write', { path: '[src/foo.ts#1A2B]' }, CWD)`가 `<cwd>/src/foo.ts`를 반환한다.
  - `URI_SCHEME_PREFIX`가 `attachment`, `cfg`, `security`, `vault`를 `://`와 `:/` 양쪽 형태에서 가상 경로로 판정해 `readTarget`→`""`, `localFileTarget`→`null`을 반환한다.
  - `SEARCH_ANCHOR_HEADER`가 `[path/with#hash.ts#1A2B]`를 매칭하고 `READ_SELECTOR`가 대소문자 구분 없이(`:RAW`, `:IMG`) 및 `:-60+10`을 스트립한다.
- [ ] **AC2 (에이전트 정의 정합화)**:
  - `.omp/agents/reviewer.md`의 Pass 2·Pass 3 `task` 스폰 예시에 `solutionSpace` 필드가 포함되고, `<Output_Format>`에 사이드카 파일 작성 후 반드시 최종 텍스트 응답을 남기라는 지시가 명시된다.
  - `.omp/agents/verifier.md`와 `.omp/agents/reviewer.md`의 테스트 실행 지시가 `omp 18.4.12+` 서브에이전트 규칙 및 공유 `.omp/harness-state/` 경합 방지 방침과 모순되지 않게 정리된다.
- [ ] **AC3 (문서·주석 드리프트 D1~D5 해소)**:
  - `AGENTS.md`·`claudedocs/CLAUDEKR.md`에서 `.omp/RULES.md` 서술이 `RULES@project` 공존(`omp://context-files.md`)에 맞게 갱신된다.
  - `.omp/rules/harness-mcp_policy.md`·`harness-context_management.md`·`.omp/skills/bootstrap/SKILL.md`에서 `~/.claude.json` 미로드 오기가 `omp://mcp-config.md` 기준으로 정정된다.
  - `.omp/extensions/harness/index.ts`·`.omp/rules/harness-harness_integration_contract.md`·`harness-hook_recipes.md`에서 `bash` `isError`·`env` 제거·`speculativeLaunch` 잔존면·`/tmp` 비-git 디스커버리 주의사항이 갱신된다.
- [ ] **AC4 (검증 통과)**:
  - `node --test .omp/extensions/harness/tests/*.test.mjs` 전 항목 통과 및 `node scripts/docs-drift` 통과.

---

## 8. 범위 밖 (Out of Scope)

- `omp` 바이너리 자체를 `18.10.4`에서 `18.11.1`로 업그레이드하는 작업 (`omp update`는 사용자가 직접 실행).
- 업스트림 `can1357/oh-my-pi`의 `speculation/host.ts`(`c6(extensionRunner)`) 동작 변경 — 하네스 밖 업스트림 영역이므로 잔존면 기록까지만 수행.
- `index.ts`의 `tool_result` 패치를 `content`에서 `additionalContext`로 전면 교체하는 작업(F10) — 기존 테스트 계약과 에이전트 가시성 비교 후 별도 판단.
