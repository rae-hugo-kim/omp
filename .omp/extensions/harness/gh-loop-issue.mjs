#!/usr/bin/env node
// gh-loop-issue.mjs — finding/decision -> `gh issue create` DECISION (autonomy Q2, seed AC3/AC4).
//
// Not a hook. Invoked by the `gh-loop` skill. It does NOT call GitHub — the `gh` calls are the
// caller's SEAM: the skill runs `gh issue list --json title,labels,body --state open --label gh-loop`,
// feeds the result as `existing`, gets a decision here, then runs `gh issue create` with `payload`
// only when action==="create". This keeps the dedup/throttle/label logic unit-testable with no
// live GitHub (analysis Q2.4 "gh issue create + 얇은 스킬", Q2.5 "dedup/throttle/라벨 필요").
//
//   decideIssue({ kind, title, body?, labels?, existing?, created?, cap? }) ->
//     { action: "create"|"skip"|"block", reason, marker, payload?: { title, body, labels } }
//
//   - dedup  : an existing OPEN issue carrying the same marker, OR an equal normalized title -> skip
//   - throttle: created >= cap (per-run create budget; loop-safety, AC4) -> block
//   - else   : create, with a stable dedup marker embedded in the body and labels assembled by kind
//
// kind "finding"  -> base labels ["gh-loop"]
// kind "decision" -> base labels ["gh-loop","needs-decision"]   (the HITL question issue; AC2)
//
// CLI (for the skill):
//   node gh-loop-issue.mjs decide --kind finding --title "..." [--body "..."] \
//        [--label x]... [--cap N] [--created N] [--existing-json '<json array>'] [--out <dir>]
//   -> prints the decision JSON on stdout (exit 0). With --out, ALSO writes <dir>/{action,title,
//      body.md,labels} (node-only, NO jq) so the skill reads fields from files. Malformed input ->
//      a fail-safe {action:"block"} decision (exit 0): the loop degrades to "do nothing", never crashes.

// 32-bit FNV-1a -> 8-char hex. Stable, dependency-free; only needs to be collision-resistant
// enough to disambiguate finding titles within one repo (not a security hash).
function hash8(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Compare key: case-insensitive, whitespace-collapsed. Two findings whose titles differ only by
// case/spacing are the same finding (cheap dedup beyond the exact marker).
export function normalizeTitle(t) {
  return String(t == null ? '' : t).toLowerCase().replace(/\s+/g, ' ').trim();
}

// Stable per-finding marker embedded in the issue body (HTML comment, invisible in rendered md).
// Re-running the loop on the same finding regenerates the same marker -> dedup hit even if a human
// edited the visible title/body. Keyed by kind so a finding and a decision on the same topic differ.
export function dedupMarker(kind, title) {
  return `<!-- gh-loop:${kind}:${hash8(kind + '\u0000' + normalizeTitle(title))} -->`;
}

// Base labels by kind + caller extras, unique, order-stable (base first).
export function assembleLabels(kind, extra = []) {
  const base = kind === 'decision' ? ['gh-loop', 'needs-decision'] : ['gh-loop'];
  const out = [];
  for (const l of [...base, ...(Array.isArray(extra) ? extra : [])]) {
    const v = String(l == null ? '' : l).trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

export function decideIssue({ kind = 'finding', title, body = '', labels = [], existing = [], created = 0, cap = Infinity } = {}) {
  const k = kind === 'decision' ? 'decision' : 'finding';
  const cleanTitle = String(title == null ? '' : title).trim();
  const marker = dedupMarker(k, cleanTitle);

  if (!cleanTitle) return { action: 'block', reason: 'empty title', marker };

  // 1. dedup — marker match (exact, survives human edits) or normalized-title match.
  const norm = normalizeTitle(cleanTitle);
  const dup = (Array.isArray(existing) ? existing : []).find((e) => {
    if (!e) return false;
    if (typeof e.body === 'string' && e.body.includes(marker)) return true;
    return normalizeTitle(e.title) === norm;
  });
  if (dup) {
    const ref = dup.number != null ? `#${dup.number}` : `"${dup.title}"`;
    return { action: 'skip', reason: `duplicate of open issue ${ref}`, marker };
  }

  // 2. throttle — block when the per-run create budget (caller-supplied `created`) OR the OBSERVED
  //    open-loop-issue count (`existing.length`, NOT caller-supplied) reaches `cap`. The latter is a
  //    backstop so the brake still fires even if the caller miscounts `created` (loop-safety, AC4).
  const capNum = typeof cap === 'number' && Number.isFinite(cap) ? cap : Infinity;
  const openCount = Array.isArray(existing) ? existing.length : 0;
  if (created >= capNum || openCount >= capNum) {
    const why = created >= capNum ? `per-run ${created}/${capNum}` : `open issues ${openCount}/${capNum}`;
    return { action: 'block', reason: `cap reached (${why})`, marker };
  }

  // 3. create — embed the marker so the next run dedups against it. Coerce body defensively (a
  //    direct caller could pass a non-string; the CLI always passes a string).
  const bodyStr = typeof body === 'string' ? body : body == null ? '' : String(body);
  const finalBody = bodyStr.includes(marker) ? bodyStr : `${bodyStr ? `${bodyStr}\n\n` : ''}${marker}`;
  return {
    action: 'create',
    reason: k === 'decision' ? 'needs-decision question issue' : 'new finding',
    marker,
    payload: { title: cleanTitle, body: finalBody, labels: assembleLabels(k, labels) },
  };
}

// --- CLI ---------------------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { label: [] };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--kind') opts.kind = argv[++i];
    else if (a === '--title') opts.title = argv[++i];
    else if (a === '--body') opts.body = argv[++i];
    else if (a === '--label') opts.label.push(argv[++i]);
    else if (a === '--cap') opts.cap = Number(argv[++i]);
    else if (a === '--created') opts.created = Number(argv[++i]);
    else if (a === '--existing-json') opts.existingJson = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
  }
  return opts;
}

// Run as a script (not when imported by tests). import.meta.url vs argv[1] is the standard ESM
// main-module check.
import { realpathSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
const isMain = (() => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();

if (isMain) {
  const mode = process.argv[2];
  if (mode !== 'decide') {
    console.error('gh-loop-issue: usage — decide --kind finding|decision --title "..." [--body s] [--label l]... [--cap N] [--created N] [--existing-json json] [--out dir]');
    process.exit(1);
  }
  const o = parseArgs(process.argv.slice(2));
  let existing = [];
  if (o.existingJson) {
    try { const p = JSON.parse(o.existingJson); if (Array.isArray(p)) existing = p; }
    catch { /* fail-safe: treat unparseable list as empty -> may re-create, never crash */ }
  }
  const decision = decideIssue({
    kind: o.kind, title: o.title, body: o.body || '', labels: o.label,
    existing, created: Number.isFinite(o.created) ? o.created : 0,
    cap: Number.isFinite(o.cap) ? o.cap : Infinity,
  });
  if (o.out) {
    // Serialize the decision to files so the skill consumes it with zero JSON parsing in shell
    // (no jq dependency): `--title "$(cat <dir>/title)"`, `--body-file <dir>/body.md`, labels via read.
    mkdirSync(o.out, { recursive: true });
    const p = decision.payload || {};
    writeFileSync(join(o.out, 'action'), `${decision.action}\n`);
    writeFileSync(join(o.out, 'title'), `${p.title || ''}\n`);
    writeFileSync(join(o.out, 'body.md'), p.body || '');
    writeFileSync(join(o.out, 'labels'), (p.labels || []).map((l) => `${l}\n`).join(''));
  }
  process.stdout.write(JSON.stringify(decision));
  process.exit(0);
}
