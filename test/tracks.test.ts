import { test } from "node:test";
import assert from "node:assert/strict";
import { checkHandoffRefs, checkTracks, liveTrackSpecDirs, pauseReason, pausedTrackSpecDirs, staleProblems } from "../src/tracks.ts";
import { fakeResolver } from "./helpers.ts";

const resolver = fakeResolver({
  files: { "specs/0016-vision/handoff.md": "# Handoff", "specs/TRACKS-LOG.md": "# Log" },
});

test("a track line without a status fails — nobody can triage it", () => {
  const problems = checkTracks("- **Hosted deploy** — none — next: provision\n", resolver);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!.reason, /carries no status/);
});

test("a track line linking a handoff that no longer exists fails", () => {
  const text = "- **Vision** — [handoff](specs/0099-gone/handoff.md) — paused, next: T1\n";
  const problems = checkTracks(text, resolver);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!.reason, /does not exist/);
});

test("a well-formed track line passes", () => {
  const text = "- **Vision** — [handoff](specs/0016-vision/handoff.md) — paused (no provider), next: T1\n";
  assert.deepEqual(checkTracks(text, resolver), []);
});

test("prose, headings and fenced examples are not track lines", () => {
  const text = ["# Work tracks", "", "One line per track.", "", "```", "- **Example** — no status here", "```", ""].join("\n");
  assert.deepEqual(checkTracks(text, resolver), []);
});

test("an external link on a track line is not this gate's business", () => {
  const text = "- **Spec** — [rfc](https://example.com/rfc) — active, next: draft\n";
  assert.deepEqual(checkTracks(text, resolver), []);
});

test("a document pointing at a deleted handoff fails, and is told where to point instead", () => {
  const problems = checkHandoffRefs("See specs/0099-gone/handoff.md for context.", resolver, "DEBT.md");
  assert.equal(problems.length, 1);
  assert.match(problems[0]!.reason, /specs\/TRACKS-LOG\.md instead/);
});

test("protocol talk and template paths are not references", () => {
  const text = "Each lane carries a handoff.md; the path is specs/NNNN-<slug>/handoff.md.";
  assert.deepEqual(checkHandoffRefs(text, resolver, "AGENTS.md"), []);
});

test("live lane directories come from the index, not from a directory listing", () => {
  const text = [
    "- **A** — [handoff](specs/0016-vision/handoff.md) — active, next: T1",
    "- **B** — none — blocked (on a token), next: provision",
  ].join("\n");
  assert.deepEqual(liveTrackSpecDirs(text), ["specs/0016-vision"]);
});

// ---- spec 0009: a lane nobody has touched

test("a live track line nobody has refreshed is reported, with its age", () => {
  const index = [
    "# Work tracks",
    "",
    "- **Fresh (spec 0001)** — [handoff](specs/0001-fresh/handoff.md) — active, 2026-09-01, next: T2",
    "- **Old (spec 0002)** — [handoff](specs/0002-old/handoff.md) — active, 2026-08-01, next: T1",
  ].join("\n");

  const problems = staleProblems(index, { today: "2026-09-08", afterDays: 14 });
  assert.equal(problems.length, 1, "only the one past the limit");
  assert.equal(problems[0]!.line, 4);
  assert.match(problems[0]!.reason, /last moved 38 days ago/);
  assert.match(problems[0]!.reason, /mark it paused|close the track/);
});

test("the fence is named when the stale lane is holding one", () => {
  const index = "# T\n\n- **Old (spec 0002)** — [handoff](specs/0002-old/handoff.md) — active, 2026-08-01, next: T1\n";
  const holding = staleProblems(index, {
    today: "2026-09-08",
    afterDays: 14,
    claimed: new Set(["specs/0002-old"]),
  });
  assert.match(holding[0]!.reason, /while holding the paths it declared/);
});

test("the rule stays quiet unless it was asked for, and never invents a date", () => {
  const index = "# T\n\n- **Old (spec 0002)** — [handoff](specs/0002-old/handoff.md) — active, 2020-01-01, next: T1\n";
  assert.deepEqual(staleProblems(index, { today: "2026-09-08", afterDays: 0 }), [], "0 turns it off");

  const undated = "# T\n\n- **Old (spec 0002)** — [handoff](specs/0002-old/handoff.md) — active, next: T1\n";
  assert.deepEqual(
    staleProblems(undated, { today: "2026-09-08", afterDays: 14 }),
    [],
    "a line with no date is the tracks check's business, not this one's",
  );
});

// ---- spec 0012: switching goals is a normal path

test("a pause carries its reason, and a pause without one is not a pause with a reason", () => {
  assert.equal(pauseReason("- **A** — [handoff](specs/0001-a/handoff.md) — paused (waiting on the API), 2026-01-01"), "waiting on the API");
  assert.equal(pauseReason("- **A** — [handoff](specs/0001-a/handoff.md) — paused — owner switched goals"), "owner switched goals");
  assert.equal(pauseReason("- **A** — [handoff](specs/0001-a/handoff.md) — paused, 2026-01-01"), null);
  assert.equal(pauseReason("- **A** — [handoff](specs/0001-a/handoff.md) — active, 2026-01-01"), null);
  assert.deepEqual(
    pausedTrackSpecDirs(
      "- **A** — [handoff](specs/0001-a/handoff.md) — paused (x), 2026-01-01\n- **B** — [handoff](specs/0002-b/handoff.md) — active\n",
    ),
    ["specs/0001-a"],
  );
});

test("a lane paused with a reason is never stale; one paused without a reason still is", () => {
  const index =
    "- **A** — [handoff](specs/0001-a/handoff.md) — paused (owner switched to billing), 2026-01-01, next: T3\n" +
    "- **B** — [handoff](specs/0002-b/handoff.md) — paused, 2026-01-01, next: T1\n";
  const problems = staleProblems(index, { today: "2026-09-08", afterDays: 14 });
  assert.deepEqual(problems.map((p) => p.line), [2], "only the pause nobody explained");
  assert.match(problems[0]!.reason, /track pause <slug> --reason/);
});
