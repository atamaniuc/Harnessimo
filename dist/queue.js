// The work queue: the only thing allowed to move an item's state.
//
// Models are consistently over-confident about their own work, so the
// judgement of whether an item is finished is taken away from the worker and
// given to a command. An agent editing `state` by hand is precisely the
// failure this prevents, which is why `checkQueue({ reverify: true })` re-runs
// every claimed verification instead of trusting the file — a hand-written
// "passing" is then detected rather than believed.
//
// The state machine is deliberately small:
//
//   not_started ──activate──► active ──verify(pass)──► passing / <terminal for kind>
//        ▲                      │
//        └──────────────────────┴──verify(fail)──► blocked
//
// This module is pure with respect to the world: reads and writes are passed
// in. `runner` is a function that executes a verification and reports whether
// it passed, so the queue is testable without running anything.
import { readiness, doneness, formatViolations } from "./readiness.js";
export class HarnessError extends Error {
    /** What went wrong, in the words the caller should read. */
    what;
    /** What to do about it. Every failure this package prints carries one. */
    fix;
    constructor(what, fix) {
        super(`${what}\n  fix:  ${fix}`);
        this.name = "HarnessError";
        this.what = what;
        this.fix = fix;
    }
}
const DEFAULT_TERMINAL = { code: "passing" };
function terminalState(item, terminalByKind) {
    return terminalByKind[item.kind ?? "code"] ?? "passing";
}
/**
 * The item, or a HarnessError naming what to run to see the queue. It never
 * returns undefined — the throw is the contract, and the declaration used to
 * say otherwise.
 */
export function findItem(list, id) {
    const item = list.items.find((i) => i.id === id);
    if (!item)
        throw new HarnessError(`no item "${id}"`, "run `harnessimo queue status` to see the queue");
    return item;
}
/**
 * Human-readable queue state, grouped by state with the limits spelled out.
 */
export function formatStatus(list) {
    const order = ["active", "blocked", "awaiting_gates", "not_started", "passing", "done"];
    const byState = new Map();
    for (const i of list.items)
        byState.set(i.state, [...(byState.get(i.state) ?? []), i]);
    const lines = [];
    for (const state of [...order, ...[...byState.keys()].filter((s) => !order.includes(s))]) {
        const items = byState.get(state) ?? [];
        if (items.length === 0)
            continue;
        lines.push(`\n${state} (${items.length})`);
        for (const i of items)
            lines.push(`  ${i.id.padEnd(28)} ${i.phase ? `phase ${i.phase}` : ""}`.trimEnd());
    }
    const active = (byState.get("active") ?? []).length;
    const queued = (byState.get("awaiting_gates") ?? []).length;
    lines.push(`\nWIP ${active}/${list.wip_limit ?? 1}   awaiting gates ${queued}/${list.review_queue_limit ?? "-"}`);
    return lines.join("\n");
}
/**
 * Claims an item. Enforces work-in-progress = 1 (split attention produces work
 * started everywhere and finished nowhere) and the Definition of Ready.
 *
 */
export function activate(list, id) {
    const wipLimit = list.wip_limit ?? 1;
    const active = list.items.filter((i) => i.state === "active");
    if (active.length >= wipLimit) {
        throw new HarnessError(`WIP limit reached — "${active[0]?.id}" is already active`, "finish or block that item first; split attention is what produces work started everywhere and finished nowhere");
    }
    const queueLimit = list.review_queue_limit ?? Infinity;
    const queued = list.items.filter((i) => i.state === "awaiting_gates").length;
    if (queued >= queueLimit) {
        throw new HarnessError(`verification queue is full (${queued}/${queueLimit})`, "let the gates drain before starting more; a backlog of ungated work is not progress");
    }
    const item = findItem(list, id);
    if (item.state !== "not_started" && item.state !== "blocked") {
        throw new HarnessError(`"${id}" is ${item.state}, not startable`, "pick a not_started or blocked item");
    }
    const notReady = readiness(item, list.items);
    if (notReady.length > 0) {
        throw new HarnessError(`"${id}" is not ready to start\n\n${formatViolations(id, notReady)}`, "make the item ready, then start it");
    }
    item.state = "active";
    return item;
}
/**
 * Runs an item's own verification and records the outcome. Activates on the
 * way in when the limits allow: making the caller run two commands to do one
 * thing is ceremony, and ceremony gets skipped rather than followed.
 *
 */
