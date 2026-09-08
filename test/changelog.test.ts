// A changelog is a claim about every version that exists, so it gets the same
// treatment as any other claim here: a check, not a habit. Bumping the version
// without writing down what changed fails before the release does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  version: string;
};

test("the version being shipped is written down", () => {
  assert.ok(
    changelog.includes(`## [${version}]`),
    `CHANGELOG.md has no entry for ${version} — write what changed before releasing it`,
  );
});

test("every entry links to the release it names", () => {
  const entries = [...changelog.matchAll(/^## \[([\d.]+)\]/gm)].map((m) => m[1]!);
  assert.ok(entries.length > 0, "no versions in the changelog");
  for (const entry of entries) {
    assert.match(
      changelog,
      new RegExp(`^\\[${entry.replace(/\./g, "\\.")}\\]: https://`, "m"),
      `${entry} is described but links nowhere`,
    );
  }
});

test("the newest entry is the current version", () => {
  const first = /^## \[([\d.]+)\]/m.exec(changelog)?.[1];
  assert.equal(first, version, "the changelog's top entry should be what package.json says");
});
