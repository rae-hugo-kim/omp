---
description: "When to delegate to reviewer/verifier/other subagents; model and effort tiers; dispatch preflight"
---
# Agent Routing Policy

프로젝트 전용 서브에이전트의 호출 기준을 정의한다.
이 에이전트들은 `.omp/agents/`에 정의되어 있고 OMP의 task 도구가 디스커버리해 호출한다 — 하네스가 정의·동기화하는 에이전트는 `reviewer`·`verifier`·`code-reviewer`·`adversary`(+ `adversary-opus`·`adversary-argon`) 6종뿐이고(`scripts/harness-sync.sh:216-222`), 그 밖에는 OMP 번들 에이전트 `scout`·`security-reviewer`·`task`·`sonic`이 있다(`omp://task-agent-discovery.md:129-136`; 번들에도 `reviewer`가 있지만 프로젝트 `.omp/agents/reviewer.md`가 이름 우선순위로 가린다). OMC(oh-my-claudecode)의 `executor`·`architect`·`critic`·`test-engineer`·`librarian` 같은 에이전트에는 **이 정책이 의존하지 않는다** — omp는 `.claude/agents` 루트를 의도적으로 건너뛰고(`omp://task-agent-discovery.md:148`), OMC처럼 사용자 레벨 Claude 마켓플레이스(`~/.claude/plugins`)로 설치된 `agents/`는 Claude 플러그인/사용자 소스가 켜져 있을 때만 들어온다(`enabledProviders`에 `claude-plugins` 또는 `claude`, 혹은 `CLAUDE_CONFIG_DIR` 설정 — `:159`; 프로젝트 범위 플러그인 루트는 `claude-plugins` 프로바이더만 있으면 된다. 2026-10-20 실측 omp 18.11.1 `omp config get enabledProviders` → `[]`, 세션 에이전트 목록에 없음). 소비 리포에 그 설정을 보장할 수 없으므로 MUST 경로는 위 6종 + 번들만 쓴다. OMC의 훅 자동화(매직 키워드, system-reminder 주입 등)도 OMP에서 동작하지 않으며, 라우팅은 본 정책과 에이전트 정의로만 이뤄진다.

## 라우팅 기준

### 판단 흐름

```
구현 완료 후 검증 필요?
  → verifier (AC/하네스 기반 완료 검증)
high/critical 위험 코드 변경의 품질 리뷰 필요?
  → reviewer (3-pass 적대적 리뷰; low/medium은 셀프 리뷰로 충분)
그 외 (탐색/조사/구현)?
  → 직접 처리 또는 빌트인 에이전트 사용 (scout, task, sonic, security-reviewer)
```

### 에이전트별 트리거

| 에이전트 | 트리거 조건 | 비트리거 (직접 처리) |
|----------|-------------|---------------------|
| **reviewer** | high/critical 위험 코드 변경 후 품질 리뷰 (3-pass: self + 이종 모델 adversary 패널(상시 3명) + code-reviewer — 전부 `.omp/agents/` 프로젝트 정의, OMC 불요) | low/medium 위험 변경(셀프 리뷰로 충분), 단순 문서/설정 변경 |
| **verifier** | 구현 완료 주장 전 AC/하네스/테스트 검증 | AC가 정의되지 않은 탐색적 작업 |

### 검증 에이전트 호출 기준

- **reviewer**: SHOULD `risk-assess` 기준 **high/critical** 변경(보안/인증/마이그레이션 파일 접촉, 또는 코드 100줄 초과 변경)일 때 호출. low/medium 변경은 셀프 리뷰(추가 스폰 없음)로 충분하다 — `review-gate`가 이종 모델 리뷰 증거를 강제하는 것도 high/critical 커밋뿐이다(review-gate.mjs). 결과는 `docs/reviews/`에 자동 기록.
- **reviewer 실행 토폴로지(Pass 2/3 중첩 스폰)**: reviewer는 frontmatter `spawns: adversary, adversary-opus, adversary-argon, code-reviewer`로 두 패스(Pass 2 패널 3명 + Pass 3)를 네이티브 중첩 스폰하며, OMP의 재귀 캡(`task.maxRecursionDepth`, 기본 2) 때문에 task 툴을 보유하려면 depth 1 이하에서 기동해야 한다. 리뷰 진입점은 아래 우선순위를 따른다.
  1. **depth 0 (top-level 세션)**: reviewer 에이전트를 스폰한다 — reviewer가 Pass 2/3를 depth 2로 중첩 스폰하는 기존 네이티브 경로가 그대로 동작한다.
  2. **depth 1 워커 세션 (vibe 등)**: reviewer 에이전트를 스폰하지 않는다. 대신 task capability를 가진 good급 세션이 `.omp/agents/reviewer.md` 프로토콜을 직접 수행한다 — Pass 1은 세션이 셀프 분석으로, Pass 2(패널 3명: adversary·adversary-opus·adversary-argon)와 Pass 3(code-reviewer)만 depth 2로 batch 스폰한다. 이것이 vibe 모드의 표준 단일 진입점이다. 수행 주체가 세션이어도 불변식은 동일하다([`.omp/rules/harness-adversarial_review.md`](harness-adversarial_review.md)의 "3-pass 코드 리뷰 불변식" 참조).
  3. **task 툴이 없는 세션**: 그 세션에서는 리뷰를 진행하지 않는다. top-level `omp -p`로 탈출해 1번 경로로 재실행한다.
