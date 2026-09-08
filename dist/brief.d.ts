import type { AgentSettings, BriefInput } from "./types.ts";
export declare function briefText({ tracksText, handoffs, queue, progressText, enabled, tracksPath, }: BriefInput): string;
/** The section under a `## <name>` heading, up to the next heading of the same level. */
/**
 */
export declare function sectionOf(markdown: string, name: string): string | null;
/**
 * The shape Claude Code's SessionStart hook reads from stdout.
 */
export declare function briefJson(text: string): {
    hookSpecificOutput: {
        hookEventName: string;
        additionalContext: string;
    };
};
/** Handoff paths named by the track index, in order, deduplicated. */
/**
 */
export declare function handoffPaths(tracksText: string): string[];
/**
 * Adds the SessionStart hook to an agent settings object without disturbing
 * anything else in it, and without adding itself twice.
 *
 */
export declare function mergeSessionStartHook(settings: AgentSettings, command: string): {
    settings: AgentSettings;
    added: boolean;
};
//# sourceMappingURL=brief.d.ts.map