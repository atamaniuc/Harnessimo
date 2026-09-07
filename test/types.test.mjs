// The type declarations are hand-written, so something has to notice when they
// drift from the code. Installing TypeScript to check them would break the
// property that makes this package's cold start meaningful — `npm test` on a
// clean checkout with no install — so the check is this instead: every runtime
// export is declared, and every declaration exists at runtime.
//
// It does not check that the *types* are right. It checks that the surface
// matches, which is the drift that actually happens: a renamed export, a new
// function nobody declared, a declaration left behind by a deletion.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as api from "../src/index.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const declarations = readFileSync(join(ROOT, "types/index.d.ts"), "utf8");

const declared = new Set(
  [...declarations.matchAll(/^export (?:declare )?(?:function|class|const) (\w+)/gm)].map((m) => m[1]),
);
const runtime = new Set(Object.keys(api));

test("every runtime export is declared", () => {
  const missing = [...runtime].filter((name) => !declared.has(name));
  assert.deepEqual(missing, [], `undeclared exports: ${missing.join(", ")}`);
});

test("every declaration exists at runtime", () => {
  const phantom = [...declared].filter((name) => !runtime.has(name));
  assert.deepEqual(phantom, [], `declared but not exported: ${phantom.join(", ")}`);
});

test("the package points consumers at the declarations", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.types, "./types/index.d.ts");
  assert.equal(pkg.exports["."].types, "./types/index.d.ts");
  assert.ok(pkg.files.includes("types"), "types/ must be published");
});
