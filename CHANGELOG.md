# Changelog

`harness/2026.NN` 태그 기준으로 git 히스토리에서 생성. 버전 범위는 직전 태그 이후~해당 태그까지이며, 버전 bump 커밋(`chore(harness): bump version …`)은 생략.

## [Unreleased]

- **docs(harness)**: 리뷰 실행 토폴로지 규칙 개정 — 2026-07-22 vibe 모드 실측 결함(depth 1 워커의 generic reviewer 스폰이 재귀 캡 `task.maxRecursionDepth=2`에서 task 툴 없이 기동, 블로킹 task 호출 중인 caller는 자식의 sibling 스폰 요청(hub)에 응답 불능 — 제3 세션 릴레이로만 회복) 대응. 리뷰 진입점 우선순위 신설(① depth 0: reviewer 에이전트 스폰 ② depth 1 워커: task capability 세션이 reviewer.md 프로토콜 직접 수행 — Pass 2/3만 depth 2 batch 스폰 ③ task 부재: top-level `omp -p` 탈출) + 디스패치 preflight MUST(세션 종류가 아닌 capability 기반 — task 툴 없으면 그 세션에서 리뷰 금지; fast급 워커의 'Allowed: none' 실측 주석) + reviewer Pass 0 preflight(task 툴 부재 시 무산출 즉시 종료·caller 재실행 지시 반환, "caller가 sibling 결과 공급" 폴백 삭제 — 블로킹 caller는 공급 불능) + 토폴로지 공통 불변식 3개 명문화(이종성 증거는 `model_change` 실측만 / 리뷰 수행 세션 ≠ 변경 작성 세션 / 게이트는 JSON tuple 사이드카만 검증). 2단계 DAG(형제 batch → aggregator) 경로는 표준 미편입 — 병렬 필요 실측 시 재도입
- **feat(harness)**: 리뷰 증거를 strict JSON 사이드카로 분리 — 마크다운 파싱 공격면 제거. 7차례 적대 리뷰가 매번 새로운 CommonMark 인용/은닉 우회(펜스·탭·blockquote·indented code·리스트 들여쓰기·주석 제조 opener·lazy continuation·opener/closer 상태 반전)를 실증해 라인 기반 마크다운 에뮬레이션을 보안 게이트로서 수렴 불가로 판정, 마크다운 증거 코드(evidenceLines/failLines/makeCommentStripper/parseFields/isHetEvidence/isHumanEvidence)를 전량 삭제. 기계 증거는 `docs/reviews/review-<ts>.json` 사이드카의 고정 길이 위치 기반 JSON tuple `["omp-review-evidence/v1", diff_hash(hex64), verdict(PASS|PASS WITH NOTES|FAIL), models|null, human_reviewed_by|null, reviewer]` — 검증은 JSON.parse + Array.isArray + 정확한 arity + 위치별 타입/enum/패턴 체크뿐이고, tuple에는 키가 없어 중복 키 last-wins 주입이 구조적으로 불가(수제 파서 재발 금지). 증거축 택1: 실측 models 배열(각 원소 modelFamily() 파싱, ≥2 distinct family) 또는 human_reviewed_by(모델명 불인정); 스키마 위반 파일은 경고 후 무시(fail-closed). 감사된 override(review-skip)도 동일 문법 `["omp-review-override/v1", reason, approved_by, diff_hash|UNVERIFIABLE]`로 통일(parseFields 제거, -a TOCTOU 가드·audit 기록·소비는 유지). 차단 메시지는 실제 해시가 담긴 복사 가능한 tuple 템플릿을 출력. reviewer 계약은 md 보고서 + json 사이드카 동시 산출로 갱신(이종성 실측 계약 유지). 마크다운 우회 회귀 스위트는 공격면 소멸로 삭제, JSON 스키마 검증 스위트로 대체(review-gate 79건, 전체 407/407 그린 실측). 1차 tuple 리뷰 FAIL 대응 하드닝: 디스패처(commit-gates) fail-open 예산을 넘길 수 없도록 I/O 바운드(64KiB 초과 파일 미독 스킵, 사이드카 스캔 32개 캡, 파일별 경고 5건 캡+요약, 진단 메시지 클리핑), 미기입 <placeholder> 값 거부(증거·override 전 위치), human 스푸핑 가드 전 토큰+제로폭 문자 스캔, FAIL verdict는 증거축 면제(정직한 FAIL이 covering PASS에 밀리지 않음 — PASS만 증거축 필수), modelFamily 부정 prefix 거부(skipped/gpt-5·gpt-5-skippedrun), -a 폼 도움말이 git diff HEAD 지시. 2차 tuple 리뷰 FAIL 대응 CRITICAL 3건 봉인(3차): ① parseEvidence/parseOverride에 반복적(스택 기반) 깊이 게이트(tooDeep — 중첩 payload가 JSON.stringify/재귀 진단을 크래시시켜 디스패처 fail-open을 유도하던 경로 제거, 진단 메시지에서 비-문자열 stringify 제거, 호출부 try/catch 이중 방어) ② readBounded가 O_NOFOLLOW|O_NONBLOCK open + fstat(fd) 검사(symlink→FIFO 추적·TOCTOU 봉인, FIFO/특수파일/symlink 즉시 무효 — 증거는 평범한 정규 파일만) ③ 스캔 캡 초과는 부분 선별 대신 무조건 fail-closed BLOCK(covering FAIL 밀어내기 우회 원천 차단). HIGH 잔존(negation laundering 변종·유니코드 invisible/호모글리프 human 스푸핑·risk-assess unknown fail-open)은 위협모델상 한계효용 판정으로 수정하지 않고 리뷰 문서(review-2026-07-22-162938.md)에 후속 과제로 기록
- **fix(harness)**: 커밋 게이트 예산 초과 우회 봉인 + 디스패처 fail-closed 전환 (3차 적대 리뷰 CRITICAL 2건) — ① review-gate `readBounded`가 fstat 크기 검사 대신 고정 버퍼 `readSync`(MAX_EVIDENCE_BYTES+1) 상한 읽기로 교체: `readFileSync(fd)`는 자체 재-stat 후 EOF까지 읽어 검사~읽기 사이에 성장하는 파일(동시 append)이 상한을 무력화했음 — 이제 상한이 읽기 자체에 실림(race-free). ② 사이드카 스캔을 `readdirSync` 전체 적재·정렬에서 `opendirSync` 증분 열거로 교체: 33번째 같은 날짜 매칭 즉시 BLOCK, 비매칭 엔트리 flood는 전체 스캔 10,000 엔트리 상한에서 fail-closed BLOCK(열거 작업량 자체를 dispatcher 예산 안에 고정), 정렬은 cap 통과한 ≤32개 매칭에만 적용. ③ `commit-gates.mjs` 디스패처가 crash/timeout/spawn 실패 게이트를 skip(fail-open)하던 것을 BLOCK(fail-closed)으로 전환 — 게이트를 예산 초과시키면 리뷰가 통째로 우회되던 공격 효용 제거, BLOCK 메시지가 실패 게이트·원인·단독 실행 디버그 방법 안내(소유자 결정). 회귀 테스트: 정확히 64KiB 수용/64KiB+1 거부, 비매칭 대량 flood BLOCK, 크래시·행 게이트 디스패처 BLOCK.
- **fix(harness)**: 4차 적대 리뷰의 timeout+exit0 fail-open 잔존 봉인 — `spawnSync` 정상 통과를 `status===0 && !error && !signal`로 한정하여 `status:0 + error:ETIMEDOUT`·ENOBUFS/EPIPE·시그널 종료를 모두 BLOCK하고, 자식 killSignal을 잡거나 무시할 수 없는 `SIGKILL`로 고정해 SIGTERM 핸들러의 exit0 위장과 spawnSync 무한 지연을 제거. 실패 원인은 `error.code → signal → exit status` 우선순위로 출력(`exit null` 제거). `readBounded`는 POSIX short-read를 EOF로 오판하지 않도록 MAX+1 버퍼가 차거나 readSync가 0을 반환할 때까지 offset 누적 반복. 실제 디스패처 회귀 테스트가 timeout+exit0 시도(ETIMEDOUT)와 signal-only 종료(SIGKILL)를 각각 fail-closed BLOCK으로 고정.
- **feat(harness)**: 네이티브 3-pass 실동작화 + 배포 자립성 + codex CLI 폴백 제거 — reviewer frontmatter `spawns: adversary, code-reviewer`로 중첩 스폰 허용(top-level 실스폰·model_change 실측: gpt 계열 확인), Pass 3용 `code-reviewer`를 `.omp/agents/` 프로젝트 에이전트로 신설(OMC 미설치 바닐라 OMP에서도 3-pass 전체 실스폰 — 롤 별칭 모델, read-only), reviewer.md의 codex CLI 폴백 섹션 삭제 및 Pass 1–3 리뷰 스코프 staged-first(`git diff --cached`, 미스테이징 시 HEAD 폴백) 정렬, review-gate isHetEvidence의 thread/session 증거 경로 전체 삭제(증거 = 실측 `models:` / human-review / 감사된 override 3형태), 유일 자동 증거가 된 `models:` 파서 강화 — 키 정확 일치(`models-*` 변형 키 배제), modelFamily 세그먼트 문법(부정 단어 세그먼트 정확 일치 거부: `-skipped`/`-unavailable`/`-not-run-2` 등 숫자 포함 변형까지 — 세그먼트 융합형은 구 정규식도 수용하던 선재 간극으로 리뷰 문서에 후속 기록, malformed 토큰 거부, `o3-mini` 등 변형 별칭 정상 매핑), 증거 4축(커버리지·FAIL 판정·het·human) 동일 sanitized 뷰(evidenceLines: 라인 단위 단일 패스로 펜스 상태를 HTML 주석 제거보다 먼저 추적 — 펜스 내부 주석은 리터럴이라 백틱 융합 조기 닫힘 불가, 닫는 펜스는 CommonMark 3컬럼 들여쓰기 제한으로 탭 들여쓰기 불인정, 다중행 HTML 주석 제외) 통일 및 `diff-hash` 키 문법 제한(괄호 한정어만 커버리지 인정), evidenceHelp·contract·lifecycle·routing·AGENTS 문서 정합, thread 필드 비증거(BLOCK)·우회 케이스별 BLOCK 회귀 테스트 추가 (review-gate 82건 포함 전체 스위트 410건 그린 실측)
- **feat(harness)**: review-gate 증거 3경로화 — ① 이종 모델 리뷰(현행) ② human-review(`human-reviewed-by:` + `Verdict:`, diff-hash 바인딩) ③ 감사된 override(review-skip에 reason/approved-by/diff-hash 필수, `review_override`로 audit.jsonl 기록·소비); bare review-skip 무감사 우회 제거, BLOCK 메시지가 정확한 해시·문법 안내
- **fix(harness)**: `grep`/`ast_grep` 검색 앵커를 read-log에 기록 — context-gate 오차단 해소 (`a609925`)

