// How much a run was watched, and how much has to be re-checked because of it.
//
// Every check here answers "is this finished". None of them ask how the answer
// was arrived at — and that is a gap, because the same green report means two
// different things depending on whether a person read every step or nobody
// looked at all. The bar was fixed while the supervision behind it moved.
//
// So the run declares a level, and the level decides what has to run. The tool
// does not guess how closely anyone was watching: a guess would be a claim of
// its own, and this package exists because claims get checked rather than
// believed. What it does enforce is that a declared level is one the
// repository can actually back — claiming nobody watched, in a repository that
// cannot show a fresh clone works, is a claim with nothing behind it.
//
// Each level adds what supervision at the level below could no longer catch,
// and costs more for the same reason.
import type { EnabledChecks, Problem } from "./types.ts";

/** Least supervision required first — the order is the ladder. */
export const LEVELS = ["watched", "reviewed", "unattended"] as const;
export type Level = (typeof LEVELS)[number];

export const DEFAULT_LEVEL: Level = "watched";

/** What each level means, in the words someone would use to describe their own run. */
export const MEANING: Record<Level, string> = {
  watched: "a person is reading each step as it happens",
  reviewed: "nobody watched the steps; a person will read the diff",
  unattended: "nobody looked at all — this is the whole of the supervision",
};

/**
 * The checks each level requires, on top of every level below it.
 *
 * `watched` is the fast set: the rules that catch what a person reading a step
 * still misses — a documented claim that stopped being true, a ticked box that
 * names nothing.
 *
 * `reviewed` adds the two a diff-reader cannot catch: a "passing" that nobody
 * re-ran, and an agent quietly editing the file that grades it.
 *
 * `unattended` adds the two that only a machine will ever notice — debris left
 * behind, and a repository that no longer runs from a clean clone.
 */
const ADDS: Record<Level, { checks: (keyof EnabledChecks)[]; reverify?: boolean }> = {
  watched: { checks: ["proof", "tracks", "tasks", "queue", "instructions", "boundaries", "thresholds", "release"] },
  reviewed: { checks: ["locked"], reverify: true },
  unattended: { checks: ["cleanExit", "coldStart"] },
};

export function rank(level: Level): number {
  return LEVELS.indexOf(level);
}

/** The level in force is the higher of the two: a floor cannot be argued down. */
export function effectiveLevel(floor: Level, asked: Level | undefined): Level {
  if (!asked) return floor;
  return rank(asked) > rank(floor) ? asked : floor;
}

/** A name that is not a level, refused with the three that are. */
export function levelProblem(name: string): string | null {
  if ((LEVELS as readonly string[]).includes(name)) return null;
  return `"${name}" is not a supervision level — one of ${LEVELS.join(", ")}`;
}

/** Every check this level requires, in the order `check` reports them. */
export function required(level: Level): { checks: (keyof EnabledChecks)[]; reverify: boolean } {
  const checks: (keyof EnabledChecks)[] = [];
  let reverify = false;
  for (const step of LEVELS) {
    checks.push(...ADDS[step].checks);
    reverify = reverify || Boolean(ADDS[step].reverify);
    if (step === level) break;
  }
  return { checks, reverify };
}

/** What this level adds over the one below it, for `doctor` to print. */
export function addedBy(level: Level): (keyof EnabledChecks)[] {
  return ADDS[level].checks;
}

/**
 * A level the repository cannot back.
 *
 * This is the rule the rest of the file exists for — and it bites only where a
 * claim is being made. `watched` demands nothing: a person is the supervision,
 * the checks supplement them, and a section left out is a check that does not
 * run, which this tool has always said out loud rather than quietly requiring.
 *
 * Above that, each level must be able to run what it *adds*. Saying nobody
 * watched the steps means answering which files the agent may not touch;
 * saying nobody looked at all means the repository can show it leaves no
 * debris and still runs from a clean clone. A level claimed without those is
 * an unsupervised run with nothing behind the claim, and a green report there
 * means less than it looks like it means.
 */
export function unbacked(level: Level, enabled: Partial<EnabledChecks>): Problem[] {
  const problems: Problem[] = [];
  for (const step of LEVELS) {
    if (step !== "watched") {
      for (const name of ADDS[step].checks) {
        if (enabled[name]) continue;
        problems.push({
          file: "harnessimo.config.json",
          line: 1,
          target: name,
          reason:
            `at "${level}" — ${MEANING[level]} — this run is held to the ${name} check, and this ` +
            `repository has no "${section(name)}" section to run it from\n` +
            `    fix:  configure it, or declare the level this repository can actually back`,
        });
      }
    }
    if (step === level) break;
  }
  return problems;
}

/** The configuration section a check reads, named in the failure so the fix is one edit. */
function section(check: keyof EnabledChecks): string {
  if (check === "proof") return "docs";
  if (check === "tasks") return "tracks";
  return check;
}
