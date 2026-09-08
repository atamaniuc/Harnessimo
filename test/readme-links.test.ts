// The README is three surfaces at once: this repository's front page, the npm
// listing and, through scripts/site-home.ts, the site's home. A link that is
// wrong is wrong in all three, and nobody reading a rendered page can tell
// whether it was ever right.
//
// This exists because one was not: the demo image carried `''' + RAW + '''`
// straight from the heredoc that wrote the file, so GitHub and npm showed a
// broken image for the tool's one screenshot. The site never showed it — the
// generator replaces that region with a player — which is exactly how a
// single-sourced document still drifts on one surface only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = "https://raw.githubusercontent.com/atamaniuc/Harnessimo/main/";
const READMES = ["README.md", "README.ru.md"];

/**
 * Fenced blocks and inline code are quoted terminal output, not links: the
 * README shows what `harnessimo brief` prints, and that sample names a spec
 * this repository does not have on purpose.
 */
function prose(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

/** Every href and src in the file: markdown links and inline HTML alike. */
function targets(markdown: string): string[] {
  const text = prose(markdown);
  return [
    ...[...text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)/g)].map((m) => m[1]!),
    ...[...text.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]!),
  ];
}

for (const readme of READMES) {
  const text = readFileSync(join(ROOT, readme), "utf8");
  const found = targets(text);

  test(`${readme} has links to check`, () => {
    assert.ok(found.length > 0, "no links found — the parser, not the document, is wrong");
  });

  // A leaked template expression is still a syntactically fine URL, so the
  // shape has to be asserted rather than assumed.
  test(`${readme}: no link carries an unexpanded template`, () => {
    for (const url of found) {
      assert.doesNotMatch(
        url,
        /'''|\$\{|\bRAW\b|\s/,
        `${url} looks like a template that was never expanded`,
      );
    }
  });

  // Absolute links to this repository's own raw content name a file that has
  // to exist here. The rest are somebody else's server and not this test's
  // business.
  test(`${readme}: every file it points at in this repository exists`, () => {
    for (const url of found) {
      const path = url.startsWith(RAW)
        ? url.slice(RAW.length)
        : /^(https?:|mailto:|#)/.test(url)
          ? null
          : url.split("#")[0]!;
      if (!path) continue;
      assert.ok(existsSync(join(ROOT, path)), `${url} points at ${path}, which is not in the repository`);
    }
  });
}

test("both READMEs show the same demo image", () => {
  const images = READMES.map(
    (r) => /<img src="([^"]+demo\.png)"/.exec(readFileSync(join(ROOT, r), "utf8"))?.[1],
  );
  assert.ok(images[0], "README.md no longer shows the demo image");
  assert.equal(images[0], images[1], "the translations point at different demo images");
});
