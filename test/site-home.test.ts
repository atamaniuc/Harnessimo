// Three surfaces show this project's front page: the repository, npmjs.com and
// the documentation site. The first two are the same file. The third is
// generated from it — and a generated file that nobody regenerates is just a
// stale copy with a comment on top, so this is the check that makes it true.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { siteHome } from "../scripts/site-home.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(join(ROOT, "README.md"), "utf8");

test("the site home page is what the README generates", () => {
  const current = readFileSync(join(ROOT, "docs/index.md"), "utf8");
  assert.equal(
    current,
    siteHome(readme),
    "docs/index.md has drifted from README.md — run `npm run docs:sync`",
  );
});

test("the generated page links inside the site, not back out to it", () => {
  const generated = siteHome(readme);
  // A language root (/ru/) is another site, not a neighbouring page, and stays
  // absolute — the switcher and the README both need it that way.
  assert.doesNotMatch(
    generated.replace(/img\.shields\.io[^)]*/g, ""),
    /https:\/\/atamaniuc\.github\.io\/Harnessimo\/[A-Z]/,
    "a page on the site should link to its neighbours relatively",
  );
  assert.match(generated, /\(GUIDE\.md\)|\(WHY\.md\)/);
});

test("the site plays the recording, the README shows a still of it", () => {
  const generated = siteHome(readme);
  assert.match(generated, /asciinema-player/, "the site should embed the player");
  assert.match(generated, /assets\/demo\.cast/, "the player should point at the recording");
  assert.doesNotMatch(generated, /demo\.png/, "the still is for surfaces that cannot play it");
  assert.match(readme, /demo\.png/, "the README needs an image, not a player");
});

test("the install block becomes tabs, which GitHub cannot render", () => {
  const generated = siteHome(readme);
  for (const manager of ['=== "pnpm"', '=== "npm"', '=== "yarn"', '=== "bun"']) {
    assert.ok(generated.includes(manager), `no ${manager} tab on the site home page`);
  }
  assert.doesNotMatch(generated, /<details>/, "the README's collapsed block should not survive");
});