- **디스패치 preflight (MUST)**: reviewer를 스폰하거나 프로토콜을 직접 수행하기 전에, 호출자는 자신의 depth와 task 툴 가용성을 확인해야 한다. 조건은 세션 종류가 아니라 capability다 — task 툴이 없으면 그 세션에서 리뷰 진행 금지. (실측 주석: fast급 워커 세션은 task 툴이 전면 비활성('Allowed: none')일 수 있다.) 이 preflight가 없으면 경로 규칙이 문서로 존재해도 generic 스폰이 그대로 실행된다 — 2026-07-22 vibe 세션 실측: depth 1 워커가 스폰한 reviewer는 depth 2에서 task 툴 없이 기동했고, 블로킹 task 호출 안에 있던 caller는 자식의 sibling 스폰 요청(hub)에 응답 불능이라 교착했다(제3 세션 릴레이로 회복, 라운드당 수십 분 손실). 같은 이유로 "caller가 sibling 스폰 결과를 reviewer에게 공급"하는 구 폴백은 폐기했다 — 블로킹 caller는 그 공급을 수행할 수 없다.
- 형제 batch → aggregator 2단계 DAG 경로는 표준에 넣지 않는다 — 계약 표면 최소화. 병렬 필요가 실측되면 그때 해당 경로만 재도입한다(아래 "재도입 트리거"와 같은 패턴).
- 어느 경로든 사이드카의 models 배열은 reviewer 자신의 `model_change` 레코드 전부와 자식 트랜스크립트의 마지막 `model_change`를 실측한 뒤에만 기재하고, 이종성은 소스 단위로 판정한다(완료된 멤버 하나 이상의 마지막 모델이 reviewer의 어느 레코드에도 없는 계열일 때만). codex CLI 폴백은 제거되었다 — thread id는 게이트 증거가 아니다.
- **verifier**: MUST 작업 완료를 사용자에게 보고하기 전에 호출. AC가 있는 경우 필수. `task` 스폰은 논블로킹(비동기 job 배달)이므로 **스폰만으로는 완료가 아니다 — verifier의 verdict가 실제로 도착한 뒤에만 완료를 선언한다.**
- **운영 팁**: 완료된 서브에이전트는 잠시 idle로 살아있다(이후 parked). reviewer/verifier 후속 질의는 재스폰 대신 `write agent://<id>`로 메시지를 보내고 `wait`로 응답을 받으면 컨텍스트를 보존한다(브로드캐스트는 `agent://all`). `hub` 툴은 omp 18.3.0에서 폐기됐다(2026-09-24, #41).
- **adversary 모델 선택**: `adversary`는 `@advisor` 롤을 따른다. **`advisor` 미설정 시 omp 18.2.1부터 `@slow`로 폴백한다**(이전엔 primary 상속) — 그 멤버만으로는 reviewer와 같은 모델이 되어 이종 증거가 되지 않지만, 고정 모델 멤버 `adversary-argon`(gemini)이 계열을 공급하므로 그 멤버가 완료되는 한 `advisor` 미설정만으로 이종 증거가 불성립하지는 않는다. 단일 계열 환경(argon의 프로바이더에 로그인이 없어 `failed`이고 `@advisor`도 reviewer 계열)에서 이종 리뷰가 불가능하면 게이트의 나머지 두 경로를 쓴다: human-review(오늘자 `docs/reviews/review-<ts>.json` 사이드카에 `["omp-review-evidence/v1", <hash>, "PASS", null, <이름>, <이름>]` — 게이트는 마크다운을 파싱하지 않는다) 또는 감사된 override(`docs/harness/review-skip`에 `["omp-review-override/v1", <사유>, <승인자>, <hash>]` — `audit.jsonl`에 `review_override`로 기록·소비). bare/비-tuple `review-skip` 파일만으로는 더 이상 우회되지 않는다.
- **adversary 패널 (상시 3명, 2026-10-21 확정)**: Pass 2는 같은 프롬프트를 쓰는 3개 에이전트를 한 batch로 병렬 스폰한다 — `adversary`(`@advisor`), `adversary-opus`(`anthropic/claude-opus-5-5`, primary와 같은 계열을 일부러 포함), `adversary-argon`(`google-antigravity/gemini-4-argon`). 두 미러 파일은 frontmatter 아래 본문이 `adversary.md`와 바이트 동일하고 `name`·`description`·`model`만 다르다 — 프롬프트가 같아야 모델 간 비교가 공정하므로 본문은 `adversary.md`에서만 고치고 다시 미러한다. 멤버별 결과(실측 모델 전부·thinking·상태·소요·verdict·finding별 심각도와 겹친 소스 `also`)는 reviewer가 리뷰와 같은 basename의 `docs/reviews/review-<ts>.panel.jsonl`(gitignored — 리뷰가 추적 파일을 건드리면 diff 해시가 어긋난다)에 남기고, 이 행으로 구성을 다시 검토한다. 완료 = 최종 출력에 파싱 가능한 `## Verdict` 라인 + Findings/Clean Areas의 diff `file:line` 인용 1건 이상(거부·블로커 메시지·잘린 보고·`file:line` 없는 verdict는 `failed`). 행은 소스별(멤버 3 + self + code-reviewer)로 남긴다. 사이드카 models 배열은 reviewer 자신의 `model_change` 레코드 전부(자기 폴백도 자기 관점이라 기재) + 완료 멤버 각각의 **마지막** `model_change` 모델(최종 출력을 낸 모델)이고, 이종성은 소스 단위 — 완료 멤버 하나 이상의 마지막 모델이 reviewer의 어느 레코드에도 없는 계열일 때만 성립한다. 실패한 멤버, reviewer 자신의 폴백, 그리고 멤버의 startup selector(다른 계열로 요청됐다가 reviewer 계열로 폴백해 완주한 경우)는 계열을 공급하지 않는다. 멤버 간 agreement는 귀속(attribution)에만 쓰이고 이종성 판정에는 영향이 없다. 알려진 비대칭: `adversary`는 `@advisor` 롤 접미사(`:xhigh`)를 따르고 나머지는 `high` 고정이라 thinking이 같지 않다(롤 변경은 범위 밖). **구성 근거(#112 사이클 ②, 2026-10-21)**: 평가 기간 4인(+ `adversary-sol`=`openai-codex/gpt-5.6-sol`)으로 리뷰 17회·멤버 실행 68회(실패 0, 폴백 1)를 집계했다(`docs/reviews/**/*panel.jsonl`). reviewer 최종 목록 58건 기준 재현율 opus 69% · argon 40% · sol 40% · astra 33%, self 외에 그 멤버만 동의한 "단독 뒷받침" opus 10 · argon 3 · sol 1 · astra 1, unique(high) opus 57(1) · argon 10(0) · astra 7(2) · sol 5(0). astra는 가장 빠르고(중앙값 3.7분) high 4건을 모두 재현했으며 최종 verdict 일치가 가장 높았다(11/13). sol은 독자 기여가 가장 작고 FAIL 14/17로 가장 가혹했으며 Pass 3 code-reviewer와 같은 모델이라 제외했다. 교란 요인: reviewer가 Claude라 opus 재현율이 부풀었을 수 있고(opus는 low 102건으로 교차확인 비율 63% 최저), high 이상 표본은 4건뿐이다. codex 인증이 죽으면 GPT 멤버가 없어 이종성은 argon 하나에 의존한다.
- **reviewer 모델 선택**: reviewer는 `@slow` 롤을 따른다. `@slow`는 `modelRoles.slow` 미설정 시 default 롤을 상속하므로, 리뷰를 primary보다 강한(또는 명시적으로 의도한) 모델로 돌리려면 `modelRoles.slow`를 직접 지정한다.
- **라우팅 기준의 근거**: 이 절의 기준값(모델 롤·에포트·reviewer 임계)을 바꿀 때는 `node .omp/extensions/harness/estimate-report.mjs` 출력(인테이크 예상 × `risk-assess` 실측 교차표, (등급·깊이·모델) 셀별 건수·FAIL 합 — `docs/harness/audit.jsonl`의 `estimate_vs_actual`; §3 gh-loop dispatch 모델×규모 셀 — `gh_loop_dispatched`·`gh_loop_closed`, 리뷰 라운드·verifier 비PASS·결정 왕복·분 중앙값)을 근거로 인용한다. 표는 사람이 읽는 원자료다 — 자동 추천은 없고, 표본이 적은 개인 하네스에서는 셀당 의미 있는 수가 모이는 데 수개월이 걸린다(`.omp/rules/harness-cycle_definition.md` "예상 레코드"). gh-loop dispatch의 "규모 기반 추천" 한 줄(`gh-loop-record.mjs recommend`, risk × depth × files 구간 → `smol`/`default`/`slow`/`plan`)은 표시용이며 기본값·자동 선택이 아니다 — 규칙표는 §3이 쌓인 뒤 테스트와 함께 조정한다(#79).

## 폐기된 MCP 라우팅 (2026-06-10)

researcher(Exa)/db-worker(Supabase)/refactorer(Serena)/full-context(복합) 4종의
MCP 위임 라우팅과 에이전트 정의를 제거했다.

- **근거**: 전 프로젝트·전 기간 세션 로그 실측에서 위임 0회 (같은 기간
  OMC executor 1,044회 — 작업량 부재가 아니라 라우팅 자체가 한 번도 선택되지
  않음). 외부 조사·DB·리팩터링 작업은 빌트인(explore(현 scout)/task/web_search)과
  직접 MCP 호출이 흡수했다.
- **재도입 트리거**: 특정 MCP 도메인 작업이 반복되며 직접 처리의 마찰이
  관측될 때, 해당 도메인 1종만 우선 복원(전체 매트릭스 부활 금지).
  복원은 git history의 에이전트 정의(구 `.claude/agents/`, 현 `.omp/agents/`) 참조.
