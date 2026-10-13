# Current Scope: backpressure-worktree-root-58-astra (P2 thread)

**Created**: 2026-10-13
**Seed**: docs/harness/seed.yaml (task_id 20261013-58-astra, v1)
**Thread-ID**: T-20261013042208-b30c
**Thread**: #58 astra: backpressure 기록을 대상 워크트리로 격리합니다.

## Acceptance Criteria
- [x] AC1 — "세션 A에서 bash(cwd=B)·cd B && 검증의 PASS/FAIL이 B에만 기록되고 A는 불변입니다. 실제 index.ts 핸들러 캡처로 검증합니다."
- [x] AC2 — "B의 편집은 B만 UNKNOWN으로 만듭니다. 링크드 워크트리도 별도 state dir을 사용하며 hook mode는 커밋 워크트리 상태만 읽습니다."
- [x] AC3 — "해석 불가 cwd·저장소 밖 cwd는 backpressure 상태를 쓰지 않으며 HARNESS_DEBUG에서 생략을 알립니다."
- [x] AC4 — "단일 워크트리 회귀가 없고 Linux suite skip 0 및 최종 docs-drift 0/0을 확인합니다. 이종 모델 reviewer 3-pass와 verifier 판정을 확보합니다."
- [x] AC5 — "#51 서브에이전트 격리·#45 service 라우팅·#57 verify-commands를 변경하지 않습니다. 운영 규칙 1단락과 astra dispatch 감사 기록을 남깁니다."

## Verification Evidence

- 최종 코드 diff `bf73a2bb80ccb9bd1e9dbc417285272504001a4f9b01b72411821f75776e6488`에서 `node --test .omp/extensions/harness/tests/backpressure-roots.test.mjs`는 16/16 PASS·skip 0이고 `node scripts/docs-drift`는 0 errors/0 warnings입니다.
- 전체 `node --test .omp/extensions/harness/tests/*.test.mjs`는 이전 diff `de8722174fb4fa7c935ee3ccc807d0d6a37ffcde7fb098ad203b7781ecdb5d86`에서 1회 실행해 761/761 PASS·skip 0입니다. 이후 리뷰·verifier 발견은 수정 경로만 집중 검증했으며 최종 해시에서 전체 suite를 재실행했다고 주장하지 않습니다.
- reviewer 라운드7은 이종 3-pass PASS WITH NOTES이며 `docs/reviews/review-2026-10-13-062357.json`이 최종 코드 diff에 결속됩니다. 실제 모델은 GPT-6 Astra / Claude Fable 5.1이며 fallback은 없습니다. 로컬 리뷰 산출물은 gitignored 상태로 유지합니다.
- `Verify58Final`은 같은 해시와 검증 전략에 대해 AC1~AC5 전부 PASS로 최종 판정했습니다. 새 OMP structured cwd 스모크와 실제 Bash·캡처 핸들러의 cd/개행/리터럴/주석 스모크도 통과했습니다.
