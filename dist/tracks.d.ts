import type { Problem, Resolver } from "./types.ts";
/**
 * The lines that are actually tracks: list items outside fenced blocks. An
 * example inside a fence documents the shape of a line and is not a track, so
 * neither the gate nor the count may treat it as one.
 *
 */
export declare function trackLines(text: string): {
    line: number;
    text: string;
}[];
/**
 * Track-index integrity. A line with no status is a track nobody can triage;
 * a line linking a file that does not exist is a handoff that would lie.
 *
 */
export declare function checkTracks(text: string, resolver: Resolver, filePath?: string): Problem[];
/**
 * No document may point at a handoff that closed. Directory-qualified paths
 * must resolve; the bare word `handoff.md` and template paths
 * (`specs/NNNN-<slug>/handoff.md`) are protocol talk, not claims, and stay
 * legal.
 *
 * @param log  where a closed track's outcome lives, named in the failure message
 */
export declare function checkHandoffRefs(text: string, resolver: Resolver, filePath: string, log?: string): Problem[];
/**
 * Spec directories currently live, derived from each track line's handoff
 * link. A track with no handoff link (an infrastructure track with nothing to
 * hand off) has no lane directory to gate and is correctly skipped rather than
 * guessed at.
 *
 */
export declare function liveTrackSpecDirs(tracksText: string, specsDir?: string): string[];
//# sourceMappingURL=tracks.d.ts.map