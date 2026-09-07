import { test } from "node:test";
import assert from "node:assert/strict";
import { activate, checkQueue, formatStatus, verifyItem, HarnessError } from "../src/queue.mjs";

const item = (over = {}) => ({
  id: "rls-proof",
  phase: "1",
  kind: "code",
  behavior: "A non-owner org_id receives zero rows from every table, proven by the RLS suite.",
  verification: "npm test",
  state: "not_started",
  evidence: null,
  ...over,
});
const list = (items, over = {}) => ({ wip_limit: 1, review_queue_limit: 5, items, ...over });
const passes = () => ({ ok: true, output: "12 tests passed" });
const fails = () => ({ ok: false, output: "1 test failed" });

test("work in progress is capped, because split attention finishes nothing", () => {
  const l = list([item({ id: "a", state: "active" }), item({ id: "b" })]);
  assert.throws(() => activate(l, "b"), (e) => e instanceof HarnessError && /WIP limit reached/.test(e.what));
});

test("an item whose success cannot be decided may not be started", () => {
  const l = list([item({ verification: "" })]);
  assert.throws(() => activate(l, "rls-proof"), /no verification command/);
});

test("an activity-shaped item may not be started", () => {
  const l = list([item({ behavior: "Add validation to the ingestion endpoint and tidy the tests up" })]);
  assert.throws(() => activate(l, "rls-proof"), /rather than an outcome/);
});

test("verifying activates on the way in, then records the evidence", () => {
  const l = list([item()]);
  const { item: after, ok } = verifyItem(l, "rls-proof", passes);
  assert.equal(ok, true);
  assert.equal(after.state, "passing");
  assert.equal(after.evidence, "12 tests passed");
});

test("a failed verification blocks the item and keeps the reason", () => {
  const l = list([item()]);
  const { ok, item: after } = verifyItem(l, "rls-proof", fails);
  assert.equal(ok, false);
  assert.equal(after.state, "blocked");
  assert.equal(after.last_failure, "1 test failed");
});

test("a kind can close in its own terminal state rather than passing", () => {
  const l = list([item({ kind: "content" })]);
  const { item: after } = verifyItem(l, "rls-proof", passes, {
    terminalByKind: { content: "awaiting_gates" },
  });
  assert.equal(after.state, "awaiting_gates");
});

test("a state edited by hand, with no evidence, fails the invariants", () => {
  const problems = checkQueue(list([item({ state: "passing", evidence: null })]));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /is passing with no evidence/);
});

test("re-verification catches a claim that is no longer true", () => {
  // The whole point: evidence is a string anyone can write, so CI re-runs the
  // command rather than believing the file.
  const l = list([item({ state: "passing", evidence: "12 tests passed" })]);
  const problems = checkQueue(l, { reverify: true, runner: fails });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /claims passing but its verification fails now/);
});

test("re-verification of a claim that still holds reports nothing", () => {
  const l = list([item({ state: "passing", evidence: "12 tests passed" })]);
  assert.deepEqual(checkQueue(l, { reverify: true, runner: passes }), []);
});

test("status prints the limits it enforces", () => {
  const out = formatStatus(list([item({ state: "active" })]));
  assert.match(out, /WIP 1\/1/);
});
