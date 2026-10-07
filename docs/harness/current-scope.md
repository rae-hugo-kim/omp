# Current Scope: macos-test-portability-91 (P2 thread)

**Created**: 2026-10-07
**Seed**: docs/harness/seed.yaml (task_id 20261008-021500-9a1c, v1)
**Thread-ID**: T-20261007175846-a114
**Thread**: gh-loop #91 worker: macOS test portability

## Acceptance Criteria
- [x] AC1 — "cross-repo.test.mjs의 withFixture/withTree가 realpath 정규화된 임시 루트를 쓰고(헬퍼 tests/helpers/real-tmpdir.mjs), /var 별칭이 있는 TMPDIR에서 기존 4건(repoToplevel·shellWriteTargets·AGENTS.md·CLAUDE.md 차단 메시지)이 통과합니다 — 별칭 TMPDIR 재현에서 수정 전 4건 실패 → 수정 후 0건 실패. 링크드 워크트리·다른 리포 차단·심볼릭 링크 경계 검증은 그대로 통과합니다."
- [x] AC2 — "scripts/harness-version-bump.sh가 harness-meta.json을 `sed -i` 없이(임시 파일 → 원본 모드 복사 → sed 출력 → mv) 갱신하고, 기존 harness-version-bump.test.mjs 전부가 그대로 통과합니다(CHANGELOG/meta 동시 커밋·CRLF·파일 모드·임시 파일 미노출·실패 후 복구 포함)."
- [x] AC3 — "BSD sed의 `-i SUFFIX` 파싱을 재현하는 shim을 PATH 앞에 둔 회귀 테스트가 추가되어, 수정 전 스크립트에서는 `sed: -e: No such file or directory`로 실패하고 수정 후에는 통과하며, meta 파일 모드와 임시 파일 부재를 함께 확인합니다."
- [x] AC4 — "Linux에서 전체 하네스 suite(node --test .omp/extensions/harness/tests/*.test.mjs)와 node scripts/docs-drift가 회귀 없이 통과합니다."
