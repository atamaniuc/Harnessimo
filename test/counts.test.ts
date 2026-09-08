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
  assert.equal(count, 11, "if this changed, the sentences below need to change with it");

  const wrong = NUMBER[count - 1]!;
  // Every page that states the number, in the language it states it in.
  const english = ["README.md", "docs/index.md", "docs/GUIDE.md", "docs/WHY.md", "AGENTS.md"];
  const russian = ["README.ru.md", "docs/index.ru.md", "docs/GUIDE.ru.md", "docs/WHY.ru.md"];

  // The site description is baked into every page's meta tag and into search
  // results, where a wrong number is read by people who never open the page.
  // The count has to be right wherever in the sentence it sits: the rule is
  // "do not miscount", not "open with the number".
  const description = /^site_description:.*$/m.exec(read("mkdocs.yml"))?.[0] ?? "";
  assert.match(
    description,
    new RegExp(`\\b${NUMBER[count]!.en} checks\\b`, "i"),
    `mkdocs.yml describes the site as something other than ${NUMBER[count]!.en} checks`,
  );
  assert.doesNotMatch(
    description,
    new RegExp(`\\b${wrong.en} checks\\b`, "i"),
    `mkdocs.yml still says ${wrong.en} checks`,
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
    "cold-start", "clean-exit", "instructions", "boundaries", "thresholds", "release",
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

  const keys = ["docs", "tracks", "tracks.gateTasks", "queue", "coldStart", "cleanExit", "instructions", "locked", "boundaries", "thresholds", "release"];
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

// The README says how many of its own checks this repository runs. That is a
// claim about a file two directories away, which is the kind this whole tool
// exists to catch — and it went stale the moment an eleventh check shipped
// that this package has nothing to feed.
test("what this repository claims to enforce on itself is what it enforces", () => {
  const config = JSON.parse(read("harnessimo.config.json")) as Record<string, unknown>;
  const total = checkCount();
  const on = ["docs", "tracks", "queue", "locked", "coldStart", "cleanExit", "instructions", "boundaries", "thresholds", "release"]
    .filter((section) => Boolean(config[section])).length
    + 1; // tracks.gateTasks is a check of its own and rides on the tracks section

  const claim = NUMBER[on]!;
  assert.match(
    read("README.md"),
    new RegExp(`${claim.en} of (its |the )?${NUMBER[total]!.en}`, "i"),
    `README.md should say ${claim.en} of ${NUMBER[total]!.en} checks run here`,
  );
  for (const word of NUMBER[on]!.ru) {
    if (read("README.ru.md").toLowerCase().includes(word)) {
      overclaim(total, on);
      return;
    }
  }
  assert.fail(`README.ru.md does not say ${claim.ru[0]} of the checks run here`);
});

/** Saying "all of them" while one is switched off is the drift, not the wording. */
function overclaim(total: number, on: number): void {
  if (on === total) return;
  for (const page of ["README.md", "docs/WHY.md"]) {
    assert.doesNotMatch(
      read(page),
      new RegExp(`\\ball ${NUMBER[total]!.en} checks run against this repository`, "i"),
      `${page} says all ${NUMBER[total]!.en} run here, and ${total - on} do not`,
    );
  }
}
