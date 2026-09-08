// Two pages here are generated, and a generated page has exactly one failure
// mode: someone edits the copy instead of the source, and the two stop
// agreeing without anything saying so. The home page already had this guard;
// the configuration reference and the machine-readable bundle need it too.
//
// The configuration reference matters most. It is built from the JSON schema,
// which is what editors complete against — so a key that exists and is not
// described is a key nobody can discover, and a description that drifts is
// worse than none.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES, keyPaths, render } from "../scripts/config-reference.ts";
import { llmsTxt } from "../scripts/llms-txt.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string): string => readFileSync(join(ROOT, p), "utf8");

for (const locale of LOCALES) {
  test(`${locale.page} matches the schema it is generated from`, () => {
    assert.equal(
      read(locale.page),
      render(locale),
      `${locale.page} has drifted — edit the schema, then run \`npm run docs:sync\``,
    );
  });
}

test("every key in the schema is described in every language", () => {
  // A half-translated reference is worse than an untranslated one: the gap is
  // invisible, and a reader assumes the missing key does not exist.
  const paths = keyPaths();
  assert.ok(paths.length > 20, "the schema walker found almost nothing — it is reading wrong");
  for (const locale of LOCALES) {
    if (!locale.strings) continue;
    const strings = JSON.parse(read(locale.strings)) as Record<string, string>;
    for (const path of paths) {
      assert.ok(
        strings[path],
        `${locale.strings} has no wording for "${path}" — a key exists in the schema and not on the page`,
      );
    }
  }
});

test("every config section appears on the reference page", () => {
  const page = read("docs/CONFIGURATION.md");
  for (const path of keyPaths()) {
    const key = path.includes(".") ? path.split(".")[1]! : path;
    assert.match(page, new RegExp(`\`${key.replace(/\$/g, "\\$")}\``), `${path} is not on the page`);
  }
});

test("llms.txt matches the pages it is built from", () => {
  assert.equal(
    read("docs/llms.txt"),
    llmsTxt(),
    "docs/llms.txt has drifted from docs/ — run `npm run docs:sync`",
  );
});

test("llms.txt carries every page a reader can reach", () => {
  const bundle = read("docs/llms.txt");
  const contracts = JSON.parse(read("docs/contracts.json")) as { pages: Record<string, unknown> };
  for (const page of Object.keys(contracts.pages)) {
    assert.ok(
      bundle.includes(`FILE: docs/${page}`),
      `${page} is a page of the site and is missing from llms.txt — add it to ORDER in scripts/llms-txt.ts`,
    );
  }
});
