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
//       carrying the effective diff hash plus `models:` (>=2 families) or a thread field + a
//       `primary-model:` from a DIFFERENT family than the adversary's (`codex-thread:` defaults the
//       adversary to gpt; `adversary-thread:` requires an explicit `adversary-model:`).
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
// ENTIRELY `[provider/]<alias><version-suffix?>` — the alias is a known model word, optionally followed
// by a version that starts with `-`/`.`/digit. This rejects substrings ("octopus"!="opus", "gptscript",
// "bardic") and trailing-word phrases ("codex skipped", "no codex") — only a bare model name maps.
// Codex folds into the gpt (OpenAI) family, so "codex, gpt-5" is ONE family, while "claude, codex" is two.
function modelFamily(tok) {
  const e = String(tok).toLowerCase().trim().replace(/^[a-z][a-z0-9.-]*\//, ''); // drop one provider/ prefix
  const m = e.match(/^(claude|sonnet|opus|haiku|codex|gpt|o[1-9]|gemini|bard|grok|llama|mistral|mixtral|deepseek|qwen)(?:[-.\d][a-z0-9.-]*)?$/);
  if (!m) return null;
  const a = m[1];
  if (/^(?:claude|sonnet|opus|haiku)$/.test(a)) return 'claude';
  if (/^(?:codex|gpt|o[1-9])$/.test(a)) return 'gpt';
  if (/^(?:gemini|bard)$/.test(a)) return 'gemini';
  return a; // grok | llama | mistral | mixtral | deepseek | qwen
}

// Parse simple `key: value` fields from a small text file / review doc — the SAME line grammar
// the het parser tolerates (Markdown list/quote/bold prefixes, CRLF, HTML comments, backticks).
// Returns lowercased key -> first non-empty value seen.
function parseFields(content) {
  const fields = {};
  for (const raw of String(content).split(/\r?\n/)) {
    const m = /^[ \t>*-]*(?:\d+[.)][ \t]*)?\*{0,2}([a-z][a-z-]*)\*{0,2}[ \t]*:\*{0,2}[ \t]*(.*)$/i.exec(raw);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].replace(/<!--[\s\S]*?-->/g, '').replace(/[*`]/g, '').trim();
    if (val && !(key in fields)) fields[key] = val;
  }
  return fields;
}

// Heterogeneity evidence for a HIGH/CRITICAL review (continuous-cross-review policy). Accepts EITHER:
//   (a) a `codex-thread:`/`codex-session:`/`adversary-thread:`/`adversary-session:` field whose
//       value's FIRST token is a real id (>=8 leading hex, optionally `-hex` groups) — but ONLY when
//       the doc also carries a `primary-model:` field that parses to a family (see modelFamily)
//       DIFFERENT from the adversary's family. The adversary family resolves PER KEY:
//         - `codex-thread`/`codex-session`: `adversary-model:` when present (unparseable → not
//           evidence), else `gpt` — a codex CLI thread implies a GPT/Codex execution, so the
//           default is safe for these keys.
//         - `adversary-thread`/`adversary-session`: a parseable `adversary-model:` is REQUIRED.
//           An adversary AGENT thread implies no particular family (the agent may have
//           auth-fallen-back to the primary's own family, e.g. Claude), so a missing or
//           unparseable `adversary-model:` is NOT evidence — fail closed.
//       A thread id alone proves a run happened, not that it was a SECOND family: a GPT/Codex-primary
//       deployment running the codex CLI is a same-family self-review, so an honest
//       `primary-model: gpt-…` next to a codex thread is mechanically rejected here and routed to
//       the human-review / audited-override paths. A missing or unparseable `primary-model:` also
//       does not count — fail closed, same routing.
//   (b) a `models`/`models-*` field where EVERY token is a clean model name (see modelFamily) AND
//       >=2 DISTINCT families are named. A single stray non-model token (noise, a negated
//       "no codex"/"codex skipped", a bare provider) makes the whole list not count.
// Markdown emphasis, list/quote/numbered prefixes, CRLF, and HTML comments are tolerated. The gate
// enforces that real evidence is PRESENT and internally consistent; truthfulness of the declaration
// is still the reviewer contract's job.
function isHetEvidence(content) {
  const fields = parseFields(content);
  const famOf = (v) => (v ? modelFamily(v.split(/\s+/)[0]) : null);
  for (const raw of String(content).split(/\r?\n/)) {
    const m = /^[ \t>*-]*(?:\d+[.)][ \t]*)?\*{0,2}([a-z][a-z-]*)\*{0,2}[ \t]*:\*{0,2}[ \t]*(.*)$/i.exec(raw);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].replace(/<!--[\s\S]*?-->/g, '').replace(/[*`]/g, '').trim();
    if (!val) continue;
    if (/^(?:codex|adversary)-(?:thread|session)$/.test(key)) {
      const id = val.split(/\s+/)[0];
      if (!/^[0-9a-f]{8,}(?:-[0-9a-f]+)*$/i.test(id)) continue; // real id shape, not "----deadbeef"
      const primaryFam = famOf(fields['primary-model']);
      if (!primaryFam) continue; // no honest primary declaration -> thread proves nothing about heterogeneity
      const advFam = 'adversary-model' in fields ? famOf(fields['adversary-model'])
        : key.startsWith('codex-') ? 'gpt' // codex CLI thread implies a GPT/Codex run
        : null; // adversary-* thread implies NO family (auth-fallback possible) -> not evidence without adversary-model
      if (advFam && advFam !== primaryFam) return true;
    } else if (/^models(?:[-_]|$)/.test(key)) {
      const toks = val.split(/[,&+/]|\s+/).map((s) => s.trim()).filter(Boolean);
      if (toks.length < 2) continue;
      const fams = new Set();
      let allModels = true;
      for (const tok of toks) { const f = modelFamily(tok); if (!f) { allModels = false; break; } fams.add(f); }
      if (allModels && fams.size >= 2) return true;
    }
  }
  return false;
}

// Human-review evidence (verification axis, path 2): the USER read the diff. Requires a
// `human-reviewed-by:` field whose first token is a real identity — non-empty and NOT a bare model
// name (`human-reviewed-by: claude` is a spoof, not a person; same anti-spoof stance as modelFamily) —
// AND a `Verdict:` whose value is on the explicit PASS whitelist: `PASS` or `PASS WITH NOTES`.
// An empty, pending, or unknown verdict (`Verdict:`, `Verdict: PENDING`, `Verdict: NEEDS REVIEW`)
// states no accepted outcome and does NOT count — fail closed (a covering FAIL additionally blocks
// via hasFail). Coverage (the diff-hash field) is checked by evaluateReviews like any other review,
// and the doc must be a TODAY review (filename scan) — that supplies the timestamp requirement.
// As with het evidence, the gate enforces the evidence is PRESENT and well-formed; truthfulness of
// the declaration rests with the human who wrote it.
function isHumanEvidence(content) {
  const who = parseFields(content)['human-reviewed-by'];
  if (!who || modelFamily(who.split(/\s+/)[0])) return false;
  const m = /^[ \t>*#-]*\*{0,2}verdict\*{0,2}[ \t]*:\*{0,2}[ \t]*(.*)$/im.exec(content);
  if (!m) return false;
  const verdict = m[1].replace(/<!--[\s\S]*?-->/g, '').replace(/[*`]/g, '').trim().toUpperCase();
  return /^PASS(?:\s+WITH\s+NOTES)?$/.test(verdict);
}

function evaluateReviews(reviews, currentHash) {
  // ^ + optional "[ \t>*-]" markers + word-bounded "diff-hash" field + the hash.
  const covers = currentHash
    ? (content) => new RegExp(`^[ \\t>*-]*diff-hash\\b[^\\n:]*:[ \\t]*${currentHash}\\b`, 'm').test(content)
    : () => false;
  // Heterogeneity is detected by isHetEvidence() (family-counting parser, above): a single-model or
  // placeholder-field review does not satisfy it. Human review is detected by isHumanEvidence().
  const matching = currentHash ? reviews.filter((r) => covers(r.content)) : [];
  const failScope = matching.length > 0 ? matching : (currentHash ? [] : reviews);
  const hasFail = failScope.some((r) => /Verdict:\s*FAIL/i.test(r.content));
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
    '  (1) heterogeneous model review [verification]: run the reviewer agent; its doc in docs/reviews/ must carry `diff-hash: <hash>` plus `models: <fam1>, <fam2>` (>=2 model families, e.g. `models: claude, codex`) or `codex-thread: <id>` TOGETHER WITH `primary-model: <your model>` from a different family than the adversary (`adversary-model:` if present, else assumed gpt/codex). An `adversary-thread: <id>` (adversary agent) counts ONLY with an explicit parseable `adversary-model:` of a different family — the agent may auth-fall-back to your own family, so no default is assumed. If your primary model IS GPT/Codex-family, a codex thread is same-family and cannot satisfy (1) — use (2) or (3).',
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
// a heterogeneous model review (>=2 model families, e.g. a codex pass) or a human review. A
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
