// Definition of Ready and Definition of Done, as rules rather than prose.
//
// Both belong in a document people read; these are the parts a machine can
// decide, checked at the two moments they matter — before an item is started,
// and before it is closed. A definition nothing enforces is a wish.
//
// The check that earns its keep is outcome-versus-activity. "Add validation"
// is complete when you stop typing, and an item phrased that way cannot be
// closed honestly. The expensive failure is starting work whose success cannot
// be decided, because it is discovered only at the end, when the work is
// already done and unfalsifiable.

/** Phrasing that describes activity rather than an outcome someone could observe. */
import type { QueueItem, Violation } from "./types.ts";

const TASK_SHAPED = /^(implement|add|create|build|write|refactor|update|fix|make|improve|support)\b/i;
const PLACEHOLDER = /\b(TODO|TBD|FIXME)\b/;

/** Terminal states a dependency must have reached before an item can start. */
export const SATISFIED = new Set(["passing", "auto_verified", "verified", "done"]);

/**
 * Definition of Ready. Checked before an item may be activated.
 *
 */
export function readiness(item: QueueItem, all: QueueItem[]): Violation[] {
  const problems = [];
  const behavior = (item.behavior ?? "").trim();

  if (behavior.length < 40) {
    problems.push({
      what: "behavior is too short to describe an observable outcome",
      why: "a one-line task name cannot be verified, so nobody can tell when it is finished",
      fix: "state what will be observably true, in the terms someone could check",
    });
  }

  if (TASK_SHAPED.test(behavior)) {
    problems.push({
      what: `behavior describes an activity ("${behavior.split(/\s+/)[0]} ...") rather than an outcome`,
      why: "an activity is complete when you stop doing it, which is not a definition of done",
      fix: 'rewrite as the state that will hold — "the validator rejects X" rather than "add a check for X"',
    });
  }

  if (PLACEHOLDER.test(behavior)) {
    problems.push({
      what: "behavior still contains a placeholder",
      why: "the scope is not settled, so any verification written against it is provisional",
      fix: "settle the scope before starting",
    });
  }

  if (!(item.verification ?? "").trim()) {
    problems.push({
      what: "no verification command",
      why: "without an executable check the item can only be closed on an opinion",
      fix: "give a command that passes when the behavior holds and fails when it does not",
    });
  }

  if (!item.kind) {
    problems.push({
      what: "no kind",
      why: "kinds close by different rules; conflating them is how unverified work ships",
      fix: 'set kind (for example "code" or "content")',
    });
  }

  for (const id of item.depends_on ?? []) {
    const dep = all.find((i) => i.id === id);
    if (!dep) {
      problems.push({
        what: `unknown dependency "${id}"`,
        why: "the ordering it implies cannot be checked",
        fix: "fix the id or drop the dependency",
      });
    } else if (!SATISFIED.has(dep.state)) {
      problems.push({
        what: `dependency "${id}" is ${dep.state}`,
        why: "starting on an unfinished dependency produces work that has to be redone when it lands",
        fix: `close "${id}" first`,
      });
    }
  }

  return problems;
}

/**
 * Definition of Done. The verification passing is necessary and not
 * sufficient: evidence has to exist and be tied to this item, or "done" is an
 * assertion again — and re-verification in CI has nothing to re-check.
 *
 */
export function doneness(item: QueueItem, verificationPassed: boolean): Violation[] {
  const problems = [];
  if (!verificationPassed) {
    problems.push({
      what: "verification did not pass",
      why: "done means a command succeeded, not that the work looked right",
      fix: "fix the cause and run it again",
    });
  }
  if (!item.evidence || String(item.evidence).trim().length === 0) {
    problems.push({
      what: "no evidence recorded",
      why: "a closed item with no output cannot be re-checked later, and CI re-runs these claims",
      fix: "let the harness record the command output rather than setting state by hand",
    });
  }
  return problems;
}

export function formatViolations(id: string, violations: Violation[]) {
  return violations.map((v) => `${id}: ${v.what}\n  why:  ${v.why}\n  fix:  ${v.fix}`).join("\n\n");
}
