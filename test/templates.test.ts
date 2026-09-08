// templates/ is what `init` gives a project adopting the tool; .harness/ is
// what this repository actually runs on. They have the same shape deliberately,
// and the failure mode of that is copying: someone fixes a starter document by
// pasting this project's version of it, and every adopter inherits rules about
// a package they have never seen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string): string => readFileSync(join(ROOT, p), "utf8");

const PAIRS = [
  ".harness/1-instructions/CONSTRAINTS.md",
  ".harness/4-state/PROGRESS.md",
  ".harness/4-state/DECISIONS.md",
  ".harness/4-state/feature_list.json",
];

for (const path of PAIRS) {
  test(`the template for ${path} is a starter, not a copy`, () => {
    const mine = read(path);
    const template = read(join("templates", path));
    assert.notEqual(template, mine, "a consumer would inherit this repository's own state");
  });
}

test("the starter constraints tell the reader they are placeholders", () => {
  assert.match(read("templates/.harness/1-instructions/CONSTRAINTS.md"), /Replace these/);
});

test("the starter queue ships empty", () => {
  const queue = JSON.parse(read("templates/.harness/4-state/feature_list.json")) as {
    items: unknown[];
  };
  assert.deepEqual(queue.items, [], "an adopter should not inherit someone else's work items");
});
