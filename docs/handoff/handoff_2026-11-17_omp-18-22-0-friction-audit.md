# Handoff 2026-11-17 — omp 18.22.0 누적 패치(18.18.7~18.22.0) 대비 하네스 마찰 감사

- 발신: omp 리포 메인 세션 (2026-11-17, 호스트 설치 버전 `omp 18.22.0`, 대조 대상 `v18.18.7` ~ `v18.22.0`)
- 수신: omp 리포(하네스 SoT) 후속 작업 세션 (사이클 ①~⑤ 분할 제안)
- 상태: 분석 완료, 분할안 미승인 — 이슈는 만들지 않았습니다.
- 역할: `seed.yaml`의 전신(pre-seed 입력) — 이슈 발행 후 권위는 `docs/harness/seed.yaml`로 넘어갑니다 (`docs/rules/artifact_roles_contract.md` §Handoff).
- 절차: `.omp/skills/harness-friction/SKILL.md` 1~7단계.

## 한 줄 요약

직전 감사 기준선 `omp 18.18.6`(2026-11-13) 이후 `18.18.7`부터 `18.22.0`(2026-11-16)까지 릴리스 **10개(전수 수집 10 / 읽은 수 10, 큐레이션 불릿 532개)** 를 하네스와 대조해 **충돌 3건(C1~C3), 드리프트 5건(D1~D5), 확인 필요 4건(U1~U4)** 을 찾았습니다. 가장 큰 것은 `v18.20.1`이 더한 `/commit`·eval `commit` 네임스페이스입니다(C1). 커밋이 `bash` 도구를 거치지 않으므로 커밋 우회 트립와이어·cross-repo 가드·커밋 뒤 후속 처리가 모두 침묵하고, `no_verify=True`가 1급 인자로 생겼습니다. pre-commit 훅 자체는 이 경로에서도 실행됩니다(업스트림 소스 판독).

---

## 배경 및 버전 기준선

1. **직전 마찰 감사 기준선**: `omp 18.18.6` (`docs/handoff/handoff_2026-11-13_omp-18-18-6-friction-audit.md`). 그 분할안 가운데 ②는 #135로 닫혔고(2026-11-16, `adversary-argon` 퇴역·패널 2인), ①은 #109, ③은 #110에 합쳐져 **둘 다 OPEN**, #111도 OPEN입니다(2026-11-17 `gh issue list`).
2. **현재 워크스테이션 설치 버전**: `omp 18.22.0` (2026-11-16 발행, 이 구간의 마지막 릴리스).
3. **구간 수집**: `node .omp/skills/harness-friction/scripts/friction.mjs releases --out …` → `구간 18.18.6 → 18.22.0: 릴리스 10개 / 읽은 수 10개`. 큐레이션 절(`## @oh-my-pi/<pkg>` 아래 Added/Changed/Fixed/Removed/Breaking)만 읽었고 `What's Changed`·`New Contributors`는 뺐습니다. 3묶음으로 나눠 `scout` 에이전트가 읽고 묶음별 읽은 수를 합산했습니다(170+156+206 = 532 불릿). 릴리스별 수는 `v18.18.7` 23 · `v18.18.8` 40 · `v18.18.9` 65 · `v18.19.0` 42 · `v18.20.0` 156 · `v18.20.1` 85 · `v18.20.2` 4 · `v18.20.3` 52 · `v18.21.0` 34 · `v18.22.0` 31이고, 메인 세션이 `awk`로 따로 센 값과 일치합니다.
4. **모델 참조 생존 검사**: `node .omp/skills/harness-friction/scripts/friction.mjs models --releases-json …` → **지적 0건**. 고정값 `anthropic/claude-opus-5-5`(`.omp/agents/adversary-opus.md:4`)는 해석되고, 롤 참조(`@advisor`·`@slow`·`["@task", "@default"]`)는 호스트 `modelRoles`에서 모두 해석됩니다. 카탈로그는 모델 81개, 프로바이더 `anthropic, local, openai-codex, web, xai-oauth`입니다.
5. **스킬 점검**: `node .omp/skills/harness-skill-tune/scripts/skill-tune.mjs check` 머리말이 예약 이름 기준 `18.18.6` ≠ 설치 `18.22.0`을 알렸으므로 `refresh-reserved`를 먼저 돌렸습니다. `reserved-names.json`의 변화는 빌트인 슬래시 명령 `commit` 추가와 번들 에이전트 `seance` 제거 둘입니다. 재점검 결과는 스킬 17개·지적 19건으로 갱신 전과 같고, 새 예약 이름과 겹치는 하네스 스킬은 없습니다(`compr`·`compush`는 `commit`과 이름이 다릅니다).

구간의 주요 변경 축: 네이티브 선택 커밋(`18.20.1` `/commit`·eval `commit`), Google Antigravity 재개→재중지와 `antigravity-cli` 신설(`18.18.7`, `18.20.1`, `18.20.2`), `task` 스키마 정리(`18.19.0` `taskFile` 제거·`task.steps`, `18.20.3` `seance`·`sourceSession` 제거), 시스템 프롬프트·도구 설명 축소와 `read` 셀렉터 문서의 주문형 이동(`18.19.0`, `18.20.0`), 확장 이벤트 추가(`18.18.7` `session_before_shutdown`, `18.20.1` `session_clear`, `18.21.0` `agent_pause`), bash 리다이렉트의 내부 URL 쓰기(`18.21.0`).

