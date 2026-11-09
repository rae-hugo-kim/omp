# oh-my-pi 업스트림 이슈 트래킹

**Repo**: can1357/oh-my-pi | **작성**: 2026-07-18 | **갱신**: 2026-10-01 | **작성 계정**: rae-hugo-kim

> 데이터 출처: `gh api`(2026-07-18 실측, 2026-08-03·08-05·08-07·08-12·08-14·09-23·10-01 재실측), `docs/sum/` 세션 기록, 초안 트래커(2026-07-27~28, 게시 완료 후 폐기). 총 9건(closed 6 / open 3)이에요. 2026-10-01 재실측 기준으로, 09-26에 새로 게시한 #13403(Codex 이미지 모델 표시 오류)은 다음 날 수정 PR이 머지돼 v18.4.0에 포함됐어요. #6869에는 같은 날(09-26) v18.3.0 실측과 좁힌 규칙을 담은 저자 후속 코멘트를 올렸지만, open 3건은 여전히 maintainer 발화와 `accepted` 라벨이 0건이에요. 릴리즈 노트 v18.3.0~v18.4.6(2026-09-24~10-01, 13개)을 전수 스캔했는데 세 제안이 직접 랜딩한 변경은 없었고, 같은 서브시스템의 인접 변화는 [인접 동향](#인접-동향-2026-10-01) 절에 정리했어요. 로컬 설치는 `omp/18.4.4`예요.

## 요약 표

