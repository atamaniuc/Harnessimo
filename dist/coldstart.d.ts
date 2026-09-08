/**
 * Pure core: which of the required files a fresh clone would be missing, and
 * which documents point outside the repository.
 *
 * A path like `~/.claude/plans/` or `/Users/someone/...` in an entry-point
 * document is the specific failure this catches: the repository appears to
 * document itself, but only works on one laptop.
 *
 */
import type { SourceFile } from "./types.ts";
export declare function coldStartProblems({ requiredFiles, escapes }: {
    requiredFiles: string[];
    escapes: SourceFile[];
}, exists: (path: string) => boolean): string[];
//# sourceMappingURL=coldstart.d.ts.map