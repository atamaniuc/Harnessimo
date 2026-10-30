// A herd of lane agents (spec 0011): one worktree and one agent per lane that
// can honestly run now, opened in herdr panes, started a few at a time.
//
// Pure decisions only — which lanes may run side by side, what an agent is
// called, what it is told first, what herdr's answers mean. `src/cli.ts` asks
// herdr and git the questions and hands the answers here, so the planning is
// testable without a terminal multiplexer.
//
// herdr owns the topology because Claude Code agent teams cannot: teammates
// share the lead's checkout, so two of them editing one file is a collision
// nothing prevents. One worktree per lane makes that collision impossible
// across lanes; the `## Owns` fences still decide which lanes may run at once.

import { overlaps } from "./claims.ts";
import type { Problem } from "./types.ts";

export const HERD_DEFAULTS = {
  /** Lane agents working at once. Three keeps a plan under most API rate limits. */
  maxWorking: 3,
  /** Seconds between two agent starts, so their first requests do not land together. */
  staggerSeconds: 20,
  /** The herdr agent kind each lane agent is started as (`herdr agent start --kind`). */
  agentKind: "claude",
  /** Arguments passed to the agent after `--`. */
  agentArgs: [] as string[],
  /** The wait before each re-prompt after a rate-limit error, in seconds. */
  backoffSeconds: [60, 120, 240] as number[],
};

export type HerdSettings = typeof HERD_DEFAULTS;

/** Settings that would make `herd` misbehave rather than merely differ. */
export function herdSettingsProblems(herd: HerdSettings, file = "harnessimo.config.json"): Problem[] {
  const problems: Problem[] = [];
  const bad = (key: string, reason: string): void => {
    problems.push({ file, line: 1, target: `herd.${key}`, reason });
  };
  if (!Number.isInteger(herd.maxWorking) || herd.maxWorking < 1) {
    bad("maxWorking", "must be a whole number of at least 1 — a cap of none is no cap");
  }
  if (typeof herd.staggerSeconds !== "number" || !(herd.staggerSeconds >= 0)) {
    bad("staggerSeconds", "must be a number of seconds, 0 or more");
  }
  if (typeof herd.agentKind !== "string" || !herd.agentKind) bad("agentKind", "must name a herdr agent kind, e.g. \"claude\"");
  if (!Array.isArray(herd.agentArgs) || herd.agentArgs.some((a) => typeof a !== "string")) {
    bad("agentArgs", "must be a list of strings");
  }
  if (
    !Array.isArray(herd.backoffSeconds) ||
    herd.backoffSeconds.length === 0 ||
    herd.backoffSeconds.some((s) => typeof s !== "number" || !(s > 0))
  ) {
    bad("backoffSeconds", "must be a non-empty list of positive numbers, e.g. [60, 120, 240]");
  }
  return problems;
}

/** A lane as the herd sees it. */
export interface HerdLane {
  /** `0012-search` without the number: `search`. */
  slug: string;
  /** `specs/0012-search`. */
  lane: string;
  /** The status word from the track line: active, paused, blocked… */
  status: string;
  /** Paths under `## Owns`. */
  owns: string[];
  /** Slugs under `## Depends on`. */
  deps: string[];
}

/** The status word of a track line: the first of active / paused / blocked it carries. */
export function laneStatus(line: string): string {
  return /\b(active|paused|blocked)\b/i.exec(line)?.[1]?.toLowerCase() ?? "unknown";
}

export interface HerdPlan {
  runnable: string[];
  held: { slug: string; reason: string }[];
}

/**
 * Which lanes can run now, side by side, within the cap.
 *
 * In index order: a lane runs when it is active, everything it depends on is
 * closed, its fence overlaps no lane already chosen, and the cap has room. A
 * lane that declares no `## Owns` cannot be shown not to collide, so it runs
 * only alone. `alreadyRunning` lanes count against the cap and are not listed.
 */
export function planHerd(
  lanes: HerdLane[],
  { maxWorking, alreadyRunning = [] }: { maxWorking: number; alreadyRunning?: string[] },
): HerdPlan {
  const live = new Set(lanes.map((l) => l.slug));
  const running = new Set(alreadyRunning);
  const chosen: HerdLane[] = lanes.filter((l) => running.has(l.slug));
  const runnable: string[] = [];
  const held: { slug: string; reason: string }[] = [];
  const hold = (slug: string, reason: string): void => {
    held.push({ slug, reason });
  };

  for (const lane of lanes) {
    if (running.has(lane.slug)) continue;
    if (lane.status !== "active") {
      hold(lane.slug, `its track line says ${lane.status}, not active`);
      continue;
    }
    const waiting = lane.deps.filter((d) => live.has(d) && d !== lane.slug);
    if (waiting.length > 0) {
      hold(lane.slug, `waits on ${waiting.join(", ")}, still open`);
      continue;
    }
    const unfenced = chosen.find((c) => c.owns.length === 0);
    if (unfenced) {
      hold(lane.slug, `${unfenced.slug} declares no ## Owns, so nothing may run beside it`);
      continue;
    }
    if (lane.owns.length === 0 && chosen.length > 0) {
      hold(lane.slug, "declares no ## Owns, so it can run only alone — declare its paths to run it beside others");
      continue;
    }
    const clash = chosen.find((c) => c.owns.some((a) => lane.owns.some((b) => overlaps(a, b))));
    if (clash) {
      hold(lane.slug, `its ## Owns overlaps ${clash.slug}'s`);
      continue;
    }
    if (chosen.length >= maxWorking) {
      hold(lane.slug, `the cap of ${maxWorking} working agent(s) is reached (herd.maxWorking)`);
      continue;
    }
    chosen.push(lane);
    runnable.push(lane.slug);
  }
  return { runnable, held };
}

