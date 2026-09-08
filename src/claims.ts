// What a lane is working on, and what happens when two lanes disagree.
//
// Every other rule in this package was designed for one worker at a time. Two
// agents on one repository break three things, and only the first needs a new
// idea: nothing declares which files a lane is touching, so nothing can notice
// when two lanes touch the same ones. The collision then surfaces as a merge,
// and a merge resolves text, not intent.
//
// This is declaration and detection, not locking. Nothing here waits, holds or
// schedules — a tool that owns the order of work is a tool a project cannot
// get out of. A lane that declares nothing is not in error; two lanes that
// declare the same path are.
//
// Claims live in `handoff.md` on purpose: a handoff is deleted the moment its
// track closes, so a claim cannot outlive the work it protects.
import type { Problem } from "./types.ts";
import { laneDirectories } from "./track.ts";

/** The heading a lane declares under, and the shapes a declaration may take. */
const OWNS_HEADING = /^#{2,6}\s+owns\s*$/i;
const DEPENDS_HEADING = /^#{2,6}\s+depends\s+on\s*$/i;
const HEADING = /^#{1,6}\s/;
const LIST_ITEM = /^\s*[-*]\s+(.*)$/;

/** One declared path, and where it was declared, so a failure can point at it. */
export interface Claim {
  path: string;
  line: number;
}

/** A lane's declarations, as `checkClaims` compares them. */
export interface LaneClaims {
  /** The lane directory, e.g. `specs/0006-parallel-agents`. */
  lane: string;
  /** The handoff the claims were read from, named in any failure. */
  file: string;
  claims: Claim[];
}

/**
 * The paths a handoff declares under its `## Owns` heading.
 *
 * Entries carrying `<placeholder>` brackets are template text rather than
 * claims — the same convention proof markers already use, so the shipped
 * templates can show the shape without declaring anything.
 */
export function parseClaims(handoffText: string): Claim[] {
  return parseSection(handoffText, OWNS_HEADING);
}

