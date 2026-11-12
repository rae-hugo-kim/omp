# Current Scope: omp-update-detection-31 (P2 thread)

**Created**: 2026-11-12
**Seed**: docs/harness/seed.yaml (task_id 20261113-020816-3d97, v1)
**Thread-ID**: T-20261112170840-9547
**Thread**: gh-loop #31 worker: omp update detection

## Acceptance Criteria
- [x] AC1 — "세션 시작 호출에서 기록된 버전과 현재 `omp --version`이 다르면 `HARNESS NOTE`를 1회 내고 기록을 갱신하며, 같은 버전으로 다시 시작하면 무발화다. 턴 시작·커밋 직후 재확인 호출(`max_age_ms` 있음)은 알림도 기록도 하지 않아 1회 알림을 소비하지 않는다."
- [x] AC2 — "기록이 없는 첫 실행은 현재 버전만 기록하고 무발화다(읽을 수 없는 기록도 같은 경로)."
- [x] AC3 — "`omp`를 실행할 수 없거나(PATH에 없음·비정상 종료) 출력에서 버전을 읽지 못하면 알림도 기록 변경도 없이 통과한다 — exit 0, stdout·stderr 비어 있음."
- [x] AC4 — "알림이 가리키는 스킬이 소스 리포(`harness-meta.json`에 `source_remote` 없음)에서는 harness-friction, 소비 리포에서는 harness-check로 갈린다."
- [x] AC5 — "링크드 워크트리에서는 무발화·무기록(기록 파일을 만들지도 바꾸지도 않음)이고 같은 리포의 메인 체크아웃이 1회 알린다 — fixture 테스트로 고정한다."
- [x] AC6 — "`node --test .omp/extensions/harness/tests/*.test.mjs`가 전부 통과하고(신규 케이스는 RED → GREEN) `node scripts/docs-drift`가 0 errors이며 `CHANGELOG.md`의 `[Unreleased]`에 항목이 있다."
