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
  /** Arguments passed to the agent after `--`. A `--model` or `--effort` here wins over the role's. */
  agentArgs: [] as string[],
  /** The role a lane agent plays unless `laneRoles` says otherwise: its model comes from `.claude/agents/<role>.md`. */
  defaultRole: "implementer",
  /** Lane slug → role, for the lane that is not an implementer's. */
  laneRoles: {} as Record<string, string>,
  /** Role → model and effort, for when the role's file is missing or silent. The file wins. */
  roles: {} as Record<string, RoleSetting>,
  /** Panes in one herdr tab, the coordinator's included. More agents than fit go to a new tab. */
  panesPerTab: 4,
  /** The wait before each re-prompt after a rate-limit error, in seconds. */
  backoffSeconds: [60, 120, 240] as number[],
};

export type HerdSettings = typeof HERD_DEFAULTS;

/** What a role is launched with. Either half may be absent. */
export interface RoleSetting {
  model?: string;
  effort?: string;
}

/** The values `claude --effort` takes. */
export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"];

const ROLE_NAME = /^[a-z][a-z0-9_-]*$/;

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
  if (!Number.isInteger(herd.panesPerTab) || herd.panesPerTab < 1) {
    bad("panesPerTab", "must be a whole number of at least 1 — a tab with no room puts every agent in the dark");
  }
  if (typeof herd.agentKind !== "string" || !herd.agentKind) bad("agentKind", "must name a herdr agent kind, e.g. \"claude\"");
  if (!Array.isArray(herd.agentArgs) || herd.agentArgs.some((a) => typeof a !== "string")) {
    bad("agentArgs", "must be a list of strings");
  }
  if (typeof herd.defaultRole !== "string" || !ROLE_NAME.test(herd.defaultRole)) {
    bad("defaultRole", "must be a role name that is a file name under .claude/agents, e.g. \"implementer\"");
  }
  const table = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  if (!table(herd.laneRoles) || Object.values(herd.laneRoles).some((r) => typeof r !== "string" || !ROLE_NAME.test(r))) {
    bad("laneRoles", "must map lane slugs to role names, e.g. { \"search\": \"architect\" }");
  }
  if (!table(herd.roles)) {
    bad("roles", "must map role names to { model, effort }");
  } else {
    for (const [role, setting] of Object.entries(herd.roles)) {
      const s = setting as Record<string, unknown> | null;
      if (!ROLE_NAME.test(role) || !table(s)) {
        bad("roles", `"${role}" must be a role name mapped to { model, effort }`);
      } else if (s.model !== undefined && (typeof s.model !== "string" || !/^\S+$/.test(s.model))) {
        bad("roles", `${role}.model must be a model name such as "sonnet"`);
      } else if (s.effort !== undefined && !EFFORT_LEVELS.includes(String(s.effort))) {
        bad("roles", `${role}.effort must be one of ${EFFORT_LEVELS.join(", ")}`);
      }
    }
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

// ---- the role a lane agent plays, and the model that role runs on
//
// Model routing lives in `.claude/agents/<role>.md`, which Claude Code reads
// for a *subagent*. A lane agent in a herdr pane is a top-level session and
// never reads it, so it ran on the default model whatever the role said.
// `herd up` therefore reads the role's file itself and passes the answer as
// launch flags. Flags, not `/model` or `/effort` typed into the running
// session: those save the choice as the user's global default and change every
// other session they have open.

/** Where a role's definition lives, relative to the repository root. */
export function roleFilePath(role: string): string {
  return `.claude/agents/${role}.md`;
}

/** The role a lane plays: its own entry in `laneRoles`, else `defaultRole`. */
export function roleFor(slug: string, settings: Pick<HerdSettings, "defaultRole" | "laneRoles">): string {
  return settings.laneRoles[slug] ?? settings.defaultRole;
}

/** The `key: value` lines of a file's leading `---` block. Nothing else in the file is read. */
export function frontmatterOf(text: string): Record<string, string> {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
  const out: Record<string, string> = {};
  for (const line of block?.split(/\r?\n/) ?? []) {
    const m = /^([A-Za-z][\w-]*):[ \t]*(.*?)[ \t]*$/.exec(line);
    if (m) out[m[1]!] = m[2]!.replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

/** Sonnet agents run at high effort unless told otherwise; no other model has a default. */
export function defaultEffort(model: string | null): string | null {
  return model && /sonnet/i.test(model) ? "high" : null;
}

export interface Launch {
  role: string;
  model: string | null;
  effort: string | null;
  /** Where each value came from, for the plan to show. */
  modelFrom: string;
  effortFrom: string;
  /** What follows `--` in `herdr agent start`: the role's flags, then `herd.agentArgs`. */
  args: string[];
  /** The launch works but is probably not what was meant. */
  warnings: string[];
  /** The launch cannot be built. */
  problems: string[];
}

/** The value `--flag value` or `--flag=value` gives in `args`, or undefined when the flag is absent. */
function explicit(args: string[], flag: string): string | undefined {
  const at = args.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (at === -1) return undefined;
  return args[at]!.startsWith(`${flag}=`) ? args[at]!.slice(flag.length + 1) : (args[at + 1] ?? "");
}

/**
 * The flags a lane agent starts with.
 *
 * Per value, the first of these that names one: `herd.agentArgs` (explicit and
 * fleet-wide, so it wins and the role's value is dropped — rejecting the
 * conflict would break every repository that already sets `--model` there),
 * the role file's frontmatter, `herd.roles[role]`, and for effort the default
 * of the model. A role with no model anywhere launches without `--model`, and
 * the plan says so.
 */
export function launchFor({
  role,
  roleFile,
  fallback = {},
  agentArgs,
}: {
  role: string;
  /** The role file's text, or null when there is none. */
  roleFile: string | null;
  fallback?: RoleSetting;
  agentArgs: string[];
}): Launch {
  const file = roleFile === null ? {} : frontmatterOf(roleFile);
  const path = roleFilePath(role);
  const warnings: string[] = [];
  const problems: string[] = [];

  const pick = (key: "model" | "effort"): { value: string | null; from: string; own: boolean } => {
    const given = explicit(agentArgs, `--${key}`);
    if (given !== undefined) return { value: given || null, from: "herd.agentArgs", own: false };
    const fromFile = file[key];
    // `inherit` means "the parent's model"; a pane agent has no parent, so it names nothing.
    if (fromFile && !(key === "model" && fromFile === "inherit")) return { value: fromFile, from: path, own: true };
    const fromConfig = fallback[key];
    if (fromConfig) return { value: fromConfig, from: `herd.roles.${role}`, own: true };
    return { value: null, from: roleFile === null ? `${path} is missing` : `${path} has no ${key}`, own: true };
  };

  const model = pick("model");
  let effort = pick("effort");
  if (effort.value === null && effort.own) {
    const byModel = defaultEffort(model.value);
    if (byModel) effort = { value: byModel, from: `default for ${model.value}`, own: true };
  }
  if (effort.value !== null && !EFFORT_LEVELS.includes(effort.value)) {
    problems.push(
      `role ${role}: effort "${effort.value}" (${effort.from}) is not one of ${EFFORT_LEVELS.join(", ")}\n` +
        `  fix:  correct it there — \`/effort\` in a running session saves a global default and is not the fix`,
    );
  }
  if (model.value === null && model.own) {
    warnings.push(
      `role ${role} names no model (${model.from}), so its lane agents run on the default model\n` +
        `  fix:  add \`model:\` to ${path}, or set herd.roles.${role}.model in harnessimo.config.json`,
    );
  }

  const args = [
    ...(model.own && model.value ? ["--model", model.value] : []),
    ...(effort.own && effort.value ? ["--effort", effort.value] : []),
    ...agentArgs,
  ];
  return { role, model: model.value, effort: effort.value, modelFrom: model.from, effortFrom: effort.from, args, warnings, problems };
}

/** One line of the plan for a lane: its role, its flags, and where each came from. */
export function launchLine(slug: string, launch: Launch, placement?: Placement): string {
  const flags = launch.args.length > 0 ? launch.args.join(" ") : "(no flags)";
  const from = [`model: ${launch.modelFrom}`, `effort: ${launch.effortFrom}`].join("; ");
  const where = placement ? `  → ${placementText(placement)}` : "";
  return `  ${slug.padEnd(20)} ${launch.role.padEnd(12)} ${flags}   (${from})${where}`;
}

// ---- where each agent's pane goes
//
// A tab of more than a few panes stops being readable: every pane gets a
// sliver and nobody looks at any of them. So a tab holds `panesPerTab` panes —
// the coordinator's included — and the agents that do not fit open a new tab,
// itself filled to the same cap.

export interface Placement {
  slug: string;
  /** 0 is the tab the coordinator is in; 1, 2… are new tabs, in order. */
  tab: number;
  /** The new tab's label (its first lane); null for the coordinator's tab. */
  label: string | null;
  /** The pane's position in its tab. 0 is a new tab's root pane; in the coordinator's tab it is the coordinator. */
  slot: number;
}

/**
 * Where each lane's pane goes. `occupied` is how many panes the coordinator's
 * tab already holds, the coordinator's included.
 */
export function placeLanes(slugs: string[], { occupied, capacity }: { occupied: number; capacity: number }): Placement[] {
  const out: Placement[] = [];
  let tab = 0;
  let slot = Math.max(occupied, 1);
  let label: string | null = null;
  for (const slug of slugs) {
    if (slot >= capacity) {
      tab += 1;
      slot = 0;
      label = slug;
    }
    out.push({ slug, tab, label, slot });
    slot += 1;
  }
  return out;
}

/** The placement as the plan shows it. */
export function placementText(p: Placement): string {
  return p.tab === 0 ? "this tab" : p.slot === 0 ? `new tab "${p.label}"` : `tab "${p.label}"`;
}

/** How a pane at `slot` is made: split which pane, in which direction. The first split of a tab goes right, the rest down. */
export function splitDirection(slot: number): "right" | "down" {
  return slot <= 1 ? "right" : "down";
}

/** The tab a `herdr pane current` answer names. */
export function tabIdFrom(response: unknown): string | null {
  const result = obj(obj(response)?.result) ?? obj(response);
  const id = obj(result?.pane)?.tab_id ?? obj(result?.tab)?.tab_id;
  return typeof id === "string" && id ? id : null;
}

/** The panes a tab holds, from a `herdr tab list` answer; null when the tab is not in it. */
export function tabPaneCount(response: unknown, tabId: string): number | null {
  const result = obj(obj(response)?.result) ?? obj(response);
  const tabs = Array.isArray(result?.tabs) ? (result.tabs as unknown[]) : [];
  for (const raw of tabs) {
    const t = obj(raw);
    if (t?.tab_id === tabId && typeof t.pane_count === "number") return t.pane_count;
  }
  return null;
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
