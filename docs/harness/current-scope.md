# Current Scope: capability-aware-review-overhaul (P2 thread)

**Created**: 2026-07-21
**Seed**: docs/harness/seed.yaml (task_id 20260721-200358-0802, v4)
**Thread-ID**: T-20260721114423-74d9
**Thread**: native 3-pass + codex CLI fallback removal (AC7)

## Acceptance Criteria
- [x] AC1 에이전트 3종(verifier/reviewer/adversary) frontmatter가 롤 기반 — 모델 하드코딩 0
- [x] AC2 reviewer 위임이 high/critical 위험 변경에 한정
- [x] AC3 이종성 증거 실측 계약 — adversary 트랜스크립트 model_change 확인, models:는 실측 시에만 기재
- [x] AC4 review-gate 3경로 증거(이종 리뷰/human-review/감사된 override) 강제 + 무감사 skip 제거
- [x] AC5 Verdict 화이트리스트 + git commit -a TOCTOU 가드 (v2까지의 "thread 계열 검증(codex-thread만 gpt 기본값 함의)" 서술은 AC7의 thread 증거 경로 전체 삭제로 대체·철회 — v3에서 모순 해소)
- [x] AC6 review-gate 테스트 82건 포함 전체 410건 그린 (`node --test tests/*.test.mjs` 실측 410/410 — models: 단일 경로 강화 회귀 v4 7건 + 2차 리뷰 대응 v5 9건 + 3차 리뷰 대응 sanitizer v6 2건(펜스-우선 순서·탭 닫힘 오인 재현) 포함, docs-drift real-repo 테스트는 closeout_contract PR-4 계약대로 "Closeout pending" 단일 경고만 허용하도록 정합)
- [x] AC7 네이티브 3-pass 실동작화 + 배포 자립성 + codex CLI 폴백 및 게이트 thread 증거 경로 제거 — reviewer frontmatter spawns:로 adversary/code-reviewer 중첩 스폰 허용(top-level 실스폰·model_change 실측), Pass 3용 code-reviewer를 .omp/agents/ 프로젝트 에이전트로 신설(OMC 미설치 바닐라 OMP에서도 3-pass 전체 실스폰, 롤 별칭 모델·read-only), reviewer.md 폴백 섹션 삭제 및 Pass 1–3 리뷰 스코프 staged-first(git diff --cached, 미스테이징 시 HEAD 폴백) 정렬, review-gate isHetEvidence의 codex-thread/codex-session/adversary-thread/adversary-session 경로 전체 삭제(증거 = models: 실측 / human-review / 감사된 override 3형태), 유일 자동 증거가 된 models: 파서 강화(키 정확 일치 — models-* 변형 키 배제; modelFamily 세그먼트 문법 — 부정 단어 세그먼트 정확 일치 거부(-skipped/-unavailable/-not-run-2 등 숫자 포함 변형; 세그먼트 융합형은 구 정규식도 수용하던 선재 간극으로 리뷰 문서에 후속 기록)·malformed 토큰 거부·o3-mini 등 변형 별칭 정상 매핑), 증거 4축(커버리지·FAIL 판정·het·human) 전부 동일 sanitized 뷰(evidenceLines: 라인 단위 단일 패스로 펜스 상태를 HTML 주석 제거보다 먼저 추적 — 펜스 내부 주석은 리터럴, 닫는 펜스는 CommonMark 3컬럼 들여쓰기 제한으로 탭 불인정, 다중행 HTML 주석 제외) 사용 및 diff-hash 키 문법 제한(괄호 한정어만 허용), evidenceHelp·문서 정합, thread 필드 비증거(BLOCK) + 우회 케이스별 BLOCK 회귀 테스트 + 전체 스위트 그린
