import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTarget, findMarkers, isSyntaxExample, verifyProofs } from "../src/proof.mjs";
import { fakeResolver } from "./helpers.mjs";

const resolver = fakeResolver({
  files: {
    "src/search.ts": "export function searchChunks() {}",
    "test/rls.spec.ts": 'test("every table has RLS", () => {})',
    "README.md": "# Readme",
  },
  commands: { task: ["check", "verify"], make: ["check"] },
  migrations: ["20260821110000_locks.sql"],
});

test("a target that is only a path checks the file exists", () => {
  assert.equal(checkTarget("src/search.ts", resolver), null);
  assert.match(checkTarget("src/gone.ts", resolver), /does not exist/);
});

test("a path:symbol target checks the file contains the symbol", () => {
  assert.equal(checkTarget("src/search.ts:searchChunks", resolver), null);
  assert.match(checkTarget("src/search.ts:missingSymbol", resolver), /does not contain/);
});

test("a path#test-name target checks the named test still exists", () => {
  assert.equal(checkTarget("test/rls.spec.ts#every table has RLS", resolver), null);
  assert.match(checkTarget("test/rls.spec.ts#a renamed test", resolver), /does not contain/);
});

test("a command target resolves against the runner that declares it", () => {
  assert.equal(checkTarget("task check", resolver), null);
  assert.equal(checkTarget("make check", resolver), null);
  assert.match(checkTarget("task deploy", resolver), /no task command named "deploy"/);
});

test("a command kind the project does not declare says so instead of passing", () => {
  // The failure mode this rejects: an unknown prefix silently resolving to
  // "fine", which is how a gate quietly stops gating.
  assert.match(checkTarget("just build", resolver), /declares no "just" command file/);
});

test("a migration target matches by prefix", () => {
  assert.equal(checkTarget("migration:20260821110000", resolver), null);
  assert.match(checkTarget("migration:19990101", resolver), /no migration starts with/);
});

test("a marker documenting the syntax is not a claim", () => {
  assert.ok(isSyntaxExample("path/to/file.ts[:symbol]"));
  assert.ok(isSyntaxExample("specs/NNNN-<slug>/handoff.md"));
  assert.ok(isSyntaxExample("src/... "));
  assert.ok(!isSyntaxExample("src/search.ts:searchChunks"));
  assert.deepEqual(findMarkers("<!-- proof: path[:symbol] -->"), []);
});

test("markers are found with their line numbers, and only real ones", () => {
  const text = "# Title\n\nClaim. <!-- proof: src/search.ts -->\nExample: <!-- proof: file[:sym] -->\n";
  assert.deepEqual(findMarkers(text), [{ line: 3, target: "src/search.ts" }]);
});

test("strict mode fails a central document that carries no evidence at all", () => {
  const problems = verifyProofs([{ path: "README.md", text: "# Readme\nWe do everything." }], resolver, {
    strict: true,
    mustCarryProof: ["README.md"],
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0].reason, /carries no proof marker/);
});

test("without strict mode an unmarked document is left alone", () => {
  const problems = verifyProofs([{ path: "README.md", text: "# Readme" }], resolver, {
    mustCarryProof: ["README.md"],
  });
  assert.deepEqual(problems, []);
});
