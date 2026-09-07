import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTaskGate, taskBlocks, verifyTaskGates } from "../src/tasks.mjs";
import { fakeResolver } from "./helpers.mjs";

const resolver = fakeResolver({
  files: { "test/dates.spec.ts": "quarantines a future-dated invoice" },
});

test("a checked box naming no check is the failure this gate exists for", () => {
  const problems = checkTaskGate("- [x] **T1** future dates quarantine\n", "specs/0001-x/tasks.md", resolver);
  assert.equal(problems.length, 1);
  assert.match(problems[0].reason, /names no executable check/);
});

test("a checked box whose proof does not resolve fails with the underlying reason", () => {
  const text = "- [x] **T1** dates <!-- proof: test/gone.spec.ts -->\n";
  const problems = checkTaskGate(text, "specs/0001-x/tasks.md", resolver);
  assert.equal(problems.length, 1);
  assert.match(problems[0].reason, /checked task's proof failed: file "test\/gone\.spec\.ts" does not exist/);
});

test("an unchecked box is not a claim and is left alone", () => {
  assert.deepEqual(checkTaskGate("- [ ] **T2** not started yet\n", "specs/0001-x/tasks.md", resolver), []);
});

test("a marker on a wrapped continuation line still belongs to its task", () => {
  // Regression: real task entries wrap, and the first version of this rule
  // only looked at the first line, so a wrapped-but-proven task failed.
  const text = ["- [x] **T1** a long task description that wraps onto", "      a second line <!-- proof: test/dates.spec.ts -->", ""].join("\n");
  assert.deepEqual(checkTaskGate(text, "specs/0001-x/tasks.md", resolver), []);
  assert.equal(taskBlocks(text).length, 1);
});

test("only task lists under a live track are gated", () => {
  const tracks = "- **A** — [handoff](specs/0001-live/handoff.md) — active, next: T1\n";
  const files = [
    { path: "specs/0001-live/tasks.md", text: "- [x] **T1** live lane\n" },
    { path: "specs/0000-shipped/tasks.md", text: "- [x] **T1** finished long ago\n" },
  ];
  const problems = verifyTaskGates(files, tracks, resolver);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].file, "specs/0001-live/tasks.md");
});
