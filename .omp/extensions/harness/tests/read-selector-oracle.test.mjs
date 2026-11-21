// read-selector-oracle.test.mjs — #109: READ_SELECTOR against omp's own splitter.
//
// read-path.mjs claims its line-selector regex mirrors omp's `splitPathAndSel`, with two named
// deviations. This test holds that claim to a reference: ORACLE below is a port of the shipped
// splitter (omp 18.22.0, packages/tui/src/tools/read.ts `splitPathAndSel` + `foldListColons`,
// packages/tui/src/tools/line-ranges.ts), and a deterministic grammar-biased generator compares
// "what the oracle peels" with "what READ_SELECTOR strips" on every input.
//
// Any disagreement outside the two documented classes fails — in particular a regex edit that
// starts stripping MORE than omp (a file marked read that was never read) or less.
// On an omp upgrade: re-port ORACLE from the new splitter first, then fix the regex until green.
//
// Run: node --test .omp/extensions/harness/tests/read-selector-oracle.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { READ_SELECTOR } from '../gates/read-path.mjs';

// ── ORACLE (port; identifiers follow the upstream source) ──────────────────────────────────
const LINE_RANGE = String.raw`L?(\d+)(?:(\.\.|[-+])L?(\d+)?)?`;
const CHUNK = `(?:${LINE_RANGE}(?<=[\\d.-])|-\\d+)`;
const LIST = `${CHUNK}(?:,${CHUNK})*`;
const SELECTOR_RE = new RegExp(`^(?:${LIST}|raw|conflicts|img)$`, 'i');
const LIST_RE = new RegExp(`^(?:${LIST})$`, 'i');
const RAW_RE = /^raw$/i;
const DIGITS_RE = /^\d+$/;

function foldListColons(path, list, minColon) {
  const chunks = list.split(',').reverse();
  let base = path;
  let merged = false;
  while (true) {
    const colon = base.lastIndexOf(':');
    if (colon < minColon) break;
    const segment = base.slice(colon + 1);
    if (segment.endsWith(',')) {
      const head = segment.slice(0, -1);
      if (!LIST_RE.test(head)) break;
      chunks.push(...head.split(',').reverse());
    } else {
      const parts = segment.split(',');
      const last = parts.pop();
      const next = chunks.at(-1);
      if (!DIGITS_RE.test(last) || !DIGITS_RE.test(next)) break;
      if (parts.length > 0 && !LIST_RE.test(parts.join(','))) break;
      chunks[chunks.length - 1] = `${last}-${next}`;
      chunks.push(...parts.reverse());
      merged = true;
    }
    base = base.slice(0, colon);
  }
  if (merged && chunks.length === 1) return { basePath: path, list };
  return { basePath: base, list: chunks.reverse().join(',') };
}

/** The path omp is left with after peeling a trailing selector. */
function oraclePath(input) {
  const colon = input.lastIndexOf(':');
  if (colon <= 0) return input;
  const last = input.slice(colon + 1);
  if (!SELECTOR_RE.test(last)) return input;
  let base = input.slice(0, colon);
  let list;
  let rawSuffix = false;
  if (LIST_RE.test(last)) {
    list = last;
  } else if (RAW_RE.test(last)) {
    const prev = base.lastIndexOf(':');
    const segment = base.slice(prev + 1);
    if (prev > 0 && LIST_RE.test(segment)) {
      list = segment;
      rawSuffix = true;
      base = base.slice(0, prev);
    }
  }
  if (list === undefined) return base;
  ({ basePath: base } = foldListColons(base, list, 1));
  if (!rawSuffix) {
    const prev = base.lastIndexOf(':');
    if (prev > 0 && RAW_RE.test(base.slice(prev + 1))) return base.slice(0, prev);
  }
  return base;
}

