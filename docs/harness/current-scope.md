# Current Scope: read-path-remirror-109

**Created**: 2026-11-19
**Seed**: docs/harness/seed.yaml (task_id 20261118-162627-109a, v1)
**Issue**: #109

## MUST
- `gates/read-path.mjs`의 read/write 경로 해석을 omp 18.22.0에 맞춥니다: `?` 쿼리, 콤마 꼬리·콜론 반복, 대소문자 무시, 컨테이너 멤버, `;` 목록, `write`의 `[path#TAG]` 언래핑, 내장 스킴 6종, 경로 내 `#`.
- `index.ts`의 `tool_result` `read` 분기가 read-tracker에 `file_paths`로 넘깁니다.
- 미러 기준 버전·기준 주소 서술을 고칩니다.

## MUST NOT
- 업스트림보다 더 벗기는 방향(읽지 않은 파일을 읽은 것으로 기록)으로 넓히지 않습니다. 예외는 AC가 요구한 `:-N+C` 하나이며 로컬 `read`가 업스트림에서 오류라 추적되지 않습니다.
- #110·#111 범위, `harness-surface.md`, `edit`의 `MV DEST` 추적, 버전 범프를 건드리지 않습니다.

## Acceptance Criteria
- [x] AC1 — F1 `?` 쿼리 스트립(`read-path.test.mjs` "#109 F1: strips the ?query of JSON/JSONL, image and SQLite reads"; 종단: `read-ledger-wiring.test.mjs` "a ?q= read marks the file itself as read")
- [x] AC2 — F2 `write` 래퍼 언래핑과 차단(`read-path.test.mjs` "#109 F2: write unwraps a copied [path#TAG] wrapper", "forms omp does NOT unwrap stay literal", "a wrapped xd://ast_edit address still gates the paths in its body"; 종단: `read-ledger-wiring.test.mjs` "write through a copied [path#TAG] wrapper is gated as the real file" — 읽기 전 `block: true`, 읽은 뒤 통과)
- [x] AC3 — F3·D5 스킴 6종 양쪽 슬래시(`read-path.test.mjs` "#109 F3: attachment / cfg / security / vault / out / mr are virtual in both slash forms")
- [x] AC4 — F4 경로 내 `#`과 `:RAW`/`:IMG`/`:-60+10`(`read-path.test.mjs` "#109 F4: [path#TAG] headers accept # inside the path", "#109: READ_SELECTOR is case-insensitive and strips :-N+C")
- [x] AC5 — C2·C3·아카이브 멤버(`read-path.test.mjs` "#109 C2: strips comma lists with a tail chunk and a repeated colon", "#109: container selectors resolve to the container file"; 종단: "a comma-tail read and an archive member query record the file, not a phantom")
- [x] AC6 — `;` 목록의 두 파일이 read-log에 기록(`read-ledger-wiring.test.mjs` "a ; list read records every member in read-log"; 단위: `read-path.test.mjs` "#109: a ; list fans out", "virtual members … skipped", "a ; list member that does not exist is not recorded")
- [x] AC7 — D5 기준 버전 18.22.0·기준 주소(`read-path.mjs` 머리말과 READ_SELECTOR 주석, `harness-harness_integration_contract.md` §1 "Ledger path normalization"·Helper modules)
- [x] AC8 — `node --test .omp/extensions/harness/tests/*.test.mjs`(838 pass, RED 18건 → GREEN)와 `node scripts/docs-drift`(OK) 통과, `CHANGELOG.md` `[Unreleased]`에 #109 항목
