# #71 작업 범위를 추적합니다.

- task_id: `20261002-233155-9050`
- seed: `docs/harness/seed.yaml` version 1
- 승인 근거는 이슈 #71의 A+C 결정과 이 세션의 worker 지시입니다.
- AC3·AC4의 리뷰 보강은 실제 push URL·base 리포/ref 정체성 고정, 결과 끝 개행 확인, 최신 base 속성 조회, 기존 통합 충돌 해결 사례와의 적용 경계로 한정합니다. 통합 계약의 해당 안내만 정합하며 sync 범위는 변경하지 않습니다.

## Acceptance Criteria

- [x] AC1 — 감사 로그 한 경로에만 union을 적용하고 기존 속성을 보존합니다.
- [x] AC2 — 격리된 임시 리포에서 실제 rebase로 기존 로그·두 append 이벤트 보존과 JSON 파싱을 확인합니다.
- [x] AC3 — 최신 base·작업트리 청결·원격 SHA·원 범위 및 rebase 후 보존·JSON 검증과 실패 중단을 절차에 반영합니다.
- [x] AC4 — PR별 재작성 승인과 새 head 머지 승인을 구분하고 기존 역할·라벨·nonce·match-head-commit 계약을 유지합니다.
- [x] AC5 — 최종 suite·docs-drift·스모크·배포 범위 확인 결과를 기록하며 소비 속성 덮어쓰기와 sync 확장은 하지 않습니다.

## 후속 절차를 구분합니다.

PR 생성과 증거 게시는 커밋 후 수행합니다. 이슈·PR 양쪽의 `needs-decision` 전이와 현재 head·nonce 결정 요청 뒤 턴을 종료하며 머지는 하지 않습니다.

## 검증 근거를 기록합니다.

- `node --test .omp/extensions/harness/tests/*.test.mjs`는 union 설정과 1차 리뷰 보강 뒤 1회 실행하여 653/653 PASS, fail 0을 확인했습니다. 이후 변경은 URL 재작성·태그·서브모듈 전송을 제한하는 문서와 검증·변경 기록뿐이며 전체 suite를 반복하지 않았습니다.
- `node scripts/docs-drift`는 0 errors, 0 warnings로 통과했습니다. 명령과 출력은 [최종 검증 댓글](https://github.com/rae-hugo-kim/omp/issues/71#issuecomment-5963312615)에 기록했습니다.
- [실제 rebase 스모크 댓글](https://github.com/rae-hugo-kim/omp/issues/71#issuecomment-5963201517)에 순수 append·기존 속성·비JSON·삭제·교체·다른 파일 충돌 검증을 기록했습니다. 추가로 union 도입 전 분기한 PR에서도 승인 base를 `--source`로 조회하고 실제 rebase하여 `base,A,B` 보존·JSON 파싱을 확인했습니다.
- sync 스크립트는 기준 커밋과 같고 두 스킬만 기존 배포 대상이며 `.gitattributes`는 allowlist 밖입니다. 통합 계약의 한 문단은 기존 `harness-*.md` 글롭에 포함되므로 배포 범위를 확장하지 않습니다.
- 최초 3-pass 리뷰의 승인 대상 정체성·push URL·끝 개행·속성 조회·기존 절차 경계 노트를 반영했습니다. 최종 리뷰·verifier 판정과 PR 게시는 후속 전달 기록으로 남깁니다.
