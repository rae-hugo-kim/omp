// read-ledger-wiring.test.mjs — #109: what a read / write really touched must reach the
// ledgers as the REAL file, end to end. Drives the real extension handlers
// (tests/helpers/harness-handlers.mjs) with event fixtures against a temp session root, with
// the real gates spawned — so a path the adapter resolves wrongly shows up as a wrong read-log
// entry or a wrong context-gate verdict, not as a matched source string.
//
// The read events carry the result details omp 18.22.0 emits (measured from this repo's
// session transcripts, 2026-11-19): a plain file read names its file in details.meta.source, a
// read that resolved its input (query, SQLite, archive) also in details.resolvedPath, and a
// list read is marked by details.displayReadTargets (parts) + displayReadTargetLinks.
//
// Run: node --test .omp/extensions/harness/tests/read-ledger-wiring.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadHarness, ctxFor } from './helpers/harness-handlers.mjs';
import { mkdtempReal } from './helpers/real-tmpdir.mjs';

const { handlers } = await loadHarness();
const call = handlers.tool_call[0];
const result = handlers.tool_result[0];

/** A git repo session root (the cross-repo guard resolves the target's repo) holding `files`. */
function session(t, files) {
  const root = mkdtempReal('read-ledger-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  const r = spawnSync('git', ['init', '-q'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  for (const f of files) {
    mkdirSync(join(root, f, '..'), { recursive: true });
    writeFileSync(join(root, f), '{"scripts":{}}\n');
  }
  return root;
}
/** Distinct read-log entries (read-tracker logs each path raw AND slash-normalised). */
const readLog = (root) => {
  const p = join(root, '.omp', 'harness-state', 'read-log.txt');
  return existsSync(p) ? [...new Set(readFileSync(p, 'utf8').split('\n').filter((l) => l && !l.startsWith('#origin ')))] : [];
};
const readEvent = (root, path, details) =>
  result({ toolName: 'read', input: { path }, isError: false, details, content: [{ type: 'text', text: '1:x' }] }, ctxFor(root));
/** A plain file read of `file`. */
const read = (root, path, file) => readEvent(root, path, { meta: { source: { type: 'path', value: join(root, file) } } });
/** A read that resolved its input to `reported` (query, SQLite, archive member). */
const readResolved = (root, path, reported) =>
  readEvent(root, path, { resolvedPath: join(root, reported), meta: { source: { type: 'path', value: join(root, reported) } } });
/** A list read: `parts` as displayed, `files` index-aligned (the file omp opened for each part). */
const readList = (root, path, parts, files) =>
  readEvent(root, path, {
    notes: [`Note: interpreted as ${parts.length} paths: ${parts.join(', ')}`],
    displayReadTargets: parts,
    displayReadTargetLinks: files.map((f) => join(root, f)),
  });
const blocked = async (root, toolName, input) => (await call({ toolName, input }, ctxFor(root)))?.block === true;

// List support was split off to #150: omp links every part it OPENED, also one it did not
// display (measured: `a.md:99999;b.md:2-3` links a.md and prints only "beyond end of file"), so
// a list read records nothing and each file must be read alone before it can be edited.
test('a list read records nothing — every part stays gated until it is read alone', async (t) => {
  for (const [path, parts] of [['a.md;b.md', ['a.md', 'b.md']], ['a.md:1-5;b.md:3-9', ['a.md:1-5', 'b.md:3-9']], ['a.md:99999;b.md:2-3', ['a.md:99999', 'b.md:2-3']]]) {
    const root = session(t, ['a.md', 'b.md']);
    await readList(root, path, parts, ['a.md', 'b.md']);
    assert.deepEqual(readLog(root), [], `after read ${path}`);
    assert.equal(await blocked(root, 'write', { path: 'a.md', content: 'x' }), true);
    assert.equal(await blocked(root, 'write', { path: 'b.md', content: 'x' }), true);
    await read(root, 'a.md', 'a.md');
    assert.equal(await blocked(root, 'write', { path: 'a.md', content: 'x' }), false, 'read alone, a.md is editable');
    assert.equal(await blocked(root, 'write', { path: 'b.md', content: 'x' }), true);
  }
});

test('a ; that omp did not fan out (a SQL query) records only what was read', async (t) => {
  const root = session(t, ['a.sqlite', 'b.txt']);
  await readResolved(root, 'a.sqlite?q=SELECT name FROM users; b.txt', 'a.sqlite');
  assert.deepEqual(readLog(root), [join(root, 'a.sqlite')]);
  assert.equal(await blocked(root, 'write', { path: 'b.txt', content: 'x' }), true, 'b.txt was SQL text, never read');
});

