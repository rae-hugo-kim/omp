# Current Scope: selective-commit-probe-139

**Created**: 2026-11-19
**Seed**: docs/harness/seed.yaml (task_id 20261118-163330-139a, v1)
**Issue**: #139

## MUST
- `harness-version-check.mjs`가 세션 루트에서 `omp config get commit.enabled`를 읽어 `true`면 수정 방법이 든 `HARNESS SELECTIVE COMMIT ON`을 `HARNESS STALE`과 같은 경로·주기로 냅니다. `false`·`Unknown setting`·omp 부재·타임아웃은 침묵합니다.
- `init`·`migrate`가 소비 리포의 `.omp/config.yml`에 `commit.enabled: false`를 넣습니다(파일이 있으면 키만 추가).
- 통합 계약 `:61`이 "eval `commit` 경로는 설정으로 끈다"는 결정과 잔존면(다시 켠 체크아웃·`--config` 오버레이)을 적습니다.
- 프로브의 세 경우(`true`·`false`·키 없음)를 테스트로 더합니다.

## MUST NOT
- eval `commit` 경로로 전환하거나 eval 호출의 `no_verify`를 감시하지 않습니다.
- `.omp/config.yml`을 sync 화이트리스트에 넣거나 전역 설정을 쓰지 않습니다.
- 버전 범프·태그·force-push·머지를 하지 않습니다.

## Acceptance Criteria
- [x] AC1 — 켜진 사본에서 경고가 에이전트 컨텍스트에 실리고, 고치면 사라짐(중첩 `omp -p --no-session` 세션 실측 2026-11-18: 켜진 사본의 응답이 `HARNESS SELECTIVE COMMIT ON: … set `enabled: false` under the top-level `commit:` key … in `.omp/config.yml` …`, `commit.enabled: false`를 넣은 뒤 `NONE`; 게이트 직접 호출: 켜진 사본 경고 + exit 0(`FORCE_COLOR=1`에서도 — `--json` 판독), 끈 사본과 이 리포(`.omp/config.yml` off) 침묵, 판정 0.13초; `selective-commit-probe.test.mjs` 8건 — `value: true` 3경로 반복·마커 없음, 질문 형태·cwd, `false`·`Unknown setting`·부재·hung·비JSON/ANSI 침묵, 소스/소비 모두)
- [x] AC2 — `init/SKILL.md` Phase 4·`migrate/SKILL.md` Phase 5의 멱등 스니펫(키가 어느 표기로든 있거나 플로우 매핑이면 append하지 않고 안내, 아니면 `commit:` / `  enabled: false` append; 임시 디렉터리 실측 5경우: 파일 없음·블록 없는 파일(`statusLine.preset` 보존)·재실행 → `omp config get commit.enabled` `false`·`commit:` 1줄, `"commit":`·`{…}` → 손 수정 안내만)
- [x] AC3 — 통합 계약 `:61`이 결정(설정으로 끔, `init`/`migrate`/프로브)과 잔존면 2개(다시 켠 체크아웃 — 경고는 advisory, `--config` 오버레이)를 적고 `:69` 게이트 목록에 프로브가 있음; `node scripts/docs-drift` → `0 errors`(closeout 전 경고 1건은 "closeout pending")
- [x] AC4 — `node --test .omp/extensions/harness/tests/*.test.mjs` → 828 pass / 0 fail(820 기존 + 새 8건); `harness-version-check.test.mjs` 40건·`omp-version-probe.test.mjs` 11건 그대로 통과(verifier 재실측; 실패하는 omp 스텁을 PATH 앞에 둬 호스트 omp를 읽지 않음 — POSIX `sh` 스텁, win32는 node.exe 하드링크/복사, PATH 키 표기 통일)
