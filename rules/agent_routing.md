# Agent Routing Policy

프로젝트 전용 서브에이전트의 호출 기준을 정의한다.
이 에이전트들은 `.omp/agents/`에 정의되어 있다. OMC 에이전트(executor, architect, verifier 등)는 OMP의 task 도구가 디스커버리해 호출한다 — OMC의 훅 자동화(매직 키워드, system-reminder 주입 등)는 OMP에서 동작하지 않으며, 라우팅은 본 정책과 에이전트 정의로만 이뤄진다.

## 라우팅 기준

### 판단 흐름

```
구현 완료 후 검증 필요?
  → verifier (AC/하네스 기반 완료 검증)
high/critical 위험 코드 변경의 품질 리뷰 필요?
  → reviewer (3-pass 적대적 리뷰; low/medium은 셀프 리뷰로 충분)
그 외 (탐색/조사/구현)?
  → 직접 처리 또는 빌트인 에이전트 사용 (scout, task, OMC executor 등)
```

### 에이전트별 트리거

| 에이전트 | 트리거 조건 | 비트리거 (직접 처리) |
|----------|-------------|---------------------|
| **reviewer** | high/critical 위험 코드 변경 후 품질 리뷰 (3-pass: self + 이종 모델 adversary + code-reviewer — 셋 다 `.omp/agents/` 프로젝트 정의, OMC 불요) | low/medium 위험 변경(셀프 리뷰로 충분), 단순 문서/설정 변경 |
| **verifier** | 구현 완료 주장 전 AC/하네스/테스트 검증 | AC가 정의되지 않은 탐색적 작업 |

### 검증 에이전트 호출 기준

- **reviewer**: SHOULD `risk-assess` 기준 **high/critical** 변경(보안/인증/마이그레이션 파일 접촉, 또는 코드 100줄 초과 변경)일 때 호출. low/medium 변경은 셀프 리뷰(추가 스폰 없음)로 충분하다 — `review-gate`가 이종 모델 리뷰 증거를 강제하는 것도 high/critical 커밋뿐이다(review-gate.mjs). 결과는 `docs/reviews/`에 자동 기록.
- **reviewer 중첩 스폰(Pass 2/3)**: reviewer는 frontmatter `spawns: adversary, code-reviewer`로 두 패스를 **네이티브 중첩 스폰**한다. 단 OMP의 재귀 캡(`task.maxRecursionDepth`, 기본 2) 때문에 reviewer가 task 툴을 보유하려면 depth 1 이하여야 한다 — 즉 **메인 세션(depth 0)이 reviewer를 직접 스폰하는 것이 표준 토폴로지**다. worker 서브에이전트(depth 1) 세션에서 리뷰가 필요하면: fresh top-level 세션(`omp -p`)으로 리뷰를 돌리거나, worker가 adversary·code-reviewer를 **sibling으로 스폰**해 그 결과(및 adversary 트랜스크립트의 `model_change` 실측)를 reviewer에게 전달해 교차검증·문서화시킨다. 어느 경로든 `models:` 라인은 트랜스크립트 실측 후에만 기재한다. codex CLI 폴백은 제거되었다 — thread id는 게이트 증거가 아니다.
- **verifier**: MUST 작업 완료를 사용자에게 보고하기 전에 호출. AC가 있는 경우 필수. `task` 스폰은 논블로킹(비동기 job 배달)이므로 **스폰만으로는 완료가 아니다 — verifier의 verdict가 실제로 도착한 뒤에만 완료를 선언한다.**
- **운영 팁**: 완료된 서브에이전트는 잠시 idle로 살아있다(이후 parked). reviewer/verifier 후속 질의는 재스폰 대신 `hub`(send)로 해당 에이전트에 이어가면 컨텍스트를 보존한다.
- **adversary 모델 선택**: adversary는 `@advisor` 롤을 따른다. 이종(비-primary) 계열 보장이 필요하면 사용자 설정 `modelRoles.advisor`에 GPT 계열 모델을 지정한다 — 계열이 겹치면 verdict가 이종 리뷰 증거로 인정되지 않는다(review-gate). 단일 계열 환경에서 이종 리뷰가 불가능하면 게이트의 나머지 두 경로를 쓴다: human-review(오늘자 리뷰 문서에 `diff-hash:` + `human-reviewed-by:` + `Verdict:`) 또는 감사된 override(`docs/harness/review-skip`에 `reason:`/`approved-by:`/`diff-hash:` — `audit.jsonl`에 `review_override`로 기록·소비). bare `review-skip` 파일만으로는 더 이상 우회되지 않는다.
- **reviewer 모델 선택**: reviewer는 `@slow` 롤을 따른다. `@slow`는 `modelRoles.slow` 미설정 시 default 롤을 상속하므로, 리뷰를 primary보다 강한(또는 명시적으로 의도한) 모델로 돌리려면 `modelRoles.slow`를 직접 지정한다.

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