## [2026.64] - 2026-07-08

- **chore(harness)**: 리뷰 LOW 노트 반영 — sum vault 백업 완전 fail-open(서브셸), compush/compr 아카이브 체크 pipefail-safe(`[ -n ]`), archive-guard를 contract 시작 체크리스트에 추가 (`edc2c51`)

## [2026.63] - 2026-07-08

- **feat(harness)**: 로컬 아카이브 유출 방지 + sum-vault 백업 — archive-guard 커밋 게이트(4번째, `-z` NUL 경로, 삭제 예외), pre-push tracked-archive 차단(`core.hooksPath`로 훅 활성화), compush/compr pre-push 체크, bootstrap/migrate에 라인 단위 멱등 gitignore + hooksPath, sum 스킬 vault 백업 단계(fail-open, `SUM_VAULT_DIR`) (`91ddb0a`)

## [2026.62] - 2026-07-04

- **feat(harness)**: 드리프트 자동 해소 — 턴 시작 + post-commit 에이전트 지시(1h 윈도, 10min 실패 백오프, 마지막 드리프트 보존); `parseRemoteTags`가 peeled `^{}` 커밋 SHA 우선(annotated tag 영구 오탐 DRIFT 수정) (`252c59d`)

## [2026.61] - 2026-07-04

