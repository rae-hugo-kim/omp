#!/usr/bin/env node
// read-tracker.mjs - tool_result hook for Read + grep/ast_grep search anchors
// Purpose: Track which files' content the session has seen (for context-gate).
// Accepts tool_input.file_path (single read) or tool_input.file_paths (batched
// search anchors — one spawn per grep/ast_grep result, however many files it minted).

import { readFileSync } from 'fs';
import { recordReads } from './state-origin.mjs';

const input = readFileSync(0, 'utf-8');
let data;

try {
  data = JSON.parse(input);
} catch {
  console.error('HARNESS WARNING: Hook received invalid input, skipping check.');
  process.exit(0);
}

const ti = data?.tool_input || {};
const batch = Array.isArray(ti.file_paths) ? ti.file_paths : [];
const filePaths = [ti.file_path || ti.filePath, ...batch].filter((p) => typeof p === 'string' && p.length > 0);
if (!filePaths.length) process.exit(0);

recordReads(data?.session_state?.cwd || process.cwd(), filePaths);

process.exit(0);