// ── Deterministic generator: selector-shaped suffixes, valid and nearly valid ──────────────
function generator(seed) {
  let state = seed;
  const next = (n) => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) % n;
  };
  const pick = (options) => options[next(options.length)];
  const num = () => pick(['1', '5', '12', '30', '100', '0']);
  const L = () => pick(['', '', '', 'L', 'l']);
  const chunk = () => pick([
    () => `${L()}${num()}`, () => `${L()}${num()}`, () => `${L()}${num()}-`, () => `${L()}${num()}..`,
    () => `${L()}${num()}-${L()}${num()}`, () => `${num()}..${num()}`, () => `${L()}${num()}+${L()}${num()}`,
    () => `-${num()}`, () => `-${num()}`, () => `${num()}+`, () => `-${num()}+${num()}`, () => `-${num()}-${num()}`,
    () => `${num()}-L`, () => 'x', () => '',
  ])();
  const list = () => {
    let s = chunk();
    for (let i = next(4); i > 0; i--) s += pick([',', ',', ',', ',:', ',:', ':', ', ']) + chunk();
    return s + pick(['', '', '', '', '', ',']);
  };
  const segment = () => ':' + pick([() => pick(['raw', 'RAW', 'Raw']), () => pick(['img', 'IMG', 'conflicts', 'Conflicts', 'image']), list, list, list, list])();
  return () => {
    let s = pick(['f.md', 'src/a-b.ts', 'd/v2.ts', 'pkg:/x.ts']);
    for (let i = 1 + next(3); i > 0; i--) s += segment();
    return s;
  };
}

test('READ_SELECTOR strips exactly what omp peels, except the two documented deviations', () => {
  const input = generator(0x9e3779b9);
  const TOTAL = 300_000;
  let peeled = 0;
  const seen = { tailCount: 0, numberFold: 0 };
  for (let i = 0; i < TOTAL; i++) {
    const s = input();
    const upstream = oraclePath(s);
    const ours = s.replace(READ_SELECTOR, '');
    if (upstream !== s) peeled++;
    if (upstream === ours) continue;
    // Deviation A — `:-N+C` / `:-N-C` (AC of #109). omp peels nothing; we strip that one suffix.
    if (/:-\d+[-+]\d+$/.test(s)) {
      assert.equal(upstream, s, `omp peeled something from a :-N+C input: ${s}`);
      assert.equal(ours, s.replace(/:-\d+[-+]\d+$/, ''), `more than the :-N+C suffix was stripped: ${s}`);
      seen.tailCount++;
      continue;
    }
    // Deviation B — omp folds `N:M` between two bare numbers of a list into `N-M`. Not mirrored:
    // we must strip LESS than omp here (a phantom, never a wrong file).
    assert.ok(
      ours.startsWith(upstream) && ours.length > upstream.length && /\d:\d/.test(s.slice(upstream.length)),
      `unexplained disagreement on ${JSON.stringify(s)}: omp -> ${JSON.stringify(upstream)}, READ_SELECTOR -> ${JSON.stringify(ours)}`,
    );
    seen.numberFold++;
  }
  // The comparison is only evidence if the generator really exercises the grammar.
  assert.ok(peeled > TOTAL / 3, `generator too weak: omp peeled a selector on only ${peeled}/${TOTAL} inputs`);
  assert.ok(seen.tailCount > 0 && seen.numberFold > 0, `both deviation classes must occur: ${JSON.stringify(seen)}`);
});

test('ORACLE reproduces forms measured on the live read tool (omp 18.22.0)', () => {
  for (const [input, path] of [
    ['a.md:1-2,-2', 'a.md'],
    ['a.md:1-2,:-2', 'a.md'],
    ['a.md:RAW:3-4', 'a.md'],
    ['a.md:-6+2', 'a.md:-6+2'], // "Path 'a.md:-6+2' not found"
    ['a.md:50+', 'a.md:50+'],
    ['a.md', 'a.md'],
  ]) {
    assert.equal(oraclePath(input), path, input);
  }
});
