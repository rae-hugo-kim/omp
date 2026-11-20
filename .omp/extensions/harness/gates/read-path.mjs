// read-path.mjs — resolve the real local files a `read` / `write` / `edit` call targets.
//
// Imported by index.ts (a helper module, never spawned as a gate). It yields the
// bare file path context-gate later compares an edit against: for a read, the
// file omp reports it read (or, for a result that carries no details at all, the
// path with its selector, `?` query or container member stripped); for a write,
// the path with its hashline wrapper removed. Web URLs / internal URIs — not local
// files worth tracking — yield nothing.
//
// The two failure directions are not symmetric. A form omp accepts that is left
// unstripped logs a phantom path (e.g. "foo.ts:raw"), so a later edit of "foo.ts"
// falsely fails context-gate — annoying, safe. The worse direction marks a file as
// read that never was, or misses the file a write really touches. Where this
// module cannot know what omp did, it records nothing or a phantom.
//
// Mirrored against omp 18.22.0 (2026-11-20, #109). Sources: `omp://tools/read.md`
// (selector grammar, modes, internal URL registry, result details), `xd://read/sources`
// (special source selectors — the model-facing canon since 18.20.0),
// `omp://tools/write.md`, and the v18.22.0 source: `splitPathAndSel`
// (packages/tui/src/tools/read.ts + line-ranges.ts), `readDetailsLinkPath`
// (packages/coding-agent/src/tools/read.ts), `read-archive.ts`,
// `unwrapHashlineHeaderPath` (…/tools/hashline-header-path.ts). Forms marked
// "measured" were run against the live tools on that version. Recheck on every omp
// upgrade; tests/read-selector-oracle holds READ_SELECTOR to a port of the splitter
// and names its two deviations.

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

// Line selector grammar (splitPathAndSel, case-insensitive):
//   :raw   :conflicts   :img        (standalone; :img — SVG/SVGZ as PNG, 18.2.9+)
//   :N  :LN  :N-  :N..              (start / open-ended)
//   :A-B  :LA-LB  :A..B             (range; `..` is a forgiving `-` alias)
//   :A+C  :LA+LC                    (count)
//   :-N                             (tail: last N lines)
//   :R1,R2,...                      (comma list; an item is a range chunk or a tail,
//                                    `:1-12,-15` — 18.12.4)
//   :R1,:R2                         (the colon may repeat after a comma, `:1-30,:-30`
//                                    reads as `:1-30,-30` — 18.12.4, measured)
//   :list:raw  |  :raw:list         (raw output, EITHER order)
//   :-N+C  :-N-C                    (accepted by the URL-side splitter only; a local
//                                    `a.md:-6+2` is "not found" (measured). Stripping it
//                                    anyway is safe because a FAILED read is never
//                                    tracked: a single read fails as isError, a list
//                                    read is not tracked at all)
// A range chunk must end in a digit, `.` or `-` (upstream lookbehind): `:50+` is no selector.
// NOT mirrored: the splitter also folds `:1-3,5:10` (a colon between two bare numbers of a
// multi-item list) into `:1-3,5-10`. read.md does not document it; unstripped it degrades
// to a phantom (the safe direction).
const CHUNK = String.raw`L?\d+(?:(?:\.\.|[-+])L?\d*)?(?<=[\d.-])`;
const ITEM = String.raw`(?:${CHUNK}|-\d+)`;
const LIST = String.raw`${ITEM}(?:,:?${ITEM})*`;
export const READ_SELECTOR = new RegExp(
	String.raw`:(?:raw(?::${LIST})?|conflicts|img|${LIST}(?::raw)?|-\d+[-+]\d+)$`,
	"i",
);

/** Longest input the grammar looks at (PATH_MAX). The selector regex is tried from every
 *  `:` (quadratic on a `:1,:1,:1,…` path) and the longer-reading scan in `grammarTarget`
 *  stats one candidate per `:` / `?`, so both need a bound. A bound that covers only
 *  PART of an input would peel part of a selector, or answer "no longer reading exists"
 *  for readings it never looked at — and a longer string can still name a real file once
 *  `resolve` collapses it (r6 review: `./`×2100 + `notes?copy.docx`). So an input longer
 *  than this is not interpreted at all: nothing is recorded. */
const PATH_MAX = 4096;

