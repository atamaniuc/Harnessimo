import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENT_GATE_PATH, HOOK_PATH, agentGateScript, hookScript, hookStatus } from "../src/hooks.ts";

test("the hook runs the fast gate and nothing slow", () => {
  const script = hookScript();
  assert.match(script, /^#!\/usr\/bin\/env sh/);
  assert.match(script, /\$HARNESSIMO check/);
  // Whatever else changes, these must not appear: they are what makes a hook
  // slow enough to be bypassed.
  assert.doesNotMatch(script, /--reverify|cold-start|npm test/);
});

test("a project's own fast commands run before the harness gates", () => {
  const script = hookScript(["pnpm run validate >/dev/null"]);
  const lines = script.split("\n");
  assert.ok(lines.indexOf("pnpm run validate >/dev/null") < lines.indexOf("$HARNESSIMO check"));
});

test("the CLI is located rather than assumed to be on PATH", () => {
  // Regression: the first version ran a bare `harnessimo check`, and a git
  // hook does not inherit node_modules/.bin — it failed on its first run, in
  // the repository that wrote it.
  const script = hookScript();
  assert.match(script, /node_modules\/\.bin\/harnessimo/);
  assert.match(script, /dist\/cli\.js/);
  // Source first: a stale build must not be what checks a commit.
  assert.ok(
    script.indexOf("src/cli.ts") < script.indexOf("dist/cli.js"),
    "the hook should prefer the sources over a build that may be stale",
  );
  assert.match(script, /command -v harnessimo/);
  assert.match(script, /harnessimo not found/);
});

test("installed and active is the only ok state", () => {
  assert.equal(hookStatus({ hookExists: true, hooksPath: ".githooks" }).ok, true);
});

test("a hook git is not looking at is reported, not counted as installed", () => {
  // The failure this catches: the file is in the repository, everyone assumes
  // it runs, and core.hooksPath was never set — so it has never run once.
  const status = hookStatus({ hookExists: true, hooksPath: null });
  assert.equal(status.ok, false);
  assert.match(status.message, /exists but git is not using it/);
  assert.match(status.message, /core\.hooksPath is unset/);
});

test("a hooksPath pointing somewhere else is named in the failure", () => {
  const status = hookStatus({ hookExists: true, hooksPath: ".husky" });
  assert.match(status.message, /core\.hooksPath=\.husky/);
});

test("configured with no hook file is its own failure", () => {
  const status = hookStatus({ hookExists: false, hooksPath: ".githooks" });
  assert.equal(status.ok, false);
  assert.match(status.message, /has no pre-commit hook/);
});

test("nothing installed says so plainly", () => {
  assert.match(hookStatus({ hookExists: false, hooksPath: null }).message, /no pre-commit hook/);
  assert.equal(HOOK_PATH, ".githooks/pre-commit");
});

// ---- spec 0006: the turn boundary

test("the gate is a file in the repository, like every other hook here", () => {
  // Not in .git/hooks and not in a settings blob: a reviewable file everyone
  // gets, which is the same rule the pre-commit hook follows.
  assert.equal(AGENT_GATE_PATH, ".claude/hooks/harnessimo-gate.sh");
  assert.match(agentGateScript(), /\$HARNESSIMO check/);
  assert.doesNotMatch(agentGateScript(), /--reverify|cold-start|npm test/);
});

test("the gate blocks a turn while check is red, and hands the report back", () => {
  const { dir, ran } = gateFixture("exit 1");
  const result = runGate(dir, '{"stop_hook_active":false}');

  assert.equal(result.status, 2, "exit 2 is the code an agent is shown");
  assert.match(result.stderr, /FAIL work tracks/, "the report goes with it, not just a refusal");
  assert.match(result.stderr, /cannot end while a check is red/);
  assert.equal(existsSync(ran), true, "the check actually ran");
  rmSync(dir, { recursive: true, force: true });
});

test("a green check lets the turn end", () => {
  const { dir } = gateFixture("exit 0");
  assert.equal(runGate(dir, '{"stop_hook_active":false}').status, 0);
  rmSync(dir, { recursive: true, force: true });
});

test("a turn already continuing from this hook is not blocked again", () => {
  const { dir, ran } = gateFixture("exit 1");
  // Both spellings, because the field arrives as JSON and whitespace is not
  // ours to predict.
  for (const input of ['{"stop_hook_active":true}', '{"session":"x", "stop_hook_active": true}']) {
    assert.equal(runGate(dir, input).status, 0, `blocking again on ${input} is a loop`);
  }
  assert.equal(existsSync(ran), false, "and the check is not even run — the answer cannot change");
  rmSync(dir, { recursive: true, force: true });
});

test("no CLI means no gate, and no noise at the end of every turn", () => {
  const dir = mkdtempSync(join(tmpdir(), "harness-gate-"));
  mkdirSync(join(dir, ".claude", "hooks"), { recursive: true });
  writeFileSync(join(dir, ".claude/hooks/harnessimo-gate.sh"), agentGateScript(), { mode: 0o755 });
  const result = runGate(dir, '{"stop_hook_active":false}');
  assert.equal(result.status, 0);
  assert.equal(result.stderr.trim(), "");
  rmSync(dir, { recursive: true, force: true });
});

/** A repository whose `harnessimo` is a stub with the exit code we want to test. */
function gateFixture(exit: string): { dir: string; ran: string } {
  const dir = mkdtempSync(join(tmpdir(), "harness-gate-"));
  const ran = join(dir, "ran");
  mkdirSync(join(dir, ".claude", "hooks"), { recursive: true });
  mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
  writeFileSync(join(dir, ".claude/hooks/harnessimo-gate.sh"), agentGateScript(), { mode: 0o755 });
  writeFileSync(
    join(dir, "node_modules/.bin/harnessimo"),
    `#!/bin/sh\ntouch "${ran}"\necho "  FAIL work tracks"\n${exit}\n`,
    { mode: 0o755 },
  );
  return { dir, ran };
}

function runGate(dir: string, input: string): { status: number; stderr: string } {
  try {
    execFileSync("sh", [join(dir, ".claude/hooks/harnessimo-gate.sh")], {
      cwd: dir,
      input,
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    });
    return { status: 0, stderr: "" };
  } catch (caught) {
    const error = caught as { status?: number; stderr?: string };
    return { status: error.status ?? 1, stderr: error.stderr ?? "" };
  }
}
