// A lane is the SDD half of this tool: a numbered directory whose spec carries
// criteria that can run, and which the checks then refuse to call finished
// until they do. The checks are enforced; opening and closing a lane was held
// together by memory, and memory got the number wrong.
//
// What is automated here is only what a person gets wrong the same way every
// time: the next free number, the directory, the templates copied unchanged,
// and the index line the session brief reads. What a person gets wrong
// differently every time — what the lane is for, what "done" means, why it is
// paused — is judgement, and stays theirs.
import type { Problem } from "./types.ts";

/** A slug is lower-case, digits and hyphens: it becomes a directory and a URL. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugProblem(slug: string, path: string): Problem | null {
  if (SLUG.test(slug)) return null;
  return {
    file: path,
    line: 1,
    target: slug || "(empty)",
    reason:
      "a lane's slug becomes a directory name: lower-case letters, digits and hyphens — " +
      'something like "retrieval-quality"',
  };
}

/**
 * The next lane number: one past the highest that exists.
 *
 * Not "the lowest gap" on purpose — a deleted lane's number appears in commit
 * messages and handoffs that outlive it, and reusing it makes two different
 * pieces of work answer to the same name.
 */
export function nextNumber(existing: string[]): string {
  const used = existing
    .map((name) => /^(\d{4})-/.exec(name)?.[1])
    .filter((n): n is string => Boolean(n))
    .map(Number);
  const next = used.length === 0 ? 1 : Math.max(...used) + 1;
  return String(next).padStart(4, "0");
}

/** Lane directories, as `nextNumber` wants them: names only, numbered ones only. */
export function laneDirectories(names: string[]): string[] {
  return names.filter((name) => /^\d{4}-[a-z0-9-]+$/.test(name));
}

/** The existing lane with this slug, if any — the same work must not be opened twice. */
export function findLane(names: string[], slug: string): string | undefined {
  return laneDirectories(names).find((name) => name.slice(5) === slug);
}

/**
 * One line of the track index, in the shape the file documents and the `tracks`
 * check enforces: essence, a link that resolves, a status, a date, a next step.
 */
export function indexLine({
  number,
  slug,
  title,
  specsDir,
  date,
}: {
  number: string;
  slug: string;
  title: string;
  specsDir: string;
  date: string;
}): string {
  return (
    `- **${title} (spec ${number})** — [handoff](${specsDir}/${number}-${slug}/handoff.md) — ` +
    `active, ${date}, next: write the acceptance criteria, then the first failing test`
  );
}

/** The index with this lane's line appended, before any trailing blank line. */
export function withLine(index: string, line: string): string {
  return `${index.replace(/\s*$/, "")}\n${line}\n`;
}

/** The index without this lane's line. Matching on the directory, not the prose. */
export function withoutLane(index: string, specsDir: string, lane: string): string {
  const needle = `${specsDir}/${lane}/`;
  const kept = index.split("\n").filter((line) => !(line.startsWith("- ") && line.includes(needle)));
  return kept.join("\n").replace(/\s*$/, "") + "\n";
}

/**
 * The log with this outcome on top. Newest first, and under the heading rather
 * than above it — a log whose first line is not its title stops being readable
 * the second time something is added.
 */
export function withOutcome(log: string, entry: string): string {
  const lines = log.split("\n");
  const firstBullet = lines.findIndex((line) => line.startsWith("- "));
  const at = firstBullet === -1 ? lines.length : firstBullet;
  return [...lines.slice(0, at), entry, ...lines.slice(at)].join("\n").replace(/\n{3,}/g, "\n\n");
}

/** A closing entry: what came out of the lane, in the log's own shape. */
export function outcomeEntry(title: string, number: string, outcome: string): string {
  const text = outcome.trim().replace(/\s+/g, " ");
  return `- **${title} (spec ${number})** — ${text}\n`;
}

/** Substitutes the two placeholders a template carries, and nothing else. */
export function fillTemplate(template: string, { number, title }: { number: string; title: string }): string {
  return template.replace(/^# NNNN — <lane name>/m, `# ${number} — ${title}`).replace(/\bNNNN\b/g, number);
}