// Container files: everything after the container's extension addresses something
// INSIDE it — an archive member (`arc.tar:dir/member.json?q=.x`, 18.20.0), a SQLite
// table / row / query (`db.sqlite:table:key`, `db.sqlite?q=SELECT …`), a PDF page image
// (`doc.pdf:page3.png`, 18.13.0). The ledger records the container, the file an edit or
// write would replace. Extension tables: read.md "Archives" / "SQLite databases" /
// "Documents". Version-coupled like the scheme list below: an extension omp adds
// degrades to a phantom until it is listed.
const ARCHIVE_EXTENSIONS =
	String.raw`tar(?:\.(?:gz|bz2|xz|zst|z))?|tgz|tbz2?|txz|tzst|` + // tar family
	String.raw`zip|jar|war|ear|apk|whl|ipa|xpi|vsix|nupkg|cbz|` + // ZIP family
	String.raw`rar|cbr|7z|iso|cab|cpio|rpm|ar|a|lib|deb|lzh|lha|arj|asar|` + // standalone
	String.raw`gz|bz2|xz|zst|z|lzma`; // single-stream
// In an INPUT path the selector follows the extension as `:member` or `?query`.
const INPUT_CONTAINER = new RegExp(String.raw`\.(?:${ARCHIVE_EXTENSIONS}|sqlite3?|db3?|pdf)(?=[:?])`, "gi");
// In a path omp REPORTS, `?` is an ordinary file-name character and only an ARCHIVE is
// followed by `:member` (read-archive.ts); a SQLite or PDF read reports the file itself.
const REPORTED_ARCHIVE = new RegExp(String.raw`\.(?:${ARCHIVE_EXTENSIONS})(?=:)`, "gi");

