// Gated task state: a checked box is a claim, so it is checked like one.
//
// A checked box in a task list is normally self-reported by the agent that
// just wrote the code, with nothing re-run before it flips. That is the same
// failure class as prose claiming a capability that was never built — so it
// gets the same treatment: a checked box names the executable check that
// proves it, through the same checkTarget every proof marker goes through,
// rather than a second, divergent notion of "verified".
//
//   - [x] **T3** future-dated invoices quarantine <!-- proof: test/dates.spec.ts -->
//
// Scope is deliberately narrow: only task lists belonging to a live track are
// gated. Lanes that shipped before the rule existed keep their history; the
// moment a lane is retired from the track index, it drops out of scope here
// too. A rule applied retroactively to finished work produces a migration
// project, not a gate.

import { checkTarget, isSyntaxExample } from "./proof.mjs";
import { liveTrackSpecDirs } from "./tracks.mjs";

const LIST_ITEM = /^-\s*\[[ xX]\]\s/;
const CHECKED_TASK = /^-\s*\[x\]\s/i;
const MARKER = /<!--\s*proof:\s*(.+?)\s*-->/g;

/**
 * Groups a task list into one block per list item: the first line through its
 * indented continuation lines. A real task description wraps, and a marker on
 * a continuation line is still that item's marker — a regression found by
 * running this gate against a real task list before shipping it.
 *
 * @param {string} text
 * @returns {{ startLine: number, text: string }[]}
 */
export function taskBlocks(text) {
  const lines = text.split("\n");
  const blocks = [];
  let current = null;
  lines.forEach((lineText, index) => {
    if (LIST_ITEM.test(lineText)) {
      current = { startLine: index + 1, lines: [lineText] };
      blocks.push(current);
      return;
    }
    if (current && /^\s+\S/.test(lineText)) {
      current.lines.push(lineText);
      return;
    }
    current = null; // a blank line, heading, or dedented content ends the item
  });
  return blocks.map((b) => ({ startLine: b.startLine, text: b.lines.join("\n") }));
}

/**
 * @param {string} text
 * @param {string} filePath
 * @param {import("./proof.mjs").Resolver} resolver
 * @returns {import("./proof.mjs").Problem[]}
 */
export function checkTaskGate(text, filePath, resolver) {
  const problems = [];
  for (const block of taskBlocks(text)) {
    const firstLine = block.text.split("\n", 1)[0];
    if (!CHECKED_TASK.test(firstLine)) continue;
    const line = block.startLine;
    const markers = [...block.text.matchAll(MARKER)]
      .map((m) => m[1])
      .filter((target) => !isSyntaxExample(target));
    if (markers.length === 0) {
      problems.push({
        file: filePath,
        line,
        target: "(none)",
        reason:
          "checked task names no executable check — add <!-- proof: ... --> naming the test, eval case, or query that proves it",
      });
      continue;
    }
    for (const target of markers) {
      const reason = checkTarget(target, resolver);
      if (reason) {
        problems.push({ file: filePath, line, target, reason: `checked task's proof failed: ${reason}` });
      }
    }
  }
  return problems;
}

/**
 * Runs the gate over every task list belonging to a live track. `files` may
 * list every task list in the repository — only the live ones are checked.
 *
 * @param {{ path: string, text: string }[]} files
 * @param {string} tracksText
 * @param {import("./proof.mjs").Resolver} resolver
 * @param {{ specsDir?: string, taskFile?: string }} options
 * @returns {import("./proof.mjs").Problem[]}
 */
export function verifyTaskGates(files, tracksText, resolver, options = {}) {
  const { specsDir = "specs", taskFile = "tasks.md" } = options;
  const liveDirs = new Set(liveTrackSpecDirs(tracksText, specsDir));
  const suffix = `/${taskFile}`;
  const problems = [];
  for (const file of files) {
    if (!file.path.endsWith(suffix)) continue;
    const dir = file.path.slice(0, -suffix.length);
    if (!liveDirs.has(dir)) continue; // not a live track
    problems.push(...checkTaskGate(file.text, file.path, resolver));
  }
  return problems;
}
