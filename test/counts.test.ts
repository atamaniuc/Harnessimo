// "Nine checks" in one paragraph and "eight of them" three screens down is the
// documentation equivalent of a stale comment, and it is worse here than
// elsewhere: this tool's whole argument is that a claim nobody checks drifts.
// A ninth check shipped in 0.5.0 and seven sentences kept saying eight.
//
// So the counts are read from their sources — the checks from the type that
// defines them, the constraints from the file that lists them — and every
// sentence that states a number is held to them, in both languages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string): string => readFileSync(join(ROOT, p), "utf8");

const NUMBER: Record<number, { en: string; ru: string[] }> = {
  8: { en: "eight", ru: ["восемь", "восьми"] },
  9: { en: "nine", ru: ["девять", "девяти"] },
  10: { en: "ten", ru: ["десять", "десяти"] },
  11: { en: "eleven", ru: ["одиннадцать", "одиннадцати"] },
};

/** The checks a repository can enable, from the type that defines them. */
function checkCount(): number {
  const types = read("src/types.ts");
  const block = /export type EnabledChecks = Record<([\s\S]*?)>;/.exec(types)?.[1];
  assert.ok(block, "EnabledChecks is no longer a Record — this test reads the wrong thing");
  return [...block.matchAll(/\|?\s*"(\w+)"/g)].length;
}

/** The rules in this repository's own constraints file, and the unenforced ones. */
function constraintCounts(): { total: number; reviewOnly: number } {
  const text = read(".harness/1-instructions/CONSTRAINTS.md");
  const rules = text.split(/\n(?=\d+\. \*\*)/).filter((r) => /^\d+\. \*\*/.test(r));
  return {
    total: rules.length,
    reviewOnly: rules.filter((r) => /_\(review only/.test(r)).length,
  };
}

test("the checks the docs count are the checks the code has", () => {
  const count = checkCount();
  assert.equal(count, 9, "if this changed, the sentences below need to change with it");

  const wrong = NUMBER[count - 1]!;
  // Every page that states the number, in the language it states it in.
  const english = ["README.md", "docs/index.md", "docs/GUIDE.md", "docs/WHY.md", "AGENTS.md"];
  const russian = ["README.ru.md", "docs/index.ru.md", "docs/GUIDE.ru.md", "docs/WHY.ru.md"];

  // The site description is baked into every page's meta tag and into search
  // results, where a wrong number is read by people who never open the page.
  assert.match(
    read("mkdocs.yml"),
    new RegExp(`^site_description: ${NUMBER[count]!.en} checks `, "im"),
    `mkdocs.yml describes the site as something other than ${NUMBER[count]!.en} checks`,
  );

  for (const page of english) {
    const text = read(page);
    assert.ok(
      new RegExp(`\\b${NUMBER[count]!.en}\\b`, "i").test(text),
      `${page} never says how many checks there are`,
    );
    assert.doesNotMatch(
      text,
      new RegExp(`\\b${wrong.en}\\b (checks|of them|rules|at once)`, "i"),
      `${page} still counts ${wrong.en} checks`,
    );
  }
  for (const page of russian) {
    const text = read(page);
    assert.ok(
      NUMBER[count]!.ru.some((word) => text.includes(word)),
      `${page} never says how many checks there are`,
    );
    for (const word of wrong.ru) {
      assert.ok(!text.includes(`${word} провер`), `${page} still counts ${word} проверок`);
      assert.ok(!text.includes(`Их ${word}`), `${page} still counts ${word} checks`);
    }
  }
});

test("the constraints the docs count are the constraints the file lists", () => {
  const { total, reviewOnly } = constraintCounts();
  assert.equal(total, 10, "a constraint was added or removed — the sentences below say ten");
  assert.equal(reviewOnly, 4, "the review-only count changed");

  assert.match(
    read(".harness/1-instructions/CONSTRAINTS.md"),
    new RegExp(`Four of the ${NUMBER[total]!.en} are review-only`),
    "CONSTRAINTS.md miscounts its own rules",
  );
  assert.match(
    read("docs/STANDARD.md"),
    new RegExp(`Of the ${NUMBER[total]!.en} constraints`),
    "docs/STANDARD.md miscounts the constraints",
  );
  assert.ok(
    NUMBER[total]!.ru.some((word) => read("docs/STANDARD.ru.md").includes(`Из ${word} ограничений`)),
    "docs/STANDARD.ru.md miscounts the constraints",
  );
});

// Counting right and listing right are different failures. The guide told
// readers not to switch on all nine at once and then offered a table of
// eight, which is the same drift wearing a different hat.
test("every check has a row in the tables that promise to list them all", () => {
  // The README lists commands; the guide lists the config keys that turn them
  // on, which is why the two are checked against different spellings.
  const commands = [
    "proof", "tracks", "tasks", "queue", "locked",
    "cold-start", "clean-exit", "instructions", "release",
  ];
  assert.equal(commands.length, checkCount(), "a check exists that this test does not name");

  for (const page of ["README.md", "README.ru.md"]) {
    const text = read(page);
    for (const command of commands) {
      assert.match(
        text,
        new RegExp("\\| `harnessimo " + command + "` \\|"),
        `${page}'s table of every check has no row for ${command}`,
      );
    }
  }

  const keys = ["docs", "tracks", "tracks.gateTasks", "queue", "coldStart", "cleanExit", "instructions", "locked", "release"];
  assert.equal(keys.length, checkCount(), "a check exists that the guide's table cannot name");
  for (const page of ["docs/GUIDE.md", "docs/GUIDE.ru.md"]) {
    const text = read(page);
    for (const key of keys) {
      assert.match(
        text,
        new RegExp("\\| `" + key.replace(".", "\\.") + "` \\|"),
        `${page} tells readers to turn on one at a time but never offers ${key}`,
      );
    }
  }
});
