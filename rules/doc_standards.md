# Documentation Standards

저작 매체는 마크다운(SST). HTML은 *파생* 산출물 또는 *1회성* 사람용 아티팩트에만
허용한다. 본 표준은 마크다운을 **뷰어 독립적으로** 유지한다 — 같은 파일이 raw
텍스트, Obsidian vault, GitHub 렌더, OMP TUI(ASCII 다이어그램) 어디서든 읽혀야 한다.

## Rules

### R1. 다이어그램은 Mermaid 기본, ASCII는 코드 코멘트 한정

- 문서 본문의 다이어그램은 ```` ```mermaid ```` 코드펜스를 사용.
- ASCII 다이어그램은 **코드 코멘트 안 5–10줄 짧은 흐름**에 한해 허용.
- ASCII 아트로 그린 그래프·플로우차트를 문서 본문에 두지 않는다.
- 저장 시점 검증: 하네스 익스텐션(`.omp/extensions/harness/mermaid-check.ts`)이
  OMP 내장 파서로 `.md` 저장 직후 syntax 오류를 잡아 경고를 주입함.
- 지원 타입은 OMP 내장 파서 기준: `graph`/`flowchart`, `stateDiagram(-v2)`,
  `sequenceDiagram`, `classDiagram`, `erDiagram`, `xychart`. 이 외(gantt, pie 등)는
  게이트가 거부하므로 쓰지 않는다.

### R2. 긴 문서(대략 200줄+)는 상단 요약 강제

- 200줄을 넘어가는 문서는 **TL;DR** 또는 **요약 (200자 내외)** 섹션을 상단에 둔다.
- 200줄은 hard cap이 아닌 trigger threshold. 가능하면 400줄 이전에 분할.
- 요약은 결정사항·결론을 담고, 본문은 근거·논거·구체적 데이터를 담는다.

### R3. GFM 표 정렬

- 표는 GitHub Flavored Markdown 형식 (`|---|---|`) 사용.
- `prettier --parser markdown` 또는 IDE 자동 포맷터로 정렬 유지.
- raw 마크다운에서 보더라도 컬럼이 어긋나지 않게 둔다.

### R4. 사람용 1회성 HTML은 `artifacts/`로

- 1회성 explainer·mockup·design preview·PR 시각화 등은 `artifacts/` 트리에 둔다.
- `docs/` 안에 HTML 파일을 두지 않는다 (SST 오염; md 뷰어의 대상도 아님).
- 상세는 [`artifacts/README.md`](../artifacts/README.md) 참조.

### R5. 스킬 정의 파일은 대문자 `SKILL.md`

- 스킬 디렉터리의 entry 파일은 반드시 `SKILL.md` (대문자 S, K, I, L, L, M, D).
- 소문자 `skill.md`는 Linux 환경에서 silent failure
  ([anthropics/skills#314](https://github.com/anthropics/skills/issues/314)).
- 글로벌(`~/.claude/skills/` — OMC 스킬은 OMP에서도 여기서 로드됨)·로컬(`.omp/skills/`) 양쪽 모두 동일.

## View

- 뷰어: **Obsidian** — vault 루트 = repo 루트 (`rules/`·`checklists/`·`docs/` 크로스링크 유지).
  WSL 경로: `\\wsl.localhost\<distro>\...\omp`
- 권장 설정: 기본 보기 모드 Reading / 위키링크 끄기 + 링크 형식 상대 경로 / 가독 폭 켜기
- 진입점: `docs/README.md` (섹션별 안내 색인). vault 설정 디렉터리 `.obsidian/`은 gitignore.
- 링크 무결성: `scripts/docs-drift` (뷰어 무관, 상대 링크 + 앵커 검사)

## Related

- 본 표준의 원 출처는 docs-viewer 미션(2026-06) seed의 AC였다 — 이후 `seed.yaml`은
  미션별로 회전하므로 현행 원본은 본 문서다. (mdBook+mmdc 파이프라인은 2026-07
  Obsidian 전환으로 폐지, 검증은 하네스 게이트로 이관)
- `rules/change_control.md` — 최소 변경 원칙 (본 표준의 over-prescription 방지)
- `artifacts/README.md` — 1회성 HTML 산출물 정책
