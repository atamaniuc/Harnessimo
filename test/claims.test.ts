// Spec 0006. Two agents on one repository break in ways one agent never does,
// and the first of them is that nothing declares what a lane is touching.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  checkClaims,
  checkDependencies,
  claimProblem,
  closingProblem,
  duplicateNumbers,
  normalize,
  overlaps,
  parseClaims,
  parseDependencies,
} from "../src/claims.ts";

const handoff = (owns: string) => `# Handoff — 0006 x\n\n## Context\n\nWhy.\n\n## Owns\n\n${owns}\n\n## State\n\nStarted.\n`;

test("claims are read from the Owns section and nowhere else", () => {
  const text = handoff("- src/tokens.ts\n- `test/tokens.test.ts`\n- docs/agent/**");
  assert.deepEqual(
    parseClaims(text).map((c) => c.path),
    ["src/tokens.ts", "test/tokens.test.ts", "docs/agent/**"],
  );
  // A list under a different heading is prose, not a declaration.
  assert.deepEqual(parseClaims("## What to load\n\n- src/cli.ts\n"), []);
  // A fenced example shows the shape without declaring it.
  assert.deepEqual(parseClaims("## Owns\n\n```\n- src/cli.ts\n```\n"), []);
});

test("a placeholder is not a claim", () => {
  assert.deepEqual(parseClaims(handoff("- <the paths this lane is editing>")), []);
  const template = readFileSync(new URL("../templates/specs/handoff.template.md", import.meta.url), "utf8");
  assert.match(template, /##\s+Owns/, "the template must show the section");
  assert.deepEqual(parseClaims(template), [], "and the shipped template must claim nothing");
});

test("a claim is a path, not a pattern", () => {
  for (const bad of ["src/*.ts", "**/*.test.ts", "src/**/a.ts", "/etc/passwd", "../other/src", "**"]) {
    const problem = claimProblem(bad, "h.md", 1);
    assert.ok(problem, `"${bad}" should be refused`);
  }
  assert.match(claimProblem("src/*.ts", "h.md", 1)!.reason, /a file .*a directory .*a prefix/s);
  for (const good of ["src/a.ts", "src/", "src/**", "docs/agent/**", "Makefile"]) {
    assert.equal(claimProblem(good, "h.md", 1), null, `"${good}" is a legal claim`);
  }
});

test("overlap is prefix containment, not string prefix", () => {
  assert.equal(normalize("src/**"), "src/");
  assert.ok(overlaps("src/", "src/a.ts"));
  assert.ok(overlaps("src/**", "src/deep/a.ts"));
  assert.ok(overlaps("src/a.ts", "src/a.ts"));
  // The trap: two different files that share letters.
  assert.equal(overlaps("src/a.ts", "src/ab.ts"), false);
  assert.equal(overlaps("src/", "srcs/a.ts"), false);
  assert.equal(overlaps("src/a.ts", "test/a.ts"), false);
});

test("two live lanes cannot own the same path, and the failure names both", () => {
  const problems = checkClaims([
    { lane: "specs/0007-b", file: "specs/0007-b/handoff.md", claims: [{ path: "src/cli.ts", line: 9 }] },
    { lane: "specs/0006-a", file: "specs/0006-a/handoff.md", claims: [{ path: "src/", line: 7 }] },
  ]);

  assert.equal(problems.length, 1);
  assert.equal(problems[0]!.file, "specs/0007-b/handoff.md", "reported against the later lane");
  assert.equal(problems[0]!.line, 9);
  assert.match(problems[0]!.reason, /specs\/0006-a/);
  assert.match(problems[0]!.reason, /"src\/"/, "both claims are named, not just one");
});

test("a lane does not collide with itself", () => {
  const problems = checkClaims([
    {
      lane: "specs/0006-a",
      file: "specs/0006-a/handoff.md",
      claims: [
        { path: "src/", line: 7 },
        { path: "src/cli.ts", line: 8 },
      ],
    },
  ]);
  assert.deepEqual(problems, [], "naming a directory and a file inside it is redundant, not wrong");
});

test("two directories cannot share a number", () => {
  assert.deepEqual(duplicateNumbers(["0001-a", "0002-b", "TRACKS.md"], "specs"), []);

  const problems = duplicateNumbers(["0006-parallel-agents", "0006-vision", "0007-x"], "specs");
  assert.equal(problems.length, 1);
  assert.equal(problems[0]!.target, "0006");
  assert.match(problems[0]!.reason, /0006-parallel-agents and 0006-vision/);
});

// ---- spec 0008: one lane built on another

test("dependencies are read from their own section, by slug", () => {
  const text = "# H\n\n## Owns\n\n- src/a.ts\n\n## Depends on\n\n- retrieval-quality\n- `checkout-totals`\n";
  assert.deepEqual(parseClaims(text).map((c) => c.path), ["src/a.ts"], "the two sections do not bleed");
  assert.deepEqual(parseDependencies(text).map((c) => c.path), ["retrieval-quality", "checkout-totals"]);
  assert.deepEqual(parseDependencies("## Depends on\n\n- <the lanes this one waits on>\n"), []);
});

test("a dependency naming no lane is refused, and lists the ones that exist", () => {
  const problems = checkDependencies(
    [{ slug: "b", file: "specs/0002-b/handoff.md", deps: [{ path: "ghost", line: 9 }] }],
    ["a", "b"],
  );
  assert.equal(problems.length, 1);
  assert.equal(problems[0]!.line, 9);
  assert.match(problems[0]!.reason, /no lane with this slug/);
  assert.match(problems[0]!.reason, /name one of a, b/);
});

test("a lane cannot wait on itself", () => {
  const problems = checkDependencies(
    [{ slug: "a", file: "specs/0001-a/handoff.md", deps: [{ path: "a", line: 3 }] }],
    ["a"],
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0]!.reason, /cannot wait on itself/);
});

test("a cycle is reported once, naming the way round", () => {
  const lanes = [
    { slug: "a", file: "specs/0001-a/handoff.md", deps: [{ path: "b", line: 3 }] },
    { slug: "b", file: "specs/0002-b/handoff.md", deps: [{ path: "c", line: 3 }] },
    { slug: "c", file: "specs/0003-c/handoff.md", deps: [{ path: "a", line: 3 }] },
  ];
  const problems = checkDependencies(lanes, ["a", "b", "c"]);
  assert.equal(problems.length, 1, "one cycle, not one report per lane in it");
  assert.match(problems[0]!.reason, /waits on b, which waits on c, which waits on a/);
});

test("a chain that is not a cycle is fine", () => {
  const lanes = [
    { slug: "a", file: "f", deps: [{ path: "b", line: 1 }] },
    { slug: "b", file: "f", deps: [{ path: "c", line: 1 }] },
    { slug: "c", file: "f", deps: [] },
  ];
  assert.deepEqual(checkDependencies(lanes, ["a", "b", "c"]), []);
});

test("a lane cannot be closed while what it was built on is still open", () => {
  const deps = [{ path: "interfaces", line: 5 }];
  const problem = closingProblem("totals", deps, ["totals", "interfaces"]);
  assert.ok(problem);
  assert.match(problem, /still waits on interfaces/);
  assert.match(problem, /close interfaces first/);

  assert.equal(closingProblem("totals", deps, ["totals"]), null, "once it closed, this one may close");
  assert.equal(closingProblem("totals", [], ["totals", "interfaces"]), null);
});
