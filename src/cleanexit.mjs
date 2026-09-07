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

/** A marker made only of word characters — TODO, FIXME, debugger — as opposed to
 * one carrying its own punctuation, like `console.log(` or `.only(`. */
const isWordMarker = (marker) => /^[A-Za-z0-9_]+$/.test(marker);

/**
 * Is this word-marker an annotation, or just the word appearing in prose?
 *
 * The distinction has to exist, and running the first version of this rule over
 * a real codebase is what proved it: three of its three findings were sentences
 * *about* markers — a comment explaining that a README once carried a TODO, and
 * one describing this very defect. A rule that fires on any occurrence of the
 * word cannot be left on, and a rule that gets turned off enforces nothing.
 *
 * An annotation is the marker opening a line (after indentation and any comment
 * punctuation), or one carrying `:` or `(` — `TODO:`, `TODO(alice)`. Prose that
 * merely mentions the word is left alone.
 */
function isAnnotation(lineText, marker) {
  // Opening a line, e.g. `debugger;` or `* TODO finish this`.
  const opens = new RegExp(`^\\s*(?:[/*#;<>!-]|\\*/)*\\s*${marker}\\b`);
  // Immediately after a comment opener, including a trailing one:
  // `doWork(); // TODO tidy`.
  const afterComment = new RegExp(`(?://|/\\*|#|--|<!--|\\*)\\s*${marker}\\b`);
  // Carrying its own label: `TODO:` or `TODO(alice)`.
  const labelled = new RegExp(`\\b${marker}\\s*[:(]`);
  return opens.test(lineText) || afterComment.test(lineText) || labelled.test(lineText);
}

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
        if (isWordMarker(marker) && !isAnnotation(lineText, marker)) continue;
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
 * @param {{ changed: string[], progressFile: string, codePrefixes?: string[],
 *           changedLines?: number | null, threshold?: number }} input
 *   changedLines and threshold are how a one-line fix escapes the rule: below
 *   the threshold the session is too small to owe a progress note. Null means
 *   the line counts were unreadable, and the rule falls back to strict.
 * @returns {import("./proof.mjs").Problem[]}
 */
export function progressProblems({ changed, progressFile, codePrefixes = [], changedLines = null, threshold = 50 }) {
  // A project may have no single progress file: in a handoff-driven repository
  // "where I stopped" lives in the handoff of whichever track was worked, and
  // which one that should have been is not machine-decidable. Turning the rule
  // off is then the honest answer — simulating it against an index file that
  // means something else produces failures nobody can act on.
  if (!progressFile) return [];
  if (changed.length === 0) return [];
  if (changed.includes(progressFile)) return [];
  const touched =
    codePrefixes.length === 0
      ? changed.filter((p) => !p.endsWith(".md"))
      : changed.filter((p) => codePrefixes.some((prefix) => p.startsWith(prefix)));
  if (touched.length === 0) return [];

  // Below the threshold the rule stays quiet. Found by running it: a one-line
  // wording fix in a failure message was told to update the progress file, and
  // a rule that fires on every typo is a rule that gets turned off — which
  // enforces nothing at all. The threshold is in changed lines rather than
  // changed files, because three files touched by one rename is not a session's
  // work and one file rewritten is.
  if (changedLines !== null) {
    const lines = touched.reduce((n, p) => n + (changedLines[p] ?? 0), 0);
    if (lines < threshold) return [];
  }

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
