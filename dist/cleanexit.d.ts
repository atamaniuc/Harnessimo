/**
 * Markers that pass a build and mean the work is not finished. Deliberately a
 * default rather than a hard-coded list: `.only(` is fatal in a test suite and
 * meaningless in a CSS file, and a project knows which of its own it cares
 * about.
 */
import type { Problem, SourceFile } from "./types.ts";
export declare const DEFAULT_MARKERS: string[];
/**
 * @param files  the files a session touched
 */
export declare function debrisProblems(files: SourceFile[], options?: {
    markers?: string[];
    allow?: string[];
}): Problem[];
/**
 * Did the session write down where it got to?
 *
 * The rule is relative, not absolute: a progress file that is older than the
 * code around it is worse than none, because the next session reads it and
 * believes it. A documentation-only change does not need one.
 *
 *   changedLines maps a path to the number of lines it changed, and together
 *   with threshold is how a one-line fix escapes the rule: below the threshold
 *   the session is too small to owe a progress note. Null means the line counts
 *   were unreadable, and the rule falls back to strict.
 */
export declare function progressProblems({ changed, progressFile, codePrefixes, changedLines, threshold, }: {
    changed: string[];
    progressFile: string | null;
    codePrefixes?: string[];
    /** Path -> lines it changed. Null when the counts were unreadable, and the rule falls back to strict. */
    changedLines?: Record<string, number> | null;
    /** Changed lines below which a session is too small to owe a progress note. */
    threshold?: number;
}): Problem[];
/**
 * The instruction file, kept short. From lecture 04 ("Почему один большой файл
 * инструкций не работает"): a long instruction file eats the working memory it
 * is trying to direct, and what lands in the middle is what gets ignored. The
 * fix is a router that points at topical documents, and the only way a router
 * stays a router is if something fails when it stops being one.
 *
 * @param limits  path -> maximum lines
 */
export declare function instructionProblems(files: {
    path: string;
    text: string;
}[], limits: Record<string, number>): Problem[];
//# sourceMappingURL=cleanexit.d.ts.map