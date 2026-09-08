// Spec 0004. Every rule here ships with a test that proves it fires on bad
// input, and for a guard "bad input" is the read that should not happen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideRead, emptyState, estimateTokens, format, ledger, ledgerReport } from "../src/tokens.ts";

const FILE = { path: "src/pipeline.ts", size: 28_000, mtimeMs: 1_000 };
const NOW = 1_700_000_000_000;

test("a first read is allowed and recorded", () => {
  const { decision, state } = decideRead(emptyState(), { ...FILE, now: NOW });
  assert.equal(decision.allow, true);
  assert.equal(state.reads[FILE.path]?.reads, 1);
});

test("a re-read of an unchanged file is refused, and says what it saved", () => {
  const first = decideRead(emptyState(), { ...FILE, now: NOW });
  const second = decideRead(first.state, { ...FILE, now: NOW + 1000 });

  assert.equal(second.decision.allow, false);
  assert.equal(second.decision.savedTokens, estimateTokens(FILE.size));
  assert.match(second.decision.message ?? "", /already read/);
  assert.match(second.decision.message ?? "", /fix:/, "a refusal has to say what to do instead");
});

test("a changed file may be read again", () => {
  const first = decideRead(emptyState(), { ...FILE, now: NOW });
  const changed = decideRead(first.state, { ...FILE, mtimeMs: 2_000, now: NOW + 1000 });
  assert.equal(changed.decision.allow, true);
  assert.match(changed.decision.reason, /changed/);

  const resized = decideRead(first.state, { ...FILE, size: 31_000, now: NOW + 1000 });
  assert.equal(resized.decision.allow, true);
});

test("a partial read is not a full read", () => {
  const first = decideRead(emptyState(), { ...FILE, now: NOW, partial: true });
  assert.equal(first.decision.allow, true);
  assert.equal(
    first.state.reads[FILE.path],
    undefined,
    "a range must not count as having read the file, or the next full read is refused wrongly",
  );
});

test("an override is allowed and recorded as one", () => {
  const first = decideRead(emptyState(), { ...FILE, now: NOW });
  const forced = decideRead(first.state, { ...FILE, now: NOW + 1000, override: true });

  assert.equal(forced.decision.allow, true);
  assert.equal(forced.decision.reason, "override");
  assert.equal(ledger(forced.state).overrides, 1, "an override nobody can see is a rule nobody can fix");
});

test("state older than the window is forgotten", () => {
  const first = decideRead(emptyState(), { ...FILE, now: NOW });
  const later = decideRead(first.state, { ...FILE, now: NOW + 21 * 60_000 });
  assert.equal(later.decision.allow, true, "a twenty-minute-old read is not this piece of work");
});

test("the ledger totals what was read, repeated and saved", () => {
  let state = emptyState();
  state = decideRead(state, { ...FILE, now: NOW }).state;
  state = decideRead(state, { path: "README.md", size: 4_000, mtimeMs: 5, now: NOW }).state;
  // A change, then a genuine second read of it.
  state = decideRead(state, { ...FILE, mtimeMs: 2_000, now: NOW + 10 }).state;
  // And one refusal.
  state = decideRead(state, { ...FILE, mtimeMs: 2_000, now: NOW + 20 }).state;

  const l = ledger(state);
  assert.equal(l.files, 2);
  assert.equal(l.reads, 3);
  assert.equal(l.repeated, 1, "the file read twice");
  assert.equal(l.refused, 1);
  assert.equal(l.tokensSaved, estimateTokens(FILE.size));
  assert.equal(l.largest?.path, FILE.path);
});

test("the report says the numbers are estimates and names the fix", () => {
  let state = emptyState();
  state = decideRead(state, { ...FILE, now: NOW }).state;
  state = decideRead(state, { ...FILE, mtimeMs: 2_000, now: NOW + 10 }).state;

  const report = ledgerReport(ledger(state));
  assert.match(report, /estimated at 4 bytes per token/, "an estimate must not read as a measurement");
  assert.match(report, /re-read/);
  assert.match(report, /fix:/);
});

test("an empty ledger says so rather than printing zeroes", () => {
  assert.match(ledgerReport(ledger(emptyState())), /nothing read through the guard yet/);
});

test("token counts are formatted as the approximations they are", () => {
  assert.equal(format(184_000), "~184k");
  assert.equal(format(12), "~12");
});
