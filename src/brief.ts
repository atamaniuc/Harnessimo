// What a session should read before it does anything.
//
// The state layer only pays off if it is read, and a rule in AGENTS.md saying
// "load the handoff first" is a rule that depends on the reader remembering it.
// This turns that rule into something the session receives whether or not it
// remembers: the live tracks, the head of each handoff, what is in flight, and
// what this repository actually enforces.
//
// Pure: it takes the text, not the repository. The filesystem edge is in
// bin/harnessimo.mjs, and the SessionStart hook is a three-line shell script
// that calls it.

import type { AgentSettings, BriefInput, SessionStartEntry } from "./types.ts";

const HANDOFF_LINES = 20;

/** What one live lane says it is working on, as the brief prints it. */
export interface LaneFence {
  lane: string;
  paths: string[];
}

export function briefText({
  tracksText,
  handoffs = [],
  queue,
  progressText,
  enabled = {},
  tracksPath = "specs/TRACKS.md",
  focus,
  fences = [],
  supervision,
}: BriefInput): string {
  const out: string[] = [];

  // Scoped to one lane, this is the unit handed to a second agent: its own
  // track line, its whole handoff, and the fence around everyone else's work —
  // and none of the other lanes' state, which is the half that costs tokens
  // and invites a second agent into work that is not its own.
  if (tracksText && focus) {
    const mine = tracksText.split("\n").filter((line) => line.startsWith("- ") && line.includes(`${focus}/`));
    out.push(`== ${tracksPath} (your track) ==`);
    out.push(mine.length > 0 ? mine.join("\n") : `(${focus} is not in the index — add it, or the next session will not find it)`);
  } else if (tracksText) {
    out.push(`== ${tracksPath} (live work tracks — load a track's handoff before starting on it) ==`);
    out.push(tracksText.trimEnd());
  }

  for (const handoff of handoffs) {
    // The whole handoff when it is the one lane being worked on; the head of
    // each when the brief is the index of everything in flight.
    // The lane being worked on comes whole; a lane it merely waits on comes as
    // a head, which is enough to know what is being built on and no more.
    const head = !focus || handoff.head;
    const body = head
      ? handoff.text.split("\n").slice(0, HANDOFF_LINES).join("\n").trimEnd()
      : handoff.text.trimEnd();
    out.push(`\n== ${handoff.path}${head ? ` (first ${HANDOFF_LINES} lines)` : ""}${handoff.head ? " — this lane waits on it" : ""} ==`);
    out.push(body);
  }

  if (fences.some((fence) => fence.paths.length > 0)) {
    out.push("\n== declared paths ==");
    if (focus) {
      const mine = fences.filter((f) => f.lane === focus).flatMap((f) => f.paths);
      const theirs = fences.filter((f) => f.lane !== focus && f.paths.length > 0);
      out.push(mine.length > 0 ? `you own: ${mine.join(", ")}` : "you own: nothing declared yet");
      for (const fence of theirs) out.push(`${fence.lane} owns: ${fence.paths.join(", ")}`);
    } else {
      for (const fence of fences) {
        if (fence.paths.length > 0) out.push(`${fence.lane} owns: ${fence.paths.join(", ")}`);
      }
    }
    out.push("Editing a path another lane owns is a merge that resolves text and not intent.");
  }

  if (queue?.items?.length) {
    const active = queue.items.filter((i) => i.state === "active");
    const blocked = queue.items.filter((i) => i.state === "blocked");
    const next = queue.items.find((i) => i.state === "not_started");
    const lines = ["\n== work queue =="];
    if (active.length > 0) {
      for (const item of active) {
        lines.push(`active: ${item.id} — ${item.behavior}`);
        lines.push(`  verify with: harnessimo queue verify ${item.id}`);
      }
    } else {
      lines.push("active: nothing in flight");
      if (next) lines.push(`  next queued: ${next.id} — ${next.behavior}`);
    }
    for (const item of blocked) {
      lines.push(`blocked: ${item.id}${item.last_failure ? ` — ${item.last_failure}` : ""}`);
    }
    lines.push("State moves only through `harnessimo queue verify`; editing it by hand fails CI.");
    out.push(lines.join("\n"));
  }

  if (progressText) {
    const now = sectionOf(progressText, "Now");
    if (now) {
      out.push("\n== where things stand ==");
      out.push(now.trimEnd());
    }
  }

  const on = Object.entries(enabled).filter(([, v]) => v).map(([k]) => k);
  const off = Object.entries(enabled).filter(([, v]) => !v).map(([k]) => k);
  if (on.length || off.length) {
    out.push("\n== enforced here ==");
    out.push(on.length ? on.join(", ") : "nothing configured");
    // Naming what is off matters as much as naming what is on: a session that
    // assumes a check exists stops looking for the missing one.
    if (off.length) out.push(`not enforced: ${off.join(", ")}`);
    // An agent that does not know how closely it is being watched cannot know
    // what it will be held to at the end of the turn.
    if (supervision) out.push(`supervision: ${supervision.level} — ${supervision.meaning}`);
  }

  return out.join("\n").trim();
}

