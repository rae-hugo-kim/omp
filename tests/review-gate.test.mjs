// Integration tests for review-gate.mjs (PreToolUse: Bash, git commit).
//
// Run: node --test tests/review-gate.test.mjs
//
// Focus: audit P3 review-gate cleanup —
//   (1) diff-hash matching is now a BARE-hash search across ALL of today's
//       reviews, not `content.includes('diff-hash: ' + hash)` on the single
//       lexicographically-last doc. This fixes (a) multiple PRs the same day
//       shadowing each other (the wrong doc was picked by sort().pop()) and
//       (b) non-standard label formats like "diff-hash (initial review): <h>".
//   (2) a FAIL verdict blocks only when it covers the CURRENT diff (precise),
//       instead of whichever doc sorted last.
//   (3) the dead `shell: true` option on execSync was removed (execSync always
//       shells); these tests fail if hash computation broke.
//
// Spawn-based with an EXPLICIT cwd throwaway git repo (memory:
// feedback_shell_test_cwd_isolation). Risk level is driven by the staged files.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, chmodSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', '.omp', 'extensions', 'harness', 'gates', 'review-gate.mjs');
// Match the gate's LOCAL-date naming (it no longer uses UTC), so doc names line up
// with the gate's `today` even when run near the UTC day boundary.
const _now = new Date();
const TODAY = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

const HIGH = { 'src/big.ts': 'export const x = 1;\n'.repeat(120) }; // code, >100 lines -> high
const LOW = { 'docs/notes.md': '# notes\nprose\n' };               // prose doc -> low
const MED = { 'src/small.ts': 'export const x = 1;\n'.repeat(20) };  // code, <100 lines -> medium
// Heterogeneity evidence the gate now requires for a HIGH/CRITICAL covering review (continuous
// cross-review policy). A real reviewer doc carries a measured `models:` line (>=2 families)
// after the transcript-verified adversary pass — the ONLY het evidence form the gate accepts.
const HET = 'models: claude, codex\n';

function makeRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'rv-gate-'));
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  };
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Test']);
  for (const [rel, content] of Object.entries(files)) {
    const fp = join(dir, rel);
    mkdirSync(dirname(fp), { recursive: true });
    writeFileSync(fp, content);
  }
  git(['add', '-A']); // stage so assessRisk + the gate hash see them
  return dir;
}

// The same hash the gate computes from the staged diff.
function stagedHash(dir) {
  return execSync('git diff --cached | shasum -a 256', { cwd: dir, encoding: 'utf-8' }).trim().split(/\s+/)[0];
}

// Write an (untracked) review doc so it does not perturb the staged diff.
function writeReview(dir, name, content) {
  const rd = join(dir, 'docs', 'reviews');
  mkdirSync(rd, { recursive: true });
  writeFileSync(join(rd, name), content);
}

function runGate(dir, command = 'git commit -m x') {
  return spawnSync('node', [GATE], {
    input: JSON.stringify({ tool_input: { command }, session_state: { cwd: dir } }),
    cwd: dir,
    encoding: 'utf-8',
  });
}

function withRepo(files, fn) {
  const dir = makeRepo(files);
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

// --- baseline behaviour (regression guards) ---

test('high risk + no review doc -> BLOCK (exit 2)', () => {
  withRepo(HIGH, (dir) => {
    assert.equal(runGate(dir).status, 2);
  });
});

test('low risk -> allow without any review (exit 0)', () => {
  withRepo(LOW, (dir) => {
    assert.equal(runGate(dir).status, 0);
  });
});

// --- (1) bare-hash matching ---

test('high risk + matching review (standard "diff-hash:" label) -> allow', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\n${HET}Verdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

test('high risk + matching review with non-standard label still matches (bare hash)', () => {
  withRepo(HIGH, (dir) => {
    // The old `includes('diff-hash: ' + hash)` rejected this real-world format.
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash (initial review): ${stagedHash(dir)}\n${HET}Verdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

test('high risk + matching doc is NOT the lexicographically-last of several today -> allow', () => {
  withRepo(HIGH, (dir) => {
    // Matching doc sorts FIRST; an unrelated doc sorts LAST. The old sort().pop()
    // picked the unrelated last doc (no hash) and blocked.
    writeReview(dir, `review-${TODAY}-aaa-match.md`, `diff-hash: ${stagedHash(dir)}\n${HET}Verdict: PASS\n`);
    writeReview(dir, `review-${TODAY}-zzz-other.md`, `diff-hash: ${'0'.repeat(64)}\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

// --- (2) FAIL is scoped to the review that covers the current diff ---

test('high risk + matching review marked FAIL -> BLOCK (exit 2)', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nVerdict: FAIL\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('high risk + FAIL in a NON-matching doc, PASS in the matching doc -> allow', () => {
  withRepo(HIGH, (dir) => {
    // A stale FAIL for a different diff must not block the corrected commit.
    writeReview(dir, `review-${TODAY}-old-fail.md`, `diff-hash: ${'0'.repeat(64)}\nVerdict: FAIL\n`);
    writeReview(dir, `review-${TODAY}-current.md`, `diff-hash: ${stagedHash(dir)}\n${HET}Verdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

test('high risk + a today review exists but none matches the current diff -> BLOCK', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-unrelated.md`, `diff-hash: ${'0'.repeat(64)}\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

// --- anchored matcher: the hash must be in a diff-hash FIELD, not just prose ---

test('high risk + current hash only in prose (no diff-hash field) -> BLOCK', () => {
  withRepo(HIGH, (dir) => {
    const h = stagedHash(dir);
    // A different PASS review that merely mentions the hash in body text must NOT
    // count as covering this diff.
    writeReview(dir, `review-${TODAY}-prose.md`, `We looked at commit ${h} in passing.\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('high risk + hash under a DIFFERENT field ("previous-diff-hash:") -> BLOCK', () => {
  withRepo(HIGH, (dir) => {
    // The field must begin the line; "previous-diff-hash:" must not count.
    writeReview(dir, `review-${TODAY}-prev.md`, `previous-diff-hash: ${stagedHash(dir)}\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('high risk + "diff-hash:" mid-sentence (not line-start) -> BLOCK', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-mid.md`, `Earlier we wrote diff-hash: ${stagedHash(dir)} but it changed.\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('high risk + matching review with Markdown prefix + CRLF line ending -> allow', () => {
  withRepo(HIGH, (dir) => {
    // Locks the accepted formats the matcher must keep: list/bold markers and CRLF.
    writeReview(dir, `review-${TODAY}-md.md`, `- **diff-hash: ${stagedHash(dir)}**\r\n${HET}Verdict: PASS\r\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

test('high risk + hash on the line AFTER "diff-hash:" -> BLOCK (must be same line)', () => {
  withRepo(HIGH, (dir) => {
    // The hash must follow the field on the same line; a line break in between
    // does not count as coverage.
    writeReview(dir, `review-${TODAY}-split.md`, `diff-hash:\n${stagedHash(dir)}\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

// --- fail-closed: hash cannot be computed (e.g. shasum missing) ---

test('high risk + diff hash uncomputable -> BLOCK (fail-closed)', () => {
  withRepo(HIGH, (dir) => {
    // A today review exists, but with shasum stubbed to fail the gate cannot
    // verify coverage -> unverified -> high/critical must fail closed.
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${'0'.repeat(64)}\nVerdict: PASS\n`);
    const binDir = mkdtempSync(join(tmpdir(), 'rv-nobin-'));
    writeFileSync(join(binDir, 'shasum'), '#!/bin/sh\nexit 127\n');
    chmodSync(join(binDir, 'shasum'), 0o755);
    try {
      const r = spawnSync('node', [GATE], {
        input: JSON.stringify({ tool_input: { command: 'git commit -m x' }, session_state: { cwd: dir } }),
        cwd: dir,
        encoding: 'utf-8',
        env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
      });
      assert.equal(r.status, 2);
    } finally {
      rmSync(binDir, { recursive: true, force: true });
    }
  });
});

// --- effective-content hashing: the hash must cover what the commit CAPTURES ---
// Closes the gap where `git commit -a` / a pathspec commit pulled in tracked
// changes the staged-diff hash never saw, letting a stale PASS review match.
// These repos carry an INITIAL COMMIT so the -a/pathspec forms' `git diff HEAD`
// has a base (cf. feedback_shell_test_cwd_isolation: explicit cwd, throwaway repo).

const BIG = 'export const x = 1;\n'.repeat(130);   // >100 lines of code -> high risk

function committedRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'rv-eff-'));
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  };
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Test']);
  for (const rel of ['src/big.ts', 'src/extra.ts']) {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, rel), 'init\n');
  }
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'init']);
  return { dir, git };
}

// Hash exactly as the gate/reviewer do, for an arbitrary diff selector.
const diffHash = (dir, sel) =>
  execSync(`git diff ${sel} | shasum -a 256`, { cwd: dir, encoding: 'utf-8' }).trim().split(/\s+/)[0];

function withCommitted(fn) {
  const { dir, git } = committedRepo();
  try { return fn(dir, git); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('git commit -a + unreviewed UNSTAGED change -> BLOCK (the core gap)', () => {
  withCommitted((dir, git) => {
    writeFileSync(join(dir, 'src/big.ts'), BIG);           // staged change A (reviewed)
    git(['add', 'src/big.ts']);
    writeReview(dir, `review-${TODAY}-a.md`, `diff-hash: ${diffHash(dir, '--cached')}\nVerdict: PASS\n`);
    writeFileSync(join(dir, 'src/extra.ts'), 'leak\n');    // change B: tracked, UNSTAGED, unreviewed
    // -a stages B at commit time -> effective diff (git diff HEAD) != reviewed --cached hash.
    assert.equal(runGate(dir, 'git commit -am x').status, 2);
  });
});

test('plain git commit in the SAME state -> allow (commits only the reviewed staged diff)', () => {
  withCommitted((dir, git) => {
    writeFileSync(join(dir, 'src/big.ts'), BIG);
    git(['add', 'src/big.ts']);
    writeReview(dir, `review-${TODAY}-b.md`, `diff-hash: ${diffHash(dir, '--cached')}\n${HET}Verdict: PASS\n`);
    writeFileSync(join(dir, 'src/extra.ts'), 'leak\n');    // unstaged: a plain commit ignores it
    assert.equal(runGate(dir, 'git commit -m x').status, 0);
  });
});

test('git commit -a with everything staged (nothing extra unstaged) -> allow', () => {
  withCommitted((dir, git) => {
    writeFileSync(join(dir, 'src/big.ts'), BIG);
    git(['add', 'src/big.ts']);
    // No unstaged tracked change, so git diff HEAD == git diff --cached == reviewed hash.
    writeReview(dir, `review-${TODAY}-c.md`, `diff-hash: ${diffHash(dir, '--cached')}\n${HET}Verdict: PASS\n`);
    assert.equal(runGate(dir, 'git commit -am x').status, 0);
  });
});

test('pathspec commit -> fail-closed BLOCK (unverifiable form)', () => {
  withCommitted((dir, git) => {
    writeFileSync(join(dir, 'src/big.ts'), BIG);           // staged + reviewed
    git(['add', 'src/big.ts']);
    writeReview(dir, `review-${TODAY}-d.md`, `diff-hash: ${diffHash(dir, '--cached')}\nVerdict: PASS\n`);
    writeFileSync(join(dir, 'src/extra.ts'), 'leak\n');    // unstaged, unreviewed
    // A pathspec commit's content is cwd-relative + shell-fragile, so the form is
    // unverifiable -> the staged-hash review cannot vouch for it -> fail closed.
    assert.equal(runGate(dir, 'git commit -m x src/extra.ts').status, 2);
  });
});

test('--amend -> fail-closed BLOCK even when a review matches the staged hash', () => {
  withCommitted((dir, git) => {
    writeFileSync(join(dir, 'src/big.ts'), BIG);
    git(['add', 'src/big.ts']);
    writeReview(dir, `review-${TODAY}-e.md`, `diff-hash: ${diffHash(dir, '--cached')}\nVerdict: PASS\n`);
    // amend rewrites the prior commit; its effective content can't be statically
    // hashed, so the form is unverifiable -> high risk fails closed.
    assert.equal(runGate(dir, 'git commit --amend -m x').status, 2);
  });
});

test('output-capture redirection `git commit … 2>&1` -> BLOCK with a standalone hint (agent footgun)', () => {
  withCommitted((dir, git) => {
    writeFileSync(join(dir, 'src/big.ts'), BIG);
    git(['add', 'src/big.ts']);
    // staged diff IS reviewed (matching hash) ...
    writeReview(dir, `review-${TODAY}-f.md`, `diff-hash: ${diffHash(dir, '--cached')}\nVerdict: PASS\n`);
    // ... but appending `2>&1` to capture output makes the form unverifiable: an
    // &-bearing redirection segment-splits the line, so the staged-hash review cannot
    // vouch for it -> fail closed. The message must point at the standalone-commit fix.
    const r = runGate(dir, 'git commit -m x 2>&1');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /unverifiable|standalone/i);
  });
});

test('option-abbreviation --inc (=--include) smuggling the index -> BLOCK', () => {
  withCommitted((dir, git) => {
    writeFileSync(join(dir, 'src/big.ts'), BIG);           // staged + reviewed
    git(['add', 'src/big.ts']);
    writeReview(dir, `review-${TODAY}-f.md`, `diff-hash: ${diffHash(dir, '--cached')}\nVerdict: PASS\n`);
    writeFileSync(join(dir, 'src/extra.ts'), 'leak\n');    // unstaged, unreviewed
    // `--inc` is git's abbreviation of `--include`, which commits the whole index
    // (big.ts + extra.ts). Exact-string matching would have classified it plain and
    // hashed only --cached -> fail OPEN. Prefix matching keeps it unverifiable -> BLOCK.
    assert.equal(runGate(dir, 'git commit --inc src/extra.ts -m x').status, 2);
  });
});

test('self-commit heredoc form (git commit -F - <<MSG) is NOT mis-read as a pathspec -> allow', () => {
  withCommitted((dir, git) => {
    // Regression guard: the repo commits via `git commit -F - <<'MSG' … MSG`. The
    // `<<MSG` heredoc operator must be dropped, not hashed as `git diff HEAD -- '<<MSG'`
    // (which would empty the diff and wrongly BLOCK every reviewed self-commit).
    writeFileSync(join(dir, 'src/big.ts'), BIG);
    git(['add', 'src/big.ts']);
    writeReview(dir, `review-${TODAY}-g.md`, `diff-hash: ${diffHash(dir, '--cached')}\n${HET}Verdict: PASS\n`);
    assert.equal(runGate(dir, "git commit -F - <<'MSG'\ncommit body\nMSG").status, 0);
  });
});

// --- heterogeneity enforcement (continuous cross-review policy) ---

test('high risk + matching review but NO heterogeneity evidence -> BLOCK', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('high risk + matching review with models: >=2 families -> allow', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: claude, codex\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

test('high risk + models: with a SINGLE entry -> BLOCK (needs >=2)', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: claude\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('medium risk + matching review without het -> allow (het enforced only for high/critical)', () => {
  withRepo(MED, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

// Thread/session id fields are NO LONGER evidence (codex CLI fallback removed): an id proves a
// run happened, not that a SECOND family reviewed the diff. The only het evidence is a measured
// `models:` line (>=2 distinct families). Regression guards below pin the removal — every
// combination the old thread path accepted now BLOCKS.

test('het regression: codex-thread + different-family primary-model -> BLOCK (thread path removed)', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\ncodex-thread: 019eda4f-64ee-7db3-9dcb-dafdd4e54aae\nprimary-model: anthropic/claude-fable-5\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('het regression: adversary-thread + explicit different-family adversary-model -> BLOCK', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nadversary-thread: 019eda4f-64ee-7db3-9dcb-dafdd4e54aae\nprimary-model: anthropic/claude-fable-5\nadversary-model: gpt-5.4\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('het regression: every thread/session key + full model fields -> BLOCK', () => {
  for (const key of ['codex-thread', 'codex-session', 'adversary-thread', 'adversary-session']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\n${key}: 019eda4f64ee7db3\nprimary-model: gpt-5.4\nadversary-model: gemini-2.5-pro\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 2, `should block: ${key}`);
    });
  }
});

test('het regression: a thread field does not poison a doc that ALSO carries measured models: -> allow', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\ncodex-thread: 019eda4f-64ee-7db3-9dcb-dafdd4e54aae\nmodels: claude, gpt-5\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

test('het: single provider/model or same-family models do NOT count (fail-open fix)', () => {
  for (const m of ['anthropic/claude-opus-4', 'claude+sonnet', 'claude, claude', 'claude, <!-- codex skipped -->']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: ${m}\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 2, `should block: models: ${m}`);
    });
  }
});

test('het: markdown-bold / tab-separated models ARE accepted (fail-closed fix)', () => {
  for (const line of ['- **models:** claude, codex', 'models:\tclaude, codex', 'models: claude & codex']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\n${line}\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 0, `should allow: ${line}`);
    });
  }
});

test('het: noise/unknown tokens do NOT inflate the family count (fail-open fix)', () => {
  for (const m of ['claude only', 'claude, .', 'foo, bar', 'claude - not run']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: ${m}\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 2, `should block: models: ${m}`);
    });
  }
});

test('het: a non-`models` key like `modelsX:` does NOT satisfy the field', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodelsX: claude, codex\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('het: compact `models: claude/codex` (slash) counts as two families', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: claude/codex\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

test('het v3: substring noise tokens are NOT models (octopus/bardic/gptscript)', () => {
  for (const m of ['codex, octopus', 'claude, bardic', 'gptscript, claude']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: ${m}\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 2, `should block: models: ${m}`);
    });
  }
});

test('het v3: a negated/skipped second model does NOT count', () => {
  for (const m of ['claude, no codex', 'claude, codex skipped']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: ${m}\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 2, `should block: models: ${m}`);
    });
  }
});

test('het v3: codex folds into gpt family (codex, gpt-5 = ONE) -> block; claude, gpt-5 = two -> allow', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: codex, gpt-5\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: claude, gpt-5\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

test('het v3: codex-flagged substring spoofs (allama/ogpt/codexical) are rejected', () => {
  for (const m of ['allama, ogpt', 'codexical, claude', 'claude, ogpt']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: ${m}\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 2, `should block: models: ${m}`);
    });
  }
});

test('het v3: negated/quoted-noise model fields do not pass', () => {
  for (const m of ['not claude codex', '"unavailable" claude codex', '(unavailable) claude codex']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: ${m}\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 2, `should block: models: ${m}`);
    });
  }
});

// --- het v4: sole-path hardening (models: is the only automatic evidence after thread removal) ---

test('het v4: a `models-*` variant key (models-not-run:) is NOT the models field -> BLOCK', () => {
  for (const key of ['models-not-run', 'models-attempted', 'models-skipped']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\n${key}: claude, gpt\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 2, `should block: ${key}: claude, gpt`);
    });
  }
});

test('het v4: negation pseudo-versions (claude-unavailable, codex-skipped) are NOT models -> BLOCK', () => {
  for (const m of ['claude-unavailable, codex-skipped', 'gpt-skipped, claude-not-run', 'claude, codex-unavailable']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: ${m}\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 2, `should block: models: ${m}`);
    });
  }
});

test('het v4: real digit-bearing version suffixes still map (claude-opus-4-8, gpt-5.6-sol) -> allow', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: claude-opus-4-8, gpt-5.6-sol\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

test('het v4: a models: line inside a Markdown code fence is a quoted example, not evidence -> BLOCK', () => {
  for (const fence of ['```', '````', '~~~']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-x.md`,
        `diff-hash: ${stagedHash(dir)}\n${fence}markdown\nmodels: claude, gpt\n${fence}\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 2, `should block: models: fenced with ${fence}`);
    });
  }
});

test('het v4: an UNTERMINATED fence swallows the rest of the doc (fail-closed) -> BLOCK', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\n\`\`\`\nmodels: claude, gpt\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('het v4: a real models: line AFTER a properly closed fence still counts -> allow', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`,
      `diff-hash: ${stagedHash(dir)}\n\`\`\`\nmodels: fenced, example\n\`\`\`\nmodels: claude, gpt\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

// --- het v5: second-round hardening (digit-bearing negations, sanitized coverage, comment/fence edges) ---

test('het v5: negation pseudo-versions survive digits (gpt-not-run-2 etc.) -> BLOCK', () => {
  for (const m of ['claude-4, gpt-not-run-2', 'claude, codex-unavailable-2', 'gpt-5.6-skipped, claude', 'claude-unavailable-5, gpt']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: ${m}\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 2, `should block: models: ${m}`);
    });
  }
});

test('het v5: malformed tokens (empty segments) are not models -> BLOCK', () => {
  for (const m of ['claude...4, gpt--5', 'claude-, gpt-5']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: ${m}\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 2, `should block: models: ${m}`);
    });
  }
});

test('het v5: real variant/codename aliases map (o3-mini, deepseek-r1, claude-3-5-sonnet) -> allow', () => {
  for (const m of ['claude, o3-mini', 'deepseek-r1, claude-3-5-sonnet', 'gemini-2.5-pro, gpt-4-turbo-preview']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-x.md`, `diff-hash: ${stagedHash(dir)}\nmodels: ${m}\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 0, `should allow: models: ${m}`);
    });
  }
});

test('coverage v5: a diff-hash line inside a code fence is a quotation, not coverage -> BLOCK', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`,
      `\`\`\`\ndiff-hash: ${stagedHash(dir)}\n\`\`\`\nmodels: claude, gpt\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('coverage v5: evidence wrapped in a MULTI-LINE HTML comment is invisible -> BLOCK', () => {
  // Rendered Markdown shows an empty doc; the gate must agree (het AND human paths).
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`,
      `<!--\ndiff-hash: ${stagedHash(dir)}\nmodels: claude, gpt\nhuman-reviewed-by: donghyun\nVerdict: PASS\n-->\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('coverage v5: commented-out models:/human fields do not count even when the hash line is live -> BLOCK', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`,
      `diff-hash: ${stagedHash(dir)}\n<!--\nmodels: claude, gpt\nhuman-reviewed-by: donghyun\nVerdict: PASS\n-->\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('het v5: a fence line with trailing text does NOT close the fence (CommonMark) -> BLOCK', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`,
      `diff-hash: ${stagedHash(dir)}\n\`\`\`md\n\`\`\`not-a-close\nmodels: claude, gpt\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('coverage v5: `diff-hash-<suffix>:` variant keys do not cover; a parenthesized qualifier does', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash-not-reviewed: ${stagedHash(dir)}\nmodels: claude, gpt\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`, `diff-hash (initial review): ${stagedHash(dir)}\nmodels: claude, gpt\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

test('fail-detect v5: a fenced `Verdict: FAIL` example does not veto a real PASS review -> allow', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`,
      `diff-hash: ${stagedHash(dir)}\nmodels: claude, gpt\n\`\`\`\nVerdict: FAIL\n\`\`\`\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

// --- sanitizer v6: 3rd-round review reproductions (fence state must be tracked FIRST) ---
// Both attacks render as ONE code block containing the quoted evidence; the gate must agree.

test('sanitizer v6: inline comment inside a fence must NOT fuse into a premature close -> BLOCK', () => {
  // CommonMark: `<!--x-->` inside a fence is literal text. Stripping comments before fence
  // tracking fused "`<!--x-->``" into "```", closing the fence and leaking the quoted
  // diff-hash/models/Verdict lines below as live evidence (3rd-round review, confirmed #1).
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`,
      `\`\`\`\n\`<!--x-->\`\`\ndiff-hash: ${stagedHash(dir)}\nmodels: claude, gpt\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('sanitizer v6: a TAB-indented ``` is fence content, not a close (CommonMark 3-column limit) -> BLOCK', () => {
  // A tab advances to column 4, past the 3-column fence-indent limit, so "\t```" inside an
  // open fence is content — the old /^[ \t]{0,3}/ accepted it as a close and leaked the
  // quoted evidence below (3rd-round review, confirmed #2).
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`,
      `\`\`\`\n\t\`\`\`\ndiff-hash: ${stagedHash(dir)}\nmodels: claude, gpt\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 2);
  });
  // Guard the fail-closed direction too: a close indented <=3 SPACES is still a real close.
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-x.md`,
      `\`\`\`\nquoted example\n   \`\`\`\ndiff-hash: ${stagedHash(dir)}\nmodels: claude, gpt\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

// --- path (2): human review (verification axis) ---------------------------------
// A single-model deployment cannot honestly produce het evidence; the gate instead
// accepts a covering TODAY review with `human-reviewed-by:` (a real identity, not a
// model name) plus a Verdict on the PASS whitelist (PASS / PASS WITH NOTES).

function humanDoc(hash, extra = '') {
  return `diff-hash: ${hash}\nhuman-reviewed-by: donghyun\n${extra}Verdict: PASS\n`;
}

test('human review: covering doc with human-reviewed-by + Verdict -> allow', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-h.md`, humanDoc(stagedHash(dir)));
    assert.equal(runGate(dir).status, 0);
  });
});

test('human review: multi-word identity is accepted', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-h.md`, `diff-hash: ${stagedHash(dir)}\nhuman-reviewed-by: Kim Donghyun\nVerdict: PASS\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

test('human review: identity that is a bare MODEL name does not count (spoof guard)', () => {
  for (const who of ['claude', 'gpt-5', 'openai/codex', 'o3-mini', 'deepseek-r1']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-h.md`, `diff-hash: ${stagedHash(dir)}\nhuman-reviewed-by: ${who}\nVerdict: PASS\n`);
      assert.equal(runGate(dir).status, 2, `should block: human-reviewed-by: ${who}`);
    });
  }
});

test('human review: missing Verdict line -> BLOCK (evidence incomplete)', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-h.md`, `diff-hash: ${stagedHash(dir)}\nhuman-reviewed-by: donghyun\nlooks fine to me\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('human review: Verdict FAIL still blocks (verification axis honors the verdict)', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-h.md`, `diff-hash: ${stagedHash(dir)}\nhuman-reviewed-by: donghyun\nVerdict: FAIL\n`);
    const r = runGate(dir);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /FAIL/);
  });
});

test('human review: Verdict PASS WITH NOTES is on the whitelist -> allow', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-h.md`, `diff-hash: ${stagedHash(dir)}\nhuman-reviewed-by: donghyun\nVerdict: PASS WITH NOTES\n`);
    assert.equal(runGate(dir).status, 0);
  });
});

test('human review: empty/pending/unknown verdicts do NOT count -> BLOCK (fail-open fix)', () => {
  for (const v of ['', ' PENDING', ' NEEDS REVIEW', ' maybe fine', ' PASSABLE']) {
    withRepo(HIGH, (dir) => {
      writeReview(dir, `review-${TODAY}-h.md`, `diff-hash: ${stagedHash(dir)}\nhuman-reviewed-by: donghyun\nVerdict:${v}\n`);
      assert.equal(runGate(dir).status, 2, `should block: Verdict:${v}`);
    });
  }
});

test('human review: fenced human-reviewed-by/Verdict lines are quoted examples, not evidence -> BLOCK', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-h.md`,
      `diff-hash: ${stagedHash(dir)}\n\`\`\`\nhuman-reviewed-by: donghyun\nVerdict: PASS\n\`\`\`\n`);
    assert.equal(runGate(dir).status, 2);
  });
});

test('human review: diff-hash mismatch -> BLOCK, message teaches path 2/3 with the REAL hash', () => {
  withRepo(HIGH, (dir) => {
    writeReview(dir, `review-${TODAY}-h.md`, humanDoc('0'.repeat(64)));
    const r = runGate(dir);
    assert.equal(r.status, 2);
    const hash = stagedHash(dir);
    assert.ok(r.stderr.includes(hash), 'block message must carry the actual effective diff hash to copy');
    assert.match(r.stderr, /human-reviewed-by/, 'message must teach the human-review field');
    assert.match(r.stderr, /approved-by/, 'message must teach the override field');
    assert.ok(r.stderr.includes(`review-${TODAY}-`), 'message must show the today filename to create');
  });
});

// --- path (3): audited override (approval axis) ----------------------------------
// docs/harness/review-skip is no longer a bare bypass: it must carry
// reason / approved-by / diff-hash, is bound to THIS commit's hash, is recorded to
// docs/harness/audit.jsonl as a `review_override` event, and is consumed on success.

function writeSkip(dir, content) {
  const hd = join(dir, 'docs', 'harness');
  mkdirSync(hd, { recursive: true });
  writeFileSync(join(hd, 'review-skip'), content);
}

const skipPath = (dir) => join(dir, 'docs', 'harness', 'review-skip');
const auditPath = (dir) => join(dir, 'docs', 'harness', 'audit.jsonl');

test('override: reason + approved-by + matching diff-hash -> allow, audited, consumed', () => {
  withRepo(HIGH, (dir) => {
    const hash = stagedHash(dir);
    writeSkip(dir, `reason: adversary model unavailable, hotfix needed\napproved-by: donghyun\ndiff-hash: ${hash}\n`);
    const r = runGate(dir);
    assert.equal(r.status, 0);
    assert.equal(existsSync(skipPath(dir)), false, 'a valid override is consumed');
    const events = readFileSync(auditPath(dir), 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
    const ev = events.find((e) => e.event === 'review_override');
    assert.ok(ev, 'audit.jsonl must record a review_override event');
    assert.equal(ev.actor, 'donghyun');
    assert.equal(ev.meta.diff_hash, hash);
    assert.match(ev.meta.reason, /adversary model unavailable/);
    assert.ok(ev.ts, 'event carries a timestamp');
  });
});

test('override: BARE review-skip file no longer bypasses -> BLOCK with field guidance', () => {
  withRepo(HIGH, (dir) => {
    writeSkip(dir, '');
    const r = runGate(dir);
    assert.equal(r.status, 2, 'an empty flag must fail closed');
    assert.match(r.stderr, /reason/, 'message names the missing reason field');
    assert.match(r.stderr, /approved-by/, 'message names the missing approver field');
    assert.ok(r.stderr.includes(stagedHash(dir)), 'message carries the exact hash to write');
    assert.equal(existsSync(skipPath(dir)), true, 'an invalid flag is kept in place for fixing');
    assert.equal(existsSync(auditPath(dir)), false, 'no audit event for a rejected override');
  });
});

test('override: missing a single field (reason) -> BLOCK', () => {
  withRepo(HIGH, (dir) => {
    writeSkip(dir, `approved-by: donghyun\ndiff-hash: ${stagedHash(dir)}\n`);
    const r = runGate(dir);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /missing `reason:`/);
  });
});

test('override: diff-hash mismatch (stale flag) -> BLOCK naming both hashes', () => {
  withRepo(HIGH, (dir) => {
    writeSkip(dir, `reason: r\napproved-by: a\ndiff-hash: ${'0'.repeat(64)}\n`);
    const r = runGate(dir);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /diff-hash mismatch/);
    assert.ok(r.stderr.includes(stagedHash(dir)), 'message shows the current effective hash');
  });
});

test('override: literal UNVERIFIABLE on a VERIFIABLE commit -> BLOCK (hash must bind)', () => {
  withRepo(HIGH, (dir) => {
    writeSkip(dir, 'reason: r\napproved-by: a\ndiff-hash: UNVERIFIABLE\n');
    assert.equal(runGate(dir).status, 2);
  });
});

test('override: unverifiable commit form + diff-hash: UNVERIFIABLE -> allow + audited', () => {
  withCommitted((dir, git) => {
    writeFileSync(join(dir, 'src/big.ts'), BIG);
    git(['add', 'src/big.ts']);
    writeSkip(dir, 'reason: pathspec commit needed\napproved-by: donghyun\ndiff-hash: UNVERIFIABLE\n');
    assert.equal(runGate(dir, 'git commit -m x src/big.ts').status, 0);
    const ev = readFileSync(auditPath(dir), 'utf-8').trim().split('\n').map((l) => JSON.parse(l))
      .find((e) => e.event === 'review_override');
    assert.equal(ev.meta.diff_hash, 'UNVERIFIABLE');
  });
});

test('override: unverifiable form BLOCK message tells the user to write UNVERIFIABLE', () => {
  withCommitted((dir, git) => {
    writeFileSync(join(dir, 'src/big.ts'), BIG);
    git(['add', 'src/big.ts']);
    const r = runGate(dir, 'git commit -m x src/big.ts'); // no skip file at all
    assert.equal(r.status, 2);
    assert.match(r.stderr, /diff-hash: UNVERIFIABLE/, 'help must show the exact token for this form');
  });
});

test('override: valid override bypasses a covering FAIL (approval axis, on the record)', () => {
  withRepo(HIGH, (dir) => {
    const hash = stagedHash(dir);
    writeReview(dir, `review-${TODAY}-f.md`, `diff-hash: ${hash}\nVerdict: FAIL\n`);
    writeSkip(dir, `reason: risk accepted despite FAIL\napproved-by: donghyun\ndiff-hash: ${hash}\n`);
    assert.equal(runGate(dir).status, 0);
    assert.match(readFileSync(auditPath(dir), 'utf-8'), /review_override/);
  });
});

// --- override + `git commit -a` TOCTOU -------------------------------------------
// Consuming an override appends to docs/harness/audit.jsonl and unlinks review-skip
// BEFORE the commit runs. If either file is git-TRACKED (audit.jsonl is, in this
// repo), `-a` sweeps those writes into the commit, so the committed diff would no
// longer be the diff the approver hashed. The gate fails closed on -a when a sweep
// is possible; a plain commit of the staged diff is unaffected. These tests run the
// REAL `git commit` the gate allowed and verify the committed diff.

// Track docs/harness/audit.jsonl in the temp repo, like the real repo does.
function trackAuditLog(dir, git) {
  mkdirSync(join(dir, 'docs', 'harness'), { recursive: true });
  writeFileSync(auditPath(dir), '');
  git(['add', 'docs/harness/audit.jsonl']);
  git(['commit', '-q', '-m', 'track audit log']);
}

test('override + git commit -a with TRACKED audit.jsonl -> BLOCK, flag kept, nothing audited', () => {
  withCommitted((dir, git) => {
    trackAuditLog(dir, git);
    writeFileSync(join(dir, 'src/big.ts'), BIG);
    git(['add', 'src/big.ts']);
    // Everything staged: -a's effective diff (git diff HEAD) == staged diff, so the flag is
    // otherwise VALID — only the audit-append sweep makes it unconsumable on this form.
    writeSkip(dir, `reason: r\napproved-by: donghyun\ndiff-hash: ${diffHash(dir, 'HEAD')}\n`);
    const r = runGate(dir, 'git commit -am x');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /commit -a/, 'message names the -a form as the problem');
    assert.match(r.stderr, /plain `git commit`/, 'message routes to the staged plain-commit form');
    assert.equal(existsSync(skipPath(dir)), true, 'flag NOT consumed');
    assert.equal(readFileSync(auditPath(dir), 'utf-8'), '', 'no audit event for a rejected consumption');
  });
});

test('INTEGRATION: override + plain commit -> gate allows and the REAL committed diff equals the approved hash', () => {
  withCommitted((dir, git) => {
    trackAuditLog(dir, git);
    writeFileSync(join(dir, 'src/big.ts'), BIG);
    git(['add', 'src/big.ts']);
    const approved = diffHash(dir, '--cached');
    writeSkip(dir, `reason: r\napproved-by: donghyun\ndiff-hash: ${approved}\n`);
    assert.equal(runGate(dir).status, 0, 'plain form consumes the override');
    assert.equal(existsSync(skipPath(dir)), false, 'flag consumed');
    // Run the REAL commit the gate just allowed.
    git(['commit', '-q', '-m', 'x']);
    const committed = execSync('git diff HEAD~1 HEAD | shasum -a 256', { cwd: dir, encoding: 'utf-8' }).trim().split(/\s+/)[0];
    assert.equal(committed, approved, 'committed diff is exactly the approved staged diff');
    // The gate's audit append stayed OUT of the commit (it is an unstaged change to the tracked file).
    assert.match(execSync('git status --porcelain', { cwd: dir, encoding: 'utf-8' }), /^ M docs\/harness\/audit\.jsonl$/m);
    assert.match(readFileSync(auditPath(dir), 'utf-8'), /review_override/);
  });
});

test('INTEGRATION: override + git commit -a with UNTRACKED audit/flag -> allowed, real -a commit matches approved hash', () => {
  withCommitted((dir, git) => {
    // No trackAuditLog: audit.jsonl and review-skip are untracked, so -a cannot sweep them.
    writeFileSync(join(dir, 'src/big.ts'), BIG);
    git(['add', 'src/big.ts']);
    const approved = diffHash(dir, 'HEAD');
    writeSkip(dir, `reason: r\napproved-by: donghyun\ndiff-hash: ${approved}\n`);
    assert.equal(runGate(dir, 'git commit -am x').status, 0, 'no tracked sweep target -> -a override stays consumable');
    assert.equal(existsSync(skipPath(dir)), false, 'flag consumed');
    git(['commit', '-q', '-am', 'x']);
    const committed = execSync('git diff HEAD~1 HEAD | shasum -a 256', { cwd: dir, encoding: 'utf-8' }).trim().split(/\s+/)[0];
    assert.equal(committed, approved, '-a commit captures exactly the approved diff (untracked files not swept)');
    assert.match(readFileSync(auditPath(dir), 'utf-8'), /review_override/);
  });
});

test('medium risk + valid override + git commit -a (tracked audit) -> warn, NOT consumed, commit proceeds', () => {
  withCommitted((dir, git) => {
    trackAuditLog(dir, git);
    writeFileSync(join(dir, 'src/big.ts'), 'export const x = 1;\n'.repeat(20)); // <100 lines -> medium
    git(['add', 'src/big.ts']);
    writeSkip(dir, `reason: r\napproved-by: donghyun\ndiff-hash: ${diffHash(dir, 'HEAD')}\n`);
    const r = runGate(dir, 'git commit -am x');
    assert.equal(r.status, 0, 'medium never required review');
    assert.match(r.stderr, /cannot be consumed under `git commit -a`/i);
    assert.equal(existsSync(skipPath(dir)), true, 'flag NOT consumed under -a');
    assert.equal(readFileSync(auditPath(dir), 'utf-8'), '', 'no audit event without consumption');
  });
});

// --- risk-level scoping of the new paths ------------------------------------------

test('low risk: unaffected — even a bare review-skip lying around does not block', () => {
  withRepo(LOW, (dir) => {
    writeSkip(dir, '');
    assert.equal(runGate(dir).status, 0);
    assert.equal(existsSync(skipPath(dir)), true, 'low risk exits before the override check; flag untouched');
  });
});

test('medium risk: invalid review-skip is ignored with a warning, not a block', () => {
  withRepo(MED, (dir) => {
    writeSkip(dir, '');
    const r = runGate(dir);
    assert.equal(r.status, 0, 'medium never required review, so a broken flag must not brick it');
    assert.match(r.stderr, /not a valid audited override/i);
    assert.equal(existsSync(skipPath(dir)), true, 'invalid flag is not consumed');
  });
});

test('medium risk: VALID override is consumed + audited (can clear a covering FAIL)', () => {
  withRepo(MED, (dir) => {
    const hash = stagedHash(dir);
    writeReview(dir, `review-${TODAY}-m.md`, `diff-hash: ${hash}\nVerdict: FAIL\n`);
    writeSkip(dir, `reason: r\napproved-by: a\ndiff-hash: ${hash}\n`);
    assert.equal(runGate(dir).status, 0);
    assert.equal(existsSync(skipPath(dir)), false);
    assert.match(readFileSync(auditPath(dir), 'utf-8'), /review_override/);
  });
});

// --- first-block message quality (single-model deployment UX) ---------------------

test('high risk + NO review at all: block message alone suffices to write path 2 or 3', () => {
  withRepo(HIGH, (dir) => {
    const r = runGate(dir);
    assert.equal(r.status, 2);
    const hash = stagedHash(dir);
    assert.ok(r.stderr.includes(hash), 'carries the exact diff-hash value');
    assert.ok(r.stderr.includes(`docs/reviews/review-${TODAY}-`), 'carries the exact review filename (today, local date)');
    assert.match(r.stderr, /human-reviewed-by: /, 'teaches the human-review field');
    assert.match(r.stderr, /Verdict: PASS/, 'teaches the verdict line');
    assert.match(r.stderr, /docs\/harness\/review-skip/, 'teaches the override file path');
    assert.match(r.stderr, /reason: /, 'teaches the reason field');
    assert.match(r.stderr, /approved-by: /, 'teaches the approver field');
    assert.match(r.stderr, /audit\.jsonl/, 'discloses that the override is audited');
  });
});
