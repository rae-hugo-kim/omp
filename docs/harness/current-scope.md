# Current Scope: test-portability-platform-docs-94 (P2 thread)

**Created**: 2026-10-07
**Seed**: docs/harness/seed.yaml (task_id 20261007-180736-e342, v1)
**Thread-ID**: T-20261007180812-e37d
**Thread**: gh-loop #94 worker: test portability + platform docs

## Acceptance Criteria
- [x] AC1 — "Linux에서 전체 suite(node --test .omp/extensions/harness/tests/*.test.mjs)가 실패 0건으로 통과하고 skip 수가 변하지 않습니다(기준선 701 pass / 0 skipped → 신규 테스트만 늘고 skipped는 0). 능력이 있는 호스트에서는 skip이 늘지 않습니다."
- [x] AC2 — "능력 감지 헬퍼를 강제로 '없음'으로 두는 시뮬레이션(HARNESS_TEST_FORCE_NO_CAPS)으로 skip 사유 문자열이 출력됨을 tests/capabilities.test.mjs가 고정하고(skipped 본문 미실행, 능력이 필요 없는 테스트는 skip되지 않음 포함), 전체 suite를 강제 '없음'으로 돌려도 실패 0건입니다."
- [x] AC3 — "core.autocrlf=true clone에서 harness-sync 테스트 28건이 'failed to inject the new PATHS entry'로 실패함을 재현한 명령·출력이 PR에 기록되고, .gitattributes(*.sh, .githooks/* eol=lf)로 28/28 통과가 확인되며, fixture 정규식은 \\r?\\n을 허용합니다."
- [x] AC4 — "README ko/en, init 스킬, 통합 계약 Known residual surfaces에 지원 플랫폼 절(Linux·WSL·macOS 공식, Windows 네이티브는 동작+OS 기능 없는 테스트 skip, 전제: Node ≥ 20·bash·bash PATH의 node·심볼릭 링크 테스트는 개발자 모드·권장 검증은 WSL)이 있고 node scripts/docs-drift가 0 errors/0 warnings입니다."
- [x] AC5 — "POSIX 고정 기대값(git-commit-detect·read-path·xdev-dispatch)은 join/resolve로, shasum 파이프는 node:crypto로, 공백 경로에서 쪼개지던 execSync mkfifo는 argv 배열로 바꿨고, 런타임 게이트 코드는 diff에 없으며, 이 이슈의 dispatch 튜플이 audit.jsonl에 gh_loop_dispatched(issue 94)로 있습니다."
