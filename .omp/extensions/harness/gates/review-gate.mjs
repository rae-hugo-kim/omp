#!/usr/bin/env node
// review-gate.mjs - PreToolUse hook for Bash (git commit)
// Purpose: Enforce review based on change risk level
// - critical/high risk + no accepted evidence → BLOCK
// - critical/high risk + FAIL review covering the diff → BLOCK
// - medium risk + no review → WARNING (recommend reviewer)
// - low risk → PASS (docs/config don't need adversarial review)
//
// Accepted evidence for HIGH/CRITICAL — the verification axis and the approval axis are separate:
//   (1) heterogeneous model review [verification] — a covering review doc (docs/reviews/review-<today>*)
//       carrying the effective diff hash plus a measured `models:` line naming >=2 distinct model
//       families (the reviewer writes it only after transcript-verifying the adversary's family).
//   (2) human review [verification] — a covering review doc carrying the effective diff hash plus a
//       `human-reviewed-by:` identity and an explicit `Verdict:` line. For single-model deployments
//       that cannot honestly produce (1), the USER reading the diff is the second perspective.
//   (3) audited override [approval, no verification] — docs/harness/review-skip carrying
//       `reason:` / `approved-by:` / `diff-hash:` fields. The gate binds it to THIS commit's diff,
//       appends a `review_override` event to docs/harness/audit.jsonl ({ts,event,actor,meta} — the
//       adversarial_override precedent), and consumes the flag. A BARE review-skip file no longer
//       bypasses anything: there is deliberately no unaudited escape hatch.
// Exit 0 = allow, Exit 2 = block

import { readFileSync, existsSync, appendFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { assessRisk } from './risk-assess.mjs';
import { isGitCommit, parseCommitForm } from './git-commit-detect.mjs';

function getStateDir(cwd) {
  const dir = join(cwd, '.omp', 'harness-state');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// Decide whether today's reviews cover the current diff and whether any covering
// review is a FAIL. `reviews` is [{ name, content }]; `currentHash` is the
// effective committed-diff hash (or null when it could not be produced).
// - A review "covers" the diff when it carries the hash in a `diff-hash` FIELD at
//   the start of a line (optionally behind Markdown list/quote/bold markers), e.g.
//   "diff-hash: <h>" or "diff-hash (initial review): <h>" or "- **diff-hash: <h>**".
//   A bare hash in prose, or a different field like "previous-diff-hash:", does NOT
//   count — the field must begin the line so it asserts coverage, not just mention it.
// - ALL of today's reviews are scanned (not just the lexicographically-last one),
//   so several PRs landing the same day don't shadow each other.
// - FAIL blocks only when it covers the current diff; if the hash is unknown we
//   fall back to any of today's reviews so an explicit FAIL still blocks.
// - matchedCurrent is true/false when a hash exists, or null when it could not be
//   computed (the gate treats null as "unverified" and fails closed on high/critical).
// Map a token to a model FAMILY, or null if it is not a single clean model name. The token must be
// ENTIRELY `[provider/]<alias><suffix?>` — the alias is a known model word; the suffix is analyzed
// SEGMENT BY SEGMENT (split on `-`/`.`), and every segment must be one of:
//   - a version segment starting with a digit ("4", "5.6", "8x7b") or letter+digit codename ("r1", "4o"),
//   - a same-family sub-alias ("claude-opus-4-8", "claude-3-5-sonnet"),
//   - a known variant descriptor ("o3-mini", "gemini-2.5-pro", "gpt-4-turbo"),
//   - or, once a version segment has appeared, any plain word codename ("gpt-5.6-sol").
// A NEGATION word anywhere ("not", "skipped", "unavailable", …) rejects the whole token — so
// "gpt-skipped", "claude-unavailable-5", "gpt-not-run-2" are negated declarations, not versions,
// no matter how many digits they carry. Empty segments ("claude...4", "gpt--5") are malformed and
// reject. Unknown words BEFORE any version digit reject (fail-closed: "octopus", "gptscript",
// "codex skipped", bare providers all stay non-models).
// Codex folds into the gpt (OpenAI) family, so "codex, gpt-5" is ONE family, while "claude, codex" is two.
const MODEL_ALIAS = /^(?:claude|sonnet|opus|haiku|codex|gpt|o[1-9]|gemini|bard|grok|llama|mistral|mixtral|deepseek|qwen)$/;
const NEGATION_WORD = /^(?:not?|none|never|nil|null|na|void|skip|skipped|skipping|unavailable|unverified|unused|unrun|missing|absent|omitted|pending|disabled|failed|fail|failing|error|errored|without|run)$/;
const VARIANT_WORD = /^(?:mini|nano|micro|lite|tiny|small|medium|large|max|plus|ultra|pro|air|flash|turbo|preview|exp|experimental|latest|stable|beta|alpha|instruct|chat|coder|vision|thinking|reasoner|sonic|high|low)$/;
function familyOf(alias) {
  if (/^(?:claude|sonnet|opus|haiku)$/.test(alias)) return 'claude';
  if (/^(?:codex|gpt|o[1-9])$/.test(alias)) return 'gpt';
  if (/^(?:gemini|bard)$/.test(alias)) return 'gemini';
  return alias; // grok | llama | mistral | mixtral | deepseek | qwen
}
function modelFamily(tok) {
  const e = String(tok).toLowerCase().trim().replace(/^[a-z][a-z0-9.-]*\//, ''); // drop one provider/ prefix
  const m = e.match(/^(claude|sonnet|opus|haiku|codex|gpt|o[1-9]|gemini|bard|grok|llama|mistral|mixtral|deepseek|qwen)([-.][a-z0-9.-]*|\d[a-z0-9.-]*)?$/);
  if (!m) return null;
  const family = familyOf(m[1]);
  if (!m[2]) return family;
  let versionStarted = false;
  for (const seg of m[2].replace(/^[-.]/, '').split(/[-.]/)) {
    if (!seg) return null;                                        // "claude...4", "gpt--5": malformed
    if (NEGATION_WORD.test(seg)) return null;                     // negation anywhere kills the token
    if (/^\d|^[a-z]\d/.test(seg)) { versionStarted = true; continue; } // "4", "5", "8x7b", "r1", "4o"
    if (MODEL_ALIAS.test(seg)) {                                  // sub-alias must agree in family
      if (familyOf(seg) !== family) return null;
      continue;
    }
    if (VARIANT_WORD.test(seg)) continue;                         // "mini", "pro", "turbo", …
    if (versionStarted && /^[a-z][a-z0-9]*$/.test(seg)) continue; // post-version codename ("5.6-sol")
    return null;                                                  // unknown word before a version: not a model
  }
  return family;
}

// Reduce a doc to the lines that ASSERT something in the rendered review — the single sanitized
// view every evidence axis (coverage, FAIL detection, het, human) reads. ONE pass, line by line,
// with FENCE STATE CHECKED FIRST: in CommonMark everything inside a code fence is literal text,
// including `<!-- -->`, so comment stripping must never touch fenced lines. (Stripping comments
// over the whole text first let a fenced "`<!--x-->``" fuse into "```" and close the fence early,
// leaking the quoted evidence below it as live lines — fail-open.)
//   1) Markdown code fences (``` / ~~~): an opening fence may carry an info string, but a CLOSING
//      fence is the same character, at least the opening length, nothing else on the line, and
//      indented at most 3 COLUMNS — a tab advances to the next multiple of 4, so any tab-indented
//      delimiter is fence CONTENT, not a close. An unterminated fence runs to EOF. Fenced lines
//      and the delimiters themselves are never yielded: a fenced `models:` line is an EXAMPLE
//      being quoted (e.g. the reviewer.md template), not a declaration.
//   2) HTML comments OUTSIDE fences are stripped — commented-out text is invisible in rendered
//      Markdown, so a `models:`/`diff-hash:`/`Verdict:` line inside `<!-- … -->` asserts nothing.
//      A multi-line comment leaves its opening line's prefix and closing line's remainder on
//      SEPARATE output lines, so surrounding text can never fuse into a new field line. An
//      unterminated `<!--` swallows the rest of the doc (fail-closed: hidden text can only
//      remove evidence, never add it).
function evidenceLines(content) {
  const out = [];
  let open = null;     // { ch, len } of the active opening fence
  let comment = false; // inside a multi-line HTML comment (outside any fence)
  for (const raw of String(content).split(/\r?\n/)) {
    if (open) {
      const c = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(raw);
      if (c && c[1][0] === open.ch && c[1].length >= open.len) open = null;
      continue; // inside the fence, or its closing delimiter: never yielded
    }
    let line = raw;
    if (comment) {
      const end = line.indexOf('-->');
      if (end === -1) continue; // whole line is comment-hidden
      comment = false;
      line = line.slice(end + 3);
    }
    line = line.replace(/<!--[\s\S]*?-->/g, '');
    const start = line.indexOf('<!--');
    if (start !== -1) { comment = true; line = line.slice(0, start); }
    const f = /^[ \t]{0,3}(`{3,}|~{3,})/.exec(line);
    if (f) { open = { ch: f[1][0], len: f[1].length }; continue; }
    out.push(line);
  }
  return out;
}

// Parse simple `key: value` fields from a small text file / review doc — the SAME line grammar
// the het parser tolerates (Markdown list/quote/bold prefixes, CRLF, backticks), over the SAME
// sanitized view (evidenceLines: fenced or comment-hidden lines are quoted examples, not fields).
// Returns lowercased key -> first non-empty value seen.
function parseFields(content) {
  const fields = {};
  for (const raw of evidenceLines(content)) {
    const m = /^[ \t>*-]*(?:\d+[.)][ \t]*)?\*{0,2}([a-z][a-z-]*)\*{0,2}[ \t]*:\*{0,2}[ \t]*(.*)$/i.exec(raw);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].replace(/[*`]/g, '').trim();
    if (val && !(key in fields)) fields[key] = val;
  }
  return fields;
}

// Heterogeneity evidence for a HIGH/CRITICAL review (continuous-cross-review policy). Accepts ONLY
// a field whose key is EXACTLY `models` — `models-*`/`models_*` variants ("models-not-run:",
// "models-attempted:") are somebody describing models, not the contract's declaration, and matching
// them was a fail-open — where EVERY token is a clean model name (see modelFamily) AND >=2 DISTINCT
// families are named. A single stray non-model token (noise, a negated "no codex"/"codex skipped"/
// "codex-skipped"/"gpt-not-run-2", a bare provider) makes the whole list not count. Lines inside
// Markdown code fences or HTML comments are ignored (see evidenceLines): a quoted or commented-out
// template example is not evidence. Thread/session id fields (`codex-thread:`,
// `adversary-session:`, …) are deliberately NOT evidence: an id proves a run happened, not that a
// SECOND family reviewed the diff — the reviewer contract requires the adversary transcript's
// `model_change` to be measured and expressed as `models:` (or the doc is routed to the
// human-review / audited-override paths).
// Markdown emphasis, list/quote/numbered prefixes, CRLF, and inline HTML comments are tolerated.
// The gate enforces that real evidence is PRESENT and internally consistent; truthfulness of the
// declaration is still the reviewer contract's job.
function isHetEvidence(content) {
  for (const raw of evidenceLines(content)) {
    const m = /^[ \t>*-]*(?:\d+[.)][ \t]*)?\*{0,2}([a-z][a-z-]*)\*{0,2}[ \t]*:\*{0,2}[ \t]*(.*)$/i.exec(raw);
    if (!m) continue;
    if (m[1].toLowerCase() !== 'models') continue;
    const val = m[2].replace(/[*`]/g, '').trim();
    if (!val) continue;
    const toks = val.split(/[,&+/]|\s+/).map((s) => s.trim()).filter(Boolean);
    if (toks.length < 2) continue;
    const fams = new Set();
    let allModels = true;
    for (const tok of toks) { const f = modelFamily(tok); if (!f) { allModels = false; break; } fams.add(f); }
    if (allModels && fams.size >= 2) return true;
  }
  return false;
}

// Human-review evidence (verification axis, path 2): the USER read the diff. Requires a
// `human-reviewed-by:` field whose first token is a real identity — non-empty and NOT a bare model
// name (`human-reviewed-by: claude` is a spoof, not a person; same anti-spoof stance as modelFamily) —
// AND a `Verdict:` whose value is on the explicit PASS whitelist: `PASS` or `PASS WITH NOTES`.
// An empty, pending, or unknown verdict (`Verdict:`, `Verdict: PENDING`, `Verdict: NEEDS REVIEW`)
// states no accepted outcome and does NOT count — fail closed (a covering FAIL additionally blocks
// via hasFail). Both fields are read from the sanitized view (evidenceLines): a fenced or
// commented-out `human-reviewed-by:`/`Verdict: PASS` is a quoted example, not a declaration.
// Coverage (the diff-hash field) is checked by evaluateReviews like any other review, and the doc
// must be a TODAY review (filename scan) — that supplies the timestamp requirement. As with het
// evidence, the gate enforces the evidence is PRESENT and well-formed; truthfulness of the
// declaration rests with the human who wrote it.
function isHumanEvidence(content) {
  const who = parseFields(content)['human-reviewed-by'];
  if (!who || modelFamily(who.split(/\s+/)[0])) return false;
  const m = /^[ \t>*#-]*\*{0,2}verdict\*{0,2}[ \t]*:\*{0,2}[ \t]*(.*)$/im.exec(evidenceLines(content).join('\n'));
  if (!m) return false;
  const verdict = m[1].replace(/[*`]/g, '').trim().toUpperCase();
  return /^PASS(?:\s+WITH\s+NOTES)?$/.test(verdict);
}

function evaluateReviews(reviews, currentHash) {
  // EVERY axis — coverage, FAIL detection, het, human — reads the SAME sanitized view
  // (evidenceLines): a diff-hash or Verdict line inside a code fence or HTML comment is a
  // quotation, not an assertion. Consistency matters both ways: a fenced diff-hash must not
  // grant coverage (fail-open), and a fenced `Verdict: FAIL` example must not veto a doc whose
  // real verdict is PASS (over-blocking).
  // Coverage grammar: the field must BE `diff-hash`, optionally followed by ONE parenthesized
  // qualifier — "diff-hash: <h>", "diff-hash (initial review): <h>", "- **diff-hash: <h>**"
  // cover; "previous-diff-hash: <h>" and "diff-hash-not-reviewed: <h>" describe, so they don't.
  const sanitized = reviews.map((r) => ({ name: r.name, text: evidenceLines(r.content).join('\n'), content: r.content }));
  const covers = currentHash
    ? (text) => new RegExp(`^[ \\t>*-]*\\*{0,2}diff-hash\\b(?:[ \\t]*\\([^()\\n]*\\))?\\*{0,2}[ \\t]*:\\*{0,2}[ \\t]*${currentHash}\\b`, 'm').test(text)
    : () => false;
  // Heterogeneity is detected by isHetEvidence() (family-counting parser, above): a single-model or
  // placeholder-field review does not satisfy it. Human review is detected by isHumanEvidence().
  const matching = currentHash ? sanitized.filter((r) => covers(r.text)) : [];
  const failScope = matching.length > 0 ? matching : (currentHash ? [] : sanitized);
  const hasFail = failScope.some((r) => /Verdict:\s*FAIL/i.test(r.text));
  const matchedCurrent = currentHash ? matching.length > 0 : null;
  const matchedHet = currentHash ? matching.some((r) => isHetEvidence(r.content)) : null;
  const matchedHuman = currentHash ? matching.some((r) => isHumanEvidence(r.content)) : null;
  return { hasFail, matchedCurrent, matchedHet, matchedHuman };
}

// The three accepted evidence paths, spelled out so a user blocked for the FIRST time can write
// path (2) or (3) from this message alone — single-model deployments cannot honestly produce (1),
// and this message is their entire UX. Always prints the ACTUAL values to copy (hash, today's date).
function evidenceHelp(currentHash, today) {
  const h = currentHash || 'UNVERIFIABLE';
  const lines = [
    'A HIGH/CRITICAL commit needs ONE of:',
    '  (1) heterogeneous model review [verification]: run the reviewer agent; its doc in docs/reviews/ must carry `diff-hash: <hash>` plus a MEASURED `models: <fam1>, <fam2>` line (>=2 model families, e.g. `models: claude, gpt`) — written only after the adversary transcript confirmed a different family actually ran. Thread/session ids are not evidence. If only your own family ran, (1) cannot honestly be satisfied — use (2) or (3).',
  ];
  if (currentHash) {
    lines.push(
      `  (2) human review [verification]: read the diff yourself (git diff --cached), then create docs/reviews/review-${today}-HHMMSS.md (any HHMMSS) containing exactly:`,
      `        diff-hash: ${h}`,
      '        human-reviewed-by: <your name>',
      '        Verdict: PASS',
      '      (accepted verdicts: PASS or PASS WITH NOTES — an empty/PENDING/other verdict does not count)',
    );
  } else {
    lines.push('  (2) human review [verification] is unavailable for this commit form (no diff hash to bind it to) — prefer a standalone plain `git commit` of the staged diff, which makes (1) and (2) usable.');
  }
  lines.push(
    '  (3) audited override [approval — accept the risk UNREVIEWED]: create docs/harness/review-skip containing exactly:',
    '        reason: <why review is being skipped>',
    '        approved-by: <who accepts the risk>',
    `        diff-hash: ${h}`,
    '      The gate records it as a `review_override` event in docs/harness/audit.jsonl and consumes the flag. A bare/incomplete review-skip file does NOT bypass this gate.',
  );
  return lines.join('\n');
}

// Validate the audited-override flag file (path 3). All three fields are REQUIRED; `diff-hash:`
// must equal the effective committed-diff hash, or be the literal UNVERIFIABLE when (and only
// when) no hash exists — binding each override to ONE specific commit so a stale or pre-written
// flag can never silently cover different content. Returns a list of problems ([] = valid).
function validateOverride(fields, currentHash, form) {
  const problems = [];
  if (!fields['reason']) problems.push('missing `reason:` (why review is being skipped)');
  if (!fields['approved-by']) problems.push('missing `approved-by:` (who accepts the risk)');
  const dh = fields['diff-hash'];
  if (!dh) {
    problems.push(`missing \`diff-hash:\` (must be ${currentHash || 'the literal UNVERIFIABLE for this commit form'})`);
  } else if (currentHash) {
    if (dh !== currentHash) problems.push(`diff-hash mismatch: the flag has ${dh} but the effective committed diff is ${currentHash} (the staged/committed content changed since the flag was written)`);
  } else if (dh.toUpperCase() !== 'UNVERIFIABLE') {
    problems.push(form.verifiable
      ? 'the effective diff hash could not be computed (git/shasum error) — write `diff-hash: UNVERIFIABLE` to acknowledge overriding an unhashable commit'
      : 'this commit form is unverifiable (pathspec/--amend/compound line/...) so no hash exists — write `diff-hash: UNVERIFIABLE` to acknowledge, or use a standalone plain `git commit`');
  }
  return problems;
}

const input = readFileSync(0, 'utf-8');

let data;
try {
  data = JSON.parse(input);
} catch (e) {
  console.error('HARNESS WARNING: Hook received invalid input, skipping check.');
  process.exit(0);
}

const cwd = data?.session_state?.cwd || process.cwd();
const stateDir = getStateDir(cwd);
const logFile = join(stateDir, 'hook-debug.log');

function log(msg) {
  if (!process.env.HARNESS_DEBUG) return;
  const timestamp = new Date().toISOString();
  appendFileSync(logFile, `[${timestamp}] review-gate: ${msg}\n`);
}

log('Hook started');

const command = data?.tool_input?.command || '';

if (!isGitCommit(command)) {
  log('Not a git commit, allowing');
  process.exit(0);
}

// Parse the commit form ONCE: it scopes both the risk assessment (assess only what the
// commit captures, not unrelated unstaged changes) and the effective-diff hash below.
const form = parseCommitForm(command);
const risk = assessRisk(cwd, form);
log(`Risk: ${risk.level} (${risk.reason}), ${risk.files.length} files, ~${risk.diffSize} lines`);

if (risk.level === 'low' || risk.level === 'none') {
  log('Low/no risk, review not required');
  process.exit(0);
}

const reviewDir = join(cwd, 'docs', 'reviews');
const skipFile = join(cwd, 'docs', 'harness', 'review-skip');

// LOCAL date (not toISOString's UTC): reviewer docs are named by the author's local
// date, so a UTC "today" mismatched real reviews between local midnight and the UTC
// offset (e.g. 00:00–08:59 KST → still "yesterday" in UTC), falsely failing coverage.
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// Hash the EFFECTIVE committed diff. Computed BEFORE the override check because the override must
// bind to this hash, and every BLOCK message prints it so evidence can be written from the message
// alone. parseCommitForm tells us which diff the commit will capture:
//   all=true (-a/--all) -> all tracked changes  (git diff HEAD)
//   else (plain)        -> the staged index     (git diff --cached)
// This closes the gap where `git commit -a` pulled in tracked changes the staged-diff
// hash never saw, letting a stale PASS review match the wrong content. Every other
// form (pathspec, --amend, --include/-i, -p, --pathspec-from-file, a commit behind
// bash -c, >1 commit in one line, or a repo-redirecting global like -C) is UNVERIFIABLE:
// currentHash stays null and the gate fails closed on high/critical (see the
// matchedCurrent !== true branch below). execSync runs through a shell, so the pipe
// needs no `shell` option; both diff commands are constant (no user input on the line).
let currentHash = null;
if (form.verifiable) {
  const diffCmd = form.all ? 'git diff HEAD' : 'git diff --cached';
  try {
    currentHash = execSync(`${diffCmd} | shasum -a 256`, { cwd, encoding: 'utf-8' }).trim().split(/\s+/)[0];
  } catch {
    currentHash = null;
  }
}

// Audited override (path 3). The flag file is the single write surface; the gate itself appends
// the audit event so the record cannot be forgotten. A valid override is consumed (unlink) and
// bypasses the remaining checks — including a covering FAIL — because it is the APPROVAL axis:
// the named approver accepts the risk on the record (cf. rules/adversarial_review.md override).
// An INVALID flag fails closed on high/critical (it is kept in place so it can be fixed, not
// retyped); on medium it is ignored with a warning since medium never required review anyway.
//
// `-a/--all` TOCTOU: consuming an override APPENDS to docs/harness/audit.jsonl and UNLINKS the
// flag BEFORE the commit runs (this is a pre-commit hook; there is no post-commit write point).
// If either file is git-TRACKED, `git commit -a` sweeps those writes into the commit itself, so
// the committed diff would no longer be the diff the approver hashed. When that sweep is possible
// the override CANNOT be consumed for the -a form: high/critical fails closed with "stage + plain
// git commit" guidance (matching the gate's existing stance on odd commit forms), medium warns and
// ignores the flag (the flag is NOT consumed either way). Trackedness is checked live with
// `git ls-files` (in THIS repo audit.jsonl is tracked; review-skip is gitignored) — a repo that
// ignores both files has no sweep and keeps the -a override; a failed check fails closed.
if (existsSync(skipFile)) {
  let fields = {};
  let readProblem = null;
  try {
    fields = parseFields(readFileSync(skipFile, 'utf-8'));
  } catch {
    readProblem = 'the flag file could not be read';
  }
  const problems = readProblem ? [readProblem] : validateOverride(fields, currentHash, form);
  let swept = [];
  if (problems.length === 0 && form.all) {
    try {
      swept = execSync('git ls-files -- docs/harness/audit.jsonl docs/harness/review-skip', { cwd, encoding: 'utf-8' })
        .split('\n').filter(Boolean);
    } catch {
      swept = ['docs/harness/audit.jsonl (tracking state unknown — failing closed)'];
    }
  }
  if (swept.length > 0) {
    if (risk.level === 'critical' || risk.level === 'high') {
      log(`BLOCKED: valid review-skip override, but git commit -a would sweep the gate's own writes (${swept.join(', ')}) into the commit`);
      console.error(`HARNESS BLOCK: the audited override cannot be consumed under \`git commit -a/--all\`: recording it writes ${swept.join(' and ')} (git-tracked) BEFORE the commit runs, so -a would sweep those writes into the commit and the committed diff would no longer match the approved diff-hash.`);
      console.error('Stage exactly what you intend to ship (git add ...), then use a plain `git commit`; the flag was NOT consumed and its diff-hash must match the STAGED diff (git diff --cached | shasum -a 256).');
      process.exit(2);
    }
    log('WARNING: valid review-skip override ignored under git commit -a (tracked audit/flag sweep); medium risk proceeds without it');
    console.error('HARNESS WARNING: docs/harness/review-skip is valid but cannot be consumed under `git commit -a` (the gate\'s audit/flag writes are git-tracked and would be swept into the commit); ignoring it — use a plain `git commit` of the staged diff to consume it.');
  } else if (problems.length === 0) {
    const harnessDir = join(cwd, 'docs', 'harness');
    mkdirSync(harnessDir, { recursive: true });
    const event = {
      ts: new Date().toISOString(),
      event: 'review_override',
      actor: fields['approved-by'],
      meta: { reason: fields['reason'], diff_hash: currentHash || 'UNVERIFIABLE', risk: risk.level, risk_reason: risk.reason },
    };
    appendFileSync(join(harnessDir, 'audit.jsonl'), JSON.stringify(event) + '\n');
    unlinkSync(skipFile);
    log(`review override accepted (approved-by: ${fields['approved-by']}), audited + consumed`);
    console.error(`HARNESS NOTE: review override by ${fields['approved-by']} accepted — recorded as review_override in docs/harness/audit.jsonl; flag consumed.`);
    process.exit(0);
  } else if (risk.level === 'critical' || risk.level === 'high') {
    log(`BLOCKED: invalid review-skip override (${problems.join('; ')})`);
    console.error(`HARNESS BLOCK: docs/harness/review-skip exists but is not a valid audited override — ${problems.join('; ')}.`);
    console.error([
      'An audited override must contain ALL of (fix the file in place, it was NOT consumed):',
      '  reason: <why review is being skipped>',
      '  approved-by: <who accepts the risk>',
      `  diff-hash: ${currentHash || 'UNVERIFIABLE'}`,
      'Or delete the file and provide review evidence instead (reviewer agent / human review — see below).',
      evidenceHelp(currentHash, today),
    ].join('\n'));
    process.exit(2);
  } else {
    log(`WARNING: invalid review-skip override ignored on ${risk.level} risk (${problems.join('; ')})`);
    console.error(`HARNESS WARNING: docs/harness/review-skip is not a valid audited override (${problems.join('; ')}); ignoring it.`);
  }
}

let todayReviews = [];
if (existsSync(reviewDir)) {
  todayReviews = readdirSync(reviewDir).filter(f => f.startsWith(`review-${today}`));
}

if (todayReviews.length === 0) {
  if (risk.level === 'critical' || risk.level === 'high') {
    log(`BLOCKED: ${risk.level} risk with no review`);
    console.error(`HARNESS BLOCK: ${risk.level} risk changes (${risk.reason}) require review evidence.`);
    console.error(evidenceHelp(currentHash, today));
    process.exit(2);
  }
  log(`WARNING: ${risk.level} risk with no review`);
  console.error(`HARNESS WARNING: ${risk.level} risk changes without review. Consider running reviewer agent.`);
  process.exit(0);
}

const reviews = todayReviews.map((f) => {
  try {
    return { name: f, content: readFileSync(join(reviewDir, f), 'utf-8') };
  } catch {
    return { name: f, content: '' };
  }
});

const { hasFail, matchedCurrent, matchedHet, matchedHuman } = evaluateReviews(reviews, currentHash);

// A FAIL verdict covering the current diff blocks regardless of risk level.
if (hasFail) {
  log('BLOCKED: a review verdict is FAIL for the current changes');
  console.error('HARNESS BLOCK: a review verdict is FAIL for the current changes. Fix issues before committing.');
  process.exit(2);
}

// A review must positively cover this diff. matchedCurrent === true means a today
// review carries the current diff hash. Both false (no match) and null (hash could
// not be computed) mean "unverified" — high/critical fails closed, matching the
// harness's fail-closed-on-unknown stance (cf. backpressure-gate). The audited
// override (handled above) is the deliberate, recorded escape hatch.
if (matchedCurrent !== true) {
  const detail = currentHash
    ? 'no review matches the current changes'
    : (form.verifiable
        ? 'could not compute the diff hash (git/shasum error)'
        : 'the commit form is unverifiable (an output redirection like `2>&1`, a compound `&&`/`;` line, a pathspec, --amend, or -a with unstaged changes) — run a STANDALONE `git commit` (no trailing `2>&1`/`; …`, no `cd … &&` prefix) so the staged diff can be hashed');
  if (risk.level === 'critical' || risk.level === 'high') {
    log(`BLOCKED: ${detail}`);
    console.error(`HARNESS BLOCK: ${detail}.`);
    console.error(evidenceHelp(currentHash, today));
    process.exit(2);
  }
  log(`WARNING: ${detail}`);
  console.error(`HARNESS WARNING: ${detail}. Consider re-running reviewer.`);
}

// Second-perspective enforcement: a covering review for a HIGH/CRITICAL change must evidence either
// a heterogeneous model review (measured `models:` >=2 families) or a human review. A
// single-model self-review covering the diff is treated as not-yet-reviewed for risky changes.
// (Medium keeps review optional, so it is not subject to this; the audited override remains the
// recorded approval-axis escape.)
if (matchedCurrent === true && matchedHet !== true && matchedHuman !== true && (risk.level === 'critical' || risk.level === 'high')) {
  log('BLOCKED: covering review shows neither heterogeneous-review nor human-review evidence');
  console.error('HARNESS BLOCK: the review covering these changes is a single-model self-review — a HIGH/CRITICAL change needs a second perspective.');
  console.error(evidenceHelp(currentHash, today));
  process.exit(2);
}

log(`Review check passed (${todayReviews.length} today, matchedCurrent=${matchedCurrent}, het=${matchedHet}, human=${matchedHuman})`);
process.exit(0);