---

## 1. 충돌 (C1~C3) — 게이트 오작동·우회, 에이전트·CLI 깨짐

### C1. [높음] `v18.20.1` `/commit`·eval `commit` — 커밋이 `bash` 도구 밖으로 나가 명령 계층 가드가 전부 침묵
- **업스트림**: pi-coding-agent Added "Added `/commit` to create commits containing only changes made by the agent or a selected subagent … also available through the eval `commit` namespace, supports targeting repositories outside the session directory … and can optionally skip commit hooks with `no_verify`; use `commit.enabled` to disable it." / pi-natives "Added noVerify to commitCreate() options to skip the pre-commit and commit-msg hooks, matching git commit --no-verify." ([v18.20.1](https://github.com/can1357/oh-my-pi/releases/tag/v18.20.1)). `v18.20.3`·`v18.22.0`이 이 경로의 버그를 계속 고쳤습니다. 이 버전부터 시스템 프롬프트가 "To commit your changes, use the eval `commit` namespace …, not `git add`/`git commit`"을 싣고, `xd://eval/commit` 문서가 "NEVER build a commit in a shared worktree with `git add`, `git commit -a`, … use `commit`"을 `<critical>`로 적습니다(이 세션에서 실측, `commit.enabled` = `true`).
- **하네스**: `.omp/extensions/harness/index.ts:533`(`event.toolName === "bash"` 분기 안에서만) `:561`(`commitBypassTripwire`) `:572-578`(cross-repo 가드 ②) `:582`(`snapshotHead`) `:657-677`(`commitOutcome`·breadcrumb `landed/hash`·드리프트 재검사·`CYCLE_BOUNDARY_NOTE`). `.omp/rules/harness-harness_integration_contract.md:61`은 이 경계를 "eval-spawned `git commit --no-verify` … leaving only the post-commit advisory"라는 **회피형(evasive)** 잔존면으로 적어 두었습니다.
- **업스트림 소스 판독**(`can1357/oh-my-pi@v18.22.0`, 실행 실측은 하지 않았습니다):
  - `crates/pi-vcs/src/git/mutate.rs:223-224,311-312` — `no_verify`가 아니면 `pre-commit`·`commit-msg`를 실행합니다. `:1004-1014`의 `hook_path`가 `core.hooksPath`를 따르므로 `.githooks/pre-commit`이 실행됩니다. **집행 경계는 유지됩니다.**
  - `packages/coding-agent/src/commit/selective/apply.ts:4-9`, `mutate.rs:1114-1115` — 커밋은 사설 인덱스에서 만들어지고 훅에는 그 경로가 `GIT_INDEX_FILE`로 전달됩니다. 게이트의 `git diff --cached`(`commit-gates.mjs:19-23`)는 실제 커밋 내용을 봅니다.
  - `mutate.rs:1117-1124` — 훅 출력은 `.output()`으로 포착되고 실패일 때만 오류에 실립니다. `:350`의 `post-commit`은 `let _ =`로 결과를 버립니다.
- **증상**:
  1. `d.commit(…, no_verify=True)`는 pre-commit 게이트 4종을 건너뛰는데 트립와이어가 보지 못합니다. 남는다던 post-commit advisory(`.githooks/post-commit:34-48`의 stderr)도 omp가 버리므로 에이전트·사용자 어느 쪽에도 보이지 않습니다. 도구 문서는 "only when the user asks"로 제한하지만 이는 프롬프트 수준 제약입니다.
  2. `commit.draft(repo="../other")`로 다른 리포에 커밋해도 cross-repo 가드 ②(`AGENTS.md` "Harness Enforcement" 표의 "commit/push into another discipline- or harness-bearing repo is blocked")가 발동하지 않습니다. 대상 리포의 pre-commit은 그 리포에 `core.hooksPath`가 설정돼 있을 때만 돕니다.
  3. 커밋이 착지해도 breadcrumb의 커밋 기록, 커밋 뒤 하네스 드리프트 재검사, 사이클 경계 안내가 나가지 않습니다.
  4. 게이트가 통과하면서 stderr로 내는 경고(WIP 허용, override 소비 알림)가 버려집니다.
- **해결 방향(결정 필요)**: (A) 경로를 수용하고 `eval` 도구의 `tool_call`에서 `no_verify`/`noVerify`·`repo=` 토큰만 좁게 감시 — 계약 `:61`이 "parsing arbitrary eval code (rule-pile growth)"라며 거부했던 방향입니다. (B) 하네스·소비 리포 설정에 `commit.enabled: false`를 두어 `bash`의 `git commit` 단일 경로를 유지 — 기존 보증이 그대로 복원되지만 공유 워크트리 선택 커밋을 포기합니다. (C) 경로를 수용하되 post-commit 훅이 advisory를 `.omp/harness-state/`에 남기고 다음 `before_agent_start`가 표면화하도록 바꾸고, `no_verify`와 cross-repo는 문서화된 잔존면으로 둡니다. 보수적인 순서는 B를 먼저 적용하고 C를 별도 사이클로 검토하는 것입니다.

### C2. [중간] 커밋 절차 지침이 omp 시스템 프롬프트와 정반대 — 스킬·reviewer·review-gate 안내가 `git add` + plain `git commit`을 요구
- **업스트림**: C1과 같습니다([v18.20.1](https://github.com/can1357/oh-my-pi/releases/tag/v18.20.1)).
- **하네스**: `.omp/skills/compr/SKILL.md:81,90`, `.omp/skills/compush/SKILL.md:66,105`, `.omp/skills/init/SKILL.md:185-186`, `.omp/skills/migrate/SKILL.md:61-62,173-174`(`git add -A` → `git commit -m`); `.omp/agents/reviewer.md:40`(리뷰 대상 = `git diff --cached`), `:183`(`git diff --cached | shasum -a 256`), `:236-241`("stage everything you intend to ship … commit with a plain `git commit`"); `.omp/extensions/harness/gates/review-gate.mjs:606`("Stage exactly what you intend to ship (git add ...), then use a plain `git commit`"); `.omp/extensions/harness/index.ts:568`("Run the commit plainly (git commit -m …)").
- **증상**: 에이전트는 스킬(`git add -A`)과 시스템 프롬프트(`git add` 금지) 사이에서 어느 쪽을 따를지 정해지지 않습니다. `git add -A`는 같은 워크트리의 다른 에이전트 변경까지 쓸어 담고, 반대로 `commit.draft()`로 high/critical 커밋을 하면 훅 시점의 `git diff --cached`는 **선택된 줄만 담은 사설 인덱스**의 diff라서 reviewer가 공유 인덱스(또는 `git diff HEAD`)로 계산한 `diff_hash`와 달라질 수 있습니다 — 새 파일이 선택에 들어가거나 다른 에이전트의 변경이 워크트리에 있으면 불일치하고, review-gate가 fail-closed로 막습니다 `[INFERENCE — 실측하지 않았습니다]`.
- **해결 방향**: C1의 결정에 종속됩니다. B면 문서 변경이 없고(프롬프트 문장이 사라지는지만 확인), A·C면 `compr`·`compush`와 reviewer의 해시 절차를 `d.diff()` 기준으로 다시 쓰고 review-gate 안내 문구를 맞춥니다. 참고로 `v18.19.0`부터 `shasum`이 bash 내장이 됐고, 이 호스트에서 `git diff HEAD | shasum -a 256`·`/usr/bin/sha256sum`·`node:crypto`의 해시가 같음을 확인했습니다.

### C3. [중간] `read`의 `;` 목록을 `readTarget`이 분해하지 못함 — 두 번의 이전 감사가 놓친 형태
- **업스트림**: `v18.20.0` "With the Spotlight experiment on, a `;`/`,` path `read` is shaped as one call: each part as that read alone would be" ([#18713](https://github.com/can1357/oh-my-pi/pull/18713)), `v18.18.8` "Fixed `grep` and `glob` treating a `;` list that starts with an internal URL … as one address" ([#18714](https://github.com/can1357/oh-my-pi/pull/18714)). 문법 자체는 그 전부터 있었습니다 — `omp://tools/read.md:386` "Explicit semicolon lists fan out … each member keeps its selectors and errors".
- **하네스**: `.omp/extensions/harness/gates/read-path.mjs:41-45`(`readTarget`이 `input.path` 전체에서 꼬리 셀렉터 하나만 벗김), `:8-10`(벗기지 못하면 phantom 경로가 기록돼 뒤따르는 `edit`이 거짓 차단된다는 실패 클래스).
- **실측**(2026-11-17, `readTarget`, cwd `/r`): `a.md;b.md` → `/r/a.md;b.md`, `a.md:1-5;b.md:3-9` → `/r/a.md:1-5;b.md`. 두 파일 모두 read-log에 들어가지 않습니다. 이 호스트의 세션 기록에서 `;` 목록을 쓴 `read` 호출이 있는 세션 파일은 48개입니다(가장 이른 것 2026-07-16, 가장 늦은 것 2026-11-13).
- **#109 미해결 형태 재측정**(파일은 `3dc461e` 이후 변경 없음): `a.md:1-30,-30`·`data.json?q=.x`·`doc.pdf:page3.png`·`out:/x.md`·`cfg:/ns/key`·`vault:/x`는 여전히 벗겨지지 않고, 새 형태 `arc.tar:member.json?q=.x`([#18970](https://github.com/can1357/oh-my-pi/pull/18970))도 같습니다. `a.md:17-:raw`·`a.md:17:raw`·`xd://read/sources`·`xd:/read/sources`는 정상입니다.
- **해결 방향**: `readTarget`이 `;`로 나눈 뒤 멤버마다 가상 경로 판정과 셀렉터 제거를 하도록 바꾸고(반환이 목록이 되므로 `index.ts:618-621`의 read-tracker 호출을 `file_paths`로), `tests/read-path.test.mjs`에 두 형태를 더합니다. #109에 합칩니다.

---

## 2. 드리프트 (D1~D5) — 문서·주석·실측 서술이 더는 사실이 아님

| ID | 심각도 | 대상(`파일:줄`) | 현재 서술 | 업스트림 변경(릴리스·링크) | 정정 방향 |
|---|---|---|---|---|---|
| **D1** | 중간 | `.omp/rules/harness-harness_integration_contract.md:61`, `.githooks/pre-commit:14-15`, `.omp/extensions/harness/gates/commit-gates.mjs:19` | 훅을 건너뛰는 eval 경로는 회피형이고 post-commit advisory는 남는다 / pre-commit에서 `GIT_DIR`은 설정되지 않는다(git 2.43.0 실측) | `v18.20.1` `/commit`·eval `commit`([릴리스](https://github.com/can1357/oh-my-pi/releases/tag/v18.20.1)). omp 네이티브 커밋은 훅에 `GIT_DIR`·`GIT_WORK_TREE`·`GIT_INDEX_FILE`을 모두 내보내고(`mutate.rs:1114-1121`) 훅 출력을 버립니다 | C1 결정과 함께 `:61`을 다시 쓰고, 훅 환경 주석에 "omp 네이티브 커밋은 `GIT_DIR`을 설정한다"를 더합니다(U1 실측 뒤). |
| **D2** | 낮음 | `.omp/rules/harness-agent_routing.md:40`("`write agent://<id>`로 메시지를 보내고 `wait`로 응답을 받으면") | 응답이 `wait` 결과로 온다 | `v18.18.9` "Agent-to-agent messages now always reach the recipient as user turns: one that ends a `wait` arrives right after it instead of inside the `wait` tool result, and none is sent with developer or system authority"; `v18.20.0` `wait`의 `agent://all` 뒤 직접 응답 대기 수정([#18976](https://github.com/can1357/oh-my-pi/pull/18976)); `v18.21.0` "Fixed subagents and security scans completing while child agents were still running" | "`wait`가 끝난 직후 별도 user turn으로 도착한다"로 고칩니다. #110(2026-11-13 D2·D3)과 같은 줄이므로 그 이슈에 합칩니다. |
| **D3** | 낮음 | `.omp/rules/harness-agent_routing.md:42`, `.omp/agents/reviewer.md:51-52` | `v18.18.4`가 `google-antigravity`를 중지해 카탈로그에서 사라졌다 / 재검토 트리거 "업스트림이 Antigravity 중지를 풀거나" | `v18.18.7` "Resumed Google Antigravity behind a login warning instead of pausing it"([#18499](https://github.com/can1357/oh-my-pi/issues/18499)) → `v18.20.1` "Paused Google Antigravity: login is no longer available …"([#18341](https://github.com/can1357/oh-my-pi/issues/18341)) + `auth.unpausedProviders` → `v18.20.2` 별도 프로바이더 `antigravity-cli` 추가. **실측**(2026-11-17): `omp models google-antigravity`·`omp models antigravity-cli` 모두 `No models matching`, `auth.unpausedProviders` = `[]` | 퇴역 결정(#135, 사용자 결정 B)은 그대로 두고, 이력 문장에 "18.18.7 재개 → 18.20.1 재중지, `antigravity-cli`는 별도 경로"를 덧붙여 재검토 트리거가 무엇을 가리키는지 분명히 합니다. |
| **D4** | 낮음 | `.omp/skills/harness-friction/scripts/friction.mjs:200-218`(`KNOWN_PROVIDERS`, "`omp://providers.md` 18.18.6") | 프로바이더 바닥 목록이 18.18.6 기준 | `v18.19.0`~`v18.21.0`에서 `liquid`·`nace`·`chutes`·`modal` 추가. **실측**: `omp://providers.md`(18.22.0) 표의 id 86개 중 목록에 없는 것은 `chutes`·`liquid`·`modal`·`nace` 넷이고, 본문에만 나오는 `antigravity-cli`도 없습니다 | 다섯 id를 더하고 기준 버전 주석을 `18.22.0`으로 바꿉니다. 런타임 카탈로그가 집합을 넓히므로 오탐은 없고, 규칙 산문이 새 프로바이더를 언급할 때만 영향이 있습니다. |
| **D5** | 낮음 | `.omp/skills/harness-friction/references/harness-surface.md:7`(구독 이벤트·특별 취급 도구), `:8`(셀렉터 정본), `:10`(`task` 스키마·`modelRoles` 열거) | 이벤트 4종, `task` 스키마에 `steps` 없음, 롤 11종, 커밋 표면 없음 | `v18.18.7` `session_before_shutdown`, `v18.20.1` `session_clear`([#17317](https://github.com/can1357/oh-my-pi/pull/17317)), `v18.21.0` `agent_pause`; `v18.19.0` `task.steps`·`task.autoParallel`, `taskFile` 제거; `v18.20.3` `sourceSession`·`seance` 제거; `v18.20.0` 셀렉터 정본이 `xd://read/sources`·`xd://read/urls`로 이동; `omp://settings.md:488`의 롤 목록에는 `memory`·`widget`·`judge`가 있음 | 다음 감사의 재현율이 이 문서에 달려 있으므로 축 1에 새 이벤트와 `eval`의 `commit` 네임스페이스, 축 2에 `;` 목록과 정본 주소, 축 4에 `steps`·제거된 필드·`judge` 롤을 더합니다. |

---

## 3. 확인 필요 (U1~U4) — 릴리스 노트와 소스 판독만으로 닫지 못한 것

- **U1. omp 네이티브 커밋에서 하네스 pre-commit·post-commit이 실제로 같은 판정을 내는지** — 훅 환경에 `GIT_DIR`·`GIT_WORK_TREE`가 추가로 설정되고(`mutate.rs:1120-1121`), reflog 메시지가 `commit: <제목>`이 아니라 `commit`입니다(`mutate.rs` `LogChange.message`). `.githooks/post-commit:54-55`의 토큰 대조(트리·부모)는 reflog 제목에 기대지 않으므로 통과할 것으로 보이지만 `[INFERENCE]`, 임시 리포에서 `commit.draft()` 커밋 1회와 `no_verify=True` 1회를 돌려 `.omp/harness-state/gated-commit-token` 소비와 `docs/harness/audit.jsonl` 기록을 확인해야 닫힙니다. 이 감사는 읽기 전용이라 커밋을 만들지 않았습니다.
- **U2. `v18.21.0` bash 리다이렉트의 내부 URL 쓰기** — "Bash redirects can now write to all writable internal URLs, including job cancellation endpoints and handler-backed `agent://`, `cfg://`, `ssh://`, and `xd://` URLs." `> xd://ast_edit` 같은 리다이렉트가 실제 파일 변경을 적용하는지, 그 결과가 `bash` `tool_result`에 `details.xdev`로 실리는지 확인하지 못했습니다. 적용된다면 `write` 도구 경로(`index.ts:680-715`)의 write-tracker·backpressure-invalidator·mermaid-check를 거치지 않습니다. `bash`의 직접 파일 쓰기가 이미 "conservatively unrecorded"(`harness-harness_integration_contract.md:101`)인 것과 같은 급의 잔존면입니다.
- **U3. `v18.20.0` `write xd://apply_patch` 와이어 별칭** — "Fixed `read xd://<tool>` and `write xd://<tool>` for unambiguous wire aliases of enabled tools (such as `xd://apply_patch` when `edit` uses `apply_patch` mode)" ([#18977](https://github.com/can1357/oh-my-pi/pull/18977)). `read-path.mjs`의 `mutationRoute`는 모르는 디바이스를 `{ kind: "device" }`로 분류해 추적을 건너뜁니다. 이 호스트는 `edit.mode` = `hashline`이라 해당하지 않고, `apply_patch` 모드를 쓰는 소비 리포에서만 성립합니다.
- **U4. `v18.21.0` 세션 중 확장 교체** — "Extensions enabled or reconfigured through `extensions` or `disabledExtensions` now load into the active session without requiring a restart" / "Moving a task or resuming a session in another project now switches its agents, extensions, custom tools, and MCP servers" ([#19416](https://github.com/can1357/oh-my-pi/pull/19416)). `harness-harness_integration_contract.md:77`의 "A session keeps the extension it loaded at start"(2026-09-24 실측)는 파일 편집을 말하므로 아직 사실일 수 있지만, 프로젝트 전환으로 하네스 확장이 세션 중에 실릴 때 `session_start`가 다시 오는지는 재지 않았습니다. 2026-11-13 U1(지연 로드)과 같은 질문입니다.

2026-11-13의 U1~U3(지연 로드 `session_start`, 선두 `cd` 호이스팅 이벤트 형태, `gc --strip`)은 이 구간에서 새 근거가 없어 그대로 열려 있습니다.

---

## 4. 주목 — 조치 없이 알아둘 것 (요약)

| 릴리스 | 변경 | 하네스 쪽 판단 |
|---|---|---|
| `v18.19.0`, `v18.20.0` | `task.file`·`taskFile` 제거, 차단된 todo(`blocked`) 제거 | 하네스 문서·스폰 예시에 참조가 없습니다(grep 0건). `reviewer.md`의 스폰 예시는 inline `task`입니다. |
| `v18.20.3` | `seance` 에이전트·`/seance`·`sourceSession` 제거 | 하네스 참조 0건. `reserved-names.json`은 이번 갱신에서 반영됐습니다. |
| `v18.19.0`, `v18.18.8`, `v18.21.0` | `ask`가 타임아웃 때 폼의 현재 값을 제출, 선택지 노트, 이미지 붙여넣기 | `ask.timeout` 기본값과 이 호스트 값이 `0`(비활성)이라 `gh-loop/SKILL.md:66-71`의 "사용자가 매번 고른다"는 유지됩니다. 타임아웃을 켠 호스트에서는 `checked`로 미리 고른 값이 자동 제출되므로 모델 질문 폼에 기본 선택을 두지 말아야 합니다. 문구 정정은 #110(2026-11-13 D4)에 이미 있습니다. |
| `v18.20.1` | `session_clear` 이벤트 — `/clear`는 세션 ID를 바꾸지 않고 `session_start`를 다시 내지 않음 | `index.ts:407-410`의 사이클 경계 안내가 `/clear`를 권합니다. `/clear` 뒤에는 `session_start`의 버전 체크·breadcrumb 표면화가 다시 돌지 않고, `before_agent_start`의 1시간 재검사(`index.ts:722-731`)가 부분 보완합니다. 구독 후보입니다. |
| `v18.21.0` | `agent_end`가 run당 한 번, `agent_pause` 신설 — "extension streams retain their existing per-loop `agent_end` behavior" | 하네스 확장은 구독하지 않습니다. Orca 상태 확장(`gh-loop/SKILL.md:97`)은 확장 스트림이라 기존 동작을 유지한다고 적혀 있습니다. |
| `v18.19.0`, `v18.20.0` | 시스템 프롬프트·도구 설명 축소, `systemPromptTemplates`, 서브에이전트 한도 안내 제거 | `bootstrap/SKILL.md:112`의 프로브 문자열 "Fragments when clearer"는 업스트림 `prompts/system/personalities/default.md`에 그대로 있어 프로브는 유효합니다. 깊이 preflight는 `reviewer.md`·`harness-agent_routing.md`에만 남습니다. |
| `v18.20.1` | `grep` 기본 출력이 매치 줄만 표시(`grep.contextBefore/After`) | grep 앵커로 read 처리된 파일의 `edit`이 omp 자체의 `edit.enforceSeenLines`에 거부되는 경우가 늘 수 있습니다(`harness-harness_integration_contract.md:84`가 이미 서술). |
| `v18.20.1`, `v18.20.3` | `bash.patterns` 경로별 항목, 프로젝트·`--config` 오버레이가 전역 규칙 앞에 붙음, `bash.allowedEnvVars` | 하네스는 `bash.patterns`를 설정하지 않습니다. `v18.18.9`의 "Explicit Bash prompt rules remain enforced in yolo mode"와 겹쳐, 소비 리포 설정에 따라 헤드리스 `omp -p --auto-approve`(`cross-repo.mjs:94`, `harness-check/SKILL.md:146`)가 승인 대기로 멈출 수 있습니다. |
| `v18.21.0`, `v18.20.0` | 겹치는 bash 호출이 셸 상태(변수·함수·alias)를 공유, 백그라운드 잡·서브셸의 변수 격리 | 2026-11-13 C4(세션 셸 환경 지속)의 연장이고 잔존면 기록은 미생성 사이클 ④에 남아 있습니다. |
| `v18.22.0`, `v18.18.7`, `v18.20.1` | `worktree.onExit`의 `Force Remove`, 두 번째 종료 요청이 워크트리를 남김, 읽기 전용 파일이 있는 체크아웃의 `worktree add` 수정 | #111(CoW 워크트리 상태 격리)의 주변 동작입니다. 강제 삭제 때 워크트리 안의 gitignored 리뷰 사이드카(`docs/reviews/*.panel.jsonl`)가 함께 사라집니다. |
| `v18.18.8` | `~/.omp/agent` 설정이 `PI_CODING_AGENT_DIR`을 따름, `getConfigAgentDirName()` 제거 | `skill-tune.mjs`·`bootstrap/SKILL.md:103`이 이미 같은 변수를 따릅니다. 하네스는 제거된 함수를 쓰지 않습니다. |
| `v18.20.0` | 시크릿 자리표시자 형식 변경(`$$NAME_HASH:CASE$$` → `Name_fourWords`), `secrets.yml` 정규식이 컴파일 실패 시 기동 중단 | 게이트는 자리표시자를 특별 취급하지 않습니다. 호스트 `secrets.yml`에 lookaround가 있으면 하네스가 부르는 `omp` CLI가 전부 기동에 실패합니다. |
| `v18.20.0`, `v18.20.1` | `retry.fallbackChains`의 점 표기 키 적용, 폴백 뒤 재개 시 primary의 thinking 복원([#19273](https://github.com/can1357/oh-my-pi/issues/19273)), prewalk 핸드오프 수정 | `.panel.jsonl`의 `models`·`thinking` 실측값이 달라질 수 있지만 `model_change` 레코드 형식이 바뀌었다는 근거는 없습니다. |
| `v18.22.0` | `ida`·`ghidra` 도구가 `xd://eval/dsm` 네임스페이스로 이동 | `xd` 스킴은 `URI_SCHEME_PREFIX`에 있고 하네스 참조가 없습니다. |

---

## 5. 이전 감사(#109~#111, 2026-11-13 분할안)와의 관계

| 이전 항목 | 상태 | 이번 구간에서 달라진 것 |
|---|---|---|
| #109 read-path 재미러 (2026-10-16 F1~F4, 2026-11-13 C2·C3·D5) | OPEN, 코드 변경 없음 | C3(`;` 목록)과 아카이브 멤버 `?q=`가 더해집니다. 셀렉터 정본이 `xd://read/sources`로 옮겨졌으므로 미러 기준 주소도 바뀝니다. `v18.18.9`가 확장에 `parseXdUrl`을 공개해([#18849](https://github.com/can1357/oh-my-pi/pull/18849)) 스킴 allowlist의 대안이 생겼습니다. |
| #110 서브에이전트 계약·문서 정합 (2026-11-13 D1~D8) | OPEN | D2(`wait` 응답이 user turn)가 같은 줄에 더해집니다. `reviewer.md:70`의 패널 인원 표기는 #135에서 "BOTH results"로 바뀌었지만, `wait` 한 번이 결과 도착까지 막는다는 서술(2026-11-13 D2)은 그대로입니다. |
| #111 CoW 워크트리·`commitTargetDir` | OPEN | C1로 커밋 대상 판정의 전제(`bash`의 `git commit`)가 흔들립니다. `commitTargetDir` 정합화를 먼저 하면 C1 결정 뒤에 다시 손대야 할 수 있습니다. |
| 2026-11-13 C1 (`adversary-argon`) | #135로 닫힘 | D3 — 중지가 한 번 풀렸다가 다시 걸렸고 `antigravity-cli`가 생겼습니다. 결정은 유지됩니다. |
| 2026-11-13 사이클 ④ (C4, U1~U3) | 미생성 | 새 근거 없음. 이번 ⑤와 합칠 수 있습니다. |

---

## 6. 수용 기준 후보

- [ ] **AC1 (사이클 ① — 네이티브 커밋 경로 결정)**: 사용자가 C1의 A/B/C 중 하나를 고르고, 고른 방식에서 `no_verify` 커밋 1회가 (B) 실행 불가이거나 (A·C) 세션 안에서 관측 가능한 흔적(차단 메시지 또는 다음 턴의 advisory)을 남긴다.
- [ ] **AC2 (사이클 ② — 커밋 절차 문서 정합, ①에 종속)**: `compr`·`compush`·`reviewer.md`·`review-gate.mjs` 안내 문구가 ①의 결정과 같은 커밋 방법 하나만 가리키고, high 위험 diff 1건이 그 방법으로 review-gate를 통과한다.
- [ ] **AC3 (사이클 ③ — #109 보강)**: `readTarget`이 `a.md;b.md`와 `a.md:1-5;b.md:3-9`에서 두 파일을 모두 돌려주고, `node --test .omp/extensions/harness/tests/read-path.test.mjs`가 통과한다.
- [ ] **AC4 (사이클 ④ — 감사 도구 기준 갱신)**: `KNOWN_PROVIDERS`가 `omp://providers.md`(18.22.0)의 표 id를 모두 포함하고 `harness-surface.md`가 D5의 항목을 담으며, `node --test .omp/extensions/harness/tests/harness-friction.test.mjs`가 통과한다.
- [ ] **AC5 (사이클 ⑤ — 실측)**: U1·U2가 임시 리포에서 실측되어 결과가 통합 계약 문서에 인용된다.

---

## 7. 사이클 분할 제안 (`rule://harness-cycle_definition`)

이슈는 만들지 않았습니다. 번호는 제안 순서입니다.

| 사이클 | 범위 | 산출물 | 확인 문장 (1줄) |
|---|---|---|---|
| **① 새 이슈(`needs-decision`) — omp 네이티브 커밋 경로 수용 방식** | C1, D1 | 결정 A/B/C → `.omp/extensions/harness/index.ts` 또는 설정 파일, `.githooks/post-commit`, `.omp/rules/harness-harness_integration_contract.md:61` | 임시 리포에서 `d.commit(…, no_verify=True)`를 시도하면 막히거나, 착지한 뒤 다음 턴에 미승인 커밋 advisory가 에이전트에게 보인다. |
| **② 새 이슈 — 커밋 절차 지침 정합 (①에 종속)** | C2 | `.omp/skills/{compr,compush,init,migrate}/SKILL.md`, `.omp/agents/reviewer.md`, `review-gate.mjs`·`index.ts`의 안내 문구 | `grep -n "git add -A" .omp/skills/*/SKILL.md`의 결과가 ①의 결정과 모순되지 않는다. |
| **③ #109에 합침 — `;` 목록과 아카이브 `?q=`** | C3 | `.omp/extensions/harness/gates/read-path.mjs`, `index.ts:618-621`, `tests/read-path.test.mjs` | `node --test .omp/extensions/harness/tests/read-path.test.mjs`가 `a.md:1-5;b.md:3-9` 케이스를 포함해 통과한다. |
| **④ 새 이슈 — 감사 도구 기준 갱신** | D4, D5 | `.omp/skills/harness-friction/scripts/friction.mjs`, `references/harness-surface.md` | `node --test .omp/extensions/harness/tests/harness-friction.test.mjs`가 통과하고 `KNOWN_PROVIDERS`에 `chutes`·`liquid`·`modal`·`nace`·`antigravity-cli`가 있다. |
| **#110에 합침** | D2, D3 | `.omp/rules/harness-agent_routing.md:40,42`, `.omp/agents/reviewer.md:51-52`, `claudedocs/CLAUDEKR.md`(해당 시) | `node scripts/docs-drift`가 0 error로 통과한다. |
| **⑤ 선택 — 실측** | U1~U4 + 2026-11-13 ④(C4, U1~U3) | `.omp/rules/harness-harness_integration_contract.md` Known residual surfaces | 임시 리포에서 네이티브 커밋 2회(`no_verify` 유무)와 `> xd://` 리다이렉트 1회를 돌린 결과가 계약 문서에 인용돼 있다. |

---

## 8. 범위 밖 (Out of Scope)

- 위 마찰의 수정과 이슈 생성 — 사용자가 분할안을 승인한 뒤 `gh-loop` Stage 1 절차로 합니다.
- 호스트 설정 변경(`commit.enabled`, `auth.unpausedProviders`, `ask.timeout`, `modelRoles`).
- `harness-skill-tune` 지적 19건의 갱신 단계 — 이번에는 점검과 예약 이름 기준 갱신만 했습니다.
- 렌더된 시스템 프롬프트 diff, `harness-check --smoke`(#31에 남은 범위).
- 소비 리포 동기화(`scripts/harness-sync.sh` 화이트리스트)와 리포 밖 스킬(`~/.agents/skills` 등)의 `ask`·`wait` 서술.

---

## 9. 추가 실측 (2026-11-18) — eval `commit`을 임시 리포에서 돌린 결과

사용자 승인 뒤 `/tmp` 임시 리포에서 대조군(`git commit` 1회)과 eval `commit` 4회를 돌렸습니다(omp 18.22.0, 리포는 측정 뒤 삭제). §1·§3에서 "실측하지 않았습니다"로 남긴 항목 가운데 아래는 이 결과로 대체됩니다.

| 항목 | 진짜 `git commit` | eval `commit` |
|---|---|---|
| pre-commit·commit-msg·post-commit 실행 | 실행 | 실행 (`no_verify=True`면 post-commit만) |
| 훅 환경 | `GIT_DIR`·`GIT_WORK_TREE` 미설정, `GIT_INDEX_FILE=.git/index`, `GIT_PREFIX=`(빈 값) | `GIT_DIR`·`GIT_WORK_TREE` 설정, `GIT_INDEX_FILE=.git/omp-commit-<id>.index`, `GIT_PREFIX` 미설정 |
| 훅 시점 `git diff --cached` | 공용 인덱스 전체 | 선택된 줄만(남이 스테이징한 파일은 빠지고 커밋 뒤에도 스테이징된 채 남음) |
| 통과한 훅의 stderr | 도구 결과에 보임 | 보이지 않음 |
| 막은 훅(exit 2)의 stderr | 보임 | 예외 메시지로 전달됨 |
| 하네스 사이클 안내(`CYCLE_BOUNDARY_NOTE`) | 도구 결과에 붙음 | 붙지 않음 |
| reflog 제목 | `commit (initial): <제목>` | `commit` |

- **U1은 닫힙니다.** 하네스의 실제 `.githooks/pre-commit`·`post-commit`을 임시 리포에 깔고 eval `commit`을 돌리자 pre-commit이 rc 0으로 통과했고, 토큰의 승인 트리(`ec4d1a430111`)가 착지한 커밋의 `HEAD^{tree}`와 같았으며 post-commit이 advisory 없이 토큰을 소비했습니다. `GIT_DIR`이 설정된 환경에서도 게이트 판정은 같습니다.
- **C1 증상 1·4는 실측으로 확인됩니다.** `no_verify=True` 커밋은 아무 표시 없이 착지했고, post-commit의 `HARNESS ADVISORY … (no gate verdict token)`은 훅 로그에만 남았습니다. 통과 시 경고(`HARNESS WARNING: No scope file. …`)도 에이전트에게 보이지 않았습니다.
- **C2의 해시 불일치는 실측으로 확인됩니다.** 한 워크트리에 에이전트 변경과 남의 변경이 섞인 상태에서 훅 시점 해시는 `7898c56d…`(= 착지한 커밋의 `git diff HEAD~1 HEAD`)였고, 커밋 전에 계산할 수 있는 세 값 — 공용 인덱스 `git diff --cached`(`69ff5769…`), `git diff HEAD`(`849da7d7…`), `d.diff()` 출력(`88cdfa29…`) — 은 모두 달랐습니다. `d.diff()`는 `index` 줄이 없어 `git diff`와 바이트가 다릅니다.
- **선택 동작**: 같은 파일 안에서 에이전트가 `edit`로 고친 줄은 선택되고, `bash` 리다이렉트로 덧붙인 줄과 호출 사이에 외부에서 쓴 줄은 `unrecorded`로 빠졌습니다. 훅이 커밋 중에 덧붙인 파일(`audit.jsonl` 모사)은 자동 선택되지 않고 Review 목록에 나옵니다.
- **설정(실행으로 확인, 2026-11-18)**: `commit.enabled: false`를 넣으면 시스템 프롬프트 문장과 eval의 `commit` 네임스페이스가 함께 사라집니다. 중첩 세션(`omp -p --no-session … --model @smol`)에 "시스템 프롬프트에 그 문장이 있는가 / eval에서 `'commit' in dir()`"를 물은 결과가 기본 상태 `PROMPT=YES, NS=True`, `--config` 오버레이 `PROMPT=NO, NS=False`, 프로젝트 설정(`.omp/config.yml`) 적용 뒤 `PROMPT=NO, NS=False`였습니다. 프로젝트 설정은 **체크아웃마다** 읽히므로(`omp://settings.md:30`), 이 변경이 들어가지 않은 브랜치의 워크트리(`/home/rae/orca/workspaces/omp/issue`)에서는 여전히 `true`였고, `.omp/config.yml`은 `scripts/harness-sync.sh` 화이트리스트에 없어 소비 리포로 가지 않습니다.
