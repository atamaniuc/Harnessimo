import type { Problem, Resolver } from "./types.ts";
/**
 * Resolves one marker target. Returns null when the claim holds, or the reason
 * it does not — phrased for whoever has to fix it, which is usually a fresh
 * session with no memory of why the claim was made.
 *
 */
export declare function checkTarget(target: string, resolver: Resolver): string | null;
/**
 * A marker that documents the syntax rather than making a claim.
 *
 * The rule has to exist because a project's own docs explain how to write a
 * marker, and their examples are written as markers. Placeholder punctuation —
 * `...`, `[optional]`, `<angle>` — is what separates an illustration from an
 * assertion, and no real path contains any of it.
 *
 */
export declare function isSyntaxExample(target: string): boolean;
export declare function findMarkers(text: string): {
    line: number;
    target: string;
}[];
/**
 * Checks every marker in every document, and — in strict mode — that the
 * documents which carry the project's central claims carry at least one marker
 * at all. A document with no marker is not evidence of a document with no
 * claims; it is the state the gate exists to end.
 *
 */
export declare function verifyProofs(files: {
    path: string;
    text: string;
}[], resolver: Resolver, options?: {
    strict?: boolean;
    mustCarryProof?: string[];
}): Problem[];
//# sourceMappingURL=proof.d.ts.map