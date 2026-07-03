// edit-targets-wiring.test.mjs — editTargets (index.ts) hashline `edit` target sources.
//
// OMP >=16.1.17 exposes every parsed hashline target on the extension event as
// `event.input.paths` (and `event.input.path` for single-file calls). The adapter
// must consult that native list FIRST — it is the only source that can carry an
// `MV DEST` path (v16.2.0 op), which never appears in a `[path#TAG]` header — while
// KEEPING the header-regex fallback for hosts that don't expose parsed targets.
//
// editTargets is not exported from the extension entry point, so (matching the
// wiring assertions in write-tracker.test.mjs) these are source-level checks: the
// quoted field accesses in the `edit` branch ARE the behavior contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const INDEX_TS = join(dirname(fileURLToPath(import.meta.url)), '..', '.omp', 'extensions', 'harness', 'index.ts');
const src = readFileSync(INDEX_TS, 'utf-8');

function editBranch() {
  const start = src.indexOf('if (toolName === "edit")');
  const end = src.indexOf('if (toolName === "ast_edit")');
  assert.ok(start !== -1 && end > start, 'editTargets must keep distinct edit / ast_edit branches');
  return src.slice(start, end);
}

test('edit branch merges the native parsed-target list (input.paths, OMP >=16.1.17)', () => {
  const branch = editBranch();
  const native = branch.indexOf('Array.isArray(input.paths)');
  const fallback = branch.indexOf('HASHLINE_HEADER');
  assert.ok(native !== -1,
    'edit targets must consult event.input.paths via real code (Array.isArray guard), not a comment');
  assert.ok(fallback !== -1 && native < fallback,
    'native paths handling must precede the header-regex fallback');
});

test('edit branch keeps the [path#TAG] header fallback for older hosts', () => {
  assert.match(editBranch(), /HASHLINE_HEADER/,
    'header parsing must remain as the pre-16.1.17 fallback');
});

test('edit branch still honors the direct path field (find/replace-style edits)', () => {
  assert.match(editBranch(), /input\.path\b/,
    'single-file edit tools set a direct path field');
});
