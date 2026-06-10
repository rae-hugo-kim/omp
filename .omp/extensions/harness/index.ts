// harness/index.ts — OMP extension that wires the harness gates (gates/*.mjs)
// into the OMP event model. This replaces the Claude Code registration that
// lived in `.claude/settings.json` (PreToolUse/PostToolUse/... hooks).
//
// Event mapping (Claude Code -> OMP):
//   PreToolUse  Edit|Write   -> tool_call  edit|write|ast_edit  : context-gate (blocking)
//   PreToolUse  Bash         -> tool_call  bash                 : destructive-guard (advisory), commit-gates (blocking)
//   PreToolUse  mcp__*       -> tool_call  mcp__*               : mcp-gate (advisory)
//   PostToolUse Read         -> tool_result read                : read-tracker
//   PostToolUse Bash         -> tool_result bash (ok)           : backpressure-tracker
//   PostToolUseFailure Bash  -> tool_result bash (isError)      : backpressure-failure-tracker
//   PostToolUse Edit|Write   -> tool_result edit|write|ast_edit : write-tracker + backpressure-invalidator
//   UserPromptSubmit         -> before_agent_start              : kickoff-detector (message injection)
//   SessionStart             -> session_start                   : harness-version-check
//
// The gate scripts are unchanged stdin-JSON CLIs (exit 0 = allow, stderr
// "HARNESS WARNING" = advisory; exit 2 = block, stderr = reason) so the
// existing test suite under tests/ keeps covering them directly.
//
// Requires `node` on PATH (gates are spawned with node, NOT process.execPath —
// inside OMP, process.execPath is the omp binary itself).
//
// Infra failures (node missing, gate crash, timeout) fail OPEN with a loud
// warning, matching the original per-hook fail-open behavior. Only an explicit
// gate exit code 2 blocks a tool call.

import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isGitCommit } from "./gates/git-commit-detect.mjs";

const GATES_DIR = join(dirname(fileURLToPath(import.meta.url)), "gates");
const GATE_TIMEOUT_MS = 3_000;
const COMMIT_GATES_TIMEOUT_MS = 10_000;
const VERSION_CHECK_TIMEOUT_MS = 15_000;

