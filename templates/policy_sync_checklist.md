# Policy Sync Checklist

Use this checklist whenever `AGENTS.md` changes, or when the Korean mirror is suspected stale.

Only one reference doc is synced: `claudedocs/CLAUDEKR.md` (Korean mirror of `AGENTS.md`).
`claudedocs/CLAUDE_original.md` is a **frozen snapshot** (`status: stale`, kept verbatim for history —
`rule://harness-doc_standards` R6): never edit its content or metadata.

## Content sync (same PR as the `AGENTS.md` change)

- [ ] Compare section headings between `AGENTS.md` and `claudedocs/CLAUDEKR.md`.
- [ ] Compare non-negotiables / MUST-level requirements for semantic parity.
- [ ] Compare linked module lists and ensure new/removed links are mirrored.
- [ ] Compare checklist and template references for additions/removals.
- [ ] Confirm any intentionally unsynced content is marked `STALE` with a short reason.
- [ ] Update `last_sync_date` in `claudedocs/CLAUDEKR.md`.

## Metadata re-stamp (follow-up commit that does not touch `AGENTS.md`)

`source_commit_hash` must equal `git log -1 --format=%H -- AGENTS.md`, i.e. the last commit that
touched `AGENTS.md`. A commit that edits `AGENTS.md` can never match its own hash, so the re-stamp
is a separate commit; `scripts/docs-drift` (run by `.githooks/pre-push`) FAILs a mirror whose hash
differs while it still says `status: synced` ("Reference doc claims synced but is stale").

- [ ] In the commit that changes `AGENTS.md`: either leave `source_commit_hash`/`status` untouched
      for the follow-up, or set `status: stale` if the mirror content is not updated yet.
- [ ] Follow-up commit (no `AGENTS.md` change), only once the mirror content is actually synced:
      set `source_commit_hash` to the hash above and `status: synced`. Push the `AGENTS.md` commit
      and this follow-up together — a lone push of the first commit fails `docs-drift` in `pre-push`
      unless the mirror says `status: stale`.

## Suggested verification commands

```bash
git log -1 --format=%H -- AGENTS.md
sed -n '1,8p' claudedocs/CLAUDEKR.md
git diff -- AGENTS.md claudedocs/CLAUDEKR.md
node scripts/docs-drift   # 0 errors; the pre-push hook runs the same check
```