export function verifyItem(list, id, runner, options = {}) {
    const terminalByKind = { ...DEFAULT_TERMINAL, ...(options.terminalByKind ?? {}) };
    let item = findItem(list, id);
    if (item.state === "not_started" || item.state === "blocked") {
        activate(list, id);
        item = findItem(list, id);
    }
    if (item.state !== "active") {
        throw new HarnessError(`"${id}" is ${item.state} and cannot be verified`, "only a not_started, blocked or active item can be verified");
    }
    const { ok, output } = runner(item.verification);
    if (!ok) {
        item.state = "blocked";
        item.last_failure = lastLines(output);
        return { item, ok: false, output };
    }
    item.state = terminalState(item, terminalByKind);
    item.evidence = lastLines(output);
    item.last_failure = null;
    const notDone = doneness(item, true);
    if (notDone.length > 0) {
        throw new HarnessError(`"${id}" passed but is not done\n\n${formatViolations(id, notDone)}`, "record the evidence through the harness");
    }
    return { item, ok: true, output };
}
/**
 * Invariants, plus optional re-verification of every claim. Run in CI: a
 * hand-edited "passing" is only accepted if the command still passes here.
 *
 * @param }} options
 * @returns {string[]} problems, each already formatted as what / why / fix
 */
export function checkQueue(list, options = {}) {
    const { reverify = false, runner } = options;
    const problems = [];
    const wipLimit = list.wip_limit ?? 1;
    const active = list.items.filter((i) => i.state === "active");
    if (active.length > wipLimit) {
        problems.push(`WIP limit exceeded: ${active.length} active (${active.map((i) => i.id).join(", ")})\n` +
            `  why:  split attention produces work started everywhere and finished nowhere\n` +
            `  fix:  keep at most ${wipLimit} item(s) active`);
    }
    const queueLimit = list.review_queue_limit ?? Infinity;
    const queued = list.items.filter((i) => i.state === "awaiting_gates");
    if (queued.length > queueLimit) {
        problems.push(`verification queue over limit: ${queued.length}/${queueLimit}\n` +
            `  why:  a backlog of ungated work inflates a metric that means nothing\n` +
            `  fix:  drain the gates before starting more`);
    }
    const terminal = new Set(["passing", "awaiting_gates", "done", "auto_verified", "verified"]);
    for (const item of list.items) {
        if (terminal.has(item.state) && !item.evidence) {
            problems.push(`"${item.id}" is ${item.state} with no evidence\n` +
                `  why:  done means a command passed, not that the work looked right\n` +
                `  fix:  run \`harnessimo queue verify ${item.id}\` instead of editing state`);
        }
    }
    if (reverify && runner) {
        for (const item of list.items.filter((i) => i.state === "passing" || i.state === "done")) {
            const { ok, output } = runner(item.verification);
            if (!ok) {
                problems.push(`"${item.id}" claims ${item.state} but its verification fails now\n` +
                    `  command: ${item.verification}\n` +
                    `  output:  ${lastLines(output, 3)}\n` +
                    `  fix:  fix the regression, or the claim was never true`);
            }
        }
    }
    return problems;
}
/** @param text @param n */
export function lastLines(text, n = 6) {
    return String(text)
        .trim()
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .slice(-n)
        .join(" | ")
        .slice(0, 500);
}
//# sourceMappingURL=queue.js.map