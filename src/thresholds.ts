// A scored metric has a declared floor, and a run below it is not finished.
//
// This is the one generic rule both repositories this package came from
// invented independently: one keeps `evals/thresholds.json` and fails CI when
// recall or groundedness drops below its floor; the other has a grounding gate
// with a pass mark. Both put the floors file out of the agent's reach, because
// a loop that can lower its own pass mark grades itself.
//
// It does not run the scoring. The project's own command produces a results
// file; this reads it and compares — the same division as every other rule
// here, and the reason none of them shell out to a framework.
//
// Floors only, deliberately. A metric where lower is better (latency, cost) is
// the same rule mirrored, and inventing a direction field on zero real cases
// is a guess; the two cases that exist are both floors. A third case changes
// this, and nothing else does.
import type { Problem } from "./types.ts";

export interface ThresholdInput {
  /** Metric name to score, as the project's command produced it. */
  results: Record<string, unknown> | null;
  /** Metric name to the lowest acceptable score. */
  floors: Record<string, unknown> | null;
  resultsPath: string;
  floorsPath: string;
  /** Named in the failure when results are missing. Never run from here. */
  command?: string;
}

export function thresholdProblems({
  results,
  floors,
  resultsPath,
  floorsPath,
  command,
}: ThresholdInput): Problem[] {
  if (!floors) {
    return [
      {
        file: floorsPath,
        line: 1,
        target: "(missing)",
        reason: "the floors file does not exist — a threshold nobody wrote down is not a threshold",
      },
    ];
  }

  if (!results) {
    return [
      {
        file: resultsPath,
        line: 1,
        target: "(missing)",
        reason:
          "no results to compare against the floors — a scoring step that did not run is not a scoring step that passed" +
          (command ? `\n    fix:  run \`${command}\`, which is what produces this file` : ""),
      },
    ];
  }

  const problems: Problem[] = [];
  for (const [metric, floor] of Object.entries(floors)) {
    if (metric.startsWith("$")) continue; // a comment key, as the config files use
    if (typeof floor !== "number") {
      problems.push({
        file: floorsPath,
        line: 1,
        target: metric,
        reason: `a floor is a number, and this one is ${describe(floor)}`,
      });
      continue;
    }

    const scored = results[metric];
    if (scored === undefined) {
      problems.push({
        file: resultsPath,
        line: 1,
        target: metric,
        reason:
          `has a floor of ${floor} and was not measured — a metric nobody scored is not a metric that passed` +
          `\n    fix:  score it, or drop its floor from ${floorsPath}`,
      });
      continue;
    }
    if (typeof scored !== "number") {
      problems.push({
        file: resultsPath,
        line: 1,
        target: metric,
        reason: `scored ${describe(scored)}, and a floor can only be compared with a number`,
      });
      continue;
    }
    if (scored < floor) {
      problems.push({
        file: resultsPath,
        line: 1,
        target: metric,
        reason:
          `${scored} is below the floor of ${floor} declared in ${floorsPath}` +
          `\n    fix:  raise the score. Lowering the floor to pass is the move this check exists to catch`,
      });
    }
  }

  return problems;
}

/**
 * Whether the floors file is out of the agent's reach.
 *
 * Reported rather than required, and only when the repository has already said
 * which files define success: a project that named those and left the floors
 * out has left the one file whose edit turns every failure green. A project
 * with no locked surfaces at all has not made that claim, and is not held to it.
 */
export function unprotectedFloors(floorsPath: string, lockedPaths: string[]): Problem | null {
  if (lockedPaths.length === 0) return null;
  if (lockedPaths.some((locked) => floorsPath === locked || floorsPath.startsWith(locked))) return null;
  return {
    file: floorsPath,
    line: 1,
    target: "(reachable)",
    reason:
      "this repository names the files that define success, and the floors are not among them — " +
      "an agent that can lower its own pass mark grades itself" +
      `\n    fix:  add "${floorsPath}" to locked.paths`,
  };
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "a list";
  return `a ${typeof value}`;
}