/** Tools that create or mutate files (Claude Code's Edit|Write matcher). */
const EDIT_TOOL_NAMES = new Set(["edit", "write", "ast_edit"]);
/** `[path#TAG]` headers inside a hashline `edit` patch. */
const HASHLINE_HEADER = /^\[([^\]\n#]+)#[0-9A-Fa-f]{4,}\]\s*$/gm;
/** Trailing read selectors (`:50-100`, `:raw`, ...) appended to `read` paths. */
const READ_SELECTOR = /:(?:raw|conflicts|\d+(?:[-+]\d+)?(?:,\d+(?:[-+]\d+)?)*)(?::raw)?$/;

interface ContentChunk {
	type: string;
	text?: string;
}

interface ToolCallEvent {
	toolName: string;
	toolCallId?: string;
	input?: Record<string, unknown>;
}

interface ToolResultEvent extends ToolCallEvent {
	content?: ContentChunk[];
	isError?: boolean;
	details?: { exitCode?: number } & Record<string, unknown>;
}

/**
 * OMP's bash tool reports a non-zero command exit as a SUCCESSFUL tool result
 * (isError stays false) and carries the code in `details.exitCode` — the field
 * is absent entirely on exit 0. Treat either signal as a failed run so failing
 * verifications route to backpressure-failure-tracker, never to a false PASS.
 */
function bashRunFailed(event: ToolResultEvent): boolean {
	if (event.isError) return true;
	const exitCode = event.details?.exitCode;
	return typeof exitCode === "number" && exitCode !== 0;
}

interface ToolCallBlock {
	block: true;
	reason: string;
}

interface AgentStartMessage {
	message: {
		customType: string;
		content: string;
		display: boolean;
	};
}

interface SessionMessageLike {
	role?: string;
	content?: unknown;
}

interface SessionEntryLike {
	message?: SessionMessageLike;
	role?: string;
	content?: unknown;
}

interface HarnessCtx {
	cwd: string;
	hasUI: boolean;
	ui?: {
		notify?(message: string, type?: string): void;
	};
	sessionManager?: {
		getBranch?(): SessionEntryLike[];
	};
}

interface HarnessLogger {
	warn?(message: string): void;
	info?(message: string): void;
}

interface HarnessExtensionApi {
	setLabel?(label: string): void;
	logger?: HarnessLogger;
	on(event: "tool_call", handler: (event: ToolCallEvent, ctx: HarnessCtx) => Promise<ToolCallBlock | undefined>): void;
	on(event: "tool_result", handler: (event: ToolResultEvent, ctx: HarnessCtx) => Promise<void>): void;
	on(event: "before_agent_start", handler: (event: unknown, ctx: HarnessCtx) => Promise<AgentStartMessage | undefined>): void;
	on(event: "session_start", handler: (event: unknown, ctx: HarnessCtx) => Promise<void>): void;
}

/** stdin payload in the shape the Claude Code hook protocol fed the gates. */
interface GatePayload {
	tool_name?: string;
	tool_input?: Record<string, unknown>;
	prompt?: string;
	session_state: { cwd: string };
}

interface GateRun {
	status: number | null;
	stdout: string;
	stderr: string;
	/** Spawn-level failure (node missing, timeout kill, ...), not a gate verdict. */
	failure?: string;
}

function runGate(script: string, payload: GatePayload, timeoutMs = GATE_TIMEOUT_MS): Promise<GateRun> {
	const { promise, resolve: settle } = Promise.withResolvers<GateRun>();
	let stdout = "";
	let stderr = "";
	try {
		const child = spawn("node", [join(GATES_DIR, script)], {
			stdio: ["pipe", "pipe", "pipe"],
			timeout: timeoutMs,
		});
		child.stdout?.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on("error", (err: Error) => settle({ status: null, stdout, stderr, failure: err.message }));
		child.on("close", (status: number | null) => settle({ status, stdout, stderr }));
		child.stdin?.end(JSON.stringify(payload));
	} catch (err) {
		settle({ status: null, stdout, stderr, failure: err instanceof Error ? err.message : String(err) });
	}
	return promise;
}

function textChunks(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	let text = "";
	for (const chunk of content) {
		if (chunk && typeof chunk === "object" && (chunk as ContentChunk).type === "text") {
			const part = (chunk as ContentChunk).text;
			if (part) text += (text ? "\n" : "") + part;
		}
	}
	return text;
}

/** Absolute file targets a mutating tool call touches. */
function editTargets(toolName: string, input: Record<string, unknown> | undefined, cwd: string): string[] {
	if (!input) return [];
	if (toolName === "write") {
		const path = input.path ?? input.file_path ?? input.filePath;
		return typeof path === "string" && path ? [resolve(cwd, path)] : [];
	}
	if (toolName === "edit") {
		const targets = new Set<string>();
		// Direct path field (find/replace-style edit tools)...
		const direct = input.path ?? input.file_path ?? input.filePath;
		if (typeof direct === "string" && direct) targets.add(resolve(cwd, direct));
		// ...and hashline patch headers `[path#TAG]` (hashline-style edit tools).
		const patch = typeof input.input === "string" ? input.input : "";
		for (const match of patch.matchAll(HASHLINE_HEADER)) {
			targets.add(resolve(cwd, match[1]));
		}
		return [...targets];
	}
	if (toolName === "ast_edit") {
		const paths = Array.isArray(input.paths) ? input.paths : [];
		// Globs pass through unchanged: context-gate allows non-existent paths.
		return paths.filter((p): p is string => typeof p === "string" && p.length > 0).map((p) => resolve(cwd, p));
	}
	return [];
}

/** Local file path a `read` call targets, selector stripped; "" for URLs/internal URIs. */
function readTarget(input: Record<string, unknown> | undefined, cwd: string): string {
	const raw = input?.path;
	if (typeof raw !== "string" || !raw || raw.includes("://")) return "";
	return resolve(cwd, raw.replace(READ_SELECTOR, ""));
}

function latestUserText(event: unknown, ctx: HarnessCtx): string {
	const evt = event as { prompt?: unknown; text?: unknown } | undefined;
	if (typeof evt?.prompt === "string" && evt.prompt) return evt.prompt;
	if (typeof evt?.text === "string" && evt.text) return evt.text;
	const branch = ctx.sessionManager?.getBranch?.() ?? [];
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		const message = entry.message ?? entry;
		if (message.role !== "user") continue;
		const text = textChunks(message.content);
		if (text) return text;
	}
	return "";
}

export default function harness(pi: HarnessExtensionApi): void {
	pi.setLabel?.("Harness Gates");

	const surface = (ctx: HarnessCtx, run: GateRun, gate: string): void => {
		const lines: string[] = [];
		if (run.failure) lines.push(`HARNESS WARNING: gate '${gate}' did not run (${run.failure}); skipping it.`);
		else if (run.status !== 0 && run.status !== 2) lines.push(`HARNESS WARNING: gate '${gate}' exited ${run.status}; skipping it.`);
		const stderr = run.stderr.trim();
		if (stderr && run.status !== 2) lines.push(stderr);
		if (!lines.length) return;
		const message = lines.join("\n");
		if (ctx.hasUI && ctx.ui?.notify) ctx.ui.notify(message, "warning");
		else pi.logger?.warn?.(message);
	};

	pi.on("tool_call", async (event, ctx) => {
		try {
			const session_state = { cwd: ctx.cwd };
			if (event.toolName === "bash") {
				const command = String(event.input?.command ?? "");
				if (!command) return;
				const payload: GatePayload = { tool_name: "Bash", tool_input: { command }, session_state };
				const guard = await runGate("destructive-guard.mjs", payload);
				surface(ctx, guard, "destructive-guard");
				// Cheap in-process pre-check; commit-gates spawns 3 child gates on a real commit.
				if (isGitCommit(command)) {
					const gates = await runGate("commit-gates.mjs", payload, COMMIT_GATES_TIMEOUT_MS);
					if (gates.status === 2) return { block: true, reason: gates.stderr.trim() || "HARNESS BLOCK: commit gate failed." };
					surface(ctx, gates, "commit-gates");
				}
				return;
			}
			if (EDIT_TOOL_NAMES.has(event.toolName)) {
				for (const filePath of editTargets(event.toolName, event.input, ctx.cwd)) {
					const run = await runGate("context-gate.mjs", { tool_name: "Edit", tool_input: { file_path: filePath }, session_state });
					if (run.status === 2) return { block: true, reason: run.stderr.trim() || `HARNESS BLOCK: read '${filePath}' before editing it.` };
					surface(ctx, run, "context-gate");
				}
				return;
			}
			if (/^mcp__/.test(event.toolName)) {
				const run = await runGate("mcp-gate.mjs", { tool_name: event.toolName, tool_input: event.input ?? {}, session_state });
				surface(ctx, run, "mcp-gate");
			}
		} catch (err) {
			// Never fail closed on adapter bugs — gates block only via exit 2.
			pi.logger?.warn?.(`HARNESS WARNING: tool_call adapter error: ${err instanceof Error ? err.message : String(err)}`);
		}
		return;
	});

	pi.on("tool_result", async (event, ctx) => {
		try {
			const session_state = { cwd: ctx.cwd };
			if (event.toolName === "read" && !event.isError) {
				const filePath = readTarget(event.input, ctx.cwd);
				if (filePath) await runGate("read-tracker.mjs", { tool_name: "Read", tool_input: { file_path: filePath }, session_state });
				return;
			}
			if (event.toolName === "bash") {
				const command = String(event.input?.command ?? "");
				if (!command) return;
				const payload: GatePayload = { tool_name: "Bash", tool_input: { command }, session_state };
				const tracker = bashRunFailed(event) ? "backpressure-failure-tracker.mjs" : "backpressure-tracker.mjs";
				await runGate(tracker, payload);
				return;
			}
			if (EDIT_TOOL_NAMES.has(event.toolName) && !event.isError) {
				for (const filePath of editTargets(event.toolName, event.input, ctx.cwd)) {
					const payload: GatePayload = { tool_name: "Write", tool_input: { file_path: filePath }, session_state };
					await runGate("write-tracker.mjs", payload);
					await runGate("backpressure-invalidator.mjs", payload);
				}
			}
		} catch (err) {
			pi.logger?.warn?.(`HARNESS WARNING: tool_result adapter error: ${err instanceof Error ? err.message : String(err)}`);
		}
	});

	pi.on("before_agent_start", async (event, ctx) => {
		try {
			const prompt = latestUserText(event, ctx);
			if (!prompt) return;
			const run = await runGate("kickoff-detector.mjs", { prompt, session_state: { cwd: ctx.cwd } });
			const note = run.stdout.trim();
			if (note) return { message: { customType: "harness-reminder", content: note, display: true } };
		} catch (err) {
			pi.logger?.warn?.(`HARNESS WARNING: kickoff-detector adapter error: ${err instanceof Error ? err.message : String(err)}`);
		}
		return;
	});

	pi.on("session_start", async (_event, ctx) => {
		try {
			const run = await runGate("harness-version-check.mjs", { session_state: { cwd: ctx.cwd } }, VERSION_CHECK_TIMEOUT_MS);
			const note = `${run.stdout}\n${run.stderr}`.trim();
			if (!note) return;
			if (ctx.hasUI && ctx.ui?.notify) ctx.ui.notify(note, "warning");
			else pi.logger?.info?.(note);
		} catch {
			// Version check is best-effort advisory; stay silent on infra errors.
		}
	});
}
