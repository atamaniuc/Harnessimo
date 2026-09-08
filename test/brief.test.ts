import { test } from "node:test";
import assert from "node:assert/strict";
import { briefJson, briefText, handoffPaths, mergeSessionStartHook, sectionOf } from "../src/brief.ts";

const tracks = [
  "# Work tracks",
  "",
  "- **Retrieval quality** — [handoff](specs/0004-retrieval/handoff.md) — active, next: T3 recall eval",
  "- **Hosted deploy** — none — blocked (on a token), next: provision",
].join("\n");

test("the brief leads with the track index and the head of each handoff", () => {
  const text = briefText({
    tracksText: tracks,
    handoffs: [{ path: "specs/0004-retrieval/handoff.md", text: "# Handoff\n\n## Context\n\nWhy this lane exists." }],
    queue: null,
    progressText: null,
  });
  assert.match(text, /live work tracks/);
  assert.match(text, /Retrieval quality/);
  assert.match(text, /specs\/0004-retrieval\/handoff\.md \(first 20 lines\)/);
  assert.match(text, /Why this lane exists/);
});

test("a handoff is truncated, because a brief that is a novel does not get read", () => {
  const long = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
  const text = briefText({ tracksText: null, handoffs: [{ path: "h.md", text: long }] });
  assert.match(text, /line 19/);
  assert.doesNotMatch(text, /line 20\b/);
});

test("the queue says what is in flight and how to close it", () => {
  const queue = {
    items: [
      { id: "rls-proof", state: "active", behavior: "A non-owner org receives zero rows." },
      { id: "later", state: "not_started", behavior: "Something else." },
    ],
  };
  const text = briefText({ tracksText: null, queue });
  assert.match(text, /active: rls-proof/);
  assert.match(text, /harnessimo queue verify rls-proof/);
});

test("an empty queue says so, and names what is next", () => {
  const queue = { items: [{ id: "next-thing", state: "not_started", behavior: "A thing." }] };
  const text = briefText({ tracksText: null, queue });
  assert.match(text, /active: nothing in flight/);
  assert.match(text, /next queued: next-thing/);
});

test("a blocked item carries the reason it blocked", () => {
  const queue = { items: [{ id: "x", state: "blocked", behavior: "b", last_failure: "2 tests failed" }] };
  assert.match(briefText({ tracksText: null, queue }), /blocked: x — 2 tests failed/);
});

test("the brief names what is NOT enforced, not only what is", () => {
  // A session that assumes a check exists stops looking for the missing one.
  const text = briefText({ tracksText: null, enabled: { proof: true, queue: false, locked: false } });
  assert.match(text, /not enforced: queue, locked/);
});

test("only the Now section of progress is carried", () => {
  const progress = "# PROGRESS\n\n## Now\n\nWriting the verifier.\n\n## Done\n\nEverything else.\n";
  const text = briefText({ tracksText: null, progressText: progress });
  assert.match(text, /Writing the verifier/);
  assert.doesNotMatch(text, /Everything else/);
  assert.equal(sectionOf(progress, "Done"), "Everything else.");
  assert.equal(sectionOf(progress, "Missing"), null);
});

test("handoff paths come from the index, and templates are not paths", () => {
  assert.deepEqual(handoffPaths(tracks), ["specs/0004-retrieval/handoff.md"]);
  assert.deepEqual(handoffPaths("see specs/NNNN-<slug>/handoff.md for the shape"), []);
});

test("the JSON shape is what a SessionStart hook is read from", () => {
  const json = briefJson("state");
  assert.equal(json.hookSpecificOutput.hookEventName, "SessionStart");
  assert.equal(json.hookSpecificOutput.additionalContext, "state");
});

test("installing the agent hook leaves the rest of the settings alone", () => {
  const existing = { enabledPlugins: { "some-plugin": true }, hooks: { Stop: [{ hooks: [] }] } };
  const { settings, added } = mergeSessionStartHook(existing, "./hook.sh");
  assert.equal(added, true);
  assert.deepEqual(settings.enabledPlugins, { "some-plugin": true });
  assert.equal(settings.hooks!.Stop!.length, 1);
  assert.equal(settings.hooks!.SessionStart![0]!.hooks![0]!.command, "./hook.sh");
});

test("installing twice does not add the hook twice", () => {
  const first = mergeSessionStartHook({}, "./hook.sh").settings;
  const second = mergeSessionStartHook(first, "./hook.sh");
  assert.equal(second.added, false);
  assert.equal(second.settings.hooks!.SessionStart!.length, 1);
});

test("an existing hook from another tool is preserved", () => {
  const existing = { hooks: { SessionStart: [{ hooks: [{ type: "command", command: "./theirs.sh" }] }] } };
  const { settings } = mergeSessionStartHook(existing, "./ours.sh");
  const commands = settings.hooks!.SessionStart!.flatMap((e) => (e.hooks ?? []).map((h) => h.command));
  assert.deepEqual(commands, ["./theirs.sh", "./ours.sh"]);
});
