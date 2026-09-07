import { test } from "node:test";
import assert from "node:assert/strict";
import { debrisProblems, instructionProblems, progressProblems } from "../src/cleanexit.mjs";

test("a debug marker that compiles is still debris", () => {
  const problems = debrisProblems([{ path: "src/a.ts", text: "const x = 1;\nconsole.log(x); // TODO tidy\n" }]);
  assert.equal(problems.length, 2);
  assert.deepEqual(problems.map((p) => p.target).sort(), ["TODO", "console.log("]);
});

test("a project chooses its own markers", () => {
  const files = [{ path: "src/a.ts", text: "debugger;\n" }];
  assert.equal(debrisProblems(files, { markers: ["TODO"] }).length, 0);
  assert.equal(debrisProblems(files, { markers: ["debugger"] }).length, 1);
});

test("paths a project excludes are left alone", () => {
  // The gate's own tests name the markers it looks for, so the gate would
  // otherwise fail on the file proving it works.
  const files = [{ path: "test/cleanexit.test.mjs", text: "TODO\n" }];
  assert.deepEqual(debrisProblems(files, { allow: ["test/"] }), []);
});

test("code changed without the progress file being updated fails", () => {
  const problems = progressProblems({
    changed: ["src/a.ts", "src/b.ts"],
    progressFile: ".harness/4-state/PROGRESS.md",
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0].reason, /stale one costs more than an empty one/);
});

test("a documentation-only change does not owe a progress update", () => {
  assert.deepEqual(progressProblems({ changed: ["README.md"], progressFile: "P.md" }), []);
});

test("a session that wrote its progress down passes", () => {
  assert.deepEqual(progressProblems({ changed: ["src/a.ts", "P.md"], progressFile: "P.md" }), []);
});

test("nothing changed, nothing owed", () => {
  assert.deepEqual(progressProblems({ changed: [], progressFile: "P.md" }), []);
});

test("an instruction file over its limit fails, and is told what to do about it", () => {
  const text = Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n");
  const problems = instructionProblems([{ path: "AGENTS.md", text }], { "AGENTS.md": 20 });
  assert.equal(problems.length, 1);
  assert.match(problems[0].reason, /buries its important parts in the middle/);
  assert.match(problems[0].target, /30 lines/);
});

test("a file with no declared limit is not measured", () => {
  const text = Array.from({ length: 500 }, () => "x").join("\n");
  assert.deepEqual(instructionProblems([{ path: "docs/plan.md", text }], { "AGENTS.md": 20 }), []);
});
