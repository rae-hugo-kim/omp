# Current Scope: read-path-remirror-109

**Created**: 2026-11-19
**Seed**: docs/harness/seed.yaml (task_id 20261118-162627-109a, v6)
**Issue**: #109

## MUST
- 읽은 파일은 omp가 결과에 싣는 경로로 기록합니다: `details.meta.source`가 `path`일 때만 `details.resolvedPath`(없으면 소스 값). URL로 주소를 준 읽기, 소스가 `path`가 아닌 결과, 소스 없이 `resolvedPath`·`suffixResolution`만 실린 결과는 기록하지 않습니다.
- 목록 읽기(`details.displayReadTargets`가 실린 결과)는 아무것도 기록하지 않습니다(목록 지원은 #150).
- 결과가 소스에 대해 아무것도 말하지 않을 때의 문법 해석을 omp 18.22.0에 맞춥니다: `?` 쿼리, 콤마 꼬리·콜론 반복, 대소문자 무시, 컨테이너 멤버. 디스크상 더 긴 해석이 가능하면 기록하지 않습니다.
- `write`의 해시라인 래퍼를 omp와 같은 규칙으로 벗기고, 내장 스킴 6종과 경로 내 `#`을 반영합니다.
- `index.ts`의 `tool_result` `read` 분기가 `readTarget`에 결과의 `details`를 넘깁니다.
- 미러 기준 버전·기준 주소 서술을 고칩니다.

## MUST NOT
- 읽지 않은 파일을 읽은 것으로 기록하는 방향으로 넓히지 않습니다. 문법이 업스트림보다 더 벗기는 형태는 AC가 요구한 `:-N+C` 하나이며, 실패한 읽기와 목록 읽기는 기록되지 않습니다.
- `;` 목록의 부분별 기록(#150), #110·#111 범위, `harness-surface.md`, `edit`의 `MV DEST` 추적, `write`의 컨테이너 대상 게이트, 버전 범프를 건드리지 않습니다.

## Acceptance Criteria
- [x] AC1 — F1 `?` 쿼리 스트립(`read-path.test.mjs` "#109 F1: strips the ?query of JSON/JSONL, image and SQLite reads"; 종단: `read-ledger-wiring.test.mjs` "a ?q= read marks the file itself as read — the later edit is not false-blocked")
- [x] AC2 — F2 `write` 래퍼 언래핑과 차단(`read-path.test.mjs` "#109 F2: write unwraps a copied [path#TAG] wrapper to the real file", "#109 F2: forms omp does NOT unwrap stay literal", "#109 F2: a wrapped xd://ast_edit address still gates the paths in its body"; 종단: `read-ledger-wiring.test.mjs` "write through a copied [path#TAG] wrapper is gated as the real file" — 읽기 전 `block: true`, 읽은 뒤 통과)
- [x] AC3 — F3·D5 스킴 6종 양쪽 슬래시(`read-path.test.mjs` "#109 F3: attachment / cfg / security / vault / out / mr are virtual in both slash forms")
- [x] AC4 — F4 경로 내 `#`과 `:RAW`/`:IMG`/`:-60+10`(`read-path.test.mjs` "#109 F4: [path#TAG] headers accept # inside the path", "#109: READ_SELECTOR is case-insensitive and strips :-N+C"; `read-selector-oracle.test.mjs`가 업스트림 splitter 포팅본과의 차이를 알려진 두 부류로 제한)
- [x] AC5 — C2·C3·아카이브 멤버(`read-path.test.mjs` "#109 C2: strips comma lists with a tail chunk and a repeated colon", "#109: container selectors resolve to the container file (archive / SQLite / PDF page)", "#109: a reported <archive>:<member> path records the archive", "#109: a ? in a reported path does not hide the archive"; 종단: "a comma-tail read and an archive member query record the file, not a phantom")
- [x] AC6 — D5 기준 버전 18.22.0·기준 주소(`read-path.mjs` 머리말과 READ_SELECTOR 주석, `harness-harness_integration_contract.md` §1 "Ledger path normalization"·Helper modules)
- [x] AC7 — `node --test .omp/extensions/harness/tests/*.test.mjs`와 `node scripts/docs-drift` 통과(RED → GREEN 회귀 테스트, r1~r5 리뷰 지적 회귀 포함; 목록 읽기가 아무것도 기록하지 않는다는 것은 `read-path.test.mjs` "#109: a list read records nothing, whatever its parts and links say"와 `read-ledger-wiring.test.mjs` "a list read records nothing — every part stays gated until it is read alone"이 고정), `CHANGELOG.md` `[Unreleased]`에 #109 항목
