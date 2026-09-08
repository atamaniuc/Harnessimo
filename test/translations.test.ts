// The site is published in two languages, which is a promise about every page
// rather than about the ones somebody remembered. A page added in English and
// not translated is a reader following a link into a language that changes
// under them — so it fails here instead.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");

/** Locales the site is built in, read from the mkdocs configuration itself. */
const locales = [...readFileSync(join(ROOT, "mkdocs.yml"), "utf8").matchAll(/^\s*- locale: (\w+)$/gm)]
  .map((m) => m[1]!)
  .filter((locale) => locale !== "en");

const pages = readdirSync(DOCS).filter((f) => f.endsWith(".md") && !/\.\w{2}\.md$/.test(f));

test("the site knows which languages it is built in", () => {
  assert.ok(locales.length > 0, "no non-default locale found in mkdocs.yml");
  assert.ok(pages.length > 3, "docs/ has suspiciously few pages");
});

for (const locale of locales) {
  test(`every page exists in ${locale}`, () => {
    const missing = pages
      .map((page) => page.replace(/\.md$/, `.${locale}.md`))
      .filter((translated) => !readdirSync(DOCS).includes(translated));
    assert.deepEqual(missing, [], `untranslated: ${missing.join(", ")}`);
  });
}

// The page that tells people to pin a version drifted in two directions at
// once: the English copy said 0.4.1 and the Russian 0.4.3, while the registry
// served something else again. A version in an instruction is a claim, and
// this repository's whole argument is that claims get checked.
//
// USE-CASES keeps its own version numbers on purpose — that page tells the
// story of a release that went wrong, and rewriting its history to match the
// current version would be a lie of a different kind.
test("the version the adoption guide tells people to pin is the current one", () => {
  const { version } = JSON.parse(
    readFileSync(join(ROOT, "package.json"), "utf8"),
  ) as { version: string };
  for (const page of ["docs/ADOPTING.md", "docs/ADOPTING.ru.md"]) {
    const pinned = [...readFileSync(join(ROOT, page), "utf8").matchAll(/harnessimo@(\d+\.\d+\.\d+)/g)];
    assert.ok(pinned.length > 0, `${page} no longer shows a version to pin`);
    for (const [, found] of pinned) {
      assert.equal(found, version, `${page} tells people to pin ${found}, but this is ${version}`);
    }
  }
});
