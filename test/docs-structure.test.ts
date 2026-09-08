// The site's shape is a claim like any other: this many pages, these names,
// and every URL that was ever published still answering. `mkdocs build
// --strict` catches a broken link inside the site, but it runs in a deploy job
// with Python installed — too late and too far away to be the only guard, and
// it cannot see a redirect pointing at a page that does not exist, because a
// redirect is not a link.
//
// So the structure is checked here, where the rest of the suite runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mkdocs = readFileSync(join(ROOT, "mkdocs.yml"), "utf8");

/** The `nav:` block's page files, in order. External links are not pages. */
function navPages(): string[] {
  const block = /^nav:\n((?:[ \t]+.*\n)+)/m.exec(mkdocs)?.[1] ?? "";
  return [...block.matchAll(/:\s*([\w.-]+\.md)\s*$/gm)].map((m) => m[1]!);
}

/**
 * `redirect_maps:` as pairs of retired page → the page that absorbed it.
 * Entries exist per language — `ADOPTING.ru.md: GUIDE.ru.md` — because the
 * published Russian URL needs its own stub (hooks/i18n_redirects.py).
 */
function redirects(): [string, string][] {
  const block = /redirect_maps:\n((?:[ \t]+[\w.-]+\.md:.*\n)+)/.exec(mkdocs)?.[1] ?? "";
  return [...block.matchAll(/([\w.-]+\.md):\s*([\w.-]+\.md)/g)].map((m) => [m[1]!, m[2]!]);
}

/** Every page file, translations included, since a redirect names one exactly. */
const everyPage = readdirSync(join(ROOT, "docs")).filter((f) => f.endsWith(".md"));

/** English pages in docs/ — a translation is `<name>.<locale>.md`. */
const pages = readdirSync(join(ROOT, "docs")).filter(
  (f) => f.endsWith(".md") && !/\.\w{2}\.md$/.test(f),
);

test("the nav lists exactly the pages that exist", () => {
  const nav = navPages();
  assert.ok(nav.length > 0, "no pages in nav — the parser, not the config, is wrong");

  for (const page of nav) {
    assert.ok(pages.includes(page), `nav points at docs/${page}, which does not exist`);
  }
  for (const page of pages) {
    assert.ok(
      nav.includes(page),
      `docs/${page} is in the repository but not in nav — unreachable, and --strict fails on it`,
    );
  }
});

test("every retired page redirects somewhere real", () => {
  for (const [from, to] of redirects()) {
    assert.ok(
      !everyPage.includes(from),
      `${from} still exists, so redirecting it hides the page instead of retiring it`,
    );
    assert.ok(
      everyPage.includes(to),
      `${from} redirects to ${to}, which does not exist — a published link would 404`,
    );
  }
});

test("no page needs four screens of scrolling", () => {
  // A reference nobody reaches the end of is the chaos this consolidation was
  // for. The number is a judgement, not a law — but it has to be somewhere
  // other than in someone's memory.
  const LIMIT = 400;
  for (const page of readdirSync(join(ROOT, "docs")).filter((f) => f.endsWith(".md"))) {
    const lines = readFileSync(join(ROOT, "docs", page), "utf8").split("\n").length;
    assert.ok(lines <= LIMIT, `docs/${page} is ${lines} lines; split it or move something out`);
  }
});
