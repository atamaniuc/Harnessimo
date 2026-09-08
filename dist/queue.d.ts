import type { FeatureList, QueueItem } from "./types.ts";
export declare class HarnessError extends Error {
    /** What went wrong, in the words the caller should read. */
    what: string;
    /** What to do about it. Every failure this package prints carries one. */
    fix: string;
    constructor(what: string, fix: string);
}
/**
 * The item, or a HarnessError naming what to run to see the queue. It never
 * returns undefined — the throw is the contract, and the declaration used to
 * say otherwise.
 */
export declare function findItem(list: FeatureList, id: string): QueueItem;
/**
 * Human-readable queue state, grouped by state with the limits spelled out.
 */
export declare function formatStatus(list: FeatureList): string;
/**
 * Claims an item. Enforces work-in-progress = 1 (split attention produces work
 * started everywhere and finished nowhere) and the Definition of Ready.
 *
 */
export declare function activate(list: FeatureList, id: string): QueueItem;
/**
 * Runs an item's own verification and records the outcome. Activates on the
 * way in when the limits allow: making the caller run two commands to do one
 * thing is ceremony, and ceremony gets skipped rather than followed.
 *
 */
export declare function verifyItem(list: FeatureList, id: string, runner: (command: string) => {
    ok: boolean;
    output: string;
}, options?: {
    terminalByKind?: Record<string, string>;
}): {
    item: QueueItem;
    ok: boolean;
    output: string;
};
/**
 * Invariants, plus optional re-verification of every claim. Run in CI: a
 * hand-edited "passing" is only accepted if the command still passes here.
 *
 * @param }} options
 * @returns {string[]} problems, each already formatted as what / why / fix
 */
export declare function checkQueue(list: FeatureList, options?: {
    reverify?: boolean;
    runner?: (command: string) => {
        ok: boolean;
        output: string;
    };
}): string[];
/** @param text @param n */
export declare function lastLines(text: string, n?: number): string;
//# sourceMappingURL=queue.d.ts.map