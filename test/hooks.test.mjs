import { test } from "node:test";
import assert from "node:assert/strict";
import { HOOK_PATH, hookScript, hookStatus } from "../src/hooks.mjs";

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
  assert.match(script, /bin\/harnessimo\.mjs/);
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