test('a ?q= read marks the file itself as read — the later edit is not false-blocked', async (t) => {
  const root = session(t, ['package.json']);
  assert.equal(await blocked(root, 'write', { path: 'package.json', content: '{}' }), true, 'unread file must block first');
  await readResolved(root, 'package.json?q=.scripts', 'package.json');
  assert.deepEqual(readLog(root), [join(root, 'package.json')]);
  assert.equal(await blocked(root, 'write', { path: 'package.json', content: '{}' }), false);
});

test('a comma-tail read and an archive member query record the file, not a phantom', async (t) => {
  const root = session(t, ['a.md', 'arc.tar']);
  await read(root, 'a.md:1-30,-30', 'a.md');
  await readResolved(root, 'arc.tar:member.json?q=.x', 'arc.tar:member.json'); // omp reports <archive>:<member>
  assert.deepEqual(readLog(root), [join(root, 'a.md'), join(root, 'arc.tar')]);
});

test('reading an archive member does not mark a look-alike literal file as read', async (t) => {
  const root = session(t, ['pack.zip', 'pack.zip:x']);
  await readResolved(root, 'pack.zip:x', 'pack.zip'); // with pack.zip present, omp opens the archive
  assert.deepEqual(readLog(root), [join(root, 'pack.zip')]);
  assert.equal(await blocked(root, 'write', { path: 'pack.zip:x', content: 'x' }), true, 'the literal file pack.zip:x was never read');
});

// r6 review: guessing the file from the input is confined to a result WITHOUT details. Details
// that name no source (measured: a failed document conversion returns `{fileSize}` only) record
// nothing, so the file stays gated.
test('only a result without details falls back to the grammar — details that name no source record nothing', async (t) => {
  const root = session(t, ['a.md', 'notes', 'notes?.md']);
  await readEvent(root, 'a.md:1-5', { fileSize: 10 });
  assert.deepEqual(readLog(root), []);
  assert.equal(await blocked(root, 'write', { path: 'a.md', content: 'x' }), true);
  await readEvent(root, 'a.md:1-5', undefined);
  assert.deepEqual(readLog(root), [join(root, 'a.md')]);
  await readEvent(root, 'notes?.md', undefined); // `notes` + query, or the literal file notes?.md?
  assert.deepEqual(readLog(root), [join(root, 'a.md')]);
  assert.equal(await blocked(root, 'write', { path: 'notes', content: 'x' }), true);
});

// omp reports a PDF page read with the PDF in resolvedPath and the rendered screenshot as the
// source (read.ts `#readPdfPageScreenshot`): the PDF is what was read.
test('a PDF page read records the PDF, not the rendered screenshot', async (t) => {
  const root = session(t, ['doc.pdf', 'cache/shot-page3.png']);
  await readEvent(root, 'doc.pdf:page3.png', { resolvedPath: join(root, 'doc.pdf'), meta: { source: { type: 'path', value: join(root, 'cache/shot-page3.png') } } });
  assert.deepEqual(readLog(root), [join(root, 'doc.pdf')]);
  assert.equal(await blocked(root, 'write', { path: 'doc.pdf', content: 'x' }), false);
  assert.equal(await blocked(root, 'write', { path: 'cache/shot-page3.png', content: 'x' }), true);
});

test('write through a copied [path#TAG] wrapper is gated as the real file', async (t) => {
  const root = session(t, ['src/foo.ts']);
  const wrappers = ['[src/foo.ts#1A2B]', '[src/foo.ts]', '[src/foo.ts#1A2B] '];
  for (const path of wrappers) {
    assert.equal(await blocked(root, 'write', { path, content: 'x' }), true, `overwriting an unread existing file through ${JSON.stringify(path)} must block`);
  }
  await read(root, 'src/foo.ts', 'src/foo.ts');
  for (const path of wrappers) assert.equal(await blocked(root, 'write', { path, content: 'x' }), false);
});

test('a wrapper write is recorded under the real file, so the next edit is not false-blocked', async (t) => {
  const root = session(t, []);
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'new.ts'), 'x\n'); // the write tool has just created it
  await result({ toolName: 'write', input: { path: '[src/new.ts#1A2B]', content: 'x\n' }, isError: false }, ctxFor(root));
  assert.ok(readLog(root).includes(join(root, 'src', 'new.ts')), JSON.stringify(readLog(root)));
  assert.equal(await blocked(root, 'edit', { path: 'src/new.ts' }), false);
});