function isFile(path) {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

/** True for any virtual/remote target: canonical `scheme://…` anywhere in the
 *  string, or the single-slash normalized `scheme:/…` prefix the omp event
 *  plumbing emits (live-observed: session-log `xd:/retain`, `xd:/recall`).
 *  Function declaration (hoisted) so every ledger entry point below shares ONE
 *  guard — r3: the read and search-anchor paths previously checked only `://`. */
function isVirtualPath(p) {
	return p.includes("://") || URI_SCHEME_PREFIX.test(p);
}

/** Local file behind a path omp REPORTED, or null. The reported path is the file
 *  itself, with one exception: an archive member read as JSON or PDF is reported as
 *  `<archive>:<member>` (read-archive.ts). So when a prefix of the reported path is an
 *  existing archive FILE (omp skips directory candidates), the path may stand for that
 *  archive. It does when exactly one such archive exists and the reported string itself
 *  names nothing on disk; when both exist (`pack.zip` next to a real file named
 *  `pack.zip:x.json`), or several archives do, the report cannot say which was read and
 *  nothing is recorded. */
function reportedTarget(reported, cwd) {
	const self = localFileTarget(reported, cwd);
	if (!self) return null;
	const archives = [];
	for (const match of reported.matchAll(REPORTED_ARCHIVE)) {
		const archive = resolve(cwd, reported.slice(0, match.index + match[0].length));
		if (isFile(archive)) archives.push(archive);
	}
	if (archives.length === 0) return self;
	return archives.length === 1 && !existsSync(self) ? archives[0] : null;
}

/** Local file a read path names by GRAMMAR alone, or null — used only for a result
 *  that carries no details. The pick is the earliest container before any `?`, else
 *  the part before the `?` query as it stands, else the path without its line selector
 *  (`data.json?q=.x:1-1` — the selector addresses the query output, so it goes with
 *  the query).
 *
 *  omp does not resolve by grammar alone: it prefers existing literal files and tries
 *  archive / SQLite candidates against the disk, in an order this module does not
 *  reproduce. Every such alternative is a LONGER prefix of the path, ending where a
 *  `:` or `?` starts or at the end (`notes?.md`, `pack.zip:x`, `a.md:1-2,` for
 *  `a.md:1-2,:-1`). If one of them exists, the grammar cannot know which file was
 *  read, and nothing is recorded — a false block later, never an unread file. The
 *  scan covers the whole input or does not run: see PATH_MAX. */
function grammarTarget(path, cwd) {
	if (path.length > PATH_MAX) return null;
	const query = path.indexOf("?");
	const container = path.matchAll(INPUT_CONTAINER).next().value;
	const pick =
		container && (query < 0 || container.index < query)
			? path.slice(0, container.index + container[0].length)
			: query < 0
				? path.replace(READ_SELECTOR, "")
				: path.slice(0, query);
	for (let end = pick.length + 1; end <= path.length; end++) {
		if (end < path.length && path[end] !== ":" && path[end] !== "?") continue;
		const longer = localFileTarget(path.slice(0, end), cwd);
		if (longer && existsSync(longer)) return null;
	}
	return localFileTarget(pick, cwd);
}

/** Local file a successful `read` call read; "" when there is none to record (a URL
 *  or internal resource, a list read, a result that names no file).
 *
 *  What was read is omp's knowledge, so it is taken from the RESULT, not re-derived
 *  from the input. `details.meta.source` says what kind of thing was read. Only a
 *  source of type `path` is a file read; the file is `details.resolvedPath` when the
 *  read resolved its input (query, SQLite, PDF page, archive, suffix match), else the
 *  source's own value — omp's `readDetailsLinkPath` (v18.22.0 packages/coding-agent/
 *  src/tools/read.ts). The two differ for a PDF page (`doc.pdf:page3.png`): the source
 *  is the rendered screenshot, `resolvedPath` the PDF (`#readPdfPageScreenshot`).
 *
 *  Any other result with details records nothing: a source that is NOT a path (an
 *  internal resource, a URL), a resolved path or a suffix resolution without a path
 *  source (measured: an out-of-range selection, `f.mjs:600-760` on a 494-line file,
 *  returns a notice with `resolvedPath` and no source), and details that say nothing
 *  about the source at all (measured: a failed document conversion returns
 *  `{fileSize}` only). None of them showed the file's content, and guessing the file
 *  from the input is where r1, r2 and r6 each recorded a file that was never read.
 *  (A path source means omp OPENED the file, not that it showed content: a binary-file
 *  notice or a multi-range entirely past the end still carries one and is recorded,
 *  as before.)
 *
 *  The grammar is used only when the result carries NO details at all — not a shape
 *  omp 18.22.0 produces for a successful read (none in a replay of this host's 1,500
 *  most recent session files, 2026-11-20); it keeps a result this module cannot
 *  interpret from silently recording nothing for a plain path.
 *
 *  A LIST read (`a.md;b.md`, or a `,` / whitespace list omp recovered — marked by
 *  `details.displayReadTargets`) records nothing. omp reports the parts but not which
 *  of them it actually displayed (`a.md:99999;b.md` links a.md and prints only "beyond
 *  end of file", measured), and whether a path is a list at all is omp's call
 *  (`db.sqlite?q=SELECT 1; x.md` is one SQL query), so the input is not split here
 *  either. A file read through a list must be read alone before it can be edited —
 *  the same outcome as before #109, when the whole list was logged as one phantom
 *  path. Recording list parts is tracked in #150.
 *
 *  A read addressed through a URL — `://` anywhere in the input, or a known
 *  single-slash scheme — stays untracked even when omp reports a local backing file
 *  (`rule://x` -> `.omp/rules/x.md`): reading the resource is not reading that file
 *  for the purposes of editing it. */
export function readTarget(input, details, cwd) {
	const raw = input?.path;
	if (typeof raw !== "string" || !raw || isVirtualPath(raw)) return "";
	if (details == null) return grammarTarget(raw, cwd) ?? "";
	if (Array.isArray(details.displayReadTargets)) return "";
	const source = details.meta?.source;
	if (source?.type !== "path" || typeof source.value !== "string") return "";
	return reportedTarget(typeof details.resolvedPath === "string" ? details.resolvedPath : source.value, cwd) ?? "";
}

/** Single-slash prefix of a KNOWN virtual scheme — the omp event plumbing
 *  normalizes `xd://retain` to `xd:/retain` (live-observed 2026-07-16,
 *  session-log `xd:/retain`/`xd:/recall`). The allowlist is deliberate (r4):
 *  POSIX permits `:` in path components, so a generic `<word>:/` rejection
 *  silently dropped legitimate files like `pkg:/danger.ts` from BOTH the
 *  pre-edit gate and the ledgers — worse than a phantom entry. An unknown
 *  future virtual scheme in single-slash form degrades to a phantom (the r2
 *  failure class, annoying but safe); extend the list when one appears.
 *  `proc` (job/service control: `write proc://<id>/kill`, `proc://<name>/mode`,
 *  `read proc://`) and `conflict` (write-only merge resolution) were added for
 *  omp 18.3.0 (2026-09-24, #42); `attachment`, `cfg`, `security`, `vault`, `out`
 *  and `mr` complete the 21-scheme built-in registry of omp 18.22.0 (read.md
 *  "Internal URLs", #109) — `cfg` and `vault` are writable, so a normalized
 *  `cfg:/…` must not reach the write ledger. The single-slash form is defensive,
 *  only `xd` has been observed normalized. */
const URI_SCHEME_PREFIX =
	/^(?:xd|local|memory|artifact|agent|history|mcp|skill|rule|omp|issue|pr|mr|ssh|proc|conflict|attachment|cfg|security|vault|out|https?|file):\//i;

/** Absolute path of a mutating tool's target when it names a LOCAL file; null
 *  for URI-scheme targets — both the canonical `xd://…` form (`://` anywhere)
 *  and the single-slash normalized `xd:/…` form. Virtual resources must never
 *  enter read/write ledgers as `<cwd>/xd:/…` garbage (live-reproduced on omp
 *  17.0.1, 2026-07-16; r2 counterexample session-log:315). */
export function localFileTarget(p, cwd) {
	if (typeof p !== "string" || p.length === 0 || isVirtualPath(p)) return null;
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
 *  resources don't mint editable anchors. The path may itself contain `#` (yadm
 *  `config##Linux`; hashline headers accept it since omp 18.4.1) — the tag is the
 *  LAST `#`-segment. */
const SEARCH_ANCHOR_HEADER = /^\[([^\]\n]+)#[0-9A-Fa-f]{4,}\]\s*$/gm;
export function searchTrackTargets(details, text, cwd) {
	const out = new Set();
	const files = details?.files;
	if (Array.isArray(files)) {
		for (const f of files) {
			if (typeof f === "string" && f && !isVirtualPath(f)) out.add(resolve(cwd, f));
		}
		return [...out];
	}
	if (typeof text !== "string" || !text) return [];
	for (const m of text.matchAll(SEARCH_ANCHOR_HEADER)) {
		if (!isVirtualPath(m[1])) out.add(resolve(cwd, m[1]));
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

/** Path a `write` call addresses, hashline wrapper removed. `write` accepts a copied
 *  header as its path (write.md: "A copied `[path#TAG]` wrapper is accepted and
 *  removed") and unwraps it BEFORE deciding what the target is — a wrapped device
 *  address still dispatches the device (`[xd://recall#1A2B]`, measured). This is a
 *  port of omp 18.22.0 `unwrapHashlineHeaderPath`
 *  (packages/coding-agent/src/tools/hashline-header-path.ts): after `trimEnd`, the
 *  string must be `[PATH]` or `[PATH#XXXX]` with a 4-hex tag; a valid tag lets PATH
 *  contain `#`, and without one PATH must not. Anything else — a 5-hex tag, leading
 *  whitespace, a trailing selector — stays a literal file name (all measured).
 *  Unmirrored, `[src/foo.ts#1A2B]` resolved to a path that does not exist, so
 *  context-gate judged it a new file and let an unread `src/foo.ts` be overwritten,
 *  and the ledgers then recorded the wrapper instead of the file. */
const WRAPPER_TAG = /#[0-9A-Fa-f]{4}$/;
function writePath(input) {
	const path = input?.path ?? input?.file_path ?? input?.filePath;
	if (typeof path !== "string") return path;
	const trimmed = path.trimEnd();
	if (trimmed.length < 2 || trimmed[0] !== "[" || trimmed[trimmed.length - 1] !== "]") return path;
	const inner = trimmed.slice(1, -1);
	const tag = WRAPPER_TAG.exec(inner);
	const unwrapped = tag ? inner.slice(0, tag.index) : inner;
	return unwrapped.length === 0 || (!tag && unwrapped.includes("#")) ? path : unwrapped;
}

/** Absolute file targets a mutating tool call touches (plain file tools).
 *  Lives here (not index.ts) so the URI-scheme guard is test-fixed. The
 *  hashline-header fallback reuses SEARCH_ANCHOR_HEADER — same `[path#TAG]`
 *  grammar as search anchors. */
export function editTargets(toolName, input, cwd) {
	if (!input) return [];
	if (toolName === "write") {
		const t = localFileTarget(writePath(input), cwd);
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
 *  (review 2026-07-16 M1 — defense-in-depth; shipped transport sends `path`), and
 *  it runs on the UNWRAPPED path: `[xd://ast_edit#1A2B]` dispatches the device too. */
/** ast_edit device address — tolerate the single-slash normalized form and
 *  scheme case variants (r3: exact `xd://ast_edit` match let `xd:/ast_edit`
 *  fall through to editTargets, whose URI guard DROPPED the path — silently
 *  skipping read-before-edit for the device's body paths). */
const AST_EDIT_DEVICE = /^xd:\/{1,2}ast_edit$/i;

export function mutationCallTargets(toolName, input, cwd) {
	const rawPath = writePath(input);
	if (toolName === "write" && typeof rawPath === "string" && AST_EDIT_DEVICE.test(rawPath.trim())) {
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