- **fix(harness)**: read-path selector 추적(F1 raw-leading selector, F2 ast_edit apply-only) + `editTargets`가 native `input.paths` 병합(hashline REM/MV 타깃, header-regex fallback) + md 저장 시 in-process mermaid-check 연결 (`415ebd9`)
- **docs(policy)**: OMP 16.3.4에 맞춰 툴 이름/frontmatter 정렬(search→grep, find→glob; adversary tools에 glob; verifier는 미지원 disallowedTools 대신 tools 화이트리스트 — write/edit 미노출; gh-loop.yml 예시 → `omp -p /skill:gh-loop`) + 16.0.1→16.3.4 릴리스 감사 문서 (`e54dd33`)
- **docs**: mdBook 파이프라인 제거(book.toml/SUMMARY/docs-build.sh) — 문서는 Obsidian/GitHub 네이티브 열람; mermaid 검증은 in-process 이동(`mermaid-check.ts`, 번들 pi-utils 파서, fail-open) (`f58a318`)
- **docs(readme)**: 스킬 수 13→15 수정(gh-loop + gh-fanout) (`331a5f3`)
- **docs**: 에이전트 토큰 효율 접근 기록(tidy / harness-native / headroom-class compression) (`c7f642f`)

## [2026.60] - 2026-06-19

- **test(harness)**: autonomy-loop E2E 조합 테스트 + gh-loop list-consistency 주의사항(het-reviewed, live-verified) (`a503f06`)
- **docs**: web-search 정책에 Tavily 추가, upgrade-prep 노트 색인 (`c118722`)

## [2026.59] - 2026-06-19

