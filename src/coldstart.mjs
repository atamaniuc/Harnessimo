// The cold-start test: can a fresh session run and verify this project using
// nothing but the repository?
//
// It is the honest test of the documentation. What is not written down does
// not exist for someone arriving fresh — and every session after the first
// arrives fresh. The check clones HEAD into an empty directory and runs the
// documented commands there: no environment carried over, no explanation, no
// leftover node_modules, no path that only resolves on the machine that wrote
// it.

/**
 * Pure core: which of the required files a fresh clone would be missing, and
 * which documents point outside the repository.
 *
 * A path like `~/.claude/plans/` or `/Users/someone/...` in an entry-point
 * document is the specific failure this catches: the repository appears to
 * document itself, but only works on one laptop.
 *
 * @param {{ requiredFiles: string[], escapes: { path: string, text: string }[] }} input
 * @returns {string[]} problems
 */
export function coldStartProblems({ requiredFiles, escapes }, exists) {
  const problems = [];
  for (const file of requiredFiles) {
    if (!exists(file)) {
      problems.push(
        `${file} is missing from a fresh clone\n` +
          `  why:  what is not in the repository does not exist for a fresh session`,
      );
    }
  }
  for (const doc of escapes) {
    const match = /(~\/[\w.-]+|\/Users\/[\w.-]+|\/home\/[a-z][\w.-]*)/.exec(doc.text);
    if (match) {
      problems.push(
        `${doc.path} references a path outside the repository: ${match[1]}\n` +
          `  fix:  move the referenced material into the repo and point at a relative path`,
      );
    }
  }
  return problems;
}