/** The list items under one heading, minus the template placeholders. */
function parseSection(text: string, heading: RegExp): Claim[] {
  const found: Claim[] = [];
  let inSection = false;
  let inFence = false;

  text.split("\n").forEach((raw, index) => {
    if (raw.trimStart().startsWith("```")) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    if (HEADING.test(raw)) {
      inSection = heading.test(raw.trim());
      return;
    }
    if (!inSection) return;

    const item = LIST_ITEM.exec(raw);
    if (!item) return;
    const path = item[1]!.replace(/`/g, "").trim();
    if (!path || /[<>]/.test(path)) return; // a placeholder declares nothing
    found.push({ path, line: index + 1 });
  });

  return found;
}

/**
 * A claim is a repository-relative path: a file, a directory ending in `/`, or
 * a prefix ending in `/**`. No other pattern.
 *
 * The restriction is the point. Two claims overlap when one contains the
 * other, and containment between arbitrary globs is not decidable by reading
 * them. A claim whose overlap cannot be computed protects nothing, and a fence
 * that silently does not hold is worse than no fence.
 */
export function claimProblem(claim: string, file: string, line: number): Problem | null {
  const shape = (reason: string): Problem => ({ file, line, target: claim, reason });

  if (claim.startsWith("/")) return shape("a claim is relative to the repository root, so it cannot start with `/`");
  if (claim.split("/").includes("..")) return shape("a claim cannot climb out of the repository with `..`");

  const body = claim.endsWith("/**") ? claim.slice(0, -3) : claim;
  if (body.includes("*")) {
    return shape(
      "a claim is a path, not a pattern: a file (`src/a.ts`), a directory (`src/`) or a " +
        "prefix (`src/**`) — anything else cannot be compared with another lane's claim",
    );
  }
  if (!body) return shape("a claim naming the whole repository fences nothing off");
  return null;
}

/** A claim reduced to the one form overlap is computed on: a path, or a prefix ending in `/`. */
export function normalize(claim: string): string {
  if (claim.endsWith("/**")) return claim.slice(0, -2);
  return claim;
}

/**
 * Whether two claims cover any of the same files.
 *
 * Prefix containment, and nothing cleverer: `src/` covers `src/a.ts`, while
 * `src/a.ts` and `src/ab.ts` are two different files that happen to share
 * letters.
 */
export function overlaps(a: string, b: string): boolean {
  const x = normalize(a);
  const y = normalize(b);
  if (x === y) return true;
  if (x.endsWith("/") && y.startsWith(x)) return true;
  if (y.endsWith("/") && x.startsWith(y)) return true;
  return false;
}

/**
 * Every collision between live lanes, plus every claim that is not a path.
 *
 * A lane is never compared with itself: one lane naming both a directory and a
 * file inside it is redundant, not wrong.
 */
export function checkClaims(lanes: LaneClaims[]): Problem[] {
  const problems: Problem[] = [];
  const sorted = [...lanes].sort((a, b) => a.lane.localeCompare(b.lane));

  for (const lane of sorted) {
    for (const claim of lane.claims) {
      const problem = claimProblem(claim.path, lane.file, claim.line);
      if (problem) problems.push(problem);
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const mine = sorted[i]!;
      const theirs = sorted[j]!;
      for (const claim of mine.claims) {
        if (claimProblem(claim.path, mine.file, claim.line)) continue; // already reported
        for (const other of theirs.claims) {
          if (!overlaps(claim.path, other.path)) continue;
          problems.push({
            file: theirs.file,
            line: other.line,
            target: other.path,
            reason:
              `also claimed by ${mine.lane} as "${claim.path}" (${mine.file}:${claim.line}) — ` +
              "two lanes editing one path is a merge that resolves text and not intent; " +
              "narrow one claim, or finish one lane first",
          });
        }
      }
    }
  }

  return problems;
}

/**
 * Lane directories sharing a four-digit number.
 *
 * `track new` allocates from the filesystem: two worktrees read the same state
 * and both get the next number. Each is right on its own and only the merged
 * tree is wrong, so the merged tree is where this can be caught. A lock would
 * not have helped — no lock in one worktree is visible in another.
 */
export function duplicateNumbers(names: string[], specsDir: string): Problem[] {
  const byNumber = new Map<string, string[]>();
  for (const name of laneDirectories(names).sort()) {
    const number = name.slice(0, 4);
    byNumber.set(number, [...(byNumber.get(number) ?? []), name]);
  }

  const problems: Problem[] = [];
  for (const [number, lanes] of [...byNumber].sort(([a], [b]) => a.localeCompare(b))) {
    if (lanes.length < 2) continue;
    problems.push({
      file: specsDir,
      line: 1,
      target: number,
      reason:
        `${lanes.join(" and ")} share one number — a number appears in commit messages and ` +
        "handoffs that outlive the lane, so two lanes cannot answer to it; renumber the later one",
    });
  }
  return problems;
}

/**
 * The lanes a lane is waiting on, declared beside its claims.
 *
 * Collision is one half of working in parallel; ordering is the other. When
 * one lane builds on another's interface, the second agent is writing against
 * ground that is still moving, and the cost lands as rework rather than as a
 * merge conflict — which is why nothing catches it today.
 *
 * Slugs, not numbers: a number is an allocation detail, and a dependency
 * written as `0006` says nothing to the person reading it.
 */
export function parseDependencies(handoffText: string): Claim[] {
  return parseSection(handoffText, DEPENDS_HEADING);
}

/** A lane as the dependency rules see it: its slug, where it was declared, what it waits on. */
export interface LaneDeps {
  slug: string;
  file: string;
  deps: Claim[];
}

/**
 * Dependencies that cannot be satisfied: a lane that does not exist, a lane
 * depending on itself, or a cycle.
 *
 * A dependency naming nothing is the same failure as a handoff link that no
 * longer resolves — a marker the next session trusts. A cycle is worse: every
 * lane in it is waiting for another, and nobody can honestly start.
 */
export function checkDependencies(lanes: LaneDeps[], known: string[]): Problem[] {
  const exists = new Set(known);
  const problems: Problem[] = [];
  const graph = new Map<string, string[]>();

  for (const lane of [...lanes].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const edges: string[] = [];
    for (const dep of lane.deps) {
      if (dep.path === lane.slug) {
        problems.push({
          file: lane.file,
          line: dep.line,
          target: dep.path,
          reason: "a lane cannot wait on itself",
        });
        continue;
      }
      if (!exists.has(dep.path)) {
        problems.push({
          file: lane.file,
          line: dep.line,
          target: dep.path,
          reason:
            `no lane with this slug — a dependency naming nothing is a marker the next session ` +
            `trusts\n    fix:  name one of ${known.join(", ") || "(no other lanes)"}, or drop the line`,
        });
        continue;
      }
      edges.push(dep.path);
    }
    graph.set(lane.slug, edges);
  }

  for (const cycle of cycles(graph)) {
    const lane = lanes.find((l) => l.slug === cycle[0]);
    problems.push({
      file: lane?.file ?? "specs",
      line: lane?.deps.find((d) => d.path === cycle[1])?.line ?? 1,
      target: cycle[0]!,
      reason:
        `waits on ${cycle.slice(1).join(", which waits on ")}, which waits on ${cycle[0]} — ` +
        "every lane in the cycle is waiting for another and none of them can honestly start",
    });
  }

  return problems;
}

/** Each dependency cycle once, starting from its alphabetically first lane. */
function cycles(graph: Map<string, string[]>): string[][] {
  const found: string[][] = [];
  const seen = new Set<string>();

  const walk = (node: string, path: string[]): void => {
    const at = path.indexOf(node);
    if (at !== -1) {
      const cycle = path.slice(at);
      const key = [...cycle].sort().join(">");
      if (!seen.has(key)) {
        seen.add(key);
        found.push(cycle);
      }
      return;
    }
    for (const next of graph.get(node) ?? []) walk(next, [...path, node]);
  };

  for (const node of [...graph.keys()].sort()) walk(node, []);
  return found;
}

/**
 * Why this lane cannot be closed yet: it was built on lanes that are not
 * finished.
 *
 * Closing is a claim that the work stands. A lane whose foundation is still
 * being poured is a claim about somebody else's unfinished work.
 */
export function closingProblem(slug: string, deps: Claim[], liveSlugs: string[]): string | null {
  const live = new Set(liveSlugs.filter((other) => other !== slug));
  const waiting = deps.map((d) => d.path).filter((dep) => live.has(dep));
  if (waiting.length === 0) return null;
  return (
    `${slug} still waits on ${waiting.join(", ")}, which ${waiting.length === 1 ? "is" : "are"} still open\n` +
    `  fix:  close ${waiting.join(" and ")} first, or drop the dependency if it stopped being one`
  );
}
