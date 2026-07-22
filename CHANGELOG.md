# Changelog

`harness/2026.NN` 태그 기준으로 git 히스토리에서 생성. 버전 범위는 직전 태그 이후~해당 태그까지이며, 버전 bump 커밋(`chore(harness): bump version …`)은 생략.

## [Unreleased]

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
