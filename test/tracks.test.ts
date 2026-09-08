import { test } from "node:test";
import assert from "node:assert/strict";
import { checkHandoffRefs, checkTracks, liveTrackSpecDirs , staleProblems } from "../src/tracks.ts";
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
