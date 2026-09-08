// The declarations are generated from the source now, so the old drift — a
// hand-written .d.ts describing functions that had moved on — cannot happen.
// What can still happen is a packaging mistake: an export the entry point does
// not re-export, or a package.json that points consumers at a path the build
// does not produce. Neither is caught by a type-check, and both make the
// package useless to a TypeScript consumer while every test passes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as api from "../src/index.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  types: string;
  bin: Record<string, string>;
  files: string[];
  exports: Record<string, { types: string; default: string }>;
  scripts: Record<string, string>;
};

test("the entry point re-exports every rule module", () => {
  // One name from each module: if a module stops being re-exported, its
  // consumers lose it silently.
  for (const name of [
    "checkTarget",
    "checkTracks",
    "checkTaskGate",
    "checkQueue",
    "readiness",
    "lockedViolations",
    "coldStartProblems",
    "debrisProblems",
    "briefText",
  ]) {
    assert.ok(name in api, `src/index.ts does not re-export ${name}`);
  }
});

test("the package points consumers at what the build produces", () => {
  assert.equal(pkg.types, "./dist/index.d.ts");
  assert.equal(pkg.exports["."]!.types, "./dist/index.d.ts");
  assert.equal(pkg.exports["."]!.default, "./dist/index.js");
  assert.equal(pkg.bin.harnessimo, "./dist/cli.js");
  assert.ok(pkg.files.includes("dist"), "dist/ must be published");
});

test("a consumer installing from a git tag gets a build", () => {
  // npm, pnpm, yarn and bun all run `prepare` when a dependency is installed
  // from a repository rather than the registry. Without it the package would
  // arrive as TypeScript with no dist/, and every import would fail.
  assert.ok(pkg.scripts.prepare, "no prepare script: a git install would arrive without dist/");
  assert.ok(
    existsSync(join(ROOT, "scripts/prepare.mjs")),
    "prepare points at a file that is not there",
  );
  assert.match(pkg.scripts.build ?? "", /tsconfig\.build\.json/);
});
