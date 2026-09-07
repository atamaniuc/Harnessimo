import { test } from "node:test";
import assert from "node:assert/strict";
import { doneness, readiness } from "../src/readiness.mjs";

const good = {
  id: "x",
  kind: "code",
  behavior: "The validator rejects a question with fewer than two answer bullets, with a named error.",
  verification: "npm test",
  state: "not_started",
  evidence: null,
};

test("a well-formed item is ready", () => {
  assert.deepEqual(readiness(good, [good]), []);
});

test("an item with no kind is not ready — kinds close by different rules", () => {
  const { kind, ...noKind } = good;
  assert.match(readiness(noKind, [noKind])[0].what, /no kind/);
});

test("a placeholder in the behavior means the scope is not settled", () => {
  const item = { ...good, behavior: `${good.behavior} TODO decide the error shape` };
  assert.match(readiness(item, [item])[0].what, /placeholder/);
});

test("an unfinished dependency blocks the start", () => {
  const dep = { ...good, id: "dep", state: "active" };
  const item = { ...good, depends_on: ["dep"] };
  assert.match(readiness(item, [dep, item])[0].what, /dependency "dep" is active/);
});

test("a dependency in any terminal state satisfies the check", () => {
  const dep = { ...good, id: "dep", state: "verified", evidence: "ok" };
  const item = { ...good, depends_on: ["dep"] };
  assert.deepEqual(readiness(item, [dep, item]), []);
});

test("done requires evidence, not confidence", () => {
  assert.match(doneness({ ...good, evidence: null }, true)[0].what, /no evidence/);
  assert.deepEqual(doneness({ ...good, evidence: "12 tests passed" }, true), []);
});
