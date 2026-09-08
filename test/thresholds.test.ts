// Track 0001, closed as a check. Both repositories this package came from
// invented this rule independently and wired it by hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { thresholdProblems, unprotectedFloors } from "../src/thresholds.ts";

const paths = { resultsPath: "evals/results.json", floorsPath: "evals/thresholds.json" };
const floors = { recall_at_5: 0.8, injection_safety: 1.0 };

test("a run at or above every floor passes", () => {
  const results = { recall_at_5: 0.83, injection_safety: 1.0, latency_ms: 240 };
  assert.deepEqual(thresholdProblems({ ...paths, floors, results }), [], "an extra measured metric is not a problem");
});

test("a score below its floor fails, naming both numbers", () => {
  const problems = thresholdProblems({ ...paths, floors, results: { recall_at_5: 0.71, injection_safety: 1.0 } });

  assert.equal(problems.length, 1);
  assert.equal(problems[0]!.target, "recall_at_5");
  assert.match(problems[0]!.reason, /0\.71 is below the floor of 0\.8/);
  assert.match(problems[0]!.reason, /Lowering the floor to pass is the move this check exists to catch/);
});

test("a metric with a floor that nobody scored is not a metric that passed", () => {
  const problems = thresholdProblems({ ...paths, floors, results: { recall_at_5: 0.9 } });
  assert.equal(problems.length, 1);
  assert.equal(problems[0]!.target, "injection_safety");
  assert.match(problems[0]!.reason, /was not measured/);
});

test("a scoring step that did not run is not a scoring step that passed", () => {
  const problems = thresholdProblems({ ...paths, floors, results: null, command: "npm run evals" });
  assert.equal(problems.length, 1);
  assert.match(problems[0]!.reason, /did not run is not a scoring step that passed/);
  assert.match(problems[0]!.reason, /run `npm run evals`/, "the command is named, and never run from here");
});

test("metadata beside the floors is not a broken floor", () => {
  // The first real floors file this was pointed at carries a `version` string
  // next to five numbers. A non-number is not a floor, and calling it one
  // would fail every project that documents its thresholds file in place.
  assert.deepEqual(
    thresholdProblems({
      ...paths,
      floors: { $comment: "why these numbers", version: "2026-08-21.1", recall_at_5: 0.8 },
      results: { recall_at_5: 0.9 },
    }),
    [],
  );
});

test("a floor that cannot be compared is caught where the key was actually scored", () => {
  const problems = thresholdProblems({
    ...paths,
    floors: { recall_at_5: "0.8" },
    results: { recall_at_5: 0.9 },
  });
  assert.equal(problems.length, 1, "the key was scored, so it is a metric and its floor is broken");
  assert.match(problems[0]!.reason, /a floor that cannot be compared is a floor that never held/);
});

test("floors within reach of the agent are reported, but only where success is already declared", () => {
  assert.equal(unprotectedFloors("evals/thresholds.json", []), null, "a project with no locked paths made no such claim");
  assert.equal(unprotectedFloors("evals/thresholds.json", ["evals/"]), null);
  assert.equal(unprotectedFloors("evals/thresholds.json", ["evals/thresholds.json"]), null);

  const problem = unprotectedFloors("evals/thresholds.json", [".github/workflows/"]);
  assert.ok(problem);
  assert.match(problem.reason, /an agent that can lower its own pass mark grades itself/);
  assert.match(problem.reason, /add "evals\/thresholds\.json" to locked\.paths/);
});