- **feat(harness)**: autonomy Q3 멀티세션 컨트롤러 — gh-loop-controller(planPool/nextScale/assign) + gh-fanout 스킬; het-fixed(정수 cap, assign dedup/normalize, claim rollback, crash-safe cleanup, milestone coalescing) (`bc30ed0`)

## [2026.58] - 2026-06-19

- **feat(harness)**: autonomy Q2.7-4 finding 자동 탐지 — gh-loop-detect(breadcrumb adapter + batch plan); het-fixed(coarse-type 억제 없음, 기본 cap, fail-closed 입력) (`90bd288`)

## [2026.57] - 2026-06-18

- **feat(harness)**: autonomy option-A 런타임 authoring — gh-loop-runner 결정 헬퍼(tested guard policy) + GH Actions 워크플로 템플릿 + 설정 가이드 (`1df1cdc`)

## [2026.56] - 2026-06-18

- **feat(harness)**: review-gate가 이종 리뷰 강제(≥2 모델 패밀리 / codex-thread) + reviewer 계약이 het 증거 산출(A+C) (`bd04724`)
- **fix(harness)**: gh-loop — 이종(codex+adversary) 리뷰 지적 해소: fail-closed existing-json, kind-by-marker, atomic HITL merge, race/label 강화 (`32fc26a`)
- **docs(harness)**: gh-loop 확정 guard policy — write+ / bot+marker / owner-first / parked (`f09827f`)
- **docs(harness)**: gh-loop resume = LLM-interpret + author/idempotency guards(라이브 검증 학습) (`ca8adc9`)
- **fix(harness)**: gh-loop이 `gh-loop`/`needs-decision` 라벨 부트스트랩(라이브 검증 finding) (`357413f`)
- **fix(harness)**: gh-loop jq 의존 제거 — node-only `--out` 소비(field-tested injection-inert) (`f4fcabd`)
- **feat(harness)**: autonomy Q2 PoC — gh-loop 루프 스킬 + finding→issue 헬퍼(doc-ingest #Q2) (`5e0bc4b`)
- **refactor(harness)**: breadcrumb-tracker deslop — 중복 command slice 호이스트 (`fcdcdf0`)
- **feat(harness)**: autonomy Q1 완료 — 파일 기반 breadcrumb 설계로 AC2/AC5 충족 (`3686395`)
- **fix(harness)**: review-gate가 검증 불가 커밋 형식에 actionable 메시지 제공 (`8d00a9e`)
- **feat(harness)**: autonomy Q1 — 세션 breadcrumb 캡처(no-LLM) (`ccd72a4`)
- **docs(harness)**: intent-ingest 프레임워크 v1 feature-complete(9/9 AC, slice 3) (`e69a8e0`)
- **feat(harness)**: intent-ingest slice 3 — doc-ingest, coverage, roles, L1 self-detect (`59a37a0`)
- **docs(harness)**: reopen 결정 기록(i, in-place) + slice 1/2 shipped (`4b1ede8`)
- **feat(harness)**: intent-ingest slice 2 — closed-seed reopen(in-place) (`be5e45c`)
- **feat(harness)**: intent-ingest 프레임워크 slice 1 — P2 fidelity loop (`ece3202`)

## [2026.55] - 2026-06-17

- **fix(harness)**: OMP 16.0.1 task 스키마 대응(B-1/B-2) (`e1e5147`)

## [2026.54] - 2026-06-11

- **fix(harness)**: sync 시 `bootstrapped_at` 보존 (`c61c20c`)

## [2026.53] - 2026-06-11

- **fix(harness)**: version-bump 매니페스트에 `.omp/agents/` 누락 정렬 (`a069233`)
- **feat(agents)**: adversary GPT 리뷰를 high effort로 고정 (`40451f0`)

## [2026.52] - 2026-06-11

- **feat(skills)**: Claude Code→OMP 이주 스킬 `migrate` 신설 (`35d757a`)

## [2026.51] - 2026-06-11

- **feat(agents)**: 이종모델 적대 리뷰어 `adversary` 신설(gpt-5.5 네이티브) (`7f81e1f`)

## [2026.50] - 2026-06-11

- **fix(sync)**: `.omp/agents`를 sync 매니페스트에 추가(AGENTS.md가 verifier/reviewer 에이전트 참조) (`82ada53`)

## [2026.49] - 2026-06-11

최초 태그 버전.

- **feat(harness)**: Claude Code 하네스 템플릿을 OMP 네이티브로 포팅(harness/2026.49 기반) (`8f9d689`)
- **fix(harness)**: bash 비-0 exit를 `details.exitCode`로 판정해 FAIL 라우팅 + edit 입력 양형 지원 (`4f842ee`)
- **docs**: 포팅 고지 섹션 추가(한/영) (`1e4f702`)
