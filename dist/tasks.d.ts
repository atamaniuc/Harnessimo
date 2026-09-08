import type { Problem, Resolver } from "./types.ts";
/**
 * Groups a task list into one block per list item: the first line through its
 * indented continuation lines. A real task description wraps, and a marker on
 * a continuation line is still that item's marker — a regression found by
 * running this gate against a real task list before shipping it.
 *
 */
export declare function taskBlocks(text: string): {
    startLine: number;
    text: string;
}[];
export declare function checkTaskGate(text: string, filePath: string, resolver: Resolver): Problem[];
/**
 * Runs the gate over every task list belonging to a live track. `files` may
 * list every task list in the repository — only the live ones are checked.
 *
 */
export declare function verifyTaskGates(files: {
    path: string;
    text: string;
}[], tracksText: string, resolver: Resolver, options?: {
    specsDir?: string;
    taskFile?: string;
}): Problem[];
//# sourceMappingURL=tasks.d.ts.map