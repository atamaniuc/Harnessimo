// Locked surfaces: the files that define success are out of the loop's reach.
//
// A system that improves itself will, given the opportunity, improve its own
// score instead of its own work. Every documented reward hack broke this
// invariant — the agent removed or edited the instrumentation its checker
// depended on. Constraints stated in prompt text get optimised away, so this
// one is not stated in prompt text: it is a command that fails.
//
// Limit, stated plainly rather than hidden: this assumes commits pass through
// CI. It is drift *detection*, not a sandbox. A loop with push access that
// strips its own authorship trailer defeats it. Closing that properly means
// filesystem-level read-only paths in the run environment, which most projects
// do not have. Saying so is the point — a check that overstates its own
// guarantee stops anyone looking for the missing one.
//
// The baseline exists because the commit that *creates* a locked path
// necessarily touches it. Moving the baseline forward widens what the system
// may change, which is a decision a person makes.

/**
 * Pure core: given commits (each with its message and touched paths) and the
 * locked prefixes, report every violation. No git, no filesystem.
 *
 * @param {{ sha: string, message: string, files: string[] }[]} commits
 * @param {{ paths: string[], agentTrailer: string, exempt?: Set<string> }} config
 * @returns {{ sha: string, hits: string[] }[]}
 */
export function lockedViolations(commits, { paths, agentTrailer, exempt = new Set() }) {
  const violations = [];
  for (const commit of commits) {
    if (exempt.has(commit.sha)) continue;
    if (!commit.message.includes(agentTrailer)) continue; // a human commit is allowed to change these
    const hits = commit.files.filter((file) => paths.some((locked) => file.startsWith(locked)));
    if (hits.length > 0) violations.push({ sha: commit.sha, hits });
  }
  return violations;
}

/**
 * @param {{ sha: string, hits: string[] }[]} violations
 * @returns {string}
 */
export function formatLockedViolations(violations) {
  return violations
    .map(
      (v) =>
        `locked surface modified by an agent commit: ${v.sha}\n` +
        v.hits.map((h) => `  ${h}`).join("\n") +
        `\n  why:  these paths define or enforce the acceptance signal; a loop that can edit them can grant itself a passing score` +
        `\n  fix:  a human makes this change, in a commit without the agent trailer`,
    )
    .join("\n\n");
}
