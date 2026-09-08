// One question, one reader, one moment — per document.
//
// Spec 0002 removed a duplicated table and stopped, because the real problem
// was not that two pages overlapped: it was that no page had a stated job, so
// overlap was undetectable until a reader tripped over it. A job nobody wrote
// down is a job nobody can check.
//
// So each page's job is data — docs/contracts.json — and this holds the pages
// to it. The field that does the work is `excludes`: it names what a page must
// NOT carry and where that belongs instead, which turns "these two pages feel
// like they overlap" into a failing test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string): string => readFileSync(join(ROOT, p), "utf8");

interface Contract {
  answers: string;
  profile: string;
  owns: string[];
  excludes: { heading: string; belongs: string }[];
  generated_from?: string;
}

const contracts = JSON.parse(read("docs/contracts.json")) as {
  profiles: Record<string, string>;
  pages: Record<string, Contract>;
};

/** English pages — a translation is `<name>.<locale>.md` and inherits its contract. */
const pages = readdirSync(join(ROOT, "docs")).filter(
  (f) => f.endsWith(".md") && !/\.\w{2}\.md$/.test(f),
);

test("every page has a contract, and every contract has a page", () => {
  for (const page of pages) {
    assert.ok(
      contracts.pages[page],
      `docs/${page} has no entry in docs/contracts.json — a page whose job is not written down is a page nothing can hold to it`,
    );
  }
  for (const page of Object.keys(contracts.pages)) {
    assert.ok(pages.includes(page), `contracts.json describes docs/${page}, which does not exist`);
  }
});

test("every contract names a profile that exists", () => {
  for (const [page, contract] of Object.entries(contracts.pages)) {
    assert.ok(
      contracts.profiles[contract.profile],
      `${page} claims profile "${contract.profile}", which is not one of ${Object.keys(contracts.profiles).join(", ")}`,
    );
  }
});

test("every exclusion points somewhere real", () => {
  for (const [page, contract] of Object.entries(contracts.pages)) {
    for (const { heading, belongs } of contract.excludes) {
      assert.notEqual(belongs, page, `${page} excludes "${heading}" to itself`);
      assert.ok(
        pages.includes(belongs) || contracts.pages[belongs],
        `${page} sends "${heading}" to ${belongs}, which is not a page`,
      );
    }
  }
});

test("no page keeps what its contract excludes", () => {
  for (const [page, contract] of Object.entries(contracts.pages)) {
    const headings = [...read(`docs/${page}`).matchAll(/^#{2,4}\s+(?:\d+[a-z]?\.\s*)?(.+?)\s*(?:\{.*\})?$/gm)]
      .map((m) => m[1]!.toLowerCase());
    for (const { heading, belongs } of contract.excludes) {
      assert.ok(
        !headings.includes(heading.toLowerCase()),
        `docs/${page} carries "${heading}", which its contract sends to ${belongs}`,
      );
    }
  }
});

test("the home page routes to every document a reader can reach", () => {
  // The routing table is how a reader with a question finds the page that
  // answers it. A page missing from it is a page reachable only by luck.
  const home = read("docs/index.md");
  const table = home.slice(home.indexOf("I want to"));
  for (const page of pages) {
    if (page === "index.md") continue;
    const url = page.replace(/\.md$/, "");
    assert.ok(
      table.includes(`/${url}/`) || table.includes(`(${page})`),
      `the routing table on the home page never sends anyone to ${page}`,
    );
  }
});
