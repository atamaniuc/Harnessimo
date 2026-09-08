#!/usr/bin/env node
/**
 * Generates docs/llms.txt — the whole documentation as one file, for an agent.
 *
 * This tool exists because an agent reads a repository and then claims to be
 * finished. Our documentation was seven pages of prose it would have to crawl
 * one at a time, which is the same failure we complain about: the thing that
 * needs the context has to go and assemble it.
 *
 * So the agent gets one file. It is generated from the pages, never written
 * beside them — a hand-maintained copy is a second source of truth, and this
 * repository has spent four patch releases on exactly that.
 *
 *   node scripts/llms-txt.ts          write it
 *   node scripts/llms-txt.ts --check  fail if it has drifted
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "docs/llms.txt";
const SITE = "https://atamaniuc.github.io/Harnessimo/";

interface Contract {
  answers: string;
  profile: string;
}

/** The pages, in the order a reader meets them; the contract supplies the "why". */
const ORDER = [
  "index.md",
  "WHY.md",
  "GUIDE.md",
  "CONFIGURATION.md",
  "REFERENCE.md",
  "PARALLEL.md",
  "STANDARD.md",
  "FAQ.md",
  "TROUBLESHOOTING.md",
  "SDD.md",
];

/**
 * Strips what only means something in a browser: the front-matter comment a
 * generator leaves, the reader header (an agent is every profile at once), and
 * the horizontal rule under it.
 */
function body(markdown: string): string {
  let text = markdown.replace(/^<!--[\s\S]*?-->\n*/, "");
  text = text.replace(/^(# .+\n)\n\*\*Who is this for\?\*\*[\s\S]*?\n---\n/m, "$1");
  text = text.replace(/^(# .+\n)\n\*\*Кому это\?\*\*[\s\S]*?\n---\n/m, "$1");
  return text.trim();
}

export function llmsTxt(): string {
  const contracts = JSON.parse(readFileSync(join(ROOT, "docs/contracts.json"), "utf8")) as {
    pages: Record<string, Contract>;
  };
  const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    version: string;
  };

  const parts: string[] = [
    "# Harnessimo — full documentation for machine readers",
    "",
    `Version ${version}. Generated from docs/ by scripts/llms-txt.ts; do not edit.`,
    `Published at ${SITE}llms.txt — the same pages, in the order a person would meet them.`,
    "",
    "Every section below is one page of the site. The heading names the page and the",
    "question it answers, so a reader looking for one answer can stop at one section.",
    "",
    "## Contents",
    "",
  ];

  for (const page of ORDER) {
    const contract = contracts.pages[page];
    if (!contract) continue;
    parts.push(`- ${page} — ${contract.answers}`);
  }
  parts.push("");

  for (const page of ORDER) {
    const contract = contracts.pages[page];
    if (!contract) continue;
    parts.push(
      "",
      "=".repeat(78),
      `FILE: docs/${page}`,
      `ANSWERS: ${contract.answers}`,
      `URL: ${SITE}${page === "index.md" ? "" : page.replace(/\.md$/, "/")}`,
      "=".repeat(78),
      "",
      body(readFileSync(join(ROOT, "docs", page), "utf8")),
    );
  }
  return parts.join("\n").trimEnd() + "\n";
}

function main(): void {
  const wanted = llmsTxt();
  const path = join(ROOT, OUT);
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8") === wanted) {
      console.log(`${OUT} matches the pages it is built from`);
      return;
    }
    console.error(`${OUT} has drifted from docs/ — run \`npm run docs:sync\``);
    process.exit(1);
  }
  writeFileSync(path, wanted);
  console.log(`wrote ${OUT} (${wanted.split("\n").length} lines)`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
