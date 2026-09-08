/**
 * Pure core: given commits (each with its message and touched paths) and the
 * locked prefixes, report every violation. No git, no filesystem.
 *
 */
export declare function lockedViolations(commits: {
    sha: string;
    message: string;
    files: string[];
}[], { paths, agentTrailer, exempt }: {
    paths: string[];
    agentTrailer: string;
    exempt?: Set<string>;
}): {
    sha: string;
    hits: string[];
}[];
export declare function formatLockedViolations(violations: {
    sha: string;
    hits: string[];
}[]): string;
//# sourceMappingURL=locked.d.ts.map