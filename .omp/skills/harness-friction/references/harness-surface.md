# harness-friction — 대조 축과 읽기 지시 (scout 브리핑)

릴리스 노트 묶음을 읽는 에이전트에게 그대로 건네는 문서입니다. 아래 "하네스 표면"에 닿는 변경만 보고하고, 나머지는 무관으로 버립니다. 읽는 범위는 큐레이션 패키지 절(`## @oh-my-pi/<pkg>` 아래 `### Added / Changed / Fixed / Removed / Breaking Changes`)이고, `What's Changed`·`New Contributors`는 PR 목록이라 읽지 않습니다. 묶음의 모든 불릿을 읽고 읽은 릴리스·불릿 수를 적습니다.

## 하네스 표면 (업스트림 변경이 여기에 닿아야 의미가 있습니다)

1. **확장 런타임** — `.omp/extensions/harness/index.ts`. 구독 이벤트 `tool_call`·`tool_result`·`before_agent_start`·`session_start`. 읽는 필드 `event.toolName`, `event.input`(`command`·`cwd`·`async`·`env`·`path`·`edits`·`content`), `event.details`(`exitCode`·`async.state`), `event.content`, `event.isError`, `ctx.cwd`, `ctx.hasUI`, `ctx.ui.notify`, `ctx.sessionManager.getBranch()`, `pi.logger`. `tool_result`에 `{ content: [...] }` 패치, `tool_call`에 `{ block, reason }`을 돌려줍니다. 게이트는 `node`로 띄우는 `gates/*.mjs`(stdin JSON, exit 0 허용 / exit 2 차단)이고, `mermaid-check.ts`는 omp 번들 `@oh-my-pi/pi-utils` 파서를 동적 import합니다. 특별 취급 도구 이름: `bash`·`read`·`grep`·`edit`·`write`·`mcp__*`·`xd://` 디바이스 쓰기.
2. **경로·셀렉터 파싱** — `gates/read-path.mjs`: `READ_SELECTOR`(콜론 셀렉터 `:50-80`·`:raw`·`:img`·`:-5`·`:conflicts`), `URI_SCHEME_PREFIX`(단일 슬래시 정규화된 내부 스킴 allowlist), `SEARCH_ANCHOR_HEADER`(`[path#TAG]` 해시라인 헤더), `?q=` 쿼리, `write`의 `[path#TAG]` 언래핑. `read`·`edit`·`write`·`grep`·`glob` 입력 형태, 새 셀렉터, 새 내부 URL 스킴, 해시라인 헤더 형식, `edit.enforceSeenLines`가 바뀌면 관련입니다.
3. **bash 도구** — `gates/git-commit-detect.mjs`·`cross-repo.mjs`·`backpressure-*.mjs`·`destructive-guard.mjs`: `event.input.command`·`cwd`·`async`, 종료 코드, `isError`, 백그라운드 잡의 `details.async.state === "running"`, 선두 리터럴 `cd <dir>` 1개(cwd 이동으로 모델링), `bash.gitGuard`, `PI_SMART_GIT`·워크트리 복제, 세션 셸 지속(변수·함수), `pty`·`timeout`·서비스 모드.
4. **에이전트** — `.omp/agents/{reviewer,verifier,adversary,adversary-opus,adversary-argon,code-reviewer}.md` frontmatter(`model` 고정값·롤 참조, `thinkingLevel`, `tools`, `spawns`, `structured`). `task` 도구 스키마(`solutionSpace`·`model`·`agent`·`name`·`tools`·`context`), `task.structured`·`speculativeLaunch`·`perCallModel`·`maxEffort`·`workerThreads`, 서브에이전트 깊이 제한, `write agent://<id>`·`agent://all`, `wait` 반환 조건, `yield`, 에이전트 탐색 루트(`.omp/agents`·플러그인·`enabledProviders`), `omp agents unpack --json`, `modelRoles`(`advisor slow task default smol tiny plan vision commit designer web`)와 롤 기본값, `retry.fallbackChains`, 프로바이더 중지·제거, 카탈로그 변경(`omp models`).
5. **스킬·규칙·컨텍스트 파일** — `.omp/skills/*/SKILL.md` frontmatter(`name`·`argument-hint`·`description`, 설명 길이 제한), `/skill:<name>` 호출, `omp skill list --json`, 스킬 탐색 루트(`~/.omp/agent/skills`·`~/.claude/skills`·`~/.agents/skills`·`skills.manualSkills`), `.omp/rules/*.md` frontmatter(`alwaysApply`·`globs`·`description`·`condition`), `rule://<name>`, `.omp/RULES.md`와 `RULES@project`, `AGENTS.md`/`.omp/AGENTS.md` 우선순위, `contextFiles.extra`, `/tmp` 비-git 탐색 차단, `omp://` 문서, `cfg://`, `ask` 도구 입력 형식.
6. **하네스가 호출하는 CLI** — `omp --version`, `omp config get modelRoles`, `omp config get enabledProviders`, `omp config list`, `omp skill list --json`, `omp agents unpack --dir X --json`, `omp models [provider] [--kind all] [--json]`, `omp -p --no-session --no-rules --no-skills --no-extensions`, `omp -p --auto-approve`, `omp --extension <file> --model <id> --thinking <level>`, `gh release list/view`.
7. **버전이 박힌 문서 서술** — `AGENTS.md`(측정 버전 주석), `.omp/rules/harness-agent_routing.md`(`enabledProviders` 실측, `@slow` 폴백, `hub` 폐기), `.omp/rules/harness-harness_integration_contract.md`(`edit.enforceSeenLines`, 셀렉터 미러 기준 버전, 백그라운드 run 미기록), `.omp/agents/reviewer.md`(unstructured 반환, `model_change` 해석), `.omp/skills/bootstrap/SKILL.md`, `.omp/rules/harness-coding_standards.md`. 그 밖에 "omp 18.x에서 측정"이 붙은 모든 문장.
8. **Orca·gh-loop·세션 기록** — `.omp/skills/gh-loop/SKILL.md`·`gh-fanout`의 `omp --model X --thinking Y` 워커 기동, `ORCA_OMP_STATUS_EXTENSION`, 세션 트랜스크립트(`~/.omp/agent/sessions/**/*.jsonl`의 `session`·`tool_execution_start`·`model_change` 레코드, `gc --strip`·압축), `agent.db`의 `command_usage`(`harness-skill-tune`이 읽음).
9. **리뷰 증거** — `.omp/agents/reviewer.md`가 쓰는 `docs/reviews/review-<ts>.json` 튜플과 `.panel.jsonl`의 `models`(`model_change` 실측), `gates/review-gate.mjs`의 계열 파서(`familyOf`).

