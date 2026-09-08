import { test } from "node:test";
import assert from "node:assert/strict";
import { formatLockedViolations, lockedViolations } from "../src/locked.ts";

const config = { paths: ["src/evaluator/", ".github/workflows/"], agentTrailer: "Co-Authored-By: Claude" };
const agent = (files: string[]) => ({ sha: "aaa", message: "work\n\nCo-Authored-By: Claude <noreply@anthropic.com>", files });
const human = (files: string[]) => ({ sha: "bbb", message: "widen the editable surface deliberately", files });

test("an agent commit touching the scoring code is a violation", () => {
  const found = lockedViolations([agent(["src/evaluator/score.ts"])], config);
  assert.deepEqual(found, [{ sha: "aaa", hits: ["src/evaluator/score.ts"] }]);
});

test("an agent commit touching the enforcement itself is a violation", () => {
  assert.equal(lockedViolations([agent([".github/workflows/ci.yml"])], config).length, 1);
});

test("the same change by a human is allowed — this bounds the loop, not the team", () => {
  assert.deepEqual(lockedViolations([human(["src/evaluator/score.ts"])], config), []);
});

test("an agent commit elsewhere is fine", () => {
  assert.deepEqual(lockedViolations([agent(["src/features/search.ts"])], config), []);
});

test("commits at or before the baseline are exempt", () => {
  // The commit that creates a locked path necessarily touches it, so
  // enforcement starts from a baseline a human moves deliberately.
  const found = lockedViolations([agent(["src/evaluator/score.ts"])], { ...config, exempt: new Set(["aaa"]) });
  assert.deepEqual(found, []);
});

test("the failure says why the rule exists and who may change it", () => {
  const text = formatLockedViolations(lockedViolations([agent(["src/evaluator/score.ts"])], config));
  assert.match(text, /grant itself a passing score/);
  assert.match(text, /a human makes this change/);
});
