# Bugfix Protocol Checklist

- [ ] Add an API-level regression test (or equivalent verification artifact)
- [ ] Add a minimal reproduction test/case/step
- [ ] Make the smallest change that fixes the bug
- [ ] Verify green (fast gate first, then broader gate if needed)
- [ ] Refactor only after green (keep refactors obviously behavior-preserving)

Notes:

- If test infrastructure does not exist (or automation is not feasible), document a deterministic manual repro procedure instead — no approval needed. If test infrastructure exists, skipping the regression test needs the user's explicit approval (`.omp/rules/harness-tdd_policy.md` Exception Protocol).
- If the bug is quality/statistical/LLM/visual, prefer adding an eval case + harness run.




