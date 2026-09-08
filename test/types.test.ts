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

test("a consumer installing from a git tag gets JavaScript, not TypeScript", () => {
  // Not a lifecycle script: pnpm 10 refuses to run a dependency's scripts and
  // yarn 1 does not build git dependencies, so both would install a package
  // with nothing runnable in it. dist/ is committed, and CI proves it matches
  // the source (scripts/build-is-current.mjs).
  assert.match(pkg.scripts.build ?? "", /tsconfig\.build\.json/);
  for (const file of ["dist/index.js", "dist/index.d.ts", "dist/cli.js"]) {
    assert.ok(existsSync(join(ROOT, file)), `${file} is missing: run npm run build`);
  }
});
