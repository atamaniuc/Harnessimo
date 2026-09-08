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
const HANDOFF_LINES = 20;
export function briefText({ tracksText, handoffs = [], queue, progressText, enabled = {}, tracksPath = "specs/TRACKS.md", }) {
    const out = [];
    if (tracksText) {
        out.push(`== ${tracksPath} (live work tracks — load a track's handoff before starting on it) ==`);
        out.push(tracksText.trimEnd());
    }
    for (const handoff of handoffs) {
        const head = handoff.text.split("\n").slice(0, HANDOFF_LINES).join("\n").trimEnd();
        out.push(`\n== ${handoff.path} (first ${HANDOFF_LINES} lines) ==`);
        out.push(head);
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
        }
        else {
            lines.push("active: nothing in flight");
            if (next)
                lines.push(`  next queued: ${next.id} — ${next.behavior}`);
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
        if (off.length)
            out.push(`not enforced: ${off.join(", ")}`);
    }
    return out.join("\n").trim();
}
/** The section under a `## <name>` heading, up to the next heading of the same level. */
/**
 */
export function sectionOf(markdown, name) {
    const lines = markdown.split("\n");
    const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${name.toLowerCase()}`);
    if (start === -1)
        return null;
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((l) => l.startsWith("## "));
    return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim() || null;
}
/**
 * The shape Claude Code's SessionStart hook reads from stdout.
 */
export function briefJson(text) {
    return { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } };
}
/** Handoff paths named by the track index, in order, deduplicated. */
/**
 */
export function handoffPaths(tracksText) {
    const found = [...tracksText.matchAll(/[\w./-]+\/handoff\.md/g)].map((m) => m[0]);
    return [...new Set(found)].filter((p) => !/[<>]|\.\.\./.test(p));
}
/**
 * Adds the SessionStart hook to an agent settings object without disturbing
 * anything else in it, and without adding itself twice.
 *
 */
export function mergeSessionStartHook(settings, command) {
    const next = { ...settings };
    const hooks = { ...(next.hooks ?? {}) };
    const sessionStart = [...(hooks.SessionStart ?? [])];
    const already = sessionStart.some((entry) => (entry.hooks ?? []).some((h) => h.command === command));
    if (already)
        return { settings, added: false };
    sessionStart.push({
        hooks: [
            {
                type: "command",
                command,
                timeout: 10,
                statusMessage: "Loading harness state…",
            },
        ],
    });
    hooks.SessionStart = sessionStart;
    next.hooks = hooks;
    return { settings: next, added: true };
}
//# sourceMappingURL=brief.js.map