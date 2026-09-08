// Spec 0005. The lane lifecycle is the SDD half of this tool, and until now it
// was held together by memory — which got the number wrong, and left a lane out
// of the index that the session brief reads.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fillTemplate,
  findLane,
  indexLine,
  laneDirectories,
  nextNumber,
  outcomeEntry,
  slugProblem,
  withLine,
  withOutcome,
  withoutLane,
} from "../src/track.ts";

test("the next number is one past the highest, not the lowest gap", () => {
  assert.equal(nextNumber([]), "0001");
  assert.equal(nextNumber(["0001-a", "0002-b"]), "0003");
  // A deleted lane's number lives on in commit messages and handoffs. Reusing
  // it makes two different pieces of work answer to the same name.
  assert.equal(nextNumber(["0001-a", "0003-c"]), "0004");
  assert.equal(nextNumber(["0009-x", "notes", "README.md"]), "0010");
});

test("only numbered directories count as lanes", () => {
  assert.deepEqual(laneDirectories(["0001-a", "archive", "DoD.md", "0002-b"]), ["0001-a", "0002-b"]);
});

test("a slug that is not a slug is refused, and says what one looks like", () => {
  for (const bad of ["", "Retrieval Quality", "retrieval/quality", "Retrieval", "a--b", "-a"]) {
    const problem = slugProblem(bad, "specs");
    assert.ok(problem, `"${bad}" should be refused`);
    assert.match(problem.reason, /lower-case/);
  }
  assert.equal(slugProblem("retrieval-quality", "specs"), null);
  assert.equal(slugProblem("0016-vision", "specs"), null);
});

test("the same work cannot be opened twice", () => {
  const names = ["0001-retrieval-quality", "0002-other"];
  assert.equal(findLane(names, "retrieval-quality"), "0001-retrieval-quality");
  assert.equal(findLane(names, "retrieval"), undefined);
});

test("the index line carries a status, a date and a link that resolves", () => {
  const line = indexLine({
    number: "0007",
    slug: "checkout-totals",
    title: "Checkout totals",
    specsDir: "specs",
    date: "2026-09-08",
  });
  assert.match(line, /^- \*\*Checkout totals \(spec 0007\)\*\* — /);
  assert.match(line, /\[handoff\]\(specs\/0007-checkout-totals\/handoff\.md\)/);
  assert.match(line, /active, 2026-09-08, next: /, "the tracks check requires a status and a next step");
});

test("a line is appended under whatever the index already says", () => {
  const index = "# Work tracks\n\nHow this file works.\n\n_No live tracks yet._\n";
  const out = withLine(index, "- **A (spec 0001)** — [handoff](specs/0001-a/handoff.md) — active, next: x");
  assert.match(out, /_No live tracks yet\._\n- \*\*A \(spec 0001\)/);
  assert.ok(out.endsWith("\n"), "a file ends with a newline");
});

test("closing removes the lane's line and leaves the others", () => {
  const index = [
    "# Work tracks",
    "",
    "- **A (spec 0001)** — [handoff](specs/0001-a/handoff.md) — active, next: x",
    "- **B (spec 0002)** — [handoff](specs/0002-b/handoff.md) — paused, next: y",
    "",
  ].join("\n");

  const out = withoutLane(index, "specs", "0001-a");
  assert.doesNotMatch(out, /0001-a/);
  assert.match(out, /0002-b/, "closing one track must not disturb another");
});

test("the outcome goes under the heading, newest first", () => {
  const log = "# Closed tracks\n\nNewest first.\n\n- **Older (spec 0001)** — did a thing.\n";
  const out = withOutcome(log, outcomeEntry("Newer", "0002", "  did   another\n  thing.  "));

  assert.match(out, /^# Closed tracks/, "the heading stays first");
  const newer = out.indexOf("Newer");
  const older = out.indexOf("Older");
  assert.ok(newer > 0 && newer < older, "newest first");
  assert.match(out, /did another thing\./, "an outcome typed across lines is one sentence in the log");
});

test("a template is filled in without being rewritten", () => {
  const template = "# NNNN — <lane name>\n\n**Status:** proposed\n\nSee specs/NNNN-<slug>/spec.md.\n";
  const out = fillTemplate(template, { number: "0007", title: "Checkout totals" });

  assert.match(out, /^# 0007 — Checkout totals/);
  assert.match(out, /specs\/0007-<slug>\/spec\.md/, "every NNNN is filled, everything else is left alone");
  assert.match(out, /\*\*Status:\*\* proposed/, "the tool does not decide the status");
});
