---
name: harness-friction
argument-hint: "[--from <omp-version>] [--to <omp-version>]"
description: Audits omp releases against this harness — reads every release note since the last audited omp version, checks fixed model ids still resolve, and files one conflict/drift report with an issue split. Source-repo only. Use for "harness-friction", "마찰 감사", "omp 업데이트 대조".
---

# harness-friction — omp 릴리스 대 하네스 마찰 감사

## Goal

마지막으로 감사한 omp 버전부터 설치된 버전까지의 업스트림 릴리스를 전수 읽고, 하네스(게이트 코드·규칙·에이전트 정의·스킬)와 대조해 보고서 하나를 냅니다. 보고서는 변경마다 **충돌 / 드리프트 / 무관**을 판정하고, 수정은 하지 않은 채 이슈 분할안까지만 냅니다.

이 스킬이 생기기 전의 감사 두 번(2026-09-24 `18.2.6 ~ 18.3.0` → #40~#43, 2026-10-16 `18.3.1 ~ 18.11.1` → `docs/handoff/handoff_2026-10-16_omp-18-11-1-friction-audit.md`)은 절차가 고정돼 있지 않아 `v18.18.4`의 Google Antigravity 중지 같은 변경을 놓쳤습니다. 이 스킬은 그 절차를 고정하고, 모델 참조 생존 검사를 결정적 스크립트로 둡니다.

## Non-Negotiables

| Rule | 이유 |
|------|------|
| **전수 대조** | 구간의 릴리스를 전부 읽습니다. 보고서에 구간 릴리스 수와 실제로 읽은 수를 적고, 둘이 다르면 감사가 끝난 것이 아닙니다. |
| **읽기 전용 감사** | 게이트·규칙·에이전트 정의·`modelRoles`를 고치지 않습니다. 쓰는 것은 보고서, 기준 버전 기록, 임시 수집 파일뿐입니다. 발견한 마찰의 수정은 각각 별도 이슈입니다. |
| **이슈는 승인 뒤에만** | 보고서는 이슈 분할안(번호·확인 문장)까지만 냅니다. 이슈 생성은 사용자가 분할안을 승인한 뒤 `gh-loop` Stage 1 절차로 합니다. |
| **근거 없는 판정 금지** | 판정마다 릴리스 노트 링크와 하네스 `파일:줄`을 붙입니다. 근거를 못 찾은 항목은 "확인 필요"로 남깁니다. |
| **소스 리포 전용** | `scripts/harness-sync.sh` 화이트리스트에 넣지 않습니다. 함께 배포되는 테스트는 스킬이 없으면 skip합니다. |

## Process

스크립트는 `scripts/friction.mjs` 하나이고, 네 하위 명령(`range`·`releases`·`models`·`baseline`)만 결정적으로 처리합니다. 릴리스 노트를 읽고 판정하는 일은 아래 절차의 사람(에이전트) 몫입니다.

### 1. 구간

```bash
node .omp/skills/harness-friction/scripts/friction.mjs range
# 기준 <baseline.json의 omp_version> → 대상 <설치된 omp --version>   (예: 기준 18.11.1 → 대상 18.18.6)
```

기준 버전은 `baseline.json`의 `omp_version`(마지막으로 감사한 omp 버전)이고, 대상은 설치된 `omp --version`입니다. `--from`/`--to`로 바꿀 수 있습니다(다시 돌려 보거나 특정 구간만 볼 때). 기준이 대상보다 크면 실패합니다 — 기록이 잘못됐거나 omp를 내려받은 것입니다.

### 2. 릴리스 노트 수집

```bash
OUT=$(mktemp -d)
node .omp/skills/harness-friction/scripts/friction.mjs releases --out "$OUT/releases.json"
# 구간 18.11.1 → 18.18.6: 릴리스 26개 / 읽은 수 26개 -> …/releases.json
```

`gh release list -R can1357/oh-my-pi`에서 기준 초과·대상 이하의 정식 릴리스(초안·프리릴리스 제외)를 고르고 `gh release view`로 본문을 전부 받습니다. 하나라도 못 받으면 실패하고 못 받은 태그를 알립니다. 출력 줄의 두 수를 보고서 머리말에 그대로 옮깁니다.

본문이 길면(2026-11-13 구간은 26개, 큐레이션 절만 50만 자) 릴리스를 몇 묶음으로 나눠 `scout` 에이전트에게 읽히고 묶음마다 읽은 릴리스·불릿 수를 보고받아 합산합니다. 읽을 곳은 패키지 절(`## @oh-my-pi/<pkg>` 아래 `### Added / Changed / Fixed / Removed / Breaking Changes`)이고, `What's Changed`·`New Contributors`는 PR 목록이라 뺍니다. 대조 축과 보고 형식은 `references/harness-surface.md`를 그대로 건넵니다.

### 3. 대조 축

| 축 | 하네스 쪽 | 보는 것 |
|---|---|---|
| 게이트 코드 | `.omp/extensions/harness/index.ts`, `.omp/extensions/harness/gates/` | 도구 이벤트 형태(`tool_call`·`tool_result`의 `input`·`details`·`content`·`isError`), 경로 셀렉터·내부 URL 스킴(`.omp/extensions/harness/gates/read-path.mjs`), bash 명령 파싱, 확장 API |
| 규칙·정책 | `.omp/rules/harness-*.md`, `AGENTS.md` | 버전이 박힌 실측 서술("omp 18.x에서 측정")과 omp 동작을 단정한 문장 |
| 에이전트 정의 | `.omp/agents/*.md` | `model`·`tools`·`spawns`·`thinkingLevel`·`structured`, `task` 도구 스키마, 서브에이전트 규칙 |
| 모델·프로바이더 참조 | 위 에이전트의 고정 `model:` 값, 규칙·`AGENTS.md`의 모델 id | 아래 4의 생존 검사(결정적) |
| 스킬 | `.omp/skills/*/SKILL.md` | `harness-skill-tune`의 점검 단계를 호출합니다: `node .omp/skills/harness-skill-tune/scripts/skill-tune.mjs check` — 머리말의 예약 이름 기준 버전이 설치 버전과 다르면 그 스킬의 "예약 이름 기준 갱신"을 먼저 합니다. |

### 4. 모델 참조 생존 검사 (결정적)

```bash
node .omp/skills/harness-friction/scripts/friction.mjs models --releases-json "$OUT/releases.json"
```

- `.omp/agents/*.md`의 frontmatter `model:` — 고정값(`anthropic/claude-opus-5-5` 같은 `provider/model`)은 `omp models --kind all --json` 카탈로그에서 해석돼야 하고 채팅 모델이어야 합니다. 스칼라·인라인 리스트·YAML 블록 리스트를 읽고 ` # 주석`은 값이 아닙니다. 롤 참조(`@advisor`, `["@task", "@default"]`)는 고정값이 아니므로 지적하지 않고, `modelRoles`가 가리키는 대상을 참고로 적습니다.
- `.omp/rules/*.md`·`AGENTS.md` 본문(`RULE-MODEL`)과 에이전트 본문(`AGENT-PROSE` — frontmatter 아래 표·스폰 예시)의 백틱 안 `provider/model[:level]` — 스크립트에 박힌 프로바이더 목록(`KNOWN_PROVIDERS`, omp가 실어 온 프로바이더 id)과 카탈로그·에이전트·`modelRoles`가 아는 프로바이더만 모델 참조로 봅니다(리포 경로·태그는 걸리지 않습니다). 은퇴한 프로바이더를 규칙만 언급해도 잡히도록 목록이 바닥을 깝니다.
- 호스트 `modelRoles`는 리포 산출물이 아니라 참고 표로만 냅니다(예: `vision` 롤이 중지된 프로바이더를 가리켜도 지적이 아닙니다).
- 지적마다 `파일:줄`·참조·사유(`provider-missing`·`model-missing`·`not-chat`)를 내고, `--releases-json`이 있으면 그 프로바이더를 중지·제거한다고 적힌 구간 릴리스 불릿을 인용합니다. 이것이 "어느 릴리스가 원인인가"의 1차 근거입니다.

`--models-json`·`--roles-json`·`--repo`는 테스트 시임입니다.

### 5. 판정

변경마다 셋 중 하나로 분류하고 근거를 붙입니다.

| 판정 | 뜻 | 예 |
|---|---|---|
| **충돌** | 게이트가 오작동·우회되거나, 에이전트·CLI 호출이 깨짐 | 고정 `model:`의 프로바이더 중지, 도구 입력 필드 제거, `omp` 하위 명령 출력 형식 변경 |
| **드리프트** | 하네스 문서·주석·실측 서술이 더는 사실이 아님 | 규칙의 "omp 18.3.0에서 측정" 주장이 바뀐 동작을 가리킴 |
| **무관** | 하네스 표면에 닿지 않음 | TUI 렌더링, 네이티브 바이너리, 하네스가 쓰지 않는 프로바이더 |

근거는 릴리스 노트 링크(태그·PR)와 하네스 `파일:줄` 둘 다입니다. 스크립트가 낸 지적은 그대로 충돌이고, 리뷰 기록(`docs/reviews/*.panel.jsonl`의 `models`)처럼 실측이 있으면 함께 싣습니다.

### 6. 산출

보고서를 `docs/handoff/handoff_<YYYY-MM-DD>_omp-<버전>-friction-audit.md`에 씁니다. 형식은 2026-10-16 문서를 따릅니다 — 머리말(발신·수신·상태·역할), 한 줄 요약, 배경 및 버전 기준선(구간 릴리스 수 / 읽은 수), 축별 마찰 항목(ID·심각도·근거·증상·해결 방향), 드리프트 표, **사이클 분할 제안**(사이클 번호·범위·산출물·확인 문장 1줄), 수용 기준 후보, 범위 밖. 이슈는 만들지 않습니다.

### 7. 기준 버전 갱신

```bash
node .omp/skills/harness-friction/scripts/friction.mjs baseline --set 18.18.6 --report docs/handoff/handoff_2026-11-13_omp-18-18-6-friction-audit.md
```

`baseline.json`의 현재 항목을 `history`로 옮기고 새 기준(`omp_version`·`audited_at`·`report`)을 씁니다. 보고서와 같은 커밋에 넣습니다. 다음 감사의 1단계가 이 값에서 시작합니다.

## Verification

```bash
node --test .omp/extensions/harness/tests/harness-friction.test.mjs
```

픽스처로 생존 검사(해석 안 되는 고정값 지적, 해석되는 고정값·롤 참조 비지적, 비채팅 kind, 릴리스 인용), 구간 계산, 기준 갱신, CLI를 확인합니다.

## 한계

- 릴리스 노트에 적히지 않은 변경은 잡지 못합니다. 렌더된 시스템 프롬프트 diff나 `harness-check --smoke` 같은 실행 기반 대조는 이 스킬 밖입니다(#31).
- 생존 검사는 카탈로그 존재만 봅니다. 로그인·쿼터·요청 거부는 실제 호출에서야 드러나므로 `rule://harness-adversarial_review`의 디스패치 전 프로브가 따로 필요합니다.
- 규칙 본문의 모델 id는 백틱으로 감싼 `provider/model` 형태만 봅니다. 산문 속 모델 이름("Argon", "opus")은 사람이 읽어야 합니다.
- 판정은 사람(에이전트)의 읽기에 기대므로 재현율은 읽은 사람의 축 이해에 달려 있습니다 — `references/harness-surface.md`가 그 축을 고정합니다.
