// Spec 0010. Both source repositories wrote this rule by hand, differently,
// because the tool could not say it: this string, not in these files, for this
// reason.
import { test } from "node:test";
import assert from "node:assert/strict";
import { boundaryProblems } from "../src/boundaries.ts";

const files = [
  { path: "app/page.tsx", text: "const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n" },
  { path: "app/lib/db.ts", text: "// service_role belongs on the server\n" },
  { path: "server/admin.ts", text: "const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n" },
];

const rule = {
  pattern: "SERVICE_ROLE|service_role",
  paths: ["app/"],
  reason: "the service-role key bypasses row-level security; it belongs on the server",
};

test("a pattern is caught where the boundary applies, and nowhere else", () => {
  const problems = boundaryProblems(files, [rule]);

  assert.equal(problems.length, 2, "both files under app/, and not the one under server/");
  assert.deepEqual(problems.map((p) => p.file), ["app/page.tsx", "app/lib/db.ts"]);
  assert.equal(problems[0]!.line, 1);
  assert.match(problems[0]!.reason, /bypasses row-level security/, "the failure says why, not what matched");
});

test("one legitimate place can be allowed without dropping the rule", () => {
  const problems = boundaryProblems(files, [{ ...rule, allow: ["app/lib/"] }]);
  assert.deepEqual(problems.map((p) => p.file), ["app/page.tsx"]);
});

test("a boundary with no reason is refused, because a hit would say nothing", () => {
  const problems = boundaryProblems(files, [{ pattern: "x", paths: ["app/"], reason: "" }]);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!.reason, /needs a pattern, the paths it applies to, and a reason/);
  assert.equal(problems[0]!.file, "harnessimo.config.json");
});

test("a pattern that is not a regular expression is reported, not thrown", () => {
  const problems = boundaryProblems(files, [{ pattern: "([a-z", paths: ["app/"], reason: "why" }]);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!.reason, /the boundary never ran/);
});

test("a first run does not print a novel", () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ path: `app/f${i}.ts`, text: "service_role\n" }));
  const problems = boundaryProblems(many, [rule]);

  assert.equal(problems.length, 11, "ten hits and one line saying how many are left");
  assert.match(problems.at(-1)!.reason, /and 15 more line\(s\) cross this boundary/);
});

test("no rules is not an error", () => {
  assert.deepEqual(boundaryProblems(files, []), []);
});
