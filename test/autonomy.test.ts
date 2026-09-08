// Spec 0007. The same green report means two different things depending on
// whether a person read every step or nobody looked, and until now the bar was
// the same either way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, addedBy, effectiveLevel, levelProblem, required, unbacked } from "../src/autonomy.ts";

const ALL = {
  proof: true, tracks: true, tasks: true, queue: true, locked: true,
  coldStart: true, cleanExit: true, instructions: true, release: true,
};

test("each level requires everything the level below it does, and more", () => {
  const watched = required("watched").checks;
  const reviewed = required("reviewed").checks;
  const unattended = required("unattended").checks;

  for (const check of watched) assert.ok(reviewed.includes(check), `${check} cannot stop being required`);
  for (const check of reviewed) assert.ok(unattended.includes(check), `${check} cannot stop being required`);
  assert.ok(unattended.length > reviewed.length && reviewed.length > watched.length);

  // The ladder covers every check the tool has: a rule that no level ever
  // reaches is a rule nothing runs.
  assert.deepEqual(new Set(unattended), new Set(Object.keys(ALL)));
});

test("re-verification starts where a diff-reader stops being able to catch it", () => {
  assert.equal(required("watched").reverify, false, "someone is reading each step");
  assert.equal(required("reviewed").reverify, true, "a diff-reader cannot re-run every claim");
  assert.equal(required("unattended").reverify, true);
  assert.deepEqual(addedBy("unattended"), ["cleanExit", "coldStart"]);
});

test("a declared floor cannot be argued down at the command line", () => {
  assert.equal(effectiveLevel("reviewed", "unattended"), "unattended", "asking for more is allowed");
  assert.equal(effectiveLevel("reviewed", "watched"), "reviewed", "asking for less is not");
  assert.equal(effectiveLevel("watched", undefined), "watched");
});

test("a name that is not a level is refused, with the ones that are", () => {
  assert.equal(levelProblem("unattended"), null);
  const problem = levelProblem("yolo");
  assert.ok(problem);
  for (const level of LEVELS) assert.match(problem, new RegExp(level));
});

test("a level the repository cannot back is refused, naming the section to add", () => {
  assert.deepEqual(unbacked("unattended", ALL), [], "everything configured, nothing to say");

  const problems = unbacked("unattended", { ...ALL, coldStart: false });
  assert.equal(problems.length, 1);
  assert.equal(problems[0]!.target, "coldStart");
  assert.match(problems[0]!.reason, /nobody looked at all/, "the failure says what the claim meant");
  assert.match(problems[0]!.reason, /"coldStart" section/, "and which section would back it");
});

test("a lower level is not held to what it never claimed", () => {
  // The proportionality, in one assertion: the same repository is fine at
  // "watched" and refused at "unattended".
  const withoutColdStart = { ...ALL, coldStart: false, cleanExit: false };
  assert.deepEqual(unbacked("watched", withoutColdStart), []);
  assert.equal(unbacked("unattended", withoutColdStart).length, 2);
});
