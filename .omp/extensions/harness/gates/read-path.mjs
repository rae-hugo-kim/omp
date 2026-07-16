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

/** `scheme:/…` prefix — a virtual URI whose double slash was normalized away
 *  (e.g. `xd:/retain`), observed in live ledger events on omp 17.0.1
 *  (2026-07-16, session-log `{kind:'edit', file:'xd:/retain'}`). POSIX-relative
 *  paths never start with `<word>:/`, so this rejects no legitimate target. */
const URI_SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:\//i;

/** Absolute path of a mutating tool's target when it names a LOCAL file; null
 *  for URI-scheme targets — both the canonical `xd://…` form (`://` anywhere)
 *  and the single-slash normalized `xd:/…` form. Virtual resources must never
 *  enter read/write ledgers as `<cwd>/xd:/…` garbage (live-reproduced on omp
 *  17.0.1, 2026-07-16; r2 counterexample session-log:315). */
export function localFileTarget(p, cwd) {
	if (typeof p !== "string" || p.length === 0) return null;
	if (p.includes("://") || URI_SCHEME_PREFIX.test(p)) return null;
	return resolve(cwd, p);
}

/** Shared normalization: a device/tool result `files` array — string paths
 *  (upstream shape) or objects with a path/file field (defensive) — each entry
 *  passes localFileTarget: URI entries inside RESULT payloads must not
 *  re-pollute the ledgers either. [] when absent or misshaped. */
function normalizedFileList(files, cwd) {
	if (!Array.isArray(files)) return [];
	const out = [];
	for (const f of files) {
		const p = typeof f === "string" ? f : (f && typeof f === "object" ? (f.path ?? f.file ?? f.filePath) : null);
		const t = localFileTarget(p, cwd);
		if (t) out.push(t);
	}
	return out;
}

/** Absolute file paths an ast_edit apply wrote. On omp >=17 the apply is the
 *  xd://resolve dispatch's `inner` ({ action, sourceToolName, sourceResultDetails });
 *  `sourceResultDetails.files` carries the ast_edit apply result. */
export function resolvedAstEditFiles(details, cwd) {
	return normalizedFileList(details?.sourceResultDetails?.files, cwd);
}

/** Absolute file paths on an ast_edit result's own details (`files`) — the
 *  direct-apply shape of an xd://ast_edit dispatch (dryRun:false). */
export function astEditResultFiles(details, cwd) {
	return normalizedFileList(details?.files, cwd);
}

/** v17 xd:// device dispatch envelope on a `write` tool_result's details:
 *  `{ tool, mode, inner }` (tools/resolve.ts writeDeviceDispatch verifies the
 *  same shape). null unless the envelope matches — a plain file write has no
 *  `details.xdev`. */