/** The section under a `## <name>` heading, up to the next heading of the same level. */
/**
 */
export function sectionOf(markdown: string, name: string): string | null {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${name.toLowerCase()}`);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim() || null;
}

/**
 * The shape Claude Code's SessionStart hook reads from stdout.
 */
export function briefJson(text: string) {
  return { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } };
}

/** Handoff paths named by the track index, in order, deduplicated. */
/**
 */
export function handoffPaths(tracksText: string): string[] {
  const found = [...tracksText.matchAll(/[\w./-]+\/handoff\.md/g)].map((m) => m[0]);
  return [...new Set(found)].filter((p) => !/[<>]|\.\.\./.test(p));
}

/**
 * Adds one hook to an agent settings object without disturbing anything else
 * in it, and without adding itself twice.
 *
 * Every other event's hooks are carried over untouched: this file belongs to
 * the project, not to this package, and a tool that rewrites what it does not
 * understand is a tool nobody installs twice.
 *
 * @param event  the hook event, e.g. `SessionStart` or `Stop`
 */
export function mergeHook(
  settings: AgentSettings,
  event: string,
  command: string,
  meta: { timeout?: number; statusMessage?: string } = {},
): { settings: AgentSettings; added: boolean } {
  const next: AgentSettings = { ...settings };
  const hooks = { ...(next.hooks ?? {}) };
  const entries: SessionStartEntry[] = [...(hooks[event] ?? [])];

  const already = entries.some((entry) => (entry.hooks ?? []).some((h) => h.command === command));
  if (already) return { settings, added: false };

  entries.push({ hooks: [{ type: "command", command, ...meta }] });
  hooks[event] = entries;
  next.hooks = hooks;
  return { settings: next, added: true };
}

/** The startup hook, in the shape it has always been written. */
export function mergeSessionStartHook(
  settings: AgentSettings,
  command: string,
): { settings: AgentSettings; added: boolean } {
  return mergeHook(settings, "SessionStart", command, { timeout: 10, statusMessage: "Loading harness state…" });
}

/**
 * What an agent has to be told, for the tools that have no hook to install
 * into. Three rules, short enough to survive in an instruction file, plus the
 * command that hands over the state.
 *
 * The checks themselves need none of this: they read files and run commands,
 * and nothing in them knows which model wrote the code. This is only about the
 * one thing that cannot be enforced from outside — that a session begins by
 * reading what the last one left.
 */
export function agentContract(runner = "harnessimo"): string {
  return [
    "## Harness",
    "",
    `- Run \`${runner} brief\` at the start of a session: it prints the live tracks, the`,
    "  head of each handoff and what is in flight. Read it before touching anything.",
    `- Run \`${runner} check\` before saying anything is done. Green is the claim; your`,
    "  summary is not.",
    "- Never edit state in the queue file. `" + runner + " queue verify <id>` runs the item's",
    "  own command and records the outcome — that is the only way something becomes passing.",
  ].join("\n");
}
