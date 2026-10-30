import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HERD_DEFAULTS,
  agentName,
  agentsFrom,
  herdSettingsProblems,
  herdrEnvProblem,
  kickoffPrompt,
  laneStatus,
  paneIdFrom,
  planHerd,
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
