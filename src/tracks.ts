// Handoff-driven development (HDD): the state that survives a session ending.
//
// A session ends and its working memory is gone. Specs describe what a lane
// must deliver; they do not describe where the work stopped, what was tried,
// or what the next session must NOT re-read. That is what a handoff carries,
// and an index of live tracks is what turns "which handoff" into a choice
// rather than an excavation.
//
// Two rules, both mechanical, because a handoff that lies is worse than no
// handoff — it is a dead marker the next session trusts:
//
//   1. Every track line in the index carries a status and resolves its links.
//   2. No document anywhere points at a handoff that has been deleted. A
//      handoff is deleted the moment its track closes, and a reference to it
//      can outlive it in a spec, a debt register, or a task list.
//
// Adopted from github.com/yetanothervan/handoff-driven-development and from a
// working implementation in a production repository.

import type { Problem, Resolver } from "./types.ts";

const TRACK_STATUS = /(active|paused|blocked)/;
const HANDOFF_REF = /[\w./-]+\/handoff\.md/gi;

/**
 * The lines that are actually tracks: list items outside fenced blocks. An
 * example inside a fence documents the shape of a line and is not a track, so
 * neither the gate nor the count may treat it as one.
 *
 */
export function trackLines(text: string): { line: number; text: string }[] {
  const lines: { line: number; text: string }[] = [];
  let inFence = false;
  text.split("\n").forEach((lineText, index) => {
    if (lineText.trimStart().startsWith("```")) {
      inFence = !inFence;
      return;
    }
    if (inFence || !lineText.startsWith("- ")) return; // headings, fences, prose
    lines.push({ line: index + 1, text: lineText });
  });
  return lines;
}

/**
 * Track-index integrity. A line with no status is a track nobody can triage;
 * a line linking a file that does not exist is a handoff that would lie.
 *
 */
export function checkTracks(text: string, resolver: Resolver, filePath: string = "specs/TRACKS.md"): Problem[] {
  const problems = [];
  for (const { line, text: lineText } of trackLines(text)) {
    if (!TRACK_STATUS.test(lineText)) {
      problems.push({
        file: filePath,
        line,
        target: "(status)",
        reason: "track line carries no status (active / paused / blocked)",
      });
    }
    for (const m of lineText.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1]!;
      if (/^https?:/.test(target)) continue; // external links are not this gate's business
      if (!resolver.fileExists(target)) {
        problems.push({ file: filePath, line, target, reason: `file "${target}" does not exist` });
      }
    }
  }
  return problems;
}

/**
 * No document may point at a handoff that closed. Directory-qualified paths
 * must resolve; the bare word `handoff.md` and template paths
 * (`specs/NNNN-<slug>/handoff.md`) are protocol talk, not claims, and stay
 * legal.
 *
 * @param log  where a closed track's outcome lives, named in the failure message
 */
export function checkHandoffRefs(
  text: string,
  resolver: Resolver,
  filePath: string,
  log: string = "specs/TRACKS-LOG.md",
): Problem[] {
  const problems: Problem[] = [];
  let inFence = false;
  text.split("\n").forEach((lineText, index) => {
    if (lineText.trimStart().startsWith("```")) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    for (const match of lineText.matchAll(HANDOFF_REF)) {
      const target = match[0];
      if (/[<>]|\.\.\./.test(target)) continue; // template or syntax example
      if (!resolver.fileExists(target)) {
        problems.push({
          file: filePath,
          line: index + 1,
          target,
          reason: `file "${target}" does not exist (a handoff is deleted when its track closes — point at ${log} instead)`,
        });
      }
    }
  });
  return problems;
}

/**
 * Spec directories currently live, derived from each track line's handoff
 * link. A track with no handoff link (an infrastructure track with nothing to
 * hand off) has no lane directory to gate and is correctly skipped rather than
 * guessed at.
 *
 */
export function liveTrackSpecDirs(tracksText: string, specsDir: string = "specs"): string[] {
  const pattern = new RegExp(`\\((${specsDir}\\/[A-Za-z0-9_.-]+)\\/handoff\\.md\\)`, "g");
  return [...new Set([...tracksText.matchAll(pattern)].map((m) => m[1]!))];
}

/**
 * Track lines nobody has refreshed.
 *
 * A lane abandoned mid-flight keeps its status, its next step and — once lanes
 * declare what they own — its fence around files nobody is working in. None of
 * that decays on its own: the index says `active` until a person says
 * otherwise, and the longer it lies the more it is believed.
 *
 * The date is already in the line the tool writes, so this needs no new
 * bookkeeping. `today` is passed in rather than read: a rule that consults the
 * clock is a rule whose test depends on the day it runs.
 */
export function staleProblems(
  text: string,
  {
    today,
    afterDays,
    filePath = "specs/TRACKS.md",
    claimed = new Set<string>(),
  }: { today: string; afterDays: number; filePath?: string; claimed?: Set<string> },
): Problem[] {
  if (!afterDays || afterDays <= 0) return []; // not asked for
  const problems: Problem[] = [];

  for (const { line, text: lineText } of trackLines(text)) {
    const stamp = /\b(\d{4}-\d{2}-\d{2})\b/.exec(lineText)?.[1];
    if (!stamp) continue; // a line with no date is the tracks check's business, not this one
    const age = daysBetween(stamp, today);
    if (age === null || age <= afterDays) continue;

    const lane = /\(([\w./-]+)\/handoff\.md\)/.exec(lineText)?.[1];
    const fences = lane && claimed.has(lane);
    problems.push({
      file: filePath,
      line,
      target: stamp,
      reason:
        `last moved ${age} days ago, and still says it is live` +
        (fences ? " while holding the paths it declared" : "") +
        `\n    fix:  update the line, mark it paused with what it is waiting on, or close the track`,
    });
  }

  return problems;
}

/** Whole days between two ISO dates, or null when either is not one. */
function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}
