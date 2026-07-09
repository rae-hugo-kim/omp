// read-path.mjs — resolve the real local file a `read` call targets.
//
// Imported by index.ts (a helper module, never spawned as a gate). It strips a
// trailing read selector so the path logged to read-log.txt matches the bare
// path context-gate later compares an edit against; it returns "" for web URLs
// and internal URIs, which are not local files worth tracking.
//
// The selector regex must mirror the read.md grammar EXACTLY: any documented
// form left unstripped logs a phantom path (e.g. "foo.ts:raw"), which makes a
// later edit of "foo.ts" falsely fail context-gate ("read it before editing").

import { resolve } from "node:path";

// read.md selector grammar (path-utils splitPathAndSel):
//   :raw            :conflicts
//   :N  :LN  :N-  :N..              (start / open-ended)
//   :A-B  :LA-LB  :A..B             (range; `..` is a forgiving `-` alias)
//   :A+C  :LA+LC                    (count)
//   :R1,R2,...                      (comma multi-range)
//   :range:raw  |  :raw:range       (raw output, EITHER order)
const RANGE = String.raw`L?\d+(?:(?:[-+]|\.\.)L?\d*)?(?:,L?\d+(?:(?:[-+]|\.\.)L?\d*)?)*`;
export const READ_SELECTOR = new RegExp(
	String.raw`:(?:raw(?::${RANGE})?|conflicts|${RANGE}(?::raw)?)$`,
);

/** Local file path a `read` call targets, selector stripped; "" for URLs/internal URIs. */
export function readTarget(input, cwd) {
	const raw = input?.path;
	if (typeof raw !== "string" || !raw || raw.includes("://")) return "";
	return resolve(cwd, raw.replace(READ_SELECTOR, ""));
}

/** Absolute file paths an ast_edit apply wrote. The apply surfaces as a `resolve` tool_result
 *  whose `details.sourceResultDetails.files` carries the ast_edit apply result — string paths
 *  (upstream shape) or objects with a path/file field (defensive). Resolved against cwd;
 *  returns [] when absent or misshaped (the caller then records nothing for that apply). */
export function resolvedAstEditFiles(details, cwd) {
	const files = details?.sourceResultDetails?.files;
	if (!Array.isArray(files)) return [];
	const out = [];
	for (const f of files) {
		const p = typeof f === "string" ? f : (f && typeof f === "object" ? (f.path ?? f.file ?? f.filePath) : null);
		if (typeof p === "string" && p.length > 0) out.push(resolve(cwd, p));
	}
	return out;
}

/** Local files a grep/ast_grep result certified with `[path#TAG]` edit anchors.
 *  omp mints a whole-file snapshot per rendered file (grep.md: recordFileSnapshot)
 *  and its edit tool accepts those tags as anchors ("from your latest read/search"),
 *  so context-gate must treat them as read — otherwise a grep-anchored edit
 *  false-blocks (live-reproduced on omp 16.3.12, 2026-07-09).
 *
 *  Primary source: details.files — absolute path strings on BOTH grep and ast_grep,
 *  single and grouped multi-file results alike (measured on omp 16.3.12). Any array
 *  there is trusted as-is, including empty (no matches -> nothing anchored).
 *  Fallback (details.files absent/misshaped): bracketed `[path#TAG]` headers in the
 *  result text — the single-file output form. Grouped tree headers (`## file.ts#TAG`)
 *  are deliberately NOT reconstructed: directory-stack parsing is format-coupled and
 *  a wrong join would track the WRONG file (loosening the gate), while under-tracking
 *  merely keeps the old strictness. Internal URIs (`://`) never track — virtual
 *  resources don't mint editable anchors. */
const SEARCH_ANCHOR_HEADER = /^\[([^\]\n#]+)#[0-9A-Fa-f]{4,}\]\s*$/gm;
export function searchTrackTargets(details, text, cwd) {
	const out = new Set();
	const files = details?.files;
	if (Array.isArray(files)) {
		for (const f of files) {
			if (typeof f === "string" && f && !f.includes("://")) out.add(resolve(cwd, f));
		}
		return [...out];
	}
	if (typeof text !== "string" || !text) return [];
	for (const m of text.matchAll(SEARCH_ANCHOR_HEADER)) {
		if (!m[1].includes("://")) out.add(resolve(cwd, m[1]));
	}
	return [...out];
}
