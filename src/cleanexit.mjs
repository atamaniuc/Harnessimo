// Clean state at session exit.
//
// From lecture 12 of Learn Harness Engineering ("Каждая сессия должна оставлять
// чистое состояние"): a session ends leaving the build green, the tests green,
// progress written down, no stale artifacts, and the standard startup path
// intact. The lecture's word for what happens otherwise is энтропия — entropy:
// each session leaves a little debris, no single piece is worth stopping for,
// and after twenty sessions nobody can start the project in three minutes any
// more.
//
// The build and the tests are the project's own gate. What this module adds is
// the part a build is blind to: debug leftovers that compile perfectly, and a
// progress file that was not touched while the code around it changed.

/**
 * Markers that pass a build and mean the work is not finished. Deliberately a
 * default rather than a hard-coded list: `.only(` is fatal in a test suite and
 * meaningless in a CSS file, and a project knows which of its own it cares
 * about.
 */
export const DEFAULT_MARKERS = ["TODO", "FIXME", "XXX", "HACK", "console.log(", "debugger", ".only(", ".skip("];

/**
 * @param {{ path: string, text: string }[]} files  the files a session touched
 * @param {{ markers?: string[], allow?: string[] }} options
 * @returns {import("./proof.mjs").Problem[]}
 */
export function debrisProblems(files, options = {}) {
  const markers = options.markers ?? DEFAULT_MARKERS;
  const allow = options.allow ?? [];
  const problems = [];
  for (const file of files) {
    if (allow.some((pattern) => file.path.includes(pattern))) continue;
    file.text.split("\n").forEach((lineText, index) => {
      for (const marker of markers) {
        if (!lineText.includes(marker)) continue;
        problems.push({
          file: file.path,
          line: index + 1,
          target: marker,
          reason:
            `left behind by a session that called itself finished — a marker like this compiles, ` +
            `so nothing else will ever catch it`,
        });
      }
    });
  }
  return problems;
}

/**
 * Did the session write down where it got to?
 *
 * The rule is relative, not absolute: a progress file that is older than the
 * code around it is worse than none, because the next session reads it and
 * believes it. A documentation-only change does not need one.
 *
 * @param {{ changed: string[], progressFile: string, codePrefixes?: string[] }} input
 * @returns {import("./proof.mjs").Problem[]}
 */
export function progressProblems({ changed, progressFile, codePrefixes = [] }) {
  if (changed.length === 0) return [];
  if (changed.includes(progressFile)) return [];
  const touchedCode =
    codePrefixes.length === 0
      ? changed.some((p) => !p.endsWith(".md"))
      : changed.some((p) => codePrefixes.some((prefix) => p.startsWith(prefix)));
  if (!touchedCode) return [];
  return [
    {
      file: progressFile,
      line: 1,
      target: "(not updated)",
      reason:
        `${changed.length} file(s) changed and this was not one of them — the next session reads ` +
        `this file first, and a stale one costs more than an empty one`,
    },
  ];
}

/**
 * The instruction file, kept short. From lecture 04 ("Почему один большой файл
 * инструкций не работает"): a long instruction file eats the working memory it
 * is trying to direct, and what lands in the middle is what gets ignored. The
 * fix is a router that points at topical documents, and the only way a router
 * stays a router is if something fails when it stops being one.
 *
 * @param {{ path: string, text: string }[]} files
 * @param {Record<string, number>} limits  path -> maximum lines
 * @returns {import("./proof.mjs").Problem[]}
 */
export function instructionProblems(files, limits) {
  const problems = [];
  for (const file of files) {
    const limit = limits[file.path];
    if (!limit) continue;
    const lines = file.text.split("\n").length;
    if (lines > limit) {
      problems.push({
        file: file.path,
        line: limit + 1,
        target: `${lines} lines`,
        reason:
          `the instruction file is ${lines - limit} line(s) over its ${limit}-line limit — a long ` +
          `instruction file buries its important parts in the middle, where they are ignored; move ` +
          `detail into a topical document and link it`,
      });
    }
  }
  return problems;
}