| # | 제목 | 게시일 | 상태 | 해결 PR | 비고 |
|---|---|---|---|---|---|
| [#2290](https://github.com/can1357/oh-my-pi/issues/2290) | feat(retry): auto model fallback on Anthropic classifier refusals | 2026-06-11 | closed (completed) | [#2294](https://github.com/can1357/oh-my-pi/pull/2294) merged (`0fa27b2af`) | 현행 v17.0.4에 포함 확인 |
| [#5691](https://github.com/can1357/oh-my-pi/issues/5691) | `in use by this session` marker shows email only | 2026-07-16 | closed (completed) | [#5692](https://github.com/can1357/oh-my-pi/pull/5692) merged (`009dd9948`) | v17.0.2에 포함 확인 |
| [#5701](https://github.com/can1357/oh-my-pi/issues/5701) | TUI usage panel: account labels hard-capped at 24 cols | 2026-07-16 | closed (completed) | [#5703](https://github.com/can1357/oh-my-pi/pull/5703) merged (`99f2ffa03`) | v17.0.2에 포함 확인. #5691의 후속 |
| [#5960](https://github.com/can1357/oh-my-pi/issues/5960) | Clockless 0%-used window receives a scale-incompatible drain score | 2026-07-18 | closed (completed) | [#5961](https://github.com/can1357/oh-my-pi/pull/5961) merged (2026-07-18T19:06Z) | 우리 제안 그대로 반영. 이슈 동시 close |
| [#5966](https://github.com/can1357/oh-my-pi/issues/5966) | Session credential stickiness has no idle gating | 2026-07-18 | closed (completed) | [#5967](https://github.com/can1357/oh-my-pi/pull/5967) merged (2026-07-18T19:06Z) | 제안 3항목 전부 채택 + 리뷰 코멘트 반영(`2625b92`) |
| [#6869](https://github.com/can1357/oh-my-pi/issues/6869) | feat(auth): explicit paid extra-usage branch + per-account extra allowlist | 2026-07-28 | **open** | — | `proposal` 라벨 — maintainer 설계 승인 대기. 시퀀싱 전제(#6392 계열 머지)는 #7539 머지로 충족. 10-01: 저자 후속 코멘트(09-26, v18.3.0 실측 + `auth.accountPolicies` 기반 `extra: allow` 규칙) 게시, 제3자 +1 반응 1건, maintainer·봇 응답 없음 |
| [#6870](https://github.com/can1357/oh-my-pi/issues/6870) | feat(tui): /auth credential inventory — cross-provider parity | 2026-07-28 | **open** | — | 트리아지 통과(실현성 인정). 제3자+봇 스코프 정교화 코멘트(2026-08-07), maintainer 응답 대기. 10-01: 변동 없음, 인접 #13476(v18.4.1)·#13190(v18.3.1)이 부분 표면을 넓힘 |
| [#6898](https://github.com/can1357/oh-my-pi/issues/6898) | feat(auth): pre-dispatch notice for extra-usage billing | 2026-07-28 | **open** | — | #6869 §5의 분리분. 트리아지 통과 — 4개 결정점 응답·`accepted` 라벨 대기. 10-01: 변동 없음(#6869 코멘트발 cross-reference 1건뿐), 인접 #13340(v18.3.2)이 응답 헤더 기반 "limit reached → extra usage" 알림 랜딩 |
| [#13403](https://github.com/can1357/oh-my-pi/issues/13403) | generate_image (openai-codex): reports gpt-image-1, but the ChatGPT backend runs gpt-image-2-codex and overrides model/size/quality | 2026-09-26 | closed (completed) | [#13404](https://github.com/can1357/oh-my-pi/pull/13404) merged (`dd7f83e49`) | v18.4.0에 포함 확인. v18.4.3에서 카탈로그 id도 `openai-codex/gpt-image-2`로 개명 |

공통 트리아지: bug 6건(#2290·#13403 포함)은 모두 `prio:p2`와 `triaged`를 받은 뒤 해결 PR 머지로 완결됐어요. 이 6건의 provider 라벨은 5건이 `provider:anthropic`, #13403이 `provider:openai-codex`예요. feat 3건(2026-07-28 게시)은 모두 `@roboomp` 자동 트리아지를 통과(`triaged`)했지만 사람 maintainer의 반응은 아직 없어요. 게시 후 약 9주(10-01 기준)가 지났고, 세 건 모두 maintainer 발화는 0건이에요.

## 인접 동향 (2026-10-01)

우리 이슈에 직접 랜딩한 변경은 아직 없어요. 같은 서브시스템(usage-aware fallback · 크리덴셜 랭킹·핀 · `/usage`·인증 표면)에서는 변화가 이어져서, 09-23에 등재한 4건 중 변동이 있는 3건에는 10-01 메모를 덧붙였고 새로 확인한 항목 6행을 추가했어요. 후속 코멘트나 재제안을 쓸 때 기판으로 참조해요.

| # | 유형 | 상태 | 관련 우리 이슈 | 요지 |
|---|---|---|---|---|
| [#8794](https://github.com/can1357/oh-my-pi/issues/8794) | issue (shawnkoh, 08-17) | open, `triaged` | #6869 | 세션·서브에이전트 스코프 reserve 오버라이드(`inherit \| protect \| spend-reserve`) 제안. 본문에서 #6869를 "paid extra-usage routing after depletion — related but not duplicate"로 명시 구분. `@roboomp` 트리아지(08-19): `spend`=`usageAwareFallback=false` 매핑은 health-release·sibling reselection까지 꺼버려 과도 — `usageReservePolicy` 신규 값 또는 별도 `retry.reserveOverride` 권고. maintainer 응답 없음. 우리 #6869 ①(depletion 2택)과 결합 시 "reserve 소비 허용" 축과 "extra 유료 허용" 축이 분리된 두 정책 축으로 정리됨 [평가]. 10-01: 트리아지 권고대로 `retry.usageReservePolicy: spend`를 추가하는 [#13921](https://github.com/can1357/oh-my-pi/pull/13921)(schickling-assistant, 09-30, open, `review:p2`)이 올라옴. `@roboomp` 리뷰는 "relates to #8794 but doesn't close it", 새 공개 값이라 maintainer sign-off 필요로 판정했고 blocking 회귀 1건은 저자가 `c0fc4822a`로 수정. "reserve 소비 허용" 축은 구현 후보가 생겼고 "extra 유료 허용" 축(#6869)은 여전히 별개 [평가] |
| [#8858](https://github.com/can1357/oh-my-pi/issues/8858) → [#12904](https://github.com/can1357/oh-my-pi/pull/12904) | issue(08-17) → PR merged(**v18.2.11**, 09-23) | #8858 open 유지 / PR 머지 | #6898 | `retry_fallback_applied`에 `reason` 추가 — quota/reserve preflight 결정을 health 스냅샷으로 설명, TUI 경고 아래 표시, RPC/extension에 additive 전파. **#6898과의 경계**: 이 변경은 "모델을 **바꿨을 때** 왜 바꿨나"를 설명하고, #6898은 "모델을 **안 바꾸고** 유료로 계속 갈 때" 사전 경고 — 상보적이며 #6898 미해소. 다만 preflight health 스냅샷을 사용자 표면으로 끌어올리는 배관이 생겨 #6898 결정점 ①(transient vs inline)의 구현 비용이 내려감 [평가]. 10-01: #8858 open 유지(`updated_at` 09-22 고정). 파생 이슈 [#13240](https://github.com/can1357/oh-my-pi/issues/13240)(usage-preflight 폴백이 사유 없이 세션에 영속)·[#13106](https://github.com/can1357/oh-my-pi/issues/13106)(비용 인지 폴백·복귀)이 cross-reference |
| [#8919](https://github.com/can1357/oh-my-pi/pull/8919) | PR (sethmorton, 08-18) | open, 리뷰 없음, main과 충돌(`dirty`) | **#5960/#5961** | `#computeWindowRequiredDrain`의 클록리스 폴백을 **#5961과 반대 방향**으로 조정: Anthropic 주간 윈도우가 `usedFraction === 0` + `resetsAt` 부재일 때 required-drain을 무한대(최우선 소진)로. 동기: "유휴 유료 시트를 놔두고 활성 시트가 extra usage로 넘침". 08-23 `2ad2b72`에서 Anthropic secondary 윈도우·0% 한정으로 스코프 축소, 50% 사용 클록리스 vs 12h 남은 클록 윈도우 회귀 테스트 추가. maintainer 리뷰 0건. **우리 #5960의 문제 제기(스케일 비호환)는 유지되나 정책 결론(유휴 org 후순위)이 뒤집힐 수 있음** — 머지 시 "개인 우선" 핀 운용에 영향. 추적 필요. 10-01: head `2ad2b72`·maintainer 리뷰 0건 그대로이고 `mergeable_state: dirty`. 09-24~09-28 제3자 포크 커밋 참조 6건 외 활동 없음 |
| [#8774](https://github.com/can1357/oh-my-pi/pull/8774) | PR (roboomp) merged **v17.3.8** | closed | #6869 §1 | `retry.usageReservePct`가 Fable/Mythos 주간 tier 행을 무시해 100%까지 서빙하던 버그 수정 — reserve health가 매핑된 tier 행을 반영. #6869의 "confirmed depletion" 판정이 tier-scoped 모델에서도 성립하는 기판 |
| [#12243](https://github.com/can1357/oh-my-pi/pull/12243) | PR (schickling-assistant) merged **v18.3.0** | closed (can1357 머지, 09-23) | #6869 §2 | `auth.accountPolicies` — 계정 셀렉터(email·orgId 매칭)마다 `priority`·`reservePct`를 붙이는 정책을 직접 세션·broker·자동 재선택·`omp usage` 진단에 공통 적용(Closes #11085). #6869 §2(계정별 ordered allowlist)의 설정 거처가 생겼고, 09-26 저자 코멘트가 여기에 opt-in `extra: allow` 필드를 제안. 한계: `accountPriority` 비교(`rank.ts:117`)가 차단 분기(`:89-95`) 뒤에 있어 included 소진으로 차단된 계정 사이의 순서를 정하지 못함 — 09-26 실측에서 `priority: 10` 무효. 후속 [#13177](https://github.com/can1357/oh-my-pi/pull/13177)(open, `review:p1`)이 `omp usage --json`에 정책 상태 노출 |
| [#13889](https://github.com/can1357/oh-my-pi/issues/13889) → [#13894](https://github.com/can1357/oh-my-pi/pull/13894) / [#13901](https://github.com/can1357/oh-my-pi/issues/13901) | issue (BayLee4, 09-30, `prio:p1`) → PR merged **v18.4.5** / 후속 feat issue | #13889 closed / #13894 머지 / #13901 open, `triaged` | #6869 ①②, #6898 | Codex 다계정에서 plan 소진 계정이 크레딧(유료)으로 계속 서빙되던 버그. #13894가 `rank.ts` 비교기에 `allowanceSpent` 축(`:101`)을 넣어 무료 잔여 계정을 먼저, 유료 overage를 최후로 돌리고 자동 핀도 이탈시킴(명시 핀은 유지). #6869 09-26 제안 규칙의 전반부("included 있는 계정 뒤로")가 provider 공통 비교기로 실코드화된 선례 — 단 Anthropic은 tier 소진 시 hard-block이 먼저 걸려 차단 분기(`:89-95`)가 반환하므로 적용되지 않음 [평가]. 봇이 분리한 잔여 2건(리셋 우선 소비 정책, 크레딧 사용 가시 표시)은 #13901 "No silent credits usage, and choice over autoRedeem"으로 재제기 — Codex판 #6898 + #6869 ①. #13889 스레드 봇 코멘트: "the risk is silent paid-credit use, including with default settings" |
| [#13340](https://github.com/can1357/oh-my-pi/pull/13340) | PR (H4vC) merged **v18.3.2** | closed (09-25) | #6898 | Anthropic usage-limit wrap-up allowance 추적. 5h/주간 한도 도달 후 응답 헤더(`anthropic-ratelimit-unified-grace-*`)가 오면 세션 notice 1회("Claude usage limit reached … a short wrap-up allowance runs first, then extra usage.")와 상태줄 `limit reached · wrap-up, then extra usage`를 표시. #6898의 동기(무신호 유료 전환)에 가장 근접한 랜딩. 경계: grace 헤더가 실린 응답을 받은 뒤에만 발화(`#observeWrapUp`) — fresh usage report로 소진을 판정해 첫 유료 요청 전에 경고하는 #6898의 pre-dispatch 계약과 다르고, grace 허용분 없이 소진되는 경로(예: tier 한정 소진)의 침묵 여부는 미검증. PR 본문도 "Not verified against a live account at its limit" [평가] |
| [#13528](https://github.com/can1357/oh-my-pi/pull/13528) | PR (kid0114, 09-27) | open, `review:p2` | #6869 | strict per-session OAuth 핀(`/account`, `auth.defaultAccounts`). strict 핀은 후보를 고정 크리덴셜로 제한하고, 사용량 한도·차단 시 형제 계정 폴백 대신 요청을 멈춤(`switched: false`). 09-26 코멘트가 지적한 "명시 핀이 차단 앞에서 무력"과 같은 표면이지만, 해법이 "멈춤"이라 extra 유료 계속(#6869 ①)과는 다름 [평가] |
| [#11717](https://github.com/can1357/oh-my-pi/pull/11717) | PR (JoshKirk800, 09-11) | open, `review:p2` | #6869, #6870 | `auth.startupOAuthAccount`(새 세션의 시작 계정 지정) + `omp auth accounts\|pin\|unpin` + `/switchaccount`. 09-23 josh-rosewood 코멘트가 #12243과의 겹침을 두고 can1357에게 병합 형태를 물었으나 응답 없음. 본문상 차단·rate-limit된 핀 계정은 여전히 형제 계정으로 넘어감 — 09-26 실측의 "차단 계정 핀 무효"는 범위 밖. `omp auth accounts`는 #6870 인벤토리와 표면이 겹침 [평가] |
| [#13476](https://github.com/can1357/oh-my-pi/pull/13476) · [#13190](https://github.com/can1357/oh-my-pi/pull/13190) · [#13923](https://github.com/can1357/oh-my-pi/pull/13923) | PR 3건 | #13476 merged v18.4.1 / #13190 merged v18.3.1 / #13923 open, `review:p2` | #6870 | 인벤토리 인접 표면. #13476: 인터랙티브 `/usage` 대시보드가 usage 조회에 실패한 계정을 숨기지 않고 "usage unavailable"로 유지. #13190: 자동 크리덴셜 disable을 warning 로그와 세션 notice(JSON/RPC는 `notice` 이벤트)로 알리고 `CredentialDisabledEvent`에 계정 식별자 추가. #13923: `omp logout [provider] [account]`로 활성·disabled 크리덴셜을 계정 단위로 삭제(기본 No 확인). `/usage` 공백은 좁아졌고 봇이 권고한 "삭제는 별도 명시 확인 명령" 분리가 CLI에서 진행 중이나, 전 프로바이더·전 크리덴셜 타입 읽기 전용 인벤토리와 backoff 상태 표시는 여전히 부재 [평가] |

참고(주변): [#11208](https://github.com/can1357/oh-my-pi/pull/11208) `/usage` 계정 카드·프라이버시 토글은 여전히 open(`review:p2`)이고, 09-23 이후로는 Codex 리뷰 봇의 한도 초과 코멘트만 쌓였어요. #6870의 인벤토리 뷰와 표면이 겹치지만 usage report가 있는 계정만 다루는 점은 그대로예요. [#12903](https://github.com/can1357/oh-my-pi/pull/12903)(v18.2.11)의 라벨 middle-elide는 #5701의 org 접미사 보존 계약을 재확인한 변경이에요. [#13157](https://github.com/can1357/oh-my-pi/pull/13157)(v18.3.1)은 classifier refusal 뒤 폴백 요청이 Anthropic fallback credit으로 프롬프트 캐시를 재사용하게 했고, #2290을 cross-reference했어요. [#13348](https://github.com/can1357/oh-my-pi/issues/13348)(open, `prio:p2`)이 보고한 "Claude unscoped 차단이 7d 조기 리셋 뒤에도 남는" 문제는 can1357 직접 커밋 `bde8fdd4c`(v18.4.0)로 해소됐다며 수정 PR #13427이 닫혔지만, 이슈 자체는 open이에요. [#13278](https://github.com/can1357/oh-my-pi/pull/13278)(open)은 OAuth 계정을 고를 때마다 `auth.oauth_credential_selected` 구조화 로그를 남기자는 제안이라 #6898 결정점 ④(headless 구조화 이벤트 계약)와 맞닿아 있어요 [평가].

## 이슈별 상세

### #2290 — refusal 시 자동 모델 폴백 부재 (closed)

- **문제**: `claude-fable-5`에서 Anthropic 안전 분류기 거부(`stop_reason: "refusal"`, HTTP 200)가 일반 종단 에러로 처리됨. `#isRetryableError`의 transient 정규식에 "Refusal"이 불일치 → 기존 폴백 기구(`retry.fallbackChains`)에 도달 불가 → 동일 컨텍스트 재전송은 결정적 재거부라 세션이 refusal 루프에 갇힘.
- **우리 제안**: refusal을 model-switch-eligible 조건으로 분류하고 기존 `retry.fallbackChains` 재사용 (새 기구 발명 대신 분류만 수정). 동일 모델 재시도는 명시적 반대. 3단계 제안: 구조적 분류 → 클라이언트 폴백 → 서버 측 폴백 옵션 (docs/sum 2026-06-11 세션 기록).
- **업스트림 대응**: `bug, prio:p2` 트리아지 + 재현 확인. PR #2294 "fix(retry): fall back on Anthropic refusals" — 이슈 게시 후 당일 머지(2026-06-11T13:51Z, 머지 커밋 `0fa27b2af`), 이슈 동시 close(completed). docs/sum에 따르면 수정 PR은 게시 12분 만에 생성.
- **현재 상태 / 후속**: 완결. 현행 릴리스 v17.0.4에 포함 확인(`compare v17.0.4...0fa27b2af` = behind). 이후 타 사용자 이슈 #2750, #4210(open), #5881이 본 이슈를 cross-reference — 우리 측 후속 조치 불필요.

### #5691 — 세션 마커가 이메일만 표시, 동일 이메일 다중 org 구분 불가 (closed)

- **문제**: 동일 로그인 이메일로 두 Anthropic org(팀 시트 + 개인 Max)를 쓰는 구성에서 `/usage show`의 `in use by this session:` 마커가 이메일만 표시 → 이 세션이 어느 org 쿼터를 소비 중인지 판별 불가.
- **우리 제안**: 다른 표면(로그인 성공 메시지, `omp usage` 계정 목록)과 일관되게 org-qualified 표기(`<email> · <OrgName>`). 감사 범위를 3개 표면으로 명시(2개는 정상, 마커만 누락).
- **업스트림 대응**: PR #5692 "fix(usage): org-qualified session marker for same-email accounts" 머지(2026-07-17T03:52Z, `009dd9948`), 이슈 close(completed). v17.0.2(2026-07-17 발행)에 포함 확인.
- **현재 상태 / 후속**: 완결. **docs/sum에 세션 기록 없음** (아래 교차 검증 참조).

### #5701 — TUI usage 패널 라벨 24열 하드캡, org 접미사 절단 (closed)

- **문제**: #5691로 org 라벨이 생겼으나 TUI usage 패널이 이를 다시 절단. `resolveColumnWidth`가 터미널 폭과 무관하게 `BAR_WIDTH_MAX = 24`로 클램프하고, `truncateJobLabel`이 꼬리부터 자르므로 동일 이메일 계정의 유일한 구분자인 ` (OrgName)` 접미사가 정확히 잘려나감 (`command-controller.ts` 라인 실측 포함해 게시).
- **우리 제안**: ① 터미널 여유 시 24열 캡 해제(바 폭과 라벨 폭 분리) 또는 ② org-보존 절단(이메일 로컬파트 압축, `rae@e… (Team Org)`).
- **업스트림 대응**: PR #5703 "fix(tui): preserve organization suffixes in usage panel" 머지(2026-07-17T03:52Z, `99f2ffa03`), 이슈 close(completed). v17.0.2에 포함 확인.
- **현재 상태 / 후속**: 완결. **docs/sum에 세션 기록 없음**.

### #5960 — 클록리스 0% 윈도우에 스케일 비호환 drain 점수 (closed)

- **문제**: `#computeWindowRequiredDrain`(auth-storage.ts)이 리셋 클록 존재 시 `headroom / remainingHours`를 반환하지만 `resetAt` 미정의 시 **생(bare) `headroom`(0..1)으로 폴백** — 단위가 다른 값이 그대로 비교됨. 주간 윈도우가 막 리셋된 유휴 org가 점수 ≈ 1.0으로 클록 있는 바쁜 org(~22h 후 리셋, 먼저 소진해야 할 쪽)를 제침. `usage_history` 실측 타임라인 첨부해 게시.
- **우리 제안**: 클록리스 윈도우에 전체 duration 잔여를 가정해 점수 스케일 호환 유지.
- **업스트림 대응**: 게시 40분 만에 `bug, prio:p2, triaged` (docs/sum 2026-07-18 세션 기록). PR #5961 "fix(ai): normalize clockless usage drain ranking" — 우리 제안 그대로 반영, **머지 완료**(2026-07-18T19:06Z), 이슈 동시 close(completed).
- **현재 상태 / 후속**: 완결 (2026-08-03 재실측: 이슈 closed·PR merged). 잔여(선택): 포함 릴리스에서 리셋 직후 유휴 org 오착륙 소멸 로컬 확인.

### #5966 — 세션 크레덴셜 핀에 idle 게이팅 부재 (closed)

- **문제**: 세션이 마지막 사용 크레덴셜에 핀(`session:sticky:anthropic:<sessionId>`, 30일 TTL)되고 핀이 살아있으면 usage 기반 재랭킹을 무조건 생략. 생략의 근거인 프롬프트 캐시는 최대 1h TTL인데 skip 조건에 시간/유휴 요소가 전무 → 캐시가 소멸한 뒤에도 최대 30일간 보호 장치만 남아 다계정 로드밸런싱이 조용히 무력화.
- **우리 제안** (Suggestion 3항목): ① 핀 JSON에 `lastUsedAtMs` 기록 ② Anthropic 요청 유휴 1h 초과 시 재랭킹 ③ hoist를 orderPos tie-break로 강등.
- **업스트림 대응**: PR #5967 "fix(auth): gate session credential pin on prompt-cache idle window" — **3항목 모두 채택**. 추가로 우리의 PR 리뷰 코멘트를 받아 메인테이너가 비-Anthropic 회귀를 직접 재현 후 `provider !== "anthropic"` 게이트 커밋(`2625b92`) + Codex 불변 테스트 추가 (docs/sum 2026-07-18 세션 기록). **머지 완료**(2026-07-18T19:06Z), 이슈 동시 close(completed).
- **현재 상태 / 후속**: 완결 (2026-08-03 재실측: 이슈 closed·PR merged). 잔여(선택): 포함 릴리스에서 1h 유휴 세션 자동 재랭킹 로컬 확인.

### #6869 — usage-aware fallback에 명시적 유료 extra 분기 + 계정별 extra allowlist (open, proposal)

- **문제**: included 쿼터 소진 후 "이 모델을 유지하고 유료 extra를 허용, 단 지불 계정은 명시 선택"이라는 반대편 분기가 없음. extra 행(`anthropic:extra`)은 표시 전용 — drain 랭킹·proactive hard-block 어디에도 불참여. 프로덕션 사고(무캡 auto-reload org 계정에 의도치 않은 유료 사용 적립)가 동기.
- **우리 제안**: ① confirmed depletion(reserve 아님)에서만 fallback 모델 vs 유료 extra 계속의 2택 노출 ② 계정별 ordered allowlist(default-deny) ③ stale/미보고 크리덴셜은 유료 후보 제외(unknown ≠ 지불 허가) ④ 서버 캡 종속의 로컬 예산 가드(선택) ⑤ MVS: 소진→extra 전환 시점의 가시 알림.
- **업스트림 대응**: `@roboomp` 자동 트리아지 — 코드 참조 전제 검증 통과, reserve/depletion 구분 "the right cut", §3 불확실성 계약 "non-negotiable" 평가. `proposal` 라벨 — maintainer 설계 승인 전 구현 착수 없음 방침. 트리아지의 "결정점이 main에 없다"(#6392 미머지) 주장은 저자 정정 코멘트([5103095953](https://github.com/can1357/oh-my-pi/issues/6869#issuecomment-5103095953))로 철회됨 — turn-scoped 결정점은 v17.1.0부터 main에 실존.
- **현재 상태 / 후속**: open, maintainer 응답 대기. ① `accepted` 라벨/4문항 응답 추적 ② 시퀀싱 전제 **충족됨** — PR #6392는 미머지 close(2026-08-05T18:17Z, eggpeat 본인), 대체 PR [#7539](https://github.com/can1357/oh-my-pi/pull/7539) "supersedes #6392"를 **can1357이 직접 머지**(2026-08-05T00:57Z): 성숙한 usage-aware fallback 교정판(모든 provider request preflight — 툴 연속·큐 소비 시점 포함)이 현행 main에 랜딩 → 시퀀싱 답변의 "상태 기반 명세" 적용 조건 성립 ③ 스키마는 #5281 결론 소비. eggpeat의 close 주장([2026-07-30 코멘트](https://github.com/can1357/oh-my-pi/pull/6696#issuecomment-5125175940))은 **미실현**: #7539는 본 이슈·#6898을 참조하지 않았고(본문에 extra/notice 언급 없음, 타임라인 cross-reference 없음) 머지 후에도 두 이슈 모두 open 유지. **09-23 재실측**: 타임라인 추가 이벤트는 #8794(08-17) cross-reference 1건뿐, `updated_at` 07-28 고정. #8794 트리아지가 본 이슈를 "not duplicate"로 재확인 — reserve 스코프 오버라이드(#8794)와 유료 extra 분기(본 이슈)가 별개 축임이 봇 레벨에서 문서화됨.
  - 10-01 재실측: 09-26에 저자 후속 코멘트([5847049205](https://github.com/can1357/oh-my-pi/issues/6869#issuecomment-5847049205))를 게시했어요. v18.3.0 실측으로 "모든 계정에 지출 캡" 대안이 실제로는 작동하지 않음을 보였어요. 두 계정의 Fable 주간 윈도우가 모두 100%일 때 `priority: 10`을 준 개인 org는 무시되고 팀 org로 20/20 라우팅돼 USD 332.93이 적립됐고, 팀 org의 본인 한도를 $0으로 건 뒤에도 선택은 429를 내는 그 계정을 10/10 골랐어요. 원인으로 코드 세 곳(extra 행이 hard-block 범위 밖, 차단 계정 간 순서를 `blockedUntil`이 `accountPriority`보다 먼저 결정, 차단된 계정에는 명시 핀도 무효)을 짚고, v18.3.0의 `auth.accountPolicies`에 opt-in `extra: allow` 필드를 두는 좁힌 규칙을 제안했어요. 이후 반응은 제3자 +1 1건(msokh, 09-29)뿐이고 maintainer·봇 응답은 없어요. 세 코드 근거는 10-01 main(`d462f4b99`)에서도 줄 번호만 바뀌어 유효해요(`rank.ts:89-95`·`:117`, `select.ts:648-652`, `claude.ts:850-862`). 그래서 세션 기록(D1)의 재검토 트리거인 "omp가 차단 계정 간 정렬을 바꿀 때"도 아직 오지 않았어요.

### #6870 — /auth 크리덴셜 인벤토리, /logout 피커와 크로스-프로바이더 동격 (open)

- **문제**: 저장된 크리덴셜 인벤토리의 읽기 전용 뷰가 없음 — `/logout` 피커(파괴적 UI의 뷰어 전용), `/session pin`(현재 프로바이더 OAuth 한정 선택기), `/usage`(usage report 있는 계정만) 모두 부분 표면.
- **우리 제안**: `/auth`(또는 `/auth list`) 읽기 전용 빌트인 — `/logout` 피커가 열거하는 저장소를 전 프로바이더·전 크리덴셜 타입으로 렌더.
- **업스트림 대응**: `@roboomp` 트리아지 — 실현성 인정(`listStoredCredentials()` 무필터 읽기 실존), 핵심 스코프는 backoff read-model(`#getCredentialBlockedUntil` private 상태), 계약 결정 6문항 나열, 공유 인벤토리 read-model formatter 권고, 중복 없음 재확인. 이후 제3자 @cplus02 코멘트([5212468426](https://github.com/can1357/oh-my-pi/issues/6870#issuecomment-5212468426), 2026-08-07) — disabled rows 표면의 구체 사례 보강: #7876(→#7878 수정)의 pre-org OAuth tombstone이 기존 설치에서 좌초(해당 계정 재로그인 없이는 회수 경로 부재), 본 제안의 disabled 표시가 그 관측 수단이 됨. `@roboomp` 재확인 코멘트([5212478020](https://github.com/can1357/oh-my-pi/issues/6870#issuecomment-5212478020), 2026-08-07) — 코드 대조 검증 후 스코프 정교화: `/auth` 수용 시 공유 read model에 actionable disabled subset 포함 권고, 단 `forget`류 삭제는 별도의 명시 확인 명령으로 분리(읽기 전용 계약 유지).
- **현재 상태 / 후속**: open, maintainer 응답 대기. 6문항 결정은 여전히 0건이나, 스레드에 제3자 지지 사례 + 봇 스코프 정교화가 축적되는 중 — 셋 중 유일하게 게시 후 스레드가 살아 있는 이슈. **09-23 재실측**: 08-07 이후 이벤트 없음(`updated_at` 08-07 고정). 인접 #11208(`/usage` 계정 카드, open)이 표면을 넓히지만 usage report 없는 크리덴셜·backoff 상태는 여전히 미표시.
  - 10-01 재실측: 이슈 이벤트는 없어요(`updated_at` 08-07 고정). 인접 표면은 넓어졌어요. v18.4.1의 #13476으로 `/usage` 대시보드가 조회 실패 계정을 숨기지 않게 됐고, v18.3.1의 #13190으로 자동 disable이 발생 시점에 notice로 알려져요. 다만 저장된 크리덴셜 전체를 프로바이더·타입 구분 없이 읽기 전용으로 보여 주는 뷰와 backoff 상태 표시는 여전히 없어서 본 제안의 핵심 공백은 그대로예요 [평가]. 열린 PR #11717(`omp auth accounts`)과 #13923(`omp logout [provider] [account]`)이 조회·삭제 CLI를 각각 다루고 있어, 재제안 시 "읽기 전용 인벤토리 + 별도 확인 삭제" 분리의 실례로 인용할 수 있어요.

### #6898 — included 소진 시 extra 과금 pre-dispatch 알림 (open)

- **문제**: included 윈도우 소진 + extra enabled 계정은 429 없이 유료 초과분으로 계속 서빙 — TUI/headless 어디에도 신호 없음. #6869의 동기 사고를 직접 제거하는 최소 슬라이스.
- **우리 제안**: #6869 §5 분리분(트리아지 초대에 따름). 계약: 유료 전환 "감지"가 아니라 **pre-dispatch 경고**(fresh report + 동일 모델 included 풀 confirmed depleted + extra enabled). allowlist 스키마·depletion 분기 UI 불요. `retry.usageAwareFallback` on/off 무관하게 동작해야 함 — 기본값 off가 바로 침묵 케이스.
- **업스트림 대응**: 게시 전 표적 중복검색 5쿼리 무매치. 라벨 `enhancement, providers, auth, ux, provider:anthropic, agent, triaged`. `@roboomp` 자동 트리아지([5104780644](https://github.com/can1357/oh-my-pi/issues/6898#issuecomment-5104780644), 2026-07-28) — 코드 참조 전제 3건(`buildClaudeExtraUsageLimit` 표시 전용, `findWindowLimits` 5h/7d 한정, `#maybeApplyUsageAwareFallback` 기본 off) 현행 main에서 검증 통과, 라우팅 무변경 display-only로 실현 가능 판정, "stale/미보고 리포트는 침묵"(과금 자격은 판정 가능하되 실지출 귀속은 불가) 불변을 핵심으로 지지. 구현 전 maintainer 결정 4문항: ① TUI 알림이 transient status vs durable inline(후자는 transcript rebuild/resume 시 dedupe 난도↑) ② emit 경계 — turn-entry preflight만 vs 같은 턴 tool continuation 포함 전체 provider request ③ re-arm 의미론 — included 윈도우 하나 리셋 시 즉시 재장전 여부, tier-scoped 모델의 window-cycle key 정의 ④ headless 구조화 이벤트/로그 레벨 계약 — SDK 소비자용 이벤트 vs 로컬 로거 한정. **`accepted` 라벨 또는 maintainer 명시적 진행 지시 전 구현 착수 없음.**
- **현재 상태 / 후속**: open, maintainer 4문항 응답·`accepted` 라벨 추적. eggpeat의 close 주장([2026-07-30 코멘트](https://github.com/can1357/oh-my-pi/pull/6696#issuecomment-5125175940))은 **미실현** — #6392는 미머지 close(2026-08-05), 대체 PR [#7539](https://github.com/can1357/oh-my-pi/pull/7539)가 머지(can1357, 2026-08-05)됐지만 본 이슈를 참조하지 않았고 notice 미구현, 이슈 open 유지. 기판 변화 주목: #7539로 main이 이제 **모든 provider request를 preflight**(툴 연속 포함)하므로, 결정점 ②(emit 경계)의 "전체 provider request" 선택지가 실코드로 지원됨 — 알림 훅 지점이 넓어져 본 제안에 유리 [평가]. 기본값 off 침묵 케이스는 여전히 미해소. **09-23 재실측**: 이벤트 없음(`updated_at` 07-28 고정, 코멘트 1건 그대로). v18.2.11 #12904가 `retry_fallback_applied.reason`으로 preflight health 스냅샷을 TUI/RPC에 노출하기 시작 — "전환했을 때의 사유"까지만 커버하고 "전환 없이 유료 계속"의 사전 경고(본 이슈)는 여전히 부재. 재제안 시 #12904의 reason 배관을 emit 지점으로 지목하면 결정점 ①④의 구현 경로가 구체화됨 [평가].
  - 10-01 재실측: 이슈 자체의 이벤트는 #6869 후속 코멘트발 cross-reference 1건(09-26)뿐이에요. 가장 가까운 랜딩은 v18.3.2의 #13340이에요. Anthropic이 한도 도달 후 grace 헤더를 보내면 세션에 "a short wrap-up allowance runs first, then extra usage" notice를 한 번 띄우고 상태줄에 `limit reached · wrap-up, then extra usage`를 표시해요. 무신호 유료 전환이라는 동기는 부분적으로 완화됐지만, 판정 근거가 응답 헤더라 첫 응답을 받은 뒤에야 발화하고 grace 허용분 없이 소진되는 경로는 다루지 않아서 #6898의 pre-dispatch 계약(fresh report 기반 사전 경고)은 미해소예요 [평가]. Codex 쪽에서도 같은 문제(무신호 크레딧 사용)가 #13889 → #13901로 제기됐고 봇이 "silent paid-credit use" 위험을 인정했어요. 재제안 시 provider 공통 요구로 묶을 근거가 생겼어요 [평가].

### #13403 — Codex `generate_image`가 실제 모델 대신 카탈로그 id(`gpt-image-1`)를 표시 (closed)

- **문제**: ChatGPT 구독(Codex) 경로의 `generate_image`는 항상 `Model: gpt-image-1`로 보고하지만, 백엔드는 실제로 `gpt-image-2-codex`로 생성하면서 도구의 `model`·`size`·`quality`를 덮어써요. 표시값은 내장 카탈로그 항목 `openai-codex/gpt-image-1`의 id였어요. 이 표시를 믿으면 구독 경로가 구형 모델에 묶였다고 판단해 유료 API 키 경로로 옮기게 돼요.
- **우리 제안**: 백엔드가 `response.tools[0].model`로 돌려주는 실제 모델을 결과 텍스트와 `details.model`에 쓰거나, 카탈로그 항목 이름을 실제 모델에 맞추자고 했어요. 백엔드가 덮어쓰는 `size`·`quality`는 문서화하거나 `image_generation_call`이 돌려준 실제 값을 결과에 싣자고 했어요. 근거로 원시 요청 4회 실측표를 붙였어요(존재하지 않는 모델명도 오류 없이 `gpt-image-2-codex`로 대체).
- **업스트림 대응**: 게시(09-26T15:23Z) 약 3분 만에 `@roboomp`가 `bug, prio:p2, provider:openai-codex, tool, triaged` 라벨을 달고 mock SSE로 재현했어요. 원인은 `generateHostedImage`(`packages/ai/src/images/openai-hosted.ts`)가 백엔드 echo를 버리고 `buildToolResult`가 선택된 카탈로그 id를 그대로 출력하는 것이었어요. 게시 약 10분 뒤 PR #13404가 열렸고, H4vC가 09-27T21:30Z에 머지(`dd7f83e49`)하면서 이슈도 completed로 닫혔어요.
- **현재 상태 / 후속**: 완결이에요. v18.4.0부터 결과가 `Model: gpt-image-2-codex (catalog entry openai-codex/gpt-image-1)` 형식으로 실제 모델을 보이고, 저장 이미지마다 백엔드가 돌려준 size·quality를 표시해요. v18.4.3에서는 카탈로그 id도 `openai-codex/gpt-image-2`로 개명됐어요(기존 `gpt-image-1` 셀렉터는 새 id로 해석, 릴리즈 노트상 이슈 참조 없음). 로컬 추적 이슈 `rae-hugo-kim/blender#6`은 아직 open이고, 로컬 설치가 18.4.4라 세션 기록의 재검토 트리거(18.4.0 이상)는 충족됐어요.

## 교차 검증 (docs/sum 대조)

- **계정 일치**: `gh api user` 실측 로그인 = `rae-hugo-kim`. 검색된 건 전부 이 계정 author — 계정 불일치 없음 (2026-07-18 5건, 2026-08-03 재실측 8건, 2026-10-01 재실측 9건).
- **docs/sum 기록과 대조**:
  - #2290 — `session_2026-06-11_omp-refusal-issue-and-15.11-audit.md`에 게시 경위·PR #2294 추적 기록 있음. 일치.
  - #5960, #5966 — `session_2026-07-18_omp-credential-rotation-issues.md`에 게시·정정·PR 리뷰 기여까지 기록 있음. 일치. (세션 기록 시점엔 "둘 다 open, v17.0.4 미포함"이었고, 2026-08-03 재실측에서 둘 다 머지·close 완결로 갱신됨 — 위 상세 참조.)
  - **#5691, #5701 — docs/sum에 기록 누락**. 2026-07-16 게시분인데 같은 날짜의 `session_2026-07-16_v17-adaptation-r1-r4-convergence.md`에는 두 이슈에 대한 언급이 없음(관련 가능성 있는 흔적은 이월 항목 "usage 2행 HUD" 한 줄뿐). 두 건 모두 이미 해결·릴리스되어 실질 후속은 없으나, 세션 기록 관점의 공백임.
  - #6869 09-26 후속 코멘트 — `session_2026-09-28_retier-merges-2026.84-mac-parity.md` D1에 게시 근거(차단 계정 핀 무효·`priority` 미반영 실측)와 코멘트 id `5847049205`가 기록돼 있어 일치해요.
  - #13403 — omp가 아니라 blender 프로젝트 세션 기록 `session_2026-09-28_main-bench-report-rover-opus-eval.md` D3에 게시 경위, PR #13404 머지, v18.4.0 포함이 기록돼 있어 일치해요. 로컬 추적은 `rae-hugo-kim/blender#6`이에요.
- **혼동 주의**: docs/sum의 이슈 #2~#14(gh-loop 레인)는 우리 하네스 레포 로컬 이슈로, 본 문서의 업스트림(can1357/oh-my-pi) 이슈와 별개.
