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
