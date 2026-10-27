# Bugfix Protocol Checklist

- [ ] Add an API-level regression test (or equivalent verification artifact)
- [ ] Add a minimal reproduction test/case/step
- [ ] Make the smallest change that fixes the bug
- [ ] Verify green (fast gate first, then broader gate if needed)
- [ ] Refactor only after green (keep refactors obviously behavior-preserving)

Notes:

- Same exception list as `.omp/rules/harness-tdd_policy.md`: if test infrastructure does not exist, the fix is docs/policy-only, or the existing infrastructure cannot exercise the change at all (automation is not feasible), document a deterministic manual repro procedure instead — no approval needed. If test infrastructure exists and the fix is code logic, skipping the regression test needs the user's explicit approval (Exception Protocol) — the approval path wins over an infeasibility judgement.
- If the bug is quality/statistical/LLM/visual, prefer adding an eval case + harness run.




