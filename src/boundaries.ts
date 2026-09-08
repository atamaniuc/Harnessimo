// A pattern that must not appear in a particular part of the tree.
//
// Both repositories this package was extracted from wrote this rule by hand,
// differently: one forbids the service-role key under `app/` and hard-coded
// colours in components, the other forbids placeholder markers in published
// content. The shape underneath is the same every time — *this string, not in
// these files, for this reason* — and it was the one generic rule the tool
// could not say, so everyone said it in their own script.
//
// The reason is required, not decorative. A boundary that fires with "matched
// /service_role/" tells the next person what happened and not what to do; the
// whole design of every failure here is that it says why it matters.
import type { Problem, SourceFile } from "./types.ts";
import { normalize, overlaps } from "./claims.ts";

/** One boundary: a pattern, where it applies, and why it is there. */
export interface BoundaryRule {
  /** A regular expression, as a string, matched against each line. */
  pattern: string;
  /** Files and directories it applies to: `app/`, `src/**`, `a/b.ts`. */
  paths: string[];
  /** Why the boundary exists, printed with every hit. */
  reason: string;
  /** Paths inside `paths` that are allowed to match — the one legitimate place. */
  allow?: string[];
}

/** Hits beyond this per rule are summarised: a first run should not print a novel. */
const PER_RULE = 10;

export function boundaryProblems(files: SourceFile[], rules: BoundaryRule[]): Problem[] {
  const problems: Problem[] = [];

  rules.forEach((rule, index) => {
    const named = `boundaries.rules[${index}]`;
    if (!rule.pattern || !rule.reason || !(rule.paths ?? []).length) {
      problems.push({
        file: "harnessimo.config.json",
        line: 1,
        target: named,
        reason:
          "a boundary needs a pattern, the paths it applies to, and a reason — " +
          "a rule that fires without saying why leaves the next person guessing",
      });
      return;
    }

    let matcher: RegExp;
    try {
      matcher = new RegExp(rule.pattern);
    } catch (error) {
      problems.push({
        file: "harnessimo.config.json",
        line: 1,
        target: `${named}.pattern`,
        reason: `${(error as Error).message} — the boundary never ran`,
      });
      return;
    }

    const hits: Problem[] = [];
    for (const file of files) {
      if (!rule.paths.some((path) => covers(path, file.path))) continue;
      if ((rule.allow ?? []).some((path) => covers(path, file.path))) continue;

      file.text.split("\n").forEach((line, at) => {
        const found = matcher.exec(line);
        if (!found) return;
        hits.push({
          file: file.path,
          line: at + 1,
          target: found[0]!.trim().slice(0, 60),
          reason: rule.reason,
        });
      });
    }

    problems.push(...hits.slice(0, PER_RULE));
    if (hits.length > PER_RULE) {
      problems.push({
        file: "harnessimo.config.json",
        line: 1,
        target: named,
        reason:
          `and ${hits.length - PER_RULE} more line(s) cross this boundary — ` +
          "narrow the paths, or fix them in a batch rather than one report at a time",
      });
    }
  });

  return problems;
}

/** Whether a declared path covers a file: the same containment claims use. */
function covers(path: string, file: string): boolean {
  const scope = normalize(path);
  return scope.endsWith("/") ? file.startsWith(scope) : overlaps(scope, file);
}