패키지 신호 강도: `pi-coding-agent`(도구·확장·에이전트·스킬·컨텍스트·세션·CLI)와 `pi-agent-core`가 가장 높고, `pi-catalog`·`pi-ai`는 모델·프로바이더·인증, `pi-mnemopi`는 메모리 도구입니다. `pi-tui`·`pi-natives`·`pi-wire`·`pi-utils`·`browser-relay`·`snapcompact`·`omptype`·`collab-web`·`omp-stats`는 위 항목을 직접 이름 짓는 불릿(예: `pi-utils`의 mermaid 파서, `pi-natives`의 bash 셸 의미)만 봅니다.

## 보고 형식 (Markdown, 식별자는 영어 유지)

1. `읽은 릴리스: N개 / 불릿 M개` 한 줄.
2. 후보 표 — 정밀도 우선, 순수 무관은 빼고:

| # | 릴리스 | 축(1-9) | 불릿 요약(영문 인용 ≤ 200자) | PR/이슈 링크 | 하네스 근거(`파일:줄`) | 예비 분류 | 왜 |
|---|---|---|---|---|---|---|---|

`예비 분류` ∈ `충돌`(게이트 오작동·우회, 에이전트·CLI 깨짐) / `드리프트`(문서·주석·실측 서술이 더는 사실이 아님) / `주목`(알아둘 것, 조치 없음). `하네스 근거`는 실제로 `grep`·`read`로 찾은 줄만 적고, 못 찾았으면 `(근거 없음 — 확인 필요)`라고 씁니다 — 줄 번호를 지어내지 않습니다.

3. `확인하지 못한 것` — 의심했지만 리포만으로 검증하지 못한 것.

파일을 고치지 않고, 빌드·테스트 명령을 돌리지 않습니다. 읽기 전용 조사입니다.
