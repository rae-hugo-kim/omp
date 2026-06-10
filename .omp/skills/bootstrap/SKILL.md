---
name: bootstrap
argument-hint: [--skip-optional]
description: Bootstrap development environment with OMC discovery, MCP servers, and docs tooling
---

# Bootstrap - Development Environment Setup

## Goal

이 하네스 템플릿을 사용하기 위한 개발 환경을 구축한다.
기존 OMC 설치 확인(OMP가 자동 발견), OMP MCP 설정에 범용 MCP 서버 등록,
선택적 MCP 서버 안내, docs viewer 빌드 도구(mdBook + Mermaid)까지 한 번에 처리.

## Non-Negotiables

| Rule | Violation = STOP |
|------|------------------|
| **npm/npx 필수** | Node.js 없으면 안내 후 중단 |
| **기존 설정 덮어쓰지 않음** | 이미 등록된 MCP 서버는 스킵 |

## Inputs

- `$ARGUMENTS` — 사용자 인자(`User: <args>` 형태로 덧붙어 전달됨):
  - (없음) → 전체 플로우 실행
  - `"--skip-optional"` → 선택적 MCP 서버 질문 생략

## Workflow

### Phase 0: Preflight

```
1. node --version, npm --version 확인 → 실패 시 "Node.js를 설치하세요" 안내 후 중단
2. 현재 설치 상태 수집:
   - which omc → OMC 설치 여부
   - OMP MCP 설정의 등록된 서버 목록 (`omp://mcp-config.md`를 먼저 `read`로 확인)
```

### Phase 1: OMC 확인 (자동)

OMP는 `~/.claude` 사용자 디렉터리에 설치된 기존 OMC(스킬 + 에이전트)를 자동
발견한다 (priority 80으로 디스커버리). 별도 등록 작업이 필요 없다.

```
1. omc가 이미 설치되어 있으면 → "✓ OMC found — OMP discovers ~/.claude skills/agents automatically" 출력, 스킵
2. 미설치 시 (선택):
   npm install -g oh-my-claudecode
   omc setup
```

> **주의**: OMC의 hook 자동화(매직 키워드, system-reminder 주입, RTK 명령
> 재작성)는 OMP에서 동작하지 않는다. OMC 에이전트는 OMP의 `task` 도구로
> 호출하고, 스킬은 `/skill:<name>` 또는 자연어로 사용한다.

실패 시: 에러 메시지 그대로 출력, 수동 설치 안내 후 다음 단계로 진행.

### Phase 2: Docs Build Tools (자동)

`scripts/docs-build.sh`와 `mdbook serve`가 의존하는 도구. 템플릿 fresh-clone
에서 docs viewer 즉시 동작을 위해 설치.

```
1. mdbook 체크:
   - command -v mdbook → 있으면 "✓ mdbook already installed" 스킵
   - 미설치 시: cargo install mdbook
   - cargo 없으면 → "Rust/Cargo를 설치하세요: https://rustup.rs" 안내, 스킵

2. mdbook-mermaid 체크:
   - command -v mdbook-mermaid → 있으면 스킵
   - 미설치 시: cargo install mdbook-mermaid

3. mmdc (mermaid-cli) 체크:
   - command -v mmdc → 있으면 스킵
   - 미설치 시: npm install -g @mermaid-js/mermaid-cli
```

셋 모두 선택적 — 설치 실패해도 중단하지 않고 계속 진행. docs viewer를
나중에 사용하지 않을 프로젝트는 그대로 두고 넘어가도 됨.

### Phase 3: 범용 MCP 서버 등록 (자동)

MCP 서버는 OMP 자체 MCP 설정에 등록한다 (`~/.claude.json` 아님).
**진행 전에 `omp://mcp-config.md` 문서를 `read`로 읽고** 정확한 설정 파일
위치와 형식을 확인한다 — 형식을 추측해서 쓰지 말 것.

이미 등록된 서버는 스킵. 미등록 서버만 추가:

- **context7** — 라이브러리/프레임워크 공식 문서 조회: `npx -y @upstash/context7-mcp@latest`
- **serena** — 시맨틱 코드 탐색/리팩토링: `uvx --from "git+https://github.com/oraios/serena" serena start-mcp-server`
- **exa** — AI 웹 검색 (HTTP transport): `https://mcp.exa.ai/mcp`
- **browser-tools-mcp** — 브라우저 콘솔/네트워크/스크린샷: `npx -y @agentdeskai/browser-tools-mcp@1.2.0`

각 서버 등록 후 성공/실패 표시.

### Phase 4: 선택적 MCP 서버 (인터랙티브)

`--skip-optional` 이면 이 단계 스킵.

`ask` 도구로 선택지 제시:

```
추가로 설치할 MCP 서버를 선택하세요 (쉼표로 구분, 엔터로 스킵):

1. supabase — Supabase DB/Edge Functions 관리
2. react-design-systems — React 컴포넌트 디자인 시스템 조회
3. pixelmaker — 픽셀 아트 생성/추출

예: 1,2 또는 all 또는 엔터(스킵)
```

선택된 서버를 OMP MCP 설정에 추가 (`omp://mcp-config.md` 형식 준수):

- **supabase** (SUPABASE_ACCESS_TOKEN 필요): `npx -y @supabase/mcp-server-supabase@latest`
  → 토큰이 없으면 https://supabase.com/dashboard/account/tokens 안내
- **react-design-systems** (로컬 서버 필요): `ask` 도구로 서버 URL을 입력받아 SSE transport로 등록
- **pixelmaker** (로컬 Python 패키지 필요): 설치 경로 안내만 제공

### Phase 5: 결과 리포트

```markdown
## Bootstrap Complete

### Installed
- ✓ OMC vX.Y.Z (또는 — not installed)
- ✓ mdbook / mdbook-mermaid / mmdc (또는 ✗ skipped)

### MCP Servers
| Server | Status |
|--------|--------|
| context7 | ✓ registered |
| serena | ✓ registered |
| exa | ✓ registered |
| browser-tools-mcp | ✓ registered |
| supabase | ✓ registered (또는 — skipped) |
| ... | ... |

### Next Steps
1. OMP 세션을 재시작하면 MCP 서버가 활성화됩니다
2. `/init <project-name>`(OMP: `/skill:init`) — 새 프로젝트 생성
3. `/kickoff` — 프로젝트 스코프 정의
```

## Error Handling

| Condition | Action |
|-----------|--------|
| Node.js 미설치 | 안내 후 중단 |
| Cargo 미설치 | docs 빌드 도구(mdbook, mdbook-mermaid) 스킵, 경고 출력 후 계속 |
| MCP 서버 등록 실패 | 해당 서버만 실패 표시, 계속 진행 |
| 네트워크 오류 | 재시도 안내, 수동 명령어 제시 |
| 이미 설치된 항목 | 스킵, 현재 버전 표시 |
