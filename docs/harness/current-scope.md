# Current Scope: consumer-safe-sync (P2 thread)

**Created**: 2026-09-04
**Seed**: docs/harness/seed.yaml (task_id 20260903-120000-c5a1, v1)
**Thread-ID**: T-20260904184902-13b9
**Thread**: consumer-safe-sync

## Acceptance Criteria
- [x] AC1-tests-sync — 게이트 테스트가 게이트와 같은 태그로 소비 리포에 동기화된다 (#17)
- [x] AC2-first-sync-landing — 신규 화이트리스트 항목이 소비 리포의 첫 sync에 착지한다 (#24)
- [x] AC3-hooks-active — init 리포의 훅이 활성화되고 비활성 상태가 감지된다 (#26)
- [x] AC4-link-contract — 동기화 문서가 화이트리스트 밖을 링크하지 않고 소비자 확장 공간이 보호된다 (#27, #28)
- [x] AC5-provenance-gates — 순수 sync 커밋은 override 없이 통과하고 섞인 사용자 변경은 정상 판정된다 (핸드오프 C)