export function xdevEnvelope(details) {
	const xdev = details && typeof details === "object" ? details.xdev : null;
	if (!xdev || typeof xdev !== "object") return null;
	if (typeof xdev.tool !== "string" || !("mode" in xdev)) return null;
	return xdev;
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

/** Local paths named in an xd://ast_edit dispatch body (JSON args `paths`).
 *  Globs pass through unchanged — context-gate allows non-existent paths
 *  (same semantics as the pre-v17 top-level ast_edit input.paths). */
export function deviceArgPaths(input, cwd) {
	let args;
	try { args = JSON.parse(String(input?.content ?? "")); } catch { return []; }
	if (!args || !Array.isArray(args.paths)) return [];
	const out = [];
	for (const p of args.paths) {
		const t = localFileTarget(p, cwd);
		if (t) out.push(t);
	}
	return out;
}

/** Absolute file targets a mutating tool call touches (plain file tools).
 *  Lives here (not index.ts) so the URI-scheme guard is test-fixed. The
 *  hashline-header fallback reuses SEARCH_ANCHOR_HEADER — same `[path#TAG]`
 *  grammar as search anchors. */
export function editTargets(toolName, input, cwd) {
	if (!input) return [];
	if (toolName === "write") {
		const t = localFileTarget(input.path ?? input.file_path ?? input.filePath, cwd);
		return t ? [t] : [];
	}
	if (toolName === "edit") {
		const targets = new Set();
		// Direct path field (find/replace-style edit tools)...
		const direct = localFileTarget(input.path ?? input.file_path ?? input.filePath, cwd);
		if (direct) targets.add(direct);
		// ...native parsed-target list — OMP >=16.1.17 exposes every parsed hashline
		// target as input.paths (single-file calls also set input.path above)...
		if (Array.isArray(input.paths)) {
			for (const p of input.paths) {
				const t = localFileTarget(p, cwd);
				if (t) targets.add(t);
			}
		}
		// ...and hashline patch headers `[path#TAG]` as a fallback for hosts that
		// don't expose parsed targets. Note an `MV DEST` op row names its
		// destination outside any header; only a host-provided input.paths that
		// carries the DEST tracks it — the header fallback sees the source file only.
		const patch = typeof input.input === "string" ? input.input : "";
		for (const match of patch.matchAll(SEARCH_ANCHOR_HEADER)) {
			const t = localFileTarget(match[1], cwd);
			if (t) targets.add(t);
		}
		return [...targets];
	}
	return [];
}

/** tool_call-side pre-edit gate targets. v17 ast_edit rides `write` with a JSON
 *  body — its `paths` MUST still context-gate (read-before-edit): a bare URI
 *  guard would silently drop the pre-edit invariant for AST rewrites. The device
 *  detection normalizes the same path aliases editTargets honors (path /
 *  file_path / filePath), so an alias-shaped dispatch cannot slip past the gate
 *  (review 2026-07-16 M1 — defense-in-depth; shipped transport sends `path`). */
export function mutationCallTargets(toolName, input, cwd) {
	const rawPath = input?.path ?? input?.file_path ?? input?.filePath;
	if (toolName === "write" && typeof rawPath === "string" && rawPath.trim() === "xd://ast_edit") {
		return deviceArgPaths(input, cwd);
	}
	return editTargets(toolName, input, cwd);
}

/** tool_result-side ledger routing for mutating tools. The xdev envelope is
 *  checked BEFORE plain file targets — structurally fixing the ordering the
 *  v16 wiring got wrong under v17 (device writes fell into the generic file
 *  branch and tracked only the bogus device path). Kinds:
 *    read-anchors — xd grep/ast_grep dispatch: record files as read
 *    apply        — the REAL write (xd resolve-apply / ast_edit direct apply)
 *    preview      — staged ast_edit preview: backpressure-invalidate only
 *    device       — other xd devices: touch no local files
 *    files        — plain file write/edit targets */
export function mutationRoute(toolName, input, details, text, cwd) {
	if (toolName === "write") {
		const xdev = xdevEnvelope(details);
		if (xdev) {
			if (xdev.tool === "grep" || xdev.tool === "ast_grep") {
				return { kind: "read-anchors", files: searchTrackTargets(xdev.inner, text, cwd) };
			}
			if (xdev.tool === "ast_edit") {
				const inner = xdev.inner && typeof xdev.inner === "object" ? xdev.inner : null;
				return inner && inner.applied === true
					? { kind: "apply", files: astEditResultFiles(inner, cwd) }
					: { kind: "preview", files: deviceArgPaths(input, cwd) };
			}
			if (xdev.tool === "resolve") {
				const inner = xdev.inner && typeof xdev.inner === "object" ? xdev.inner : null;
				if (inner && inner.action === "apply" && inner.sourceToolName === "ast_edit") {
					return { kind: "apply", files: resolvedAstEditFiles(inner, cwd) };
				}
				return { kind: "device" };
			}
			return { kind: "device" };
		}
	}
	return { kind: "files", files: editTargets(toolName, input, cwd) };
}
