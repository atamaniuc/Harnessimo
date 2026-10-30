import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HERD_DEFAULTS,
  agentName,
  agentsFrom,
  defaultEffort,
  frontmatterOf,
  herdSettingsProblems,
  herdrEnvProblem,
  kickoffPrompt,
  laneStatus,
  launchFor,
  launchLine,
  paneIdFrom,
  placeLanes,
  placementText,
  planHerd,
  roleFor,
  splitDirection,
  tabIdFrom,
  tabPaneCount,
  statusRows,
  upProblems,
} from "../src/herd.ts";
import type { HerdLane } from "../src/herd.ts";
import { reason } from "./helpers.ts";

const lane = (slug: string, owns: string[], extra: Partial<HerdLane> = {}): HerdLane => ({
  slug,
  lane: `specs/0001-${slug}`,
  status: "active",
  owns,
  deps: [],
  ...extra,
});

test("lanes on disjoint paths run side by side; an overlapping one is held, naming the other", () => {
  const plan = planHerd([lane("search", ["src/search/"]), lane("billing", ["src/billing/"]), lane("ranking", ["src/search/rank.ts"])], {
    maxWorking: 3,
  });
  assert.deepEqual(plan.runnable, ["search", "billing"]);
  assert.match(plan.held.find((h) => h.slug === "ranking")!.reason, /overlaps search/);
});

test("the cap holds, counting agents already running", () => {
  const lanes = [lane("a", ["a/"]), lane("b", ["b/"]), lane("c", ["c/"]), lane("d", ["d/"])];
  assert.deepEqual(planHerd(lanes, { maxWorking: 3 }).runnable, ["a", "b", "c"]);
  const plan = planHerd(lanes, { maxWorking: 3, alreadyRunning: ["a", "b"] });
  assert.deepEqual(plan.runnable, ["c"]);
  assert.match(plan.held.find((h) => h.slug === "d")!.reason, /cap of 3/);
});

test("a lane waiting on an open lane, or not active, is held with the reason", () => {
  const plan = planHerd(
    [lane("api", ["api/"]), lane("ui", ["ui/"], { deps: ["api"] }), lane("docs", ["docs/"], { status: "paused" })],
    { maxWorking: 3 },
  );
  assert.deepEqual(plan.runnable, ["api"]);
  assert.match(plan.held.find((h) => h.slug === "ui")!.reason, /waits on api/);
  assert.match(plan.held.find((h) => h.slug === "docs")!.reason, /paused/);
  // A dependency on a closed lane is no longer a wait.
  assert.deepEqual(planHerd([lane("ui", ["ui/"], { deps: ["api"] })], { maxWorking: 3 }).runnable, ["ui"]);
});

test("a lane with no ## Owns runs only alone", () => {
  const first = planHerd([lane("loose", []), lane("fenced", ["x/"])], { maxWorking: 3 });
  assert.deepEqual(first.runnable, ["loose"]);
  assert.match(first.held[0]!.reason, /loose declares no ## Owns/);
  const second = planHerd([lane("fenced", ["x/"]), lane("loose", [])], { maxWorking: 3 });
  assert.deepEqual(second.runnable, ["fenced"]);
  assert.match(second.held[0]!.reason, /can run only alone/);
});

test("up refuses a lane the plan holds or that does not exist, with a fix", () => {
  const plan = { runnable: ["a"], held: [{ slug: "b", reason: "its ## Owns overlaps a's" }] };
  assert.deepEqual(upProblems(["a"], plan, ["a", "b"]), []);
  assert.match(upProblems(["b"], plan, ["a", "b"])[0]!, /b cannot start now: its ## Owns overlaps[\s\S]*herd plan/);
  assert.match(upProblems(["zz"], plan, ["a", "b"])[0]!, /no live lane "zz"[\s\S]*one of a, b/);
});

test("agents fill the coordinator's tab to the cap, then each new tab to the same cap", () => {
  const slugs = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const where = (occupied: number, capacity = 4) => placeLanes(slugs, { occupied, capacity }).map((p) => `${p.tab}:${p.slot}`);
  // The coordinator alone: three more fit, then a tab of four, then the rest.
  assert.deepEqual(where(1), ["0:1", "0:2", "0:3", "1:0", "1:1", "1:2", "1:3", "2:0"]);
  // A full tab sends everything to new tabs.
  assert.deepEqual(where(4).slice(0, 2), ["1:0", "1:1"]);
  assert.deepEqual(where(7).slice(0, 2), ["1:0", "1:1"]);
  assert.deepEqual(where(1, 2).slice(0, 4), ["0:1", "1:0", "1:1", "2:0"]);
  assert.deepEqual(placeLanes([], { occupied: 1, capacity: 4 }), []);
  const placed = placeLanes(slugs, { occupied: 1, capacity: 4 });
  assert.equal(placed[3]!.label, "d");
  assert.equal(placed[6]!.label, "d", "the tab is named for its first lane");
  assert.equal(placed[7]!.label, "h");
  assert.equal(placementText(placed[0]!), "this tab");
  assert.equal(placementText(placed[3]!), 'new tab "d"');
  assert.equal(placementText(placed[4]!), 'tab "d"');
  assert.ok(placed.every((p) => p.slot < 4), "no tab goes past the cap");
});

test("the first split of a tab goes right, the rest down", () => {
  assert.deepEqual([1, 2, 3].map(splitDirection), ["right", "down", "down"]);
});

test("the tab and its pane count are read from herdr's answers, or not at all", () => {
  assert.equal(tabIdFrom({ result: { pane: { pane_id: "w1:p5", tab_id: "w1:t2" } } }), "w1:t2");
  assert.equal(tabIdFrom({ result: {} }), null);
  const list = { result: { tabs: [{ tab_id: "w1:t1", pane_count: 4 }, { tab_id: "w1:t2", pane_count: 1 }] } };
  assert.equal(tabPaneCount(list, "w1:t1"), 4);
  assert.equal(tabPaneCount(list, "w1:t9"), null);
  assert.equal(tabPaneCount({ error: "nope" }, "w1:t1"), null);
  assert.equal(paneIdFrom({ result: { tab: { tab_id: "w1:t3" }, root_pane: { pane_id: "w1:p7" } } }), "w1:p7");
});

test("a panesPerTab below 1 is refused", () => {
  assert.deepEqual(herdSettingsProblems({ ...HERD_DEFAULTS, panesPerTab: 0 }).map((p) => p.target), ["herd.panesPerTab"]);
  assert.equal(HERD_DEFAULTS.panesPerTab, 4);
});

test("bad role settings are refused, each naming the key", () => {
  const problems = herdSettingsProblems({
    ...HERD_DEFAULTS,
    defaultRole: "../etc/passwd",
    laneRoles: { api: "Not A Role" },
    roles: { implementer: { effort: "turbo" }, "Bad": {} },
  });
  assert.deepEqual(
    problems.map((p) => p.target),
    ["herd.defaultRole", "herd.laneRoles", "herd.roles", "herd.roles"],
  );
  assert.deepEqual(herdSettingsProblems({ ...HERD_DEFAULTS, roles: { implementer: { model: "sonnet", effort: "high" } } }), []);
});

test("bad herd settings are refused, each naming the key", () => {
  assert.deepEqual(herdSettingsProblems(HERD_DEFAULTS), []);
  const problems = herdSettingsProblems({
    ...HERD_DEFAULTS,
    maxWorking: 0,
    staggerSeconds: -1,
    backoffSeconds: [],
    agentArgs: [3 as unknown as string],
  });
  assert.deepEqual(
    problems.map((p) => p.target),
    ["herd.maxWorking", "herd.staggerSeconds", "herd.agentArgs", "herd.backoffSeconds"],
  );
});

const roleFile = (front: string): string => `---\nname: x\n${front}\n---\n\nBody with model: nope\n`;

test("a role's launch flags come from its file: sonnet gets high effort without being told", () => {
  const launch = launchFor({ role: "implementer", roleFile: roleFile("model: sonnet"), agentArgs: [] });
  assert.deepEqual(launch.args, ["--model", "sonnet", "--effort", "high"]);
  assert.equal(launch.modelFrom, ".claude/agents/implementer.md");
  assert.equal(launch.effortFrom, "default for sonnet");
  assert.deepEqual([launch.warnings, launch.problems], [[], []]);
  // A full model id is still sonnet; opus and haiku have no default effort.
  assert.equal(defaultEffort("claude-sonnet-5-5"), "high");
  assert.equal(defaultEffort("opus"), null);
  assert.deepEqual(launchFor({ role: "scout", roleFile: roleFile("model: haiku"), agentArgs: [] }).args, ["--model", "haiku"]);
});

test("frontmatter effort beats the model's default, and only the leading block is read", () => {
  assert.deepEqual(launchFor({ role: "implementer", roleFile: roleFile('model: "sonnet"\neffort: medium'), agentArgs: [] }).args, [
    "--model",
    "sonnet",
    "--effort",
    "medium",
  ]);
  assert.deepEqual(frontmatterOf("no block\nmodel: opus\n"), {});
  assert.equal(frontmatterOf(roleFile("model: opus")).model, "opus");
});

test("a missing or silent role file falls back to herd.roles; with no fallback it warns instead of guessing", () => {
  const fallback = { model: "sonnet", effort: "low" };
  assert.deepEqual(launchFor({ role: "implementer", roleFile: null, fallback, agentArgs: [] }).args, ["--model", "sonnet", "--effort", "low"]);
  assert.equal(launchFor({ role: "implementer", roleFile: null, fallback, agentArgs: [] }).modelFrom, "herd.roles.implementer");
  // The file wins where it speaks; the config fills only what it leaves out.
  assert.deepEqual(launchFor({ role: "implementer", roleFile: roleFile("model: opus"), fallback, agentArgs: [] }).args, [
    "--model",
    "opus",
    "--effort",
    "low",
  ]);
  const none = launchFor({ role: "implementer", roleFile: null, agentArgs: [] });
  assert.deepEqual(none.args, []);
  assert.match(none.warnings[0]!, /names no model[\s\S]*implementer\.md is missing[\s\S]*default model[\s\S]*fix:/);
  // `inherit` names no model for a pane agent, which has no parent to inherit from.
  assert.equal(launchFor({ role: "r", roleFile: roleFile("model: inherit"), agentArgs: [] }).warnings.length, 1);
});

test("an explicit --model or --effort in herd.agentArgs wins for that flag only, and is not doubled", () => {
  const model = launchFor({ role: "implementer", roleFile: roleFile("model: sonnet"), agentArgs: ["--model", "opus"] });
  // The effective model is opus, which has no default effort: the role's sonnet default does not leak in.
  assert.deepEqual(model.args, ["--model", "opus"]);
  assert.equal(model.modelFrom, "herd.agentArgs");
  assert.equal(model.model, "opus");
  const joined = launchFor({ role: "implementer", roleFile: roleFile("model: sonnet"), agentArgs: ["--effort=max", "--verbose"] });
  assert.deepEqual(joined.args, ["--model", "sonnet", "--effort=max", "--verbose"]);
  assert.equal(joined.effort, "max");
  const both = launchFor({ role: "scout", roleFile: roleFile("model: haiku"), agentArgs: ["--model", "sonnet", "--effort", "low"] });
  assert.deepEqual(both.args, ["--model", "sonnet", "--effort", "low"]);
  assert.deepEqual(both.warnings, []);
});

test("an effort claude would not accept is a problem naming its source", () => {
  const launch = launchFor({ role: "implementer", roleFile: roleFile("model: sonnet\neffort: turbo"), agentArgs: [] });
  assert.match(launch.problems[0]!, /role implementer: effort "turbo" \(\.claude\/agents\/implementer\.md\)[\s\S]*low, medium, high, xhigh, max/);
});

test("a lane plays the default role unless laneRoles names another", () => {
  const settings = { defaultRole: "implementer", laneRoles: { api: "architect" } };
  assert.equal(roleFor("search", settings), "implementer");
  assert.equal(roleFor("api", settings), "architect");
});

test("the plan line shows the role, the flags and where each came from", () => {
  const line = launchLine("search", launchFor({ role: "implementer", roleFile: roleFile("model: sonnet"), agentArgs: [] }));
  assert.match(line, /search\s+implementer\s+--model sonnet --effort high\s+\(model: \.claude\/agents\/implementer\.md; effort: default for sonnet\)/);
});

test("an agent name fits herdr's pattern whatever the slug", () => {
  assert.equal(agentName("search"), "search");
  assert.equal(agentName("2fa.Login"), "l2fa-login");
  assert.ok(agentName("x".repeat(60)).length <= 32);
  assert.match(agentName("2fa.Login"), /^[a-z][a-z0-9_-]{0,31}$/);
});

test("the kickoff prompt names the lane, the handoff, the checks, the commit and the backoff", () => {
  const text = kickoffPrompt({ slug: "search", lane: "specs/0003-search", backoffSeconds: [60, 120] });
  assert.match(text, /AGENTS\.md/);
  assert.match(text, /brief --track search/);
  assert.match(text, /specs\/0003-search\/handoff\.md/);
  assert.match(text, /check/);
  assert.match(text, /commit/);
  assert.match(text, /429\) wait 60, then 120 seconds/);
  assert.doesNotMatch(text, /\n/, "one line: a pane submits a newline as Enter");
});

test("up outside a herdr pane is refused with what to do instead", () => {
  assert.equal(herdrEnvProblem({ HERDR_ENV: "1" }), null);
  assert.match(reason(herdrEnvProblem({})), /inside a herdr pane[\s\S]*fix:/);
});

test("herdr's answers are read defensively: pane ids and agents, or nothing", () => {
  assert.equal(paneIdFrom({ result: { pane: { pane_id: "w1:p2" } } }), "w1:p2");
  assert.equal(paneIdFrom({ result: { workspace: { workspace_id: "w2" }, root_pane: { pane_id: "w2:p1" } } }), "w2:p1");
  assert.equal(paneIdFrom({ result: {} }), null);
  assert.deepEqual(agentsFrom({ result: { agents: [{ name: "search", pane_id: "w1:p2", state: "working" }, { kind: "x" }] } }), [
    { name: "search", pane: "w1:p2", state: "working" },
  ]);
  assert.deepEqual(agentsFrom({ error: "nope" }), []);
});

test("status puts blocked lanes first and says what the lead does next", () => {
  const rows = statusRows([lane("a", []), lane("b", []), lane("c", [])], [
    { name: "a", pane: "w1:p1", state: "working" },
    { name: "c", pane: "w1:p3", state: "blocked" },
  ]);
  assert.deepEqual(rows.map((r) => [r.slug, r.state]), [["c", "blocked"], ["a", "working"], ["b", "not started"]]);
  assert.match(rows[0]!.next, /agent read/);
});

test("a track line's status word is read, and a line with none is unknown", () => {
  assert.equal(laneStatus("- **Search** — [handoff](x) — active, next: T1"), "active");
  assert.equal(laneStatus("- **Search** — [handoff](x) — Blocked on api"), "blocked");
  assert.equal(laneStatus("- **Search** — [handoff](x)"), "unknown");
});
