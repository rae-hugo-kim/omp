# Handoff 2026-11-13 — omp 18.18.6 누적 패치(18.11.2~18.18.6) 대비 하네스 마찰 감사

- 발신: omp 리포 gh-loop 워커 세션 (#129, 2026-11-13, 호스트 설치 버전 `omp 18.18.6`, 대조 대상 `v18.11.2` ~ `v18.18.6`)
- 수신: omp 리포(하네스 SoT) 후속 작업 세션 (사이클 ①~④ 분할 제안)
- 상태: 분석 완료, 분할안 처리됨 — ① #109·③ #110에 댓글로 합침, ② #135(`needs-decision`), ④ 미생성 (2026-11-13 코디네이터 결정; 구현은 각 이슈에서)
- 역할: `seed.yaml`의 전신(pre-seed 입력) — 이슈 발행 후 권위는 `docs/harness/seed.yaml`로 넘어갑니다 (`docs/rules/artifact_roles_contract.md` §Handoff).
- 절차: `.omp/skills/harness-friction/SKILL.md` 1~7단계. 이 문서가 그 스킬의 첫 실행 산출물입니다.

## 한 줄 요약

직전 감사 기준선 `omp 18.11.1`(2026-10-16, #109~#111) 이후 `18.11.2`부터 `18.18.6`(2026-11-09)까지 릴리스 **26개(전수 수집 26 / 읽은 수 26, 큐레이션 불릿 1,929개)** 를 하네스와 대조해 **충돌 4건(C1~C4), 드리프트 8건(D1~D8), 확인 필요 3건(U1~U3)** 을 찾았습니다. 가장 큰 것은 `v18.18.4`의 Google Antigravity 중지로 고정 패널 멤버 `adversary-argon`이 해석되지 않는 충돌(C1)이고, 모델 참조 생존 검사 스크립트가 이를 결정적으로 잡습니다.

---

## 배경 및 버전 기준선

1. **직전 마찰 감사 기준선**: `omp 18.11.1` (`docs/handoff/handoff_2026-10-16_omp-18-11-1-friction-audit.md`, 이슈 #109~#111 — 2026-11-13 현재 셋 다 OPEN, 미구현).
2. **현재 워크스테이션 설치 버전**: `omp 18.18.6` (2026-11-09 발행). 업스트림 최신은 `v18.20.0`(2026-11-12)이며 `18.18.7`·`18.18.8`·`18.18.9`·`18.19.0`·`18.20.0` 5개는 이번 구간 밖입니다(다음 감사 대상).
3. **구간 수집**: `node .omp/skills/harness-friction/scripts/friction.mjs releases --out …` → `구간 18.11.1 → 18.18.6: 릴리스 26개 / 읽은 수 26개`. 큐레이션 절(`## @oh-my-pi/<pkg>` 아래 Added/Changed/Fixed/Removed/Breaking)만 읽었고 `What's Changed`·`New Contributors`는 뺐습니다. 7묶음으로 나눠 `scout` 에이전트가 읽고 묶음별 읽은 수를 합산했습니다(347+218+264+315+244+279+262 = 1,929 불릿).
4. **모델 참조 생존 검사**: `node .omp/skills/harness-friction/scripts/friction.mjs models --releases-json …` → 지적 3건(`AGENT-MODEL` `.omp/agents/adversary-argon.md:4`, `RULE-MODEL` `.omp/rules/harness-agent_routing.md:42`, `AGENT-PROSE` `.omp/agents/reviewer.md:57` — 셋 다 `google-antigravity/gemini-4-argon`, `provider-missing`, 인용 릴리스 `v18.18.4`). 나머지 고정값(`anthropic/claude-opus-5-5`)과 롤 참조(`@advisor`·`@slow`·`["@task", "@default"]`)는 해석됩니다.
5. **스킬 점검**: `node .omp/skills/harness-skill-tune/scripts/skill-tune.mjs check`(#127) — 예약 이름 기준 `omp 18.18.6`으로 설치 버전과 같고, 이 감사가 새로 더한 스킬 `harness-friction`에 지적이 없습니다(실행 결과는 PR 본문에 발췌).

구간의 주요 변경 축: 프로바이더 중지(`18.18.4`), `read` 셀렉터 문법 확장(`18.12.4`, `18.13.0`), `task`·`wait`·서브에이전트 메시징 의미 변경(`18.12.4`, `18.17.0`, `18.18.0`), 모델 선택기 엄격화와 롤 기본값(`18.14.0`), `ask` 입력 형식 전면 교체(`18.18.3`), bash 세션 셸 지속(`18.12.2`, `18.18.2`)과 선두 `cd` 호이스팅(`18.18.0`), 확장 지연 로드(`18.12.6`).

---

## 1. 충돌 (C1~C4) — 게이트 오작동·우회, 에이전트·CLI 깨짐

### C1. [높음] `v18.18.4` Google Antigravity 중지 → 고정 패널 멤버 `adversary-argon` 해석 불가
- **업스트림**: pi-catalog "Paused Google Antigravity, since Google may restrict accounts that use it outside its own apps" / pi-ai "Providers paused by a `disabled` auth rule (currently Google Antigravity) … refuse login, token refresh and usage probes, resolve no key from any source, and refuse requests" ([#18622](https://github.com/can1357/oh-my-pi/pull/18622), [v18.18.4](https://github.com/can1357/oh-my-pi/releases/tag/v18.18.4)).
- **하네스**: `.omp/agents/adversary-argon.md:4` `model: "google-antigravity/gemini-4-argon"`; `.omp/agents/reviewer.md:5`(`spawns: … adversary-argon`), `:57`, `:283`; `.omp/rules/harness-agent_routing.md:41-42`("고정 모델 멤버 `adversary-argon`(gemini)이 계열을 공급하므로 … 이종 증거가 불성립하지는 않는다").
- **실측**:
  - `omp models google-antigravity` → `No models matching "google-antigravity"`; `omp models --kind all --json`의 프로바이더는 `anthropic, local, openai-codex, web, xai-oauth`뿐입니다(2026-11-13).
  - 생존 검사 출력: `AGENT-MODEL .omp/agents/adversary-argon.md:4 — google-antigravity/gemini-4-argon: 프로바이더 google-antigravity가 현재 omp 카탈로그에 없습니다. — v18.18.4: Paused Google Antigravity …`.
  - 리뷰 기록: PR #130·#131의 reviewer 3-pass 5라운드 사이드카(`docs/reviews/review-2026-11-12-173034/-174730/-2026-11-13-030130.panel.jsonl` 등 — gitignored라 리뷰를 돌린 워크트리와 메인 체크아웃 사본에 흩어져 있음)에서 `adversary-argon` 행이 모두 `requested_model: google-antigravity/gemini-4-argon → models: ["anthropic/claude-fable-5-1"]`, `heterogeneity: SAME-FAMILY`입니다(그 라운드들의 `failure`는 `null`). 이 PR의 리뷰 r1·r2(`review-2026-11-13-154422`·`-160235`의 `.panel.jsonl`)에서도 같은 형태로 재현됐고, 그 행의 `failure`에는 `startup resolved to the primary's model anthropic/claude-fable-5-1 (single model_change record, resolvedModelIsFallback:false) — google-antigravity is paused in omp 18.18.4+`가 기록돼 있습니다. 이종 증거는 `@advisor`(`openai-codex/gpt-6-astra`)로만 성립했고 패널의 gemini 자리는 비어 있었습니다.
  - `v18.14.0`의 "Provider-qualified model selectors … must identify an exact model ID or alias. Near matches now fail"과 `v18.15.0`의 "a model whose provider has no usable credential … now switches to the first `retry.fallbackChains` candidate"가 겹쳐, 멤버는 에러가 아니라 **primary 계열로 조용히 완주**합니다 — `harness-agent_routing.md:41`이 전제한 "로그인이 없어 `failed`"가 아닙니다.
- **증상**: 상시 3인 패널의 제3 계열(gemini)이 매 리뷰에서 실질적으로 빠지고, 이종성은 `modelRoles.advisor` 한 곳에만 의존합니다. `advisor`가 reviewer 계열이거나 미설정이면(D1 참조) review-gate의 이종 증거가 불성립합니다.
- **선택지(결정은 사용자 보류 — 2026-11-10)**: (A) argon을 다른 경로로 이전 — 현재 카탈로그에 Google 계열 프로바이더가 없으므로 사용자가 다른 Google 프로바이더(`google-gemini-cli`·`google-vertex` 등)에 로그인한 뒤에만 가능; (B) 패널을 2명(`adversary`·`adversary-opus`)으로 축소하고 `reviewer.md`·`harness-agent_routing.md:42`·`scripts/harness-sync.sh:219`·`review-gate.test.mjs:378-387`를 함께 갱신; (C) 제3 계열을 `xai-oauth`(이 호스트 카탈로그에 `grok-4.7` 등 10종 존재)로 교체한 미러를 두기 — `review-gate.mjs:94-99`의 `familyOf`가 `grok`을 독립 계열로 세므로 게이트 쪽 변경 없이 이종 증거가 됩니다. 이 PR은 에이전트 정의·규칙·`modelRoles`를 바꾸지 않습니다.

### C2. [높음] `v18.12.4` `read` 콤마 목록의 꼬리 범위(`:1-30,-30`, `:1-30,:-30`)를 `READ_SELECTOR`가 벗기지 못함
- **업스트림**: "Fixed `read` losing the last lines of a comma list that pairs ranges with a tail (`file:1-30,-30`, `file:1-30,:-30`) … both parts are now read" / pi-tui `splitPathAndSel` "peel comma line lists that include a tail chunk (`:1-12,-15`) or repeat the colon after a comma (`:1-30,:-30`)" ([#16435](https://github.com/can1357/oh-my-pi/pull/16435), [v18.12.4](https://github.com/can1357/oh-my-pi/releases/tag/v18.12.4)).
- **하네스**: `.omp/extensions/harness/gates/read-path.mjs:26-29` — `RANGE`의 콤마 연속은 `,L?\d+`만 허용해 `,-30`·`,:-30`이 매치되지 않습니다. `:8-10`이 명시한 실패 클래스("any documented form left unstripped logs a phantom path")입니다.
- **실측**(2026-11-13, `readTarget`): `a.md:1-30,-30` → `a.md:1-30,-30`(그대로), `a.md:1-30,:-30` → `a.md:1-30,`(일부만 벗김), `a.md:1-30,40-50` → `a.md`(정상).
- **증상**: 꼬리를 섞은 콤마 범위로 읽은 파일을 이어서 `edit`하면 `context-gate`가 "읽지 않은 파일"로 거짓 차단합니다.
- **해결 방향**: `RANGE`의 콤마 항목에 `-\d+`와 선행 `:`를 허용하고 `tests/read-path.test.mjs`에 두 형태를 더합니다. #109(사이클 ①)의 `READ_SELECTOR` 작업과 같은 파일이므로 그 이슈에 합칩니다.

### C3. [낮음] `v18.13.0` PDF 페이지 셀렉터 `:page<N>.png` 미반영
- **업스트림**: "`read doc.pdf:page<N>.png` renders the page … the note `read` adds to a PDF … now points at the `:page<N>.png` selector" ([#16585](https://github.com/can1357/oh-my-pi/pull/16585), [v18.13.0](https://github.com/can1357/oh-my-pi/releases/tag/v18.13.0)).
- **하네스**: `read-path.mjs:27-29`(`raw|conflicts|img|range`만). **실측**: `doc.pdf:page3.png` → `doc.pdf:page3.png`(phantom).
- **증상**: PDF를 편집하는 일이 드물어 실제 차단 가능성은 낮지만, "mirror the read.md grammar EXACTLY"(`:8`) 주장과 `harness-harness_integration_contract.md:85`의 "Last mirrored against omp 18.3.0"은 더 이상 사실이 아닙니다. #109에 합칩니다.

### C4. [낮음] `v18.12.2` bash 세션 셸 지속 — 내보낸 환경이 호출 사이에 남아 커밋 트립와이어를 비껴감
- **업스트림**: "Fixed the `bash` tool dropping variables, functions, and shell options between calls whenever auto-background was on (the default): a call that starts in the foreground now runs in the session's persistent shell" ([#16153](https://github.com/can1357/oh-my-pi/pull/16153), [v18.12.2](https://github.com/can1357/oh-my-pi/releases/tag/v18.12.2)); `v18.18.2` "A `bash` call that overlaps another one … runs in a copy of the session shell".
- **실측**(2026-11-13, omp 18.18.6): 호출 1 `cd /tmp && export FRICTION_PROBE=1 && pwd` → `/tmp`; 호출 2 `pwd; echo $FRICTION_PROBE` → 세션 cwd로 복귀, `FRICTION_PROBE=1` 유지. 즉 **cwd는 호출마다 리셋되지만 내보낸 변수·함수는 지속**됩니다.
- **하네스**: `gates/git-commit-detect.mjs:352-357`(`tripwireEnvReason` — 호출의 `env` 입력만), `:389-430`(`--config-env`·`GIT_DIR`·`core.hooksPath` 재지정은 **같은 명령 문자열**에서만 감지), `.omp/rules/harness-harness_integration_contract.md:44`("single-cwd model" — cwd 전제는 유지됨), `:60-61`(잔존면 목록).
- **증상**: 호출 1 `export GIT_DIR=/other/.git` 또는 `git() { command git --no-verify "$@"; }` 뒤 호출 2 `git commit`은 트립와이어·cross-repo 가드가 보지 못합니다. 위협 모델상 "evasive" 범주라 게이트 설계 밖이지만, 잔존면 목록에 없습니다.
- **해결 방향**: 통합 계약 Known residual surfaces에 "세션 셸의 내보낸 환경·함수 지속(18.12.2+)"을 추가하고, 필요하면 `tool_call` bash에서 `export GIT_DIR|GIT_WORK_TREE|GIT_INDEX_FILE=`·`git()` 함수 정의를 advisory로 잡는 `destructive-guard` 패턴을 검토합니다.

---

## 2. 드리프트 (D1~D8) — 문서·주석·실측 서술이 더는 사실이 아님

| ID | 심각도 | 대상(`파일:줄`) | 현재 서술 | 업스트림 변경(릴리스·링크) | 정정 방향 |
|---|---|---|---|---|---|
| **D1** | 중간 | `.omp/rules/harness-agent_routing.md:43` ("`@slow`는 `modelRoles.slow` 미설정 시 default 롤을 상속"), `:41`(`advisor` 미설정 시 `@slow` 폴백) | 미설정 롤은 default를 상속 | `v18.14.0` "Updated `smol` and `slow` role defaults to use the currently bundled Cerebras and OpenAI Codex model identifiers." **실측**(빈 프로필 `PI_CODING_AGENT_DIR=$(mktemp -d)`, `modelRoles = {}`): `omp -p --model @slow "say ok"` → `No API key found for openai-codex.` — 미설정 `@slow`는 **번들 Codex 기본값**으로 갑니다. | `:43`을 "번들 기본값(Codex 계열)"로 고치고 `:41`의 "advisor 미설정 → @slow → reviewer와 같은 계열" 추론을 다시 씁니다(소비 리포에서 `modelRoles.slow` 미설정이면 reviewer·code-reviewer가 Codex로 돌 수 있음). |
| **D2** | 중간 | `.omp/agents/reviewer.md:71-72`("Block on `wait` until ALL three results have arrived"), `:140`, `.omp/rules/harness-agent_routing.md:40` | `wait` 한 번이 결과 도착까지 막음 | `v18.17.0` "`wait` with nothing new returns after 5s (backing off to 5m over repeated idle waits) instead of blocking up to 30 minutes, and nudges the agent toward other work" / "`wait` for a reply gives up after 5 minutes (was 30)"; `v18.18.6` `wait`가 결과 전달 경로(delivered/handed over/late)를 명시([#18635](https://github.com/can1357/oh-my-pi/pull/18635)). #130·#131의 5라운드는 18.18.6에서 완주했으므로 깨진 것은 아니고 **서술**이 낡았습니다. | "세 결과가 모두 도착할 때까지 `wait`를 **반복**하고, idle 반환의 nudge에 끌려 Pass 2/3 전에 yield하지 말 것"으로 고칩니다. |
| **D3** | 중간 | `.omp/rules/harness-agent_routing.md:40`("브로드캐스트는 `agent://all`") | 누구나 `agent://all` | `v18.17.0` "Subagents can no longer broadcast (`write agent://all` fails, pointing to a direct `agent://<id>` message) … the main agent can still broadcast" | "메인 에이전트만 — 서브에이전트(reviewer 등)는 `agent://<id>` 직접 메시지"로 한정합니다. |
| **D4** | 중간 | `.omp/skills/gh-loop/SKILL.md:66`("`ask` 툴로 선택지를 제시"), `.omp/extensions/harness/gh-loop-record.mjs:16-17,117`("appended to the `ask` options"), `.omp/skills/bootstrap/SKILL.md:131,147`, `.omp/skills/kickoff/SKILL.md:96,135,177,198,340,344`, `.omp/skills/gh-fanout/SKILL.md:79`, `.omp/skills/brainstorm/SKILL.md:24,31,236`, `.omp/skills/init/SKILL.md:18,42` | `ask`가 `questions[]`/options 입력 | `v18.18.3` Breaking "The `ask` tool takes one HTML form (`{ html }`) instead of `questions[]` … the 'Other', 'Chat about this', answer-note and answer-image paths of the tool are removed" | 선택지는 `<form>`의 radio/checkbox로 쓴다는 문구로 바꾸고, `renderRecommendation`의 "한 줄 추가"는 폼 끝 `<p>`에 넣는다고 적습니다. 도구 호출 자체는 유지됩니다. |
| **D5** | 낮음 | `.omp/rules/harness-harness_integration_contract.md:85`("Last mirrored against omp 18.3.0"), `read-path.mjs:14-25` 문법 주석 | 18.3.0 기준 EXACT mirror | `v18.12.4` `:N:raw`/`:raw:N` 단일 줄 의미([#16438](https://github.com/can1357/oh-my-pi/pull/16438)), C2·C3의 새 형태, `v18.14.0` `out://`·`v18.12.4` `mr://`·`v18.18.0` `vault://`가 내부 스킴으로 명시(단일 슬래시 allowlist `read-path.mjs:59-60`에 `out|mr|vault|cfg|attachment|security` 없음 — 2026-10-16 F3의 연장) | #109에서 미러를 18.18.6으로 재맞춤하고 기준 버전 문구를 갱신합니다. 스킴은 정규형 `://`로는 걸러지므로 단일 슬래시 정규화가 관측될 때만 실질 영향이 있습니다. |
| **D6** | 낮음 | `docs/handoff/handoff_2026-10-16_omp-18-11-1-friction-audit.md:32`(`edit`만 `:raw` 재읽기 강제로 서술), `.omp/rules/harness-harness_integration_contract.md:84`(omp 자체 가드로 `edit.enforceSeenLines`만 언급) | 잘린 줄 거부는 `edit`만 | `v18.16.0` "Fixed `write` accepting the output of a `read` whose long lines were cut to `tools.outputMaxColumns` … it now refuses it as an incomplete read" ([#16595](https://github.com/can1357/oh-my-pi/pull/16595)) | 계약 `:84`의 "omp 자체 가드" 목록에 `write`의 잘린 읽기 거부를 더합니다. |
| **D7** | 낮음 | `.omp/skills/harness-skill-tune/SKILL.md:35`, `scripts/skill-tune.mjs:226`(`node:sqlite`로 `agent.db` 읽기) | 최소 omp 버전 없음 | `v18.16.0` "Fixed `~/.omp/agent/agent.db` getting corrupted (wiping stored logins) on Linux when grep, `read`, the bash tool, extensions or eval read it while omp has it open" ([#15586](https://github.com/can1357/oh-my-pi/issues/15586)) | 18.16.0 미만에서 `check`를 돌리지 말라는 최소 버전을 적습니다(#128 갱신 사이클 입력). |
| **D8** | 낮음 | `.omp/extensions/harness/gates/review-gate.mjs:71`(예시 id `claude-3-5-sonnet`), `:306`(`claude-opus-4`), `.omp/agents/reviewer.md:77`("A normal run has two startup records") | 은퇴 모델 예시, 레코드 2개 전제 | `v18.13.0` "Removed retired Anthropic models (Claude 3.x, Opus 4/4.1, Sonnet 4)" ([#16755](https://github.com/can1357/oh-my-pi/issues/16755)) — `claude-opus-4-8`(`:71`)은 아직 카탈로그에 있어 대상이 아닙니다; `v18.18.0`·`v18.13.3`·`v18.14.0` prewalk/plan-yolo 핸드오프가 폴백 플래그 없는 추가 `model_change`를 남길 수 있음([#18322](https://github.com/can1357/oh-my-pi/pull/18322), [#17229](https://github.com/can1357/oh-my-pi/pull/17229)) | 주석의 은퇴 id 두 개를 현행(`claude-opus-5-5`·`claude-fable-5-2`)으로, `:77`의 레코드 해석에 "prewalk 핸드오프 레코드가 섞일 수 있고 마지막 레코드만 멤버 모델"을 덧붙입니다. |

---

## 3. 확인 필요 (U1~U3) — 릴리스 노트만으로 판정할 수 없어 실측이 필요한 것

- **U1. `v18.12.6` 확장 지연 로드와 `session_start`** — "Interactive startup no longer waits for extensions that register only tools, commands, flags, renderers, or event hooks … they load once the composer accepts input" ([#16684](https://github.com/can1357/oh-my-pi/pull/16684)). 하네스 확장은 이벤트 훅 4종만 등록해(`index.ts:528,613,720,743`) 지연 프로필에 해당할 수 있습니다. 지연된 확장이 `session_start`를 받는지(→ `harness-version-check`·`breadcrumb-surface`)는 이 소스 리포에서 확인할 수 없었습니다 — 템플릿 자체는 `harness-meta.json`에 `source_remote`가 없어 버전 체크가 원래 skip되기 때문입니다. 소비 리포에서 `.omp/state/harness-version-check.json`의 `checkedAt`이 세션 시작 직후 갱신되는지 보면 됩니다. `before_agent_start`의 1시간 재검사(`index.ts:720-727`)가 부분 보완합니다.
- **U2. `v18.18.0` 선두 `cd <dir>;` 호이스팅의 이벤트 형태** — "Bash commands starting with `cd <dir>; ...` now run in `<dir>` as their working directory when it exists" ([#18329](https://github.com/can1357/oh-my-pi/pull/18329), `cd … &&`는 그 전부터 호이스팅). PR 설명상 호이스팅은 `BashTool.execute` 안에서 일어나므로 확장의 `tool_call`은 모델이 쓴 원문을 본다고 봅니다[INFERENCE]. 하네스는 선두 리터럴 `cd <dir>` 1개를 cwd 이동으로 이미 모델링하고(`gates/git-commit-detect.mjs:923,1159-1164`, `tests/cross-repo.test.mjs:102` `cd ${ext}; git push` → ext), 없는 디렉터리로의 `cd`는 unknown(fail-closed)이라 판정 방향은 omp와 같습니다. `tool_result`의 `event.input.command`/`cwd`가 호이스팅 뒤 값인지만 `HARNESS_DEBUG`로 1회 실측하면 닫힙니다.
- **U3. `v18.18.2`/`v18.18.6` `omp gc --strip`, `v18.13.2` `gc.autoCompress`와 세션 JSONL** — strip 대상 열거("thinking signatures, encrypted reasoning, cached native responses, request controls")에 `model_change`·`tool_execution_start`는 없지만 소스로 확정하지 못했습니다. 압축(기본 off)이 켜지면 idle 세션 파일이 `.jsonl`이 아니게 될 수 있어 `reviewer.md:75-76`의 멤버 모델 실측과 `harness-skill-tune`의 집계(`skill-tune.mjs:117` `.jsonl` 필터)가 그 세션을 놓칩니다.

---

## 4. 주목 — 조치 없이 알아둘 것 (요약)

| 릴리스 | 변경 | 하네스 쪽 판단 |
|---|---|---|
| `v18.14.0` | 프로바이더 한정 모델 선택기 엄격화(근사 매치 실패) | 고정 id(`anthropic/claude-opus-5-5`)는 카탈로그의 정확한 id라 영향 없음. C1을 "조용한 대체" 대신 명시 에러로 드러내는 방향이지만 `v18.15.0`의 무자격 프로바이더 폴백이 다시 조용히 만듭니다. |
| `v18.14.2`, `v18.18.4` | `task` 스키마에 `model` 필드 노출(`task.perCallModel` 기본 off), `task.maxEffort` | reviewer 스폰 예시(`reviewer.md:62-69`)는 `model`을 넣지 않아 안전. "Pass YOUR OWN model … in each task text"(`:59`)가 필드로 오독되면 호출이 거부되므로 문구를 "텍스트에만"으로 못 박을 가치가 있음. |
| `v18.12.4` | `agent://<id>` 메시지 뒤 `wait`로 응답 수신 가능([#16445](https://github.com/can1357/oh-my-pi/pull/16445)) | `harness-agent_routing.md:40`의 후속 질의 경로가 이 버전부터 동작 — 최소 버전(≥18.12.4) 표기 후보. |
| `v18.13.0` | 서브에이전트 결과 11,500자까지 통째 전달, `verifier`의 `["@task", "@default"]` 목록이 인증된 뒤 항목으로 넘어감([#16640](https://github.com/can1357/oh-my-pi/pull/16640)), 실패 edit의 `details.errorKind`, `before_agent_start`의 `reason: "revive"` | 모두 하네스 전제에 유리. `revive`에서 `kickoff-detector`가 다시 도는지는 미확인(저위험). |
| `v18.13.1`, `v18.13.0` | `tools.restrictedFolders`, `--max-cost`(print 모드 exit 3) | `cross-repo.mjs:94`·`harness-check/SKILL.md:146`의 헤드리스 `omp -p --auto-approve` 경로가 소비 리포 설정에 따라 승인 대기·exit 3으로 멈출 수 있음. |
| `v18.13.2` | 클론 워크트리가 "타깃이 무시하는 캐시"를 보존([#17181](https://github.com/can1357/oh-my-pi/pull/17181)) | `.omp/harness-state/`는 양쪽 다 ignored라 2026-10-16 F9(#111)가 자동 해소되지 않음. |
| `v18.17.0` | 스킬 설명 160자 초과 시 모델이 압축한 라우팅 힌트로 치환, `skills.manualSkills`, `omp zsh/bash/sh` 하위 명령 | `gh-loop`·`gh-fanout`·`harness-skill-tune`·`brainstorm` 등 긴 `description`의 트리거 문구가 압축에서 빠질 수 있음 — #128(스킬 갱신) 입력. `reserved-names.json`(18.18.6)에는 `zsh`·`bash`·`sh`·`gc`가 이미 있음. |
| `v18.17.0` | 서브에이전트 워커 스레드(`task.workerThreads` 기본 4), 비용 캡 즉시 전파, `textVerbosity` 기본 low(Codex 포함) | 확장이 워커에서 재로드되는지 미확인(`HEAD_SNAPSHOTS` 프로세스 내 Map, `ctx.hasUI`). Codex 계열 `@advisor` 응답이 짧아져 `## Verdict`+`file:line` 요건 미달 `failed`가 늘 수 있음. |
| `v18.18.1` | bash가 `LANG/LC_ALL=C.UTF-8`로 실행, `bash.patterns` deny 우선 | 게이트는 종료 코드만 보므로 무관. 하네스는 `bash.patterns`를 설정하지 않음. |
| `v18.18.5` | Claude Fable 5.2·Mythos 5.2 추가 | `review-gate.mjs:84,95` 계열 파서가 `fable|mythos`를 이미 claude로 셈. |
| `v18.12.4` | 규칙 본문의 HTML 주석이 더는 제거되지 않음([#16481](https://github.com/can1357/oh-my-pi/pull/16481)) | `.omp/rules/harness-*.md:6-8`의 `<!-- Harness: … -->` 주석이 프롬프트에 실림 — `harness-agent_security.md:33`대로 비지시형으로 유지. |

---

## 5. 2026-10-16 감사(#109~#111)와의 관계

| 이전 항목 | 상태 | 이번 구간에서 달라진 것 |
|---|---|---|
| F1 `read ?q=` 미스트립 (#109) | OPEN | `v18.12.4` SQLite `?q=` 페이지네이션, `v18.13.2` BOM·확장자 없는 파일의 JSON 셀렉터 — 대상이 넓어짐. |
| F3 스킴 4종 누락 (#109) | OPEN | D5 — `out`·`mr`·`vault`가 더해져 6종 이상. |
| F5·F6 서브에이전트 계약 (#110) | OPEN | D2·D3의 `wait`·`agent://all` 의미 변경이 같은 파일(`reviewer.md`, `harness-agent_routing.md`)을 건드림 — #110과 합쳐 한 사이클로 처리하는 것이 충돌을 줄임. |
| F8 `commitTargetDir` 선행 `cd` (#111) | OPEN | U2의 호이스팅 실측이 같은 코드 경로. |
| F9 CoW 워크트리 상태 오염 (#111) | OPEN | `v18.13.2` 수정으로도 해소되지 않음(§4). |
| F11 `bash.gitGuard` (#110 참고) | — | `v18.13.0`·`v18.14.0`에서 가드 집합이 바뀌었고 링크드 워크트리에서는 복원이 허용됨 — 안내 문구 결론 재확인 필요. |

---

## 6. 수용 기준 후보

- [ ] **AC1 (사이클 ① — #109 보강)**: `readTarget`이 `a.md:1-30,-30`·`a.md:1-30,:-30`·`doc.pdf:page3.png`를 `a.md`·`doc.pdf`로 벗기고, `URI_SCHEME_PREFIX`가 `out|mr|vault|cfg|attachment|security`의 `:/` 형태를 가상 경로로 판정하며, `read-path.mjs:14-25`와 `harness-harness_integration_contract.md:85`의 기준 버전이 `18.18.6`으로 바뀐다.
- [ ] **AC2 (사이클 ② — adversary-argon 결정)**: 사용자가 C1의 A/B/C 중 하나를 고른 뒤, reviewer 3-pass 1라운드의 `.panel.jsonl`에 `requested_model`이 해석되는 모델만 있고 완료 멤버의 계열이 2개 이상이다.
- [ ] **AC3 (사이클 ③ — 문서·규칙 18.18.6 정합)**: D1~D8의 대상 줄이 정정되고 `node scripts/docs-drift`가 0 error로 통과하며, `friction.mjs models`가 규칙 본문에서 `RULE-MODEL` 지적을 내지 않는다(C1 결정이 B/C면 `harness-agent_routing.md:42`의 argon 서술도 함께 사라진다).
- [ ] **AC4 (사이클 ④ — 잔존면·실측)**: 통합 계약 Known residual surfaces에 C4가 기록되고, U1·U2가 소비 리포 1곳에서 실측되어 결과가 계약 문서에 인용된다.

---

## 7. 사이클 분할 제안 (`rule://harness-cycle_definition`)

이슈는 만들지 않았습니다. 번호는 제안 순서이며, 기존 OPEN 이슈에 합치는 것이 하나(①)입니다.

| 사이클 | 범위 | 산출물 | 확인 문장 (1줄) |
|---|---|---|---|
| **① #109에 합침 — read-path 18.18.6 재미러** | C2, C3, D5(스킴 6종 + 기준 버전 문구), 기존 F1~F4 | `.omp/extensions/harness/gates/read-path.mjs`, `tests/read-path.test.mjs`, `.omp/rules/harness-harness_integration_contract.md:85` | `node --test .omp/extensions/harness/tests/read-path.test.mjs`가 `a.md:1-30,-30`·`doc.pdf:page3.png`·`out:/x` 케이스를 포함해 전부 통과한다. |
| **② 새 이슈(`needs-decision`) — adversary-argon 거취** | C1 선택지 A/B/C 중 사용자 결정 → `adversary-argon.md`·`reviewer.md`·`harness-agent_routing.md:41-42`·`scripts/harness-sync.sh:219`·`review-gate.test.mjs` 정합 | `.omp/agents/`, `.omp/rules/harness-agent_routing.md`, `scripts/harness-sync.sh` | 테스트 diff에 reviewer 3-pass를 1라운드 돌리면 `.panel.jsonl`의 모든 `requested_model`이 `omp models`에서 해석되고 완료 멤버 계열이 2개 이상이다. |
| **③ #110에 합침 — 서브에이전트 계약·문서 18.18.6 정합** | D1, D2, D3, D4, D6, D7, D8 + 기존 F5·F6·D1~D5(2026-10-16) | `.omp/agents/reviewer.md`, `.omp/rules/harness-agent_routing.md`, `.omp/rules/harness-harness_integration_contract.md`, `.omp/skills/{gh-loop,gh-fanout,bootstrap,kickoff,brainstorm,init,harness-skill-tune}/SKILL.md`, `.omp/extensions/harness/gh-loop-record.mjs`(주석), `.omp/extensions/harness/gates/review-gate.mjs`(주석), `claudedocs/CLAUDEKR.md` | `node scripts/docs-drift`가 0 error로 통과하고, 빈 프로필에서 `omp -p --model @slow`가 가리키는 프로바이더가 `harness-agent_routing.md:43`의 서술과 일치한다. |
| **④ 선택 — 잔존면 기록·실측** | C4(세션 셸 환경 지속), U1(지연 로드 `session_start`), U2(`cd` 호이스팅 이벤트 형태), U3(`gc --strip`·압축) | `.omp/rules/harness-harness_integration_contract.md` Known residual surfaces, 필요 시 `gates/destructive-guard.mjs` advisory 패턴 | 소비 리포 1곳에서 `HARNESS_DEBUG=1`로 `cd <B>; git commit`과 `export GIT_DIR=…` 2-호출 시나리오를 실측한 결과가 계약 문서에 인용돼 있다. |

이 감사 자체가 만든 후속 하나(omp 변경이 아니라 하네스 내부 정합): `.omp/skills/init/SKILL.md`의 소스 전용 자산 제거 목록에 `harness-friction`(이 PR)과 `harness-skill-tune`(#128)이 올랐지만, `.omp/extensions/harness/gates/risk-assess.mjs:38,189-195`의 `BOOTSTRAP_CLEANUP_*`에는 `.omp/skills/` 아래 소스 전용 스킬이 없어 소비 리포의 첫 정리 커밋이 수백 줄 삭제로 `high`로 채점되고 review-gate에 막힙니다(리뷰 r1 지적). 그래서 두 항목 모두 "제거 대상이지만 이 커밋에서는 건너뛴다"로 적혀 있고, 창을 넓혀 삭제로 되돌리는 게이트 변경은 #134가 맡습니다. 보고서 §7 분할안의 처리 결과: ①은 #109, ③은 #110에 댓글로 합쳐졌고 ②는 #135(`needs-decision`)로 났으며 ④는 만들지 않았습니다(2026-11-13 코디네이터 결정).

---

## 8. 범위 밖 (Out of Scope)

- 위 마찰의 수정과 이슈 자동 생성 — 각각 사이클 ①~④의 별도 이슈(사용자 승인 뒤 생성).
- `adversary-argon`·`modelRoles.vision`(이 호스트에서 `google-antigravity/gemini-3.8-flash:high`, 같은 프로바이더 중지로 해석 안 됨 — 리포 산출물이 아니라 참고만) 변경.
- 렌더된 시스템 프롬프트 diff, `harness-check --smoke`(#31에 남은 범위).
- `18.18.7`~`18.20.0`(2026-11-10~12 발행 5개) — 다음 감사의 구간. 기준 버전 기록은 이번 설치 버전 `18.18.6`까지입니다.
- 소비 리포 동기화(`scripts/harness-sync.sh` 화이트리스트).
