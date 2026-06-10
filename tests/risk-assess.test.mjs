// Tests for risk-assess.mjs — the shared risk classifier used by backpressure-gate and
// review-gate to decide whether a commit needs test-verification / adversarial review.
//
// Run: node --test tests/risk-assess.test.mjs
//
// Focus: the audit "substring footgun" (item #6). HIGH_RISK_PATTERNS are unanchored substrings
// matched against file paths, so documentation files whose NAME contains a risk word
// (`*_policy.md`, `author-guide.md`, ...) were misclassified as CRITICAL — forcing test gates and
// adversarial review on prose. The fix exempts documentation extensions from high-risk while
// keeping real security CODE/CONFIG matching. These tests lock both directions.
//
// Integration tests use a throwaway git repo with an EXPLICIT cwd passed to git and assessRisk,
// so the real repo is never touched (see memory: feedback_shell_test_cwd_isolation).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { assessRisk, isHighRiskFile } from '../.omp/extensions/harness/gates/risk-assess.mjs';
import { parseCommitForm } from '../.omp/extensions/harness/gates/git-commit-detect.mjs';

// --- Unit: isHighRiskFile (pure, no git) ---

test('isHighRiskFile: real security code/config stays high-risk', () => {
  for (const f of [
    'src/auth/login.ts',
    'src/oauth.ts',
    'lib/authentication.ts',          // substring match must survive (NOT broken by anchoring)
    'migrations/001_init.sql',
    'db/schema.prisma',
    'config/rls_policies.sql',
    'app/policy.ts',
    'src/credentials.ts',
    'lib/tokenStore.ts',
    '.env',
    'secrets/private.pem',
    'keys/server.key',
    'config/app.secret',
  ]) {
    assert.equal(isHighRiskFile(f), true, `should be high-risk: ${f}`);
  }
});

test('isHighRiskFile: prose docs are exempt from TOPIC substrings (the footgun fix)', () => {
  for (const f of [
    // the 9 real files in THIS repo that previously misclassified as CRITICAL
    'docs/rules/glossary_policy.md',
    'docs/rules/seed_evolution_policy.md',
    'rules/code_review_policy.md',
    'rules/context7_policy.md',
    'rules/documentation_policy.md',
    'rules/learning_policy.md',
    'rules/mcp_policy.md',
    'rules/tdd_policy.md',
    'templates/policy_sync_checklist.md',
    // other prose docs named for a topic
    'docs/author-guide.md',
    'notes/migration-plan.md',
    'CHANGELOG.txt',
    // case-insensitive: an uppercase prose extension is still exempt
    'rules/tdd_policy.MD',
    'docs/AUTHOR-GUIDE.MD',
  ]) {
    assert.equal(isHighRiskFile(f), false, `prose doc must NOT be high-risk: ${f}`);
  }
});

test('isHighRiskFile: secret/material in a prose doc STAYS high-risk (no false-negative)', () => {
  // A credential/token/password can be leaked into prose — the doc exemption must NOT swallow it.
  // Regression guard: a blanket doc exemption (the first attempt) wrongly dropped these to low.
  for (const f of [
    'config/credentials.txt',
    'runbooks/password-rotation.md',
    'secrets/prod-token.txt',
    'docs/auth-token.md',
  ]) {
    assert.equal(isHighRiskFile(f), true, `secret-bearing doc must stay high-risk: ${f}`);
  }
});

test('isHighRiskFile: .mdx is NOT passive-exempt (can import/execute JSX)', () => {
  for (const f of [
    'docs/schema-overview.mdx',
    'pages/auth.mdx',
    'src/policy.mdx',
  ]) {
    assert.equal(isHighRiskFile(f), true, `.mdx topic file must stay high-risk: ${f}`);
  }
});

// --- Integration: assessRisk over a real staged diff ---

function makeRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'risk-test-'));
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  };
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Test']);
  for (const [rel, content] of Object.entries(files)) {
    const fp = join(dir, rel);
    mkdirSync(dirname(fp), { recursive: true });
    writeFileSync(fp, content);
  }
  git(['add', '-A']);
  return dir;
}

function withRepo(files, fn) {
  const dir = makeRepo(files);
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('assessRisk: editing only a policy DOC is low risk (was falsely CRITICAL)', () => {
  withRepo({ 'rules/tdd_policy.md': '# TDD policy\nsome prose change\n' }, (dir) => {
    assert.equal(assessRisk(dir).level, 'low');
  });
});

test('assessRisk: editing real auth CODE is still critical', () => {
  withRepo({ 'src/auth/login.ts': 'export const login = () => {};\n' }, (dir) => {
    assert.equal(assessRisk(dir).level, 'critical');
  });
});

test('assessRisk: benign code + a policy doc is medium, not critical', () => {
  withRepo({
    'src/util.ts': 'export const add = (a, b) => a + b;\n',
    'rules/mcp_policy.md': '# MCP policy\nprose\n',
  }, (dir) => {
    assert.equal(assessRisk(dir).level, 'medium');
  });
});

test('assessRisk: a migration .sql is still critical', () => {
  withRepo({ 'migrations/002_add_table.sql': 'CREATE TABLE t (id int);\n' }, (dir) => {
    assert.equal(assessRisk(dir).level, 'critical');
  });
});

test('assessRisk: a doc holding credential material is still critical', () => {
  withRepo({ 'docs/credentials-runbook.md': '# rotate the token\n' }, (dir) => {
    assert.equal(assessRisk(dir).level, 'critical');
  });
});

test('assessRisk: a .mdx file named for a topic is still critical', () => {
  withRepo({ 'pages/auth.mdx': 'import X from "x"\n' }, (dir) => {
    assert.equal(assessRisk(dir).level, 'critical');
  });
});

test('assessRisk: an uppercase prose doc (.MD) is low, not medium (case-insensitive)', () => {
  // Guards the full footgun fix: extension matching across assessRisk (docs-only classification,
  // not just the high-risk check) must be case-insensitive, else `tdd_policy.MD` falls to medium.
  withRepo({ 'rules/tdd_policy.MD': '# TDD policy\nprose change\n' }, (dir) => {
    assert.equal(assessRisk(dir).level, 'low');
  });
});

// --- Commit-form scoping: risk is assessed on what the commit actually CAPTURES ---
// A repo with an initial commit, then a STAGED low-risk doc edit and an UNSTAGED
// (tracked) critical-risk code edit. A plain commit captures only the staged doc;
// -a captures the unstaged code too; an unverifiable form falls back to the union.

function makeMixedRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'risk-form-'));
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  };
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'Test']);
  mkdirSync(join(dir, 'src', 'auth'), { recursive: true });
  mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(join(dir, 'src/auth/login.ts'), 'init\n');
  writeFileSync(join(dir, 'docs/notes.md'), '# init\n');
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'init']);
  writeFileSync(join(dir, 'docs/notes.md'), '# init\nstaged prose edit\n');  // staged: low
  git(['add', 'docs/notes.md']);
  writeFileSync(join(dir, 'src/auth/login.ts'), 'init\nunstaged auth edit\n'); // unstaged: critical
  return dir;
}

function withMixed(fn) {
  const dir = makeMixedRepo();
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('assessRisk(form=plain): only the staged doc counts -> low (ignores unstaged auth)', () => {
  withMixed((dir) => {
    assert.equal(assessRisk(dir, parseCommitForm('git commit -m x')).level, 'low');
  });
});

test('assessRisk(form=-a): captures unstaged tracked code -> critical', () => {
  withMixed((dir) => {
    assert.equal(assessRisk(dir, parseCommitForm('git commit -am x')).level, 'critical');
  });
});

test('assessRisk(unverifiable form): conservative union -> critical', () => {
  withMixed((dir) => {
    assert.equal(assessRisk(dir, parseCommitForm('git commit -m x src/auth/login.ts')).level, 'critical');
  });
});

test('assessRisk(no form): legacy union default is unchanged -> critical', () => {
  // Back-compat: callers that pass no form still get the staged∪unstaged union, so the
  // unstaged auth edit is seen. This is what guarantees the plain-form result above is a
  // real narrowing, not an across-the-board drop.
  withMixed((dir) => {
    assert.equal(assessRisk(dir).level, 'critical');
  });
});
