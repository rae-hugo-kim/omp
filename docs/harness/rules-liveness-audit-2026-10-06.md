# harness-* 규칙 29편 생사 감사 (2026-10-06, 이슈 #29)

**결론**: `.omp/rules/harness-*.md` 29편을 기준 3개로 실측한 결과 **유지(생) 19편 · 병합 후보 8편 · 폐기 후보(사) 2편**이에요. 삭제·병합은 이 사이클에서 실행하지 않고 §7의 제안 목록만 남겨요 — 실행은 별도 승인 후속 사이클이에요(이슈 #29 세션 직접 결정 A, 2026-10-06).

- 대상: HEAD `0f205a7`(main, PR #81 머지 직후)의 `.omp/rules/harness-*.md` 29편. 규칙 파일은 이 감사에서 한 줄도 바꾸지 않았어요.
- 기준(이슈 본문 제안을 그대로 승인): ① 참조 여부 ② 게이트 배선 ③ 최근 발동 사례. ①·②는 명령과 출력을 §3·§4에 그대로 기록했고(리포 루트에서 재실행하면 같은 숫자), ③은 §5에서 흔적을 경로·번호로 인용했어요.
- 실측 시각: 2026-10-06 06:40~07:10 UTC. 이슈·댓글 집계는 그 시각의 스냅샷이라 이 사이클이 남기는 댓글·PR 본문은 들어 있지 않아요.

## 1. 판정 방법

| 기준 | ● (강) | ◐ (약) | ○ (없음) |
|---|---|---|---|
| ① 참조 | `harness-core` 포인터, AGENTS.md 본문(Linked Modules 색인 제외), 스킬·에이전트·checklists·templates·docs가 이름으로 가리킴 | 형제 규칙(`.omp/rules/harness-*`)의 교차 링크만 | AGENTS.md "Linked Modules" 색인 1줄뿐 |
| ② 배선 | `.omp/extensions/harness`·`.githooks` 코드가 이름을 인용하거나 그 MUST를 집행(§4.2 의미 배선 표) | `scripts/harness-audit.sh`의 파일 존재 점수, 테스트 픽스처 경로뿐 | 없음 |
| ③ 흔적 | 2026-08-07 이후(최근 60일) `audit.jsonl`·`docs/sum`·`docs/reviews`·이슈/댓글·커밋 메시지에 이름 또는 집행 이벤트 | 그 이전 흔적만 | 흔적 없음 |

판정 규칙: ● 2개 이상이면 **생**. ● 1개 이하이고 §6의 내용 중복 분석에서 흡수 모체가 있으면 **병합 후보**, 모체가 없으면 **사 후보**. 단 `harness-core`(alwaysApply)가 가리키는 규칙은 매 요청 본문이 실리는 A칸 포인터이므로 ①을 ●로 봐요(ADR 002 §결정 표).

한계: 이름 grep은 발동의 근사치예요. 문체·추측 금지처럼 매 턴 작동하는 규칙은 이름을 남기지 않고, 게이트가 집행하는 규칙은 이벤트 행(`acceptance_wip`·`review_override` 등)으로만 남아요. 그래서 ③에는 이름 흔적과 집행 이벤트를 둘 다 적었어요. `docs/sum`·`docs/reviews`는 gitignore 로컬 전용이라 메인 체크아웃(`/home/rae/projects/workspace/omp`)의 사본을 읽기 전용으로 집계했어요 — 다른 머신에서는 그 두 열의 숫자가 달라요.

## 2. 판정표 (29편)

| # | 규칙 | ① 참조 | ② 배선 | ③ 흔적 | 판정 | 근거 요약 (경로) |
|---|---|---|---|---|---|---|
| 1 | adversarial_review | ● | ● | ● | **생** | 스킬 `startdev`·`kickoff` 6회; `gates/review-gate.mjs:560` 인용, `audit.jsonl` `adversarial_review`×5·`review_override`×4(최근 2026-09-26); `docs/reviews` JSON 사이드카 35개(최근 2026-10-03) |
| 2 | agent_routing | ● | ● | ● | **생** | AGENTS.md 본문 2, `gh-loop/SKILL.md`, `.omp/agents/reviewer.md`×2; `estimate-report.mjs:3`, `harness-audit.sh:147`; #79 댓글(2026-10-03), sum 2026-09-25 |
| 3 | agent_security | ◐ | ◐ | ○ | **사 후보** | 유일 inbound는 `harness-prompt_engineering.md:172-174`의 관할 분리; `harness-audit.sh:293` 존재 점수(+2); sum·reviews·이슈·audit 흔적 없음(커밋 `edb9b0a` 포팅뿐) |
| 4 | anti_hallucination | ● | ○ | ◐ | **생** | `harness-core.md:9` 포인터, AGENTS.md 본문 1; 게이트 없음; sum 2026-08-26 |
| 5 | assetization | ● | ○ | ● | **생** (learning_policy 모체) | `docs/decisions/README.md` 참조; 이슈 #26·#27, sum 2026-09-07 |
| 6 | change_control | ● | ◐ | ◐ | **생** | `harness-core.md:12` 포인터, AGENTS.md 본문 2; `context-gate`가 read-before-edit만 집행(:6); 이슈 #16 |
| 7 | code_review_policy | ● | ◐ | ○ | **생(조건부)** | `checklists/code_review.md` 2회("Full policy"); `harness-audit.sh:183` 존재 점수(+2); 이름 흔적 0 — 임계값(50/800/4)이 `coding_standards`·체크리스트와 3중 중복(§6 A) |
| 8 | coding_standards | ◐ | ○ | ● | **생** | `harness-hook_recipes.md`·`harness-code_review_policy.md` 교차 링크; 게이트 없음; sum 7편(최근 2026-10-02), 이슈 #36 |
| 9 | commit_and_pr | ◐ | ○ | ◐ | **사 후보** | `harness-writing_style.md` 역할 분리 1회뿐; 게이트 없음; sum 2026-09-07 1편 — `compr`/`compush` 스킬·`checklists/pr.md`·`harness-core.md:7`이 내용을 덮음(§6 B) |
| 10 | context_management | ◐ | ◐ | ○ | **생(조건부, session_persistence 모체)** | `session_persistence`×3·`cycle_definition`×1 교차 링크; `harness-audit.sh:162,333` 존재 점수(+5); 이름 흔적 0 |
| 11 | core | ● | ◐ | ● | **생** | `alwaysApply: true`(매 요청 본문); 테스트 `harness-sync.test.mjs`·`harness-wiring.test.mjs` 21회; 이슈 #49·#50·#52·#80, 커밋 5건 |
| 12 | cost_awareness | ○ | ◐ | ○ | **병합 후보 → agent_routing** | 색인뿐; `harness-audit.sh:321` 존재 점수(+3); 흔적 0 — Haiku/Sonnet/Opus 고정 표가 `agent_routing`의 롤(`smol/default/slow/plan`) 체계와 이중 정의 |
| 13 | cycle_definition | ● | ● | ● | **생** | `harness-core.md:10` 포인터, 스킬 3·templates 2; 게이트 코드 10회(`acceptance-gate.mjs:534` BLOCK 메시지, `kickoff-detector.mjs:30`, `estimate.mjs`, `index.ts:404`); `estimate_vs_actual`×16(최근 2026-10-03), reviews 3 |
| 14 | design_contract | ● | ○ | ● | **생** | `templates/DESIGN.md:5` 역참조; 게이트 없음(소비 리포 계약); 이슈 #37·#44, sum 2026-09-24 |
| 15 | doc_standards | ● | ● | ● | **생** | 스킬 6(`compr`·`compush`·`sum`·`design-mockup`), `docs/README.md`; `gates/archive-guard.mjs:4`, `.githooks/pre-push:26`, `mermaid-check.ts`; 이슈 #38·#49, sum 2026-09-26 |
| 16 | documentation_policy | ◐ | ○ | ◐ | **병합 후보 → writing_style** | inbound는 `harness-writing_style.md:9,51,97`뿐; 흔적은 이슈 #16·#49 언급뿐 — 본문 5개 불릿, 이모지 금지는 writing_style R6이 재서술 |
| 17 | harness_integration_contract | ● | ● | ● | **생** | AGENTS.md 본문 1, `docs/harness/README.md`; `gates/backpressure-gate.mjs:95` BLOCK 메시지, `commit-gates.mjs:65`, `.githooks/pre-commit:12`; 이슈 10건, reviews 12, sum 15 |
| 18 | hook_recipes | ◐ | ○ | ○ | **병합 후보 → harness_integration_contract** | inbound `harness-session_persistence.md:79` 1회; 레시피 5종 중 `gates/`에 존재하는 것 0; 흔적 0 |
| 19 | information_discovery | ○ | ○ | ○ | **병합 후보 → anti_hallucination** | 색인뿐(`harness-core.md:9`는 anti_hallucination·repo_command_discovery만 가리킴); 흔적 0(커밋 `e97b8f8` 1건) — 스스로 twin 선언(:5) |
| 20 | learning_policy | ◐ | ○ | ◐ | **병합 후보 → assetization** | `templates/retro.md`·`session_persistence` 각 1; sum 2026-08-26 — retro 트리거가 `assetization:48-53`과 중복, 저장소 `MEMORY.md` 부재 |
| 21 | mcp_policy | ● | ● | ● | **생(조건부)** | AGENTS.md "MCP Server Policy" 본문 2; `gates/mcp-gate.mjs`(advisory, `index.ts:575`)가 DDL 패턴 경고; 이슈 #5·#21, sum 2026-09-07 — 본문 절반(LSP 레이어·Context7/Serena 폐기 이력)이 stale(§8) |
| 22 | prompt_engineering | ● | ◐ | ● | **생** | `docs/prompt-writing-handbook.md`·`docs/README.md`; `scripts/harness-sync.sh:228` 짝 핸드북 동기화; 이슈 #23·#24·#27·#28, 커밋 3 |
| 23 | quality_gates | ● | ◐ | ○ | **병합 후보 → verification_tests_and_evals** | `checklists/quality_gate.md`; `harness-audit.sh:207` 존재 점수(+1); 흔적 0 — 발견 순서는 `repo_command_discovery`, EVAL 조건은 `verification` 재서술, 전제 훅 `quality-gate.js` 부재 |
| 24 | repo_command_discovery | ● | ○ | ○ | **생** | `harness-core.md:9` 포인터, AGENTS.md 본문 1(Non-Negotiables); 게이트 없음; 이름 흔적 0(매 작업 암묵 적용) |
| 25 | safety_security | ● | ● | ○ | **생** | `harness-core.md:8` 포인터; `gates/destructive-guard.mjs`(advisory)가 :8-14 일부 집행, `harness-audit.sh:287`(+2); 이름 흔적 0(이벤트 없음) |
| 26 | session_persistence | ● | ● | ◐ | **병합 후보 → context_management** | `docs/architecture/harness-architecture.md`×2; `breadcrumb-tracker/-surface`가 :24-36을 집행, `harness-audit.sh:168,222`(+4); sum 2026-06-18 — 스스로 "context_management가 WHEN/WHAT, 이 파일이 HOW/WHERE"라 3회 정의(:6,:10,:77), `.omp/contexts/*` 부재 |
| 27 | tdd_policy | ● | ◐ | ◐ | **병합 후보 → verification_tests_and_evals** | AGENTS.md 본문 1; 테스트 픽스처 경로 5회(`risk-assess.test.mjs`); sum 2026-08-26 — 사이클 본문은 `.omp/skills/startdev/references/tdd_rules.md`가 상세판, 예외 절차는 3중 |
| 28 | verification_tests_and_evals | ● | ● | ● | **생** | AGENTS.md 본문 3(Non-Negotiables), `checklists/quality_gate.md`; `backpressure-gate.mjs`가 "테스트 없이 커밋 금지" 집행, `harness-audit.sh:213,271`(+2); 이슈 #16·#41, sum 2026-09-26 |
| 29 | writing_style | ● | ◐ | ● | **생** | `harness-core.md:6` 포인터; 테스트 픽스처 4회; 이슈 #49·#80, 댓글 #31·#49, 커밋 `4965c53`(2026-10-03) |

집계: 생 19(조건부 3 포함) / 병합 후보 8 / 사 후보 2.

## 3. 기준 ① 참조 여부 — 명령과 출력

열: `AGENTS` = AGENTS.md 전체 줄 수, `body` = "Linked Modules" 절을 뺀 AGENTS.md 줄 수, `skills` = `.omp/skills/**/*.md`, `rules` = 자기 파일을 뺀 `.omp/rules/*.md`, `agents` = `.omp/agents/*.md`, `chk/tpl` = `checklists/`·`templates/`·`INDEX.md`, `docs` = `docs/**/*.{md,yaml}`(이 문서 제외).

```bash
printf '%-36s %6s %4s %6s %5s %6s %7s %4s\n' rule AGENTS body skills rules agents chk/tpl docs
for f in .omp/rules/harness-*.md; do n=$(basename "$f" .md)
  a=$(grep -c "$n" AGENTS.md)
  b=$(awk '/^## Linked Modules/{skip=1} /^## Checklists/{skip=0} !skip' AGENTS.md | grep -c "$n")
  s=$(grep -rho "$n" .omp/skills --include='*.md' | wc -l)
  r=$(grep -rho "$n" .omp/rules --include='*.md' --exclude="$n.md" | wc -l)
  g=$(grep -rho "$n" .omp/agents --include='*.md' | wc -l)
  c=$(grep -rho "$n" checklists templates INDEX.md | wc -l)
  d=$(grep -rho "$n" docs --include='*.md' --include='*.yaml' --exclude='rules-liveness-audit-*.md' | wc -l)
  printf '%-36s %6s %4s %6s %5s %6s %7s %4s\n' "$n" "$a" "$b" "$s" "$r" "$g" "$c" "$d"
done
```

```text
rule                                 AGENTS body skills rules agents chk/tpl docs
harness-adversarial_review                1    0      6     6      0       0    0
harness-agent_routing                     3    2      1     3      2       0    2
harness-agent_security                    1    0      0     4      0       0    0
harness-anti_hallucination                2    1      0     5      0       0    0
harness-assetization                      1    0      0     0      0       0    2
harness-change_control                    3    2      0     4      0       0    0
harness-code_review_policy                1    0      0     0      0       4    0
harness-coding_standards                  1    0      0     3      0       0    0
harness-commit_and_pr                     1    0      0     2      0       0    0
harness-context_management                1    0      0     5      0       0    0
harness-core                              5    5      1     1      0       1   15
harness-cost_awareness                    1    0      0     0      0       0    0
harness-cycle_definition                  2    1      3     6      0       2    2
harness-design_contract                   1    0      0     0      0       1    0
harness-doc_standards                     1    0      6     7      0       0    2
harness-documentation_policy              1    0      0     6      0       0    0
harness-harness_integration_contract      2    1      0     5      0       0    2
harness-hook_recipes                      1    0      0     1      0       0    0
harness-information_discovery             1    0      0     0      0       0    0
harness-learning_policy                   1    0      0     1      0       1    0
harness-mcp_policy                        3    2      0     0      0       0    0
harness-prompt_engineering                1    0      0     0      0       0    7
harness-quality_gates                     1    0      0     2      0       1    0
harness-repo_command_discovery            2    1      0     4      0       0    0
harness-safety_security                   1    0      0     2      0       0    0
harness-session_persistence               1    0      0     2      0       0    2
harness-tdd_policy                        2    1      0     0      0       0    0
harness-verification_tests_and_evals      4    3      0     4      0       1    0
harness-writing_style                     2    0      0     1      0       0    2
```

읽는 법: `AGENTS=1, body=0`은 "Linked Modules" 색인 한 줄뿐이라는 뜻이에요(29편 전부 색인에는 있어요 — 그래서 색인은 ① 판정에서 제외했어요). `harness-core`의 포인터(`grep -noE 'rule://harness-[a-z_]+' .omp/rules/harness-core.md`)는 `writing_style`(:6)·`safety_security`(:8)·`anti_hallucination`·`repo_command_discovery`(:9)·`cycle_definition`(:10)·`change_control`(:12) 6편이에요. 참조 위치 전체 목록은 아래 명령으로 다시 뽑을 수 있어요(출력 약 190줄이라 본문에는 싣지 않았어요):

```bash
for f in .omp/rules/harness-*.md; do n=$(basename "$f" .md); echo "## $n"
  grep -rc "$n" AGENTS.md INDEX.md .omp/skills .omp/agents .omp/rules checklists templates docs \
    --include='*.md' --include='*.yaml' --exclude='rules-liveness-audit-*.md' | grep -v ':0$' | grep -v "^$f:"
done
```

frontmatter 실측(`awk` 추출): 29편 중 `harness-core`만 `alwaysApply: true`, 나머지 28편은 `description`만 있어요. `globs`·`condition`(TTSR)은 0편 — ADR 002 부속 결정 5("TTSR은 범위 밖")와 일치해요.

## 4. 기준 ② 게이트 배선 — 명령과 출력

### 4.1 코드가 이름을 인용하는가

열: `gates` = `.omp/extensions/harness/**/*.{ts,mjs}`(tests 제외), `tests` = `.omp/extensions/harness/tests/`, `hooks` = `.githooks/`, `scripts` = `scripts/`.

```bash
printf '%-36s %5s %6s %7s %8s\n' rule gates tests hooks scripts
for f in .omp/rules/harness-*.md; do n=$(basename "$f" .md)
  c=$(grep -rho "$n" .omp/extensions/harness --include='*.ts' --include='*.mjs' --exclude-dir=tests | wc -l)
  t=$(grep -rho "$n" .omp/extensions/harness/tests | wc -l)
  h=$(grep -rho "$n" .githooks | wc -l)
  s=$(grep -rho "$n" scripts | wc -l)
  printf '%-36s %5s %6s %7s %8s\n' "$n" "$c" "$t" "$h" "$s"
done
grep -rnE "readFileSync\([^)]*rules" .omp/extensions/harness --include='*.ts' --include='*.mjs' --exclude-dir=tests | wc -l
```

```text
rule                                 gates  tests   hooks  scripts
harness-adversarial_review               1      0       0        0
harness-agent_routing                    1      0       0        3
harness-agent_security                   0      0       0        3
harness-anti_hallucination               0      0       0        0
harness-assetization                     0      0       0        0
harness-change_control                   0      0       0        0
harness-code_review_policy               0      1       0        3
harness-coding_standards                 0      0       0        0
harness-commit_and_pr                    0      0       0        0
harness-context_management               0      0       0        6
harness-core                             0     21       0        0
harness-cost_awareness                   0      0       0        3
harness-cycle_definition                10      3       0        0
harness-design_contract                  0      0       0        0
harness-doc_standards                    1      0       1        0
harness-documentation_policy             0      1       0        0
harness-harness_integration_contract     2      0       1        0
harness-hook_recipes                     0      0       0        0
harness-information_discovery            0      0       0        0
harness-learning_policy                  0      1       0        0
harness-mcp_policy                       0      2       0        0
harness-prompt_engineering               0      0       0        1
harness-quality_gates                    0      0       0        3
harness-repo_command_discovery           0      0       0        0
harness-safety_security                  0      0       0        3
harness-session_persistence              0      0       0        6
harness-tdd_policy                       0      5       0        0
harness-verification_tests_and_evals     0      0       0        5
harness-writing_style                    0      4       0        0
0
```

- 마지막 `0`: 런타임에 규칙 파일 본문을 `readFileSync`로 읽는 게이트는 없어요. 게이트는 규칙을 **읽지 않고** 자기 로직으로 집행하며, 사용자에게 보이는 메시지·주석에서 규칙 경로를 인용할 뿐이에요.
- `gates` 열의 인용 위치(`grep -rnE 'harness-(cycle_definition|adversarial_review|doc_standards|harness_integration_contract|agent_routing)' .omp/extensions/harness --exclude-dir=tests .githooks`): `acceptance-gate.mjs:530,534`(BLOCK 메시지) · `kickoff-detector.mjs:30`(REMINDER) · `estimate.mjs:1,20` · `index.ts:399,404` · `review-gate.mjs:471`(cycle_definition), `review-gate.mjs:560`(adversarial_review override 선례), `archive-guard.mjs:4` · `.githooks/pre-push:26`(doc_standards), `commit-gates.mjs:65` · `backpressure-gate.mjs:95`(BLOCK 메시지) · `.githooks/pre-commit:12`(harness_integration_contract), `estimate-report.mjs:3` · `gh-loop-record.mjs:2`(agent_routing·cycle_definition).
- `tests` 열은 전부 **픽스처 경로**예요(`risk-assess.test.mjs:51-56`이 docs-only 분류 샘플로 규칙 경로를 쓰고, `harness-sync.test.mjs`가 글롭 동기화 샘플로 `harness-core`·`harness-writing_style`을 써요). 집행 근거가 아니라 ◐로 셌어요.
- `scripts` 열은 전부 `scripts/harness-audit.sh`의 **파일 존재 점수**예요(`prompt_engineering`만 `harness-sync.sh:228` 짝 핸드북 주석). 현재 점수 `bash scripts/harness-audit.sh --terse` → `TOTAL: 51/70`. 존재 점수가 걸린 규칙과 점수: `agent_routing`(+1 tool_coverage) · `context_management`(+3 context_efficiency, +2 cost_efficiency) · `session_persistence`(+2 context_efficiency, +2 memory_persistence) · `code_review_policy`(+2 quality_gates) · `quality_gates`(+1) · `verification_tests_and_evals`(+2 quality_gates, +EDD 패턴 eval_coverage) · `safety_security`(+2 security_guardrails) · `agent_security`(+2) · `cost_awareness`(+3 cost_efficiency). 이 파일들을 지우거나 개명하면 점수가 내려가므로(#49·#50 AC "점수가 내려가지 않는다") 삭제 사이클은 `harness-audit.sh`를 같이 고쳐야 해요.
- `risk-assess.mjs:36`은 `.omp/rules/harness-*.md`를 docs-only(저위험) 경로 클래스로 분류해요 — 규칙 편집 커밋은 review-gate가 리뷰를 요구하지 않는다는 뜻이고, 이 감사의 커밋도 그 경로예요.

### 4.2 의미 배선 — 어느 게이트가 어느 규칙의 MUST를 집행하는가

이름 인용과 별개로, `index.ts`가 배선한 게이트(`grep -oE '"[a-z-]+\.mjs"' index.ts` 12종 + `.githooks/pre-commit`의 `commit-gates` 4종 + in-process `mermaid-check`)의 헤더 주석(`sed -n 1,12p gates/*.mjs`)과 규칙 본문을 대조한 결과예요.

| 게이트 (배선 위치) | 집행하는 규칙 절 | 성격 |
|---|---|---|
| `context-gate` + `read-tracker` + `write-tracker` (`index.ts` tool_call Edit/Write) | read-before-edit — `harness_integration_contract` §필수 게이트, `change_control:6`이 언급 | BLOCK |
| `acceptance-gate` (`.githooks/pre-commit` → `commit-gates`) | `cycle_definition` "AC는 커밋 시점에 판정 가능"(:534 메시지), `docs/rules/scope_self_detect_policy.md`(harness-* 아님) | BLOCK |
| `backpressure-gate` + trackers (`commit-gates`) | `verification_tests_and_evals` "검증 없이 완료 금지", `harness_integration_contract` §3(:95 메시지) | BLOCK |
| `review-gate` (`commit-gates`) | `adversarial_review` 불변식 3(JSON 사이드카)·override(:560), `agent_routing` 리뷰어 트리거(high/critical), `code_review_policy`는 **간접**(리뷰 존재만 검사, 심각도 정의는 안 읽음) | BLOCK |
| `archive-guard` (`commit-gates`, `.githooks/pre-push`) | `doc_standards` §Local Archives(:4 주석, pre-push:26) | BLOCK |
| `mermaid-check.ts` (in-process, 저장 시) | `doc_standards` R1 | advisory |
| `destructive-guard` (`index.ts:538`) | `safety_security:8-14` 중 `rm -rf`·`git reset --hard`·`git clean -f`·`sed -i`(force push·DB migration·prod는 패턴 없음) | advisory |
| `mcp-gate` (`index.ts:575`) | `mcp_policy` Supabase DDL MUST(서버명 무관 패턴) | advisory |
| `kickoff-detector` (`index.ts` before_agent_start) | `cycle_definition` 인테이크(:30 REMINDER) | advisory |
| `estimate.mjs` / `estimate-report.mjs` / `gh-loop-record.mjs` | `cycle_definition` "예상 레코드", `agent_routing` 등급 갱신 원자료 | 기록 |
| `breadcrumb-tracker` + `breadcrumb-surface` (`index.ts` tool_result/session_start) | `session_persistence:24-36`(수동 sum + breadcrumb 보완) | 기록 |
| `harness-version-check` (session_start) | `harness_integration_contract`(버전 드리프트·`.omp/AGENTS.md` 그림자) | advisory |

게이트가 전혀 닿지 않는 규칙(②=○): `anti_hallucination`, `assetization`, `coding_standards`, `commit_and_pr`, `design_contract`, `hook_recipes`, `information_discovery`, `learning_policy`, `prompt_engineering`(짝 핸드북 sync만), `repo_command_discovery`, `tdd_policy`(픽스처만), `documentation_policy`(픽스처만). 이 중 `harness-core`가 가리키는 `anti_hallucination`·`repo_command_discovery`는 "게이트 없는 상시 규칙"이고, 나머지는 읽혀야 작동하는 B칸 규칙이에요.

## 5. 기준 ③ 최근 발동 사례 — 명령과 흔적

### 5.1 이름 흔적 집계

`core`는 `harness-core`로, 나머지는 접두사 유무와 무관하게 토큰 단위(`(^|[^a-z_-])<name>([^a-z_]|$)`)로 세어 2026-09-26 개명 이전의 `rules/<name>.md`·`rule://<name>` 표기도 잡았어요. 열: `audit` = `docs/harness/audit.jsonl` 행 수, `sum` = `$MAIN/docs/sum/*.md` 파일 수, `reviews` = `$MAIN/docs/reviews/` 파일 수, `issues`/`cmts` = 이름이 나오는 이슈·댓글 수(이슈 82건·댓글 124건 스냅샷, `gh api … --paginate`로 받은 본문), `gitlog` = 커밋 메시지 수.

```bash
MAIN=/home/rae/projects/workspace/omp   # docs/sum·docs/reviews는 로컬 전용(gitignore) — 메인 체크아웃 사본
mkdir -p /tmp/rules-audit-29
gh api "repos/{owner}/{repo}/issues?state=all&per_page=100" --paginate \
  --jq '.[] | "### issue#\(.number) \(.title) [\(.state)] \(.created_at)\n\(.body // "")\n"' > /tmp/rules-audit-29/issues.md
gh api "repos/{owner}/{repo}/issues/comments?per_page=100" --paginate \
  --jq '.[] | "### comment \(.issue_url | sub(".*/";"#")) \(.created_at)\n\(.body // "")\n"' > /tmp/rules-audit-29/comments.md
printf '%-30s %5s %6s %7s %6s %7s %6s\n' rule audit sum reviews issues cmts gitlog
for f in .omp/rules/harness-*.md; do n=$(basename "$f" .md); s=${n#harness-}
  if [ "$s" = core ]; then p="harness-core"; else p="(^|[^a-z_-])$s([^a-z_]|$)"; fi
  a=$(grep -cE "$p" docs/harness/audit.jsonl)
  su=$(grep -lE "$p" $MAIN/docs/sum/*.md 2>/dev/null | wc -l)
  rv=$(grep -rlE "$p" $MAIN/docs/reviews 2>/dev/null | wc -l)
  is=$(awk -v p="$p" '/^### issue#/{cur=$2} $0 ~ p && cur!=""{seen[cur]=1} END{n=0; for(k in seen)n++; print n}' /tmp/rules-audit-29/issues.md)
  cm=$(awk -v p="$p" '/^### comment/{cur=$3} $0 ~ p && cur!=""{seen[cur]=1} END{n=0; for(k in seen)n++; print n}' /tmp/rules-audit-29/comments.md)
  gl=$(git log --format=%H -E --grep="$p" | wc -l)
  printf '%-30s %5s %6s %7s %6s %7s %6s\n' "$s" "$a" "$su" "$rv" "$is" "$cm" "$gl"
done
```

```text
rule                           audit    sum reviews issues    cmts gitlog
adversarial_review                 6      9       0      1       0      2
agent_routing                      0      9       3      4       1      4
agent_security                     0      0       0      0       0      1
anti_hallucination                 0      1       0      0       0      1
assetization                       0      2       0      2       0      1
change_control                     0      0       0      1       0      0
code_review_policy                 0      0       0      0       0      0
coding_standards                   0      7       0      1       0      1
commit_and_pr                      0      1       0      0       0      0
context_management                 0      0       0      0       0      0
core                               1      4       0      4       2      5
cost_awareness                     0      0       0      0       0      0
cycle_definition                   0      9       3      3       0      1
design_contract                    0      2       0      2       0      0
doc_standards                      0      5       1      3       1      1
documentation_policy               0      0       0      2       0      0
harness_integration_contract       2     15      12     10       1      3
hook_recipes                       0      0       0      0       0      0
information_discovery              0      0       0      0       0      1
learning_policy                    0      1       0      0       0      0
mcp_policy                         0      7       0      2       0      1
prompt_engineering                 0      3       0      4       2      3
quality_gates                      0      0       0      0       0      0
repo_command_discovery             0      0       0      0       0      0
safety_security                    0      0       0      0       0      0
session_persistence                0      1       0      0       0      1
tdd_policy                         0      1       0      0       0      0
verification_tests_and_evals       0      2       0      2       0      0
writing_style                      0      3       0      3       2      2
```

스냅샷 규모: `docs/sum` 45편(2026-06~10, 최근 `session_2026-10-02_ghloop-dispatch-labels-session-decision.md`), `docs/reviews` 94편(JSON 사이드카 35, 최근 `review-2026-10-03-151425.json`), `audit.jsonl` 187행(2026-06 35·07 50·08 1·09 65·10 28), 이슈 82·댓글 124.

### 5.2 집행 이벤트 흔적 (이름 없이 남는 발동)

```bash
for e in adversarial_review review_override review_remediation acceptance_wip scope_self_detect estimate_vs_actual gh_loop_dispatched gh_loop_closed thread_opened kickoff_completed policy_update; do
  echo "$e: n=$(grep -c "\"event\":\"$e\"" docs/harness/audit.jsonl) last=$(grep "\"event\":\"$e\"" docs/harness/audit.jsonl | tail -1 | grep -oE '"ts":"[^"]+"' | head -1)"; done
```

| 이벤트 | n | 최근 | 발동한 규칙 |
|---|---|---|---|
| `adversarial_review` | 5 | 2026-07-30 | adversarial_review(3-pass 라운드 기록) |
| `review_override` | 4 | 2026-09-26 | adversarial_review 블로킹 해제 경로, review-gate |
| `review_remediation` | 3 | 2026-07-30 | adversarial_review·code_review_policy |
| `acceptance_wip` | 22 | 2026-10-01 | cycle_definition(acceptance-gate WIP 레인) |
| `scope_self_detect` | 1 | 2026-07-30 | docs/rules/scope_self_detect_policy(harness-core 한 줄) |
| `estimate_vs_actual` | 16 | 2026-10-03 | cycle_definition 예상 레코드·agent_routing 등급 원자료 |
| `gh_loop_dispatched`/`gh_loop_closed` | 2/1 | 2026-10-06 | agent_routing(모델·에포트 기록) |
| `policy_update` | 1 | 2026-07-30 | adversarial_review 불변식 4 갱신(`rules/adversarial_review.md` 인용) |

로컬 상태(메인 체크아웃 `.omp/harness-state/`, 2026-10-03 갱신): `session-log.jsonl` 2,068행(breadcrumb — `session_persistence` 집행), `read-log.txt` 2,994행(context-gate), `test-history.json` 797행(backpressure — `verification_tests_and_evals` 집행). `docs/reviews` JSON 사이드카 35편은 `adversarial_review` 불변식 3의 발동 흔적이에요.

### 5.3 규칙별 인용 (최근 것 위주, 흔적이 없으면 "흔적 없음")

| 규칙 | 인용 |
|---|---|
| adversarial_review | `docs/reviews/review-2026-10-03-151425.json`(PR #81 사이드카, het fable+gpt-6-astra); `audit.jsonl` `review_override` 2026-09-26(#48 통합 머지); sum `session_2026-10-02_ghloop-dispatch-labels-session-decision.md`; 이슈 #39 |
| agent_routing | 이슈 #79 댓글(2026-10-03, estimate-report §3·추천 규칙표); 커밋 `16e5ba6`; reviews `review-2026-07-21-212301.md`; sum `session_2026-09-25_omp1830-friction-fix-pr44-2026.80.md`; 이슈 #32·#39·#41·#44 |
| agent_security | **흔적 없음**(커밋 `edb9b0a` 포팅 커밋 1건만) |
| anti_hallucination | sum `session_2026-08-26_omp1738-harness-publish-context7-vision.md`(◐); 커밋 `edb9b0a` |
| assetization | 이슈 #26·#27(ADR 규약 인라인 결정), `docs/decisions/README.md`; sum `session_2026-09-07_fable51-consumer-safe-sync-2026.75.md` |
| change_control | 이슈 #16(◐); sum·reviews·audit 없음 |
| code_review_policy | **흔적 없음**(이름 기준). 간접: review-gate 사이드카 35편이 리뷰 존재를 증명하지만 이 규칙의 심각도·80% 게이트 적용 여부는 사이드카에 안 남아요 |
| coding_standards | sum `session_2026-10-02_ghloop-dispatch-labels-session-decision.md`·`session_2026-09-26_policy-retier-cycles-3-8.md`; 이슈 #36; 커밋 `e97b8f8` |
| commit_and_pr | sum `session_2026-09-07_fable51-consumer-safe-sync-2026.75.md`(◐) |
| context_management | **흔적 없음** |
| core | 이슈 #49·#50·#52·#80, 댓글 #49·#50; 커밋 `4965c53`(2026-10-03, 언어 줄 추가)·`d0e91b7`·`57802d7`; `audit.jsonl` thread_closed(#49) |
| cost_awareness | **흔적 없음** |
| cycle_definition | `audit.jsonl` `estimate_vs_actual` 2026-10-03(#79)·`acceptance_wip` 2026-10-01; reviews `review-2026-09-23-220120.md`; sum `session_2026-09-29_issue56-closeout-ac-record-pr59.md`; 이슈 #18·#32·#39 |
| design_contract | 이슈 #37·#44; sum `session_2026-09-24_issues-38-36-37-handoff-execpath-design-contract.md`; `docs/handoff/handoff_2026-09-23_design-contract.md` |
| doc_standards | 이슈 #38·#49, 댓글 #38; sum `session_2026-09-26_policy-retier-cycles-3-8.md`; reviews `review-2026-07-08-archive-guard.md`; `.githooks/pre-push` 실행마다 |
| documentation_policy | 이슈 #16·#49 언급(◐); sum·reviews 없음 |
| harness_integration_contract | 이슈 #26·#30·#32·#36·#39·#40·#42·#43·#44·#45; reviews 12편(최근 `review-2026-09-23-213940.md`); sum 15편(최근 `session_2026-09-26_policy-retier-cycles-1-2.md`); `audit.jsonl` review_override×2 |
| hook_recipes | **흔적 없음** |
| information_discovery | **흔적 없음**(커밋 `e97b8f8` 1건) |
| learning_policy | sum `session_2026-08-26_omp1738-harness-publish-context7-vision.md`(◐) |
| mcp_policy | 이슈 #5·#21; sum `session_2026-09-07_fable51-consumer-safe-sync-2026.75.md`·`session_2026-08-26_…context7-vision.md`(Context7 폐기 결정) |
| prompt_engineering | 이슈 #23·#24·#27·#28, 댓글 #28·#9; sum `session_2026-09-24_issues-38-36-37-….md`; 커밋 `ee9ae47`·`8227dcb`·`10ba6ba` |
| quality_gates | **흔적 없음** |
| repo_command_discovery | **흔적 없음**(이름 기준; 매 작업의 명령 발견은 기록되지 않아요) |
| safety_security | **흔적 없음**(이름 기준; destructive-guard는 audit 이벤트를 남기지 않아요) |
| session_persistence | sum `session_2026-06-18_autonomy-q1-breadcrumb.md`(◐, breadcrumb 도입 세션); 커밋 `ccd72a4`; `session-log.jsonl` 2,068행(집행 흔적) |
| tdd_policy | sum `session_2026-08-26_omp1738-harness-publish-context7-vision.md`(◐) |
| verification_tests_and_evals | 이슈 #16·#41; sum `session_2026-09-26_policy-retier-cycles-1-2.md`·`-3-8.md`; `test-history.json` 797행(backpressure 집행 흔적) |
| writing_style | 이슈 #49·#80, 댓글 #31·#49; 커밋 `4965c53`(2026-10-03)·`e490688`; sum `session_2026-09-24_issues-38-36-37-….md` |

## 6. 내용 중복 분석 (병합 후보의 근거)

3개 그룹으로 나눠 규칙 본문을 전수 대조한 결과예요(읽기 전용 scout 3개, `file:line` 인용). 병합 쌍마다 "무엇이 겹치는가"와 "병합 시 잃는 고유 내용"을 적었어요 — 후속 사이클이 이 목록을 보고 옮길 절을 고르면 돼요.

### A. 검증·리뷰 계열
- **quality_gates → verification_tests_and_evals**: 발견 순서(:26-36)는 `repo_command_discovery:12-20` 재서술, EVAL 조건(:50)은 `verification:92-100` 동일 목록, fast-gate(:84-88)는 3중. 전제 훅 `quality-gate.js`(:6,:72)는 `.omp/extensions`에 없어요. 잃는 것: 6 게이트 **정규 이름**(:12-21), 트리거별 필수 게이트 표(:42-48), 억제 주석 금지 조건(:63-66) — 이 셋만 verification으로 옮기면 돼요. `checklists/quality_gate.md`가 전체를 복제하고 있어 링크 갱신 1곳.
- **tdd_policy → verification_tests_and_evals**: RED/GREEN/TIDY 본문(:12-30)은 `.omp/skills/startdev/references/tdd_rules.md:3-75`가 상세판, 예외 절차(:72-77)는 `change_control:43-46`·`verification:24-27`과 3중, "무관한 변경 금지"(:17-30)는 `harness-core:12`. 잃는 것: 커버리지 80–100% 목표(:33-36), e2e 체크리스트 포맷(:40-70 — 리포 전체에 `e2e_*.md` 0건이라 실사용 없음).
- **code_review_policy(유지, 조건부)**: 80% 확신 게이트·머지 기준·출력 표·silent-failure 표는 이 규칙에만 있고 `.omp/agents/code-reviewer.md`·`reviewer.md`는 절차만 담아요. 다만 임계값 50/800/4가 `coding_standards:50-72`·`checklists/code_review.md:62-66`과 3중이고, 심각도 라벨이 `adversarial_review:67-73`(3단계, HIGH 비블로킹)과 **다르게 정의**돼 있어요. 제안: 임계값 SSOT를 `coding_standards`로 두고 여기선 참조만.

### B. 운영·프로세스 계열
- **cost_awareness → agent_routing**: Haiku/Sonnet/Opus 고정 표(:12-16)가 `agent_routing:41-43`의 롤 체계(`modelRoles.slow/advisor`, `smol/default/slow/plan`)와 같은 개념을 벤더명으로 이중 정의하고, `agent_routing:43`이 "기준은 estimate-report 실측으로 갱신"이라 정적 표를 대체해요. 재독 회피(:30-33)는 context-gate/read-tracker가 기계 집행. 잃는 것: eval 리포트에 모델·토큰·비용 기재(:20-23), 병렬 호출 SHOULD(:25-28 — 시스템 프롬프트 Tool Policy가 이미 요구). `~/.omp/metrics/costs.jsonl`(:6-8)은 생성 코드 없음.
- **information_discovery → anti_hallucination**: :5가 스스로 `repo_command_discovery`의 twin이라 선언, :26 "무엇을 검색했는지 말하라"는 `anti_hallucination:36-38` Exception Protocol, :9-11 "false negative = fabrication"은 `anti_hallucination:6-14`. `harness-core:9` 후반("없다는 결론은 넓게 검색한 뒤에만")이 요지. 잃는 것: 알려진 경로 vs 클래스 판별(:13-18), 3단 스윕 순서(:23-25). stale: `Explore` 에이전트(:30, 현 `scout`), `claudedocs/` 규약 디렉터리(:24).
- **session_persistence → context_management**: :6,:10,:77 세 번 "context_management가 WHEN/WHAT, 이 파일이 HOW/WHERE"라 자기 정의 — 한 파일이 자연스러워요. Self-Check(:85-89) ↔ `context_management:117-124`. 잃는 것: ad-hoc 세션 상태 파일 금지(:16), 수동 sum 결정 + breadcrumb 보완(:24-36 — `docs/architecture/harness-architecture.md:288,295`가 링크하므로 갱신 필요), session_start 로딩(:42-46). stale: `.omp/contexts/{dev,review,research}.md` 전부 부재(:52-70). 모체 `context_management`도 `~/.claude/scripts` 절(:90-114)이 Context7 폐기 이후 낡았고 :103 주석이 스스로 무효화해요.
- **learning_policy → assetization**: 캡처 트리거(:12-17) ↔ `assetization:48-53` retro 트리거, "Duplicate: link instead"(:38) ↔ `documentation_policy:35`. 잃는 것: 좋은 학습 4기준(:19-24), Vague/Unverified/Duplicate 금지(:36-38). stale: 저장 티어 `MEMORY.md`(:31) 부재 — `session_persistence:20`은 같은 역할을 auto-memory로 지정해 서로 모순.
- **commit_and_pr(사 후보)**: 작은 커밋(:6-9) ↔ `compush`/`compr` SKILL §4, 검증 명시(:11-14) ↔ `harness-core:7`·`checklists/pr.md:3`, PR 본문 필수항목(:16-23) ↔ `checklists/pr.md:2-6`·`compr` §5·`templates/pr_body.md` — 규칙·체크리스트·스킬이 **서로 다른** PR 본문 템플릿 3종을 제시해요. 고유한 것은 "태그/스탬프 브랜치는 머지 커밋(squash 금지)" MUST(:25-27) 한 절뿐이고, 이 절은 `compr` SKILL 또는 ADR 001로 옮기면 돼요.

### C. 문서·보안·인프라 계열
- **documentation_policy → writing_style**: 제목부터 "Optional Module", "if adopted"(:16,:33) 2회 — 채택 여부가 미정인데 `writing_style:51`은 이를 MUST로 인용해요. 이모지 금지(:16-18) ↔ `writing_style:51-52`, 코드 주석 영어(:14) ↔ `harness-core:5`, README vs INDEX(:20-23) ↔ `AGENTS.md:7-11`. 잃는 것: 한/영 독자 분리 SHOULD(:12-13), UTF-8 NO-BOM(:26), latest-only 옵션(:33-37). `.ps1` BOM 예외(:27)는 리포에 `.ps1` 0개.
- **hook_recipes → harness_integration_contract**: 이벤트 4종 표(:17-24)·페이로드(:28-36)·fail-open(:129)은 `index.ts:5-22,389-392,569,579`와 일치하는 OMP 시대 내용이지만, 레시피 5종(:42-121 — 800줄 차단·TODO 경고·테스트 리마인더·자동 포맷·tmux 차단)은 `gates/` 22개 파일 어느 것과도 대응하지 않아요. runGate 스폰 패턴(:137-139)은 `harness_integration_contract:9`와 동일. 잃는 것: 이벤트별 차단 가능 여부 표, 페이로드 스키마 — contract의 Gate Location 절 옆에 붙이면 돼요.
- **agent_security(사 후보)**: 외부 링크 감사·숨은 문자 탐지·MCP 공급망 MUST 3개(:14-49)는 다른 규칙에 없는 고유 내용이고 `prompt_engineering:172-174`가 관할을 위임해요 — 내용은 살아 있으나 세 기준 모두 흔적이 없어요. 삭제하면 `harness-audit.sh:293` −2점. 대안: `safety_security`와 한 편으로(단 "운영 안전 vs 적대 위협" 관할 분리(:6)가 사라져요). stale: `.omp/notepads/`(:86)·`MEMORY.md`·`~/.claude/projects/*/memory/`(:84)·`context7` 예시(:45).
- **mcp_policy(유지, 조건부)**: Supabase MUST·웹 검색·Search vs LSP 판단표(:66-98)는 AGENTS.md 한 줄로 대체되지 않지만, :8이 스스로 "LSP 레이어 A/B·`mcp__plugin_oh-my-claudecode_t__lsp_*` 도구명은 Claude Code 시절 표기"라 선언한 절(:25-74 약 60줄)과 Context7/Serena 폐기 이력(:100-135 약 35줄)이 본문 절반이에요. `bootstrap` SKILL이 등록하는 서버(exa·browser-tools·supabase·react-design-systems·pixelmaker)와 정책의 서버 목록이 어긋나요(Stitch :192-198·고정 IP :189는 정책에만, pixelmaker는 bootstrap에만).

## 7. 삭제·병합 제안 목록 (후속 사이클용 — 이 사이클에서는 실행하지 않아요)

### 7.1 병합 제안 (8편 → 모체 6편)

| # | 흡수되는 규칙 | 모체 | 옮길 절 | 링크 갱신 대상 |
|---|---|---|---|---|
| M1 | `harness-cost_awareness` | `harness-agent_routing` | eval 리포트 비용 기재(:20-23) 한 줄 | `scripts/harness-audit.sh:321-324`(cost_efficiency +3 재배치), AGENTS.md Linked Modules |
| M2 | `harness-information_discovery` | `harness-anti_hallucination` | 경로 vs 클래스 판별(:13-18), 3단 스윕(:23-25) | AGENTS.md Linked Modules·Core rails 목록 |
| M3 | `harness-session_persistence` | `harness-context_management` | :16, :19, :24-36, :42-46 | `docs/architecture/harness-architecture.md:288,295`, `harness-cycle_definition.md:189`, `harness-audit.sh:168-171,222-225`(+4 재배치); 이 파일의 outbound 링크(:78 learning_policy, :79 hook_recipes)는 모체로 옮겨요 |
| M4 | `harness-learning_policy` | `harness-assetization` | 좋은 학습 4기준(:19-24), 금지 3종(:36-38) | `templates/retro.md`, `harness-session_persistence.md:78` |
| M5 | `harness-quality_gates` | `harness-verification_tests_and_evals` | 6 게이트 정규 이름(:12-21), 트리거 표(:42-48), 억제 금지(:63-66) | `checklists/quality_gate.md`, `harness-adversarial_review.md`, `harness-audit.sh:207-210`(+1 재배치) |
| M6 | `harness-tdd_policy` | `harness-verification_tests_and_evals` | 커버리지 목표(:33-36); e2e 포맷은 실사용 0건이라 폐기 가능 | AGENTS.md Core Principles 4 "→ Detail", `risk-assess.test.mjs` 픽스처 경로 |
| M7 | `harness-documentation_policy` | `harness-writing_style` | 한/영 독자 분리(:12-13), UTF-8 NO-BOM(:26), latest-only(:33-37) | `harness-writing_style.md:9,51,97`, `risk-assess.test.mjs` 픽스처 |
| M8 | `harness-hook_recipes` | `harness-harness_integration_contract` | 이벤트 차단 가능 표(:17-24), 페이로드 스키마(:28-36), fail-open(:129); 레시피 5종은 폐기 | `harness-session_persistence.md:79`, AGENTS.md Tool rails |

### 7.2 폐기 제안 (2편)

| # | 규칙 | 근거 | 보존할 절 | 부작용 |
|---|---|---|---|---|
| D1 | `harness-commit_and_pr` | 세 기준 모두 ◐ 이하; `compr`/`compush` SKILL·`checklists/pr.md`·`harness-core:7`이 내용을 덮음 | "태그/스탬프 브랜치는 머지 커밋" MUST(:25-27) → `compr` SKILL 또는 ADR 001 | `harness-writing_style.md:95-98` Related 링크 1곳 |
| D2 | `harness-agent_security` | 참조 ◐(prompt_engineering 관할 위임뿐)·배선 ◐(존재 점수)·흔적 ○ | MUST 3개(:14-49)와 OWASP 표(:94-104)는 고유 — 폐기 대신 `safety_security`와 병합(관할 분리 포기)도 선택지 | `harness-audit.sh:293-296` −2점, `harness-prompt_engineering.md:172-174` 링크, `harness-safety_security.md:6` 주석 |

### 7.3 실행 시 공통 체크

1. `scripts/harness-audit.sh`의 존재 점수(§4.1)를 모체 파일로 옮겨 `TOTAL: 51/70`이 내려가지 않게 해요(#49·#50 AC 선례).
2. `scripts/harness-sync.sh:184`의 글롭 `.omp/rules/harness-*.md`는 그대로 두면 돼요 — 소비 리포는 다음 sync에서 사라진 파일이 자동 제거돼요(기존 `harness-*` 삭제 후 복사, ADR 002 부속 결정 1). 소비 리포 문서가 지운 규칙을 링크했을 수 있으므로 `migrate` 안내에 개명 표를 한 줄 추가해요.
3. AGENTS.md "Linked Modules"와 각 모체의 Related 절, `claudedocs/CLAUDEKR.md` 미러를 같은 PR에서 갱신하고 `node scripts/docs-drift`로 링크를 확인해요.
4. 규칙집 노출(매 프롬프트 이름+설명 한 줄, 평균 114 B/행 상한 — ADR 002 Amendment)은 10편이 줄면 약 1.1 KB/요청이 줄어요.

## 8. 부수 관찰 (비범위 — 규칙 내용 개정은 이 이슈 밖이라 기록만 해요)

- **CRLF 15편**(`file .omp/rules/harness-*.md`): agent_security, anti_hallucination, code_review_policy, coding_standards, commit_and_pr, context_management, cost_awareness, documentation_policy, learning_policy, mcp_policy, quality_gates, repo_command_discovery, safety_security, session_persistence, tdd_policy. 포팅 때 들어온 줄끝이라 병합 사이클에서 LF로 통일하면 돼요.
- **레거시 경로 참조**(`grep -rnoE '(rules/|rule://)(<28 names>)\.?m?d?'`): `docs/decisions/002-policy-layer-retiering.md:44`(`rule://writing_style` — 역사 서술), `docs/harness/review-remediation.md:4`(`rules/doc_standards.md`), `docs/handoff/*`·`docs/harness/archive/*/seed.yaml`(보관 문서), `.omp/extensions/harness/tests/risk-assess.test.mjs:63`(`rules/tdd_policy.MD` 픽스처). 규칙 본문 안의 레거시 이름: `harness-tdd_policy.md:35`(`repo_command_discovery`), `harness-mcp_policy.md:104,114`(`rules/context7_policy.md` — git history 참조로 명시).
- **stale 절(유지 규칙 안)**: `verification_tests_and_evals:8-15` "Global enforcement(oh-my-claudecode)… acceptance-gate: Blocks completion claims" — 실제 게이트는 커밋을 막아요(`acceptance-gate.mjs:3`); `harness_integration_contract:27,122-124,151` "Architect verification(oh-my-claudecode)"와 `docs/harness/completion-attack-report.md`(부재); `adversarial_review:135-142` 롤아웃 Phase 1/2(이미 운영 중), :49-51 critic/architect/security-reviewer/test-engineer(`.omp/agents/`에는 adversary/code-reviewer/reviewer/verifier만); `code_review_policy:6` "code-reviewer agent enforces this automatically"(에이전트는 이 규칙을 링크하지 않음); `context_management:90-114` `~/.claude/scripts` 절; `mcp_policy` §6 C 참조.
- **AGENTS.md 본문이 가리키지 않는 규칙 19편**(§3 `body=0`): 색인 한 줄과 규칙집 노출로만 존재해요. ADR 002 트레이드오프 "규칙집은 존재를 알리는 층이지 본문을 강제하는 층이 아니다"가 그대로 적용돼요 — 이번 판정의 ③ ○ 9편 가운데 `repo_command_discovery`를 뺀 8편이 이 집합에 들어요.

## 9. 재현

리포 루트에서 §3·§4.1·§5.1·§5.2의 코드 블록을 그대로 실행하면 돼요. `MAIN`은 `docs/sum`·`docs/reviews`를 가진 체크아웃 경로이고(없으면 그 두 열은 0), 이슈·댓글은 실행 시점 스냅샷이라 이 PR 이후 댓글이 늘면 `issues`/`cmts` 열이 커져요. 규칙 파일 무변경 확인: `git diff --stat main -- .omp/rules` 가 비어 있어요.