/** Lanes asked for by name that the plan cannot start, each with why. */
export function upProblems(requested: string[], plan: HerdPlan, known: string[]): string[] {
  return requested.flatMap((slug) => {
    if (plan.runnable.includes(slug)) return [];
    if (!known.includes(slug)) {
      return [`no live lane "${slug}"\n  fix:  one of ${known.join(", ") || "(none — open one with harnessimo track new)"}`];
    }
    const why = plan.held.find((h) => h.slug === slug)?.reason ?? "it is already running";
    return [`${slug} cannot start now: ${why}\n  fix:  harnessimo herd plan   shows what can`];
  });
}

/** herdr agent names match `[a-z][a-z0-9_-]{0,31}`; a slug is made to fit. */
export function agentName(slug: string): string {
  let name = slug.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  if (!/^[a-z]/.test(name)) name = `l${name}`;
  return name.slice(0, 32);
}

/** The first prompt a lane agent receives. Short: the handoff holds the rest. */
export function kickoffPrompt({
  slug,
  lane,
  runner = "npx harnessimo",
  backoffSeconds = HERD_DEFAULTS.backoffSeconds,
}: {
  slug: string;
  lane: string;
  runner?: string;
  backoffSeconds?: number[];
}): string {
  return [
    `You own lane ${slug} in this worktree.`,
    `1. Read AGENTS.md and follow it. Run \`${runner} brief --track ${slug}\`, then load ${lane}/handoff.md and only what its "What to load" names.`,
    `2. Work the tasks in ${lane}/tasks.md in order. Edit only the paths under ## Owns in the handoff.`,
    `3. After each task run the project's checks and \`${runner} check\`, quote the summary lines, tick the task with its proof marker, and commit.`,
    `4. On a rate-limit error (429) wait ${backoffSeconds.join(", then ")} seconds before retrying; do not retry in a loop.`,
    `5. Blocked after 3 attempts: write the evidence into the handoff's State and stop. When the lane's tasks are done, update the handoff and stop.`,
  ].join(" ");
}

/** Why `up` cannot talk to herdr from here, or null when it can. */
export function herdrEnvProblem(env: Record<string, string | undefined>): string | null {
  if (env.HERDR_ENV === "1") return null;
  return (
    "harnessimo herd up must run inside a herdr pane (HERDR_ENV=1 is not set)\n" +
    "  why:  herdr control commands talk to the session of the pane they run in, and outside one there is none\n" +
    "  fix:  start herdr, open a pane in this repository, and run it there — `harnessimo herd plan` works anywhere"
  );
}

// ---- reading herdr's JSON
//
// herdr answers in JSON with the payload under `result`. The shapes are read
// defensively: a missing field is "not found", never a guess.

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);

/** The pane a creation response names: `.result.pane`, `.result.root_pane`, or a workspace's root pane. */
export function paneIdFrom(response: unknown): string | null {
  const result = obj(obj(response)?.result) ?? obj(response);
  if (!result) return null;
  for (const holder of [result.pane, result.root_pane, obj(result.workspace)?.root_pane, obj(result.worktree)?.root_pane]) {
    const id = obj(holder)?.pane_id;
    if (typeof id === "string" && id) return id;
  }
  return null;
}

export interface HerdAgent {
  name: string;
  pane: string;
  state: string;
}

/** `herdr agent list`, as name, pane and state. */
export function agentsFrom(response: unknown): HerdAgent[] {
  const result = obj(obj(response)?.result) ?? obj(response);
  const list = Array.isArray(result?.agents) ? result.agents : Array.isArray(response) ? response : [];
  return (list as unknown[]).flatMap((raw) => {
    const a = obj(raw);
    if (!a) return [];
    const name = a.name ?? a.agent_name;
    const pane = a.pane_id ?? obj(a.pane)?.pane_id ?? "";
    const state = a.state ?? a.status ?? a.agent_status ?? "unknown";
    return typeof name === "string" && name ? [{ name, pane: String(pane), state: String(state) }] : [];
  });
}

const ORDER = ["blocked", "working", "unknown", "idle", "done", "not started"];

export interface HerdRow {
  slug: string;
  agent: string;
  state: string;
  pane: string;
  next: string;
}

/**
 * Every lane beside its agent, blocked first: a blocked agent is the one
 * costing time while nobody looks, and the lead's next action is there.
 */
export function statusRows(lanes: HerdLane[], agents: HerdAgent[]): HerdRow[] {
  const byName = new Map(agents.map((a) => [a.name, a]));
  const next: Record<string, string> = {
    blocked: "read it (herdr agent read), answer or escalate",
    working: "leave it",
    unknown: "read it before sending anything",
    idle: "review its commits; give it the next task or stop it",
    done: "review, merge (harnessimo worktree merge), then remove",
    "not started": "harnessimo herd up",
  };
  return lanes
    .map((lane) => {
      const agent = byName.get(agentName(lane.slug));
      const state = agent ? agent.state.toLowerCase() : "not started";
      return { slug: lane.slug, agent: agentName(lane.slug), state, pane: agent?.pane ?? "", next: next[state] ?? next.unknown! };
    })
    .sort((a, b) => rank(a.state) - rank(b.state));
}

function rank(state: string): number {
  const at = ORDER.indexOf(state);
  return at === -1 ? ORDER.indexOf("unknown") : at;
}
