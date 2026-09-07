import { test } from "node:test";
import assert from "node:assert/strict";
import { coldStartProblems } from "../src/coldstart.mjs";

const exists = (present) => (path) => present.includes(path);

test("a required file missing from a fresh clone fails", () => {
  const problems = coldStartProblems({ requiredFiles: ["AGENTS.md", "Makefile"], escapes: [] }, exists(["AGENTS.md"]));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Makefile is missing from a fresh clone/);
});

test("an entry document pointing outside the repository fails", () => {
  // The real defect this caught: an agent file routing to ~/.claude/plans/,
  // so the project only documented itself on one laptop.
  const problems = coldStartProblems(
    { requiredFiles: [], escapes: [{ path: "AGENTS.md", text: "The plan lives in ~/.claude/plans/current.md" }] },
    exists([]),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /references a path outside the repository/);
});

test("a repository that documents itself relatively passes", () => {
  const problems = coldStartProblems(
    { requiredFiles: ["AGENTS.md"], escapes: [{ path: "AGENTS.md", text: "The plan lives in docs/plan.md" }] },
    exists(["AGENTS.md"]),
  );
  assert.deepEqual(problems, []);
});
