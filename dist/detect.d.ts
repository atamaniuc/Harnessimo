/** Command runners, most specific first — a repo with both gets the one it drives CI with. */
import type { DetectedConfig, Repo } from "./types.ts";
/**
 */
export declare function detectConfig(repo: Repo): {
    config: DetectedConfig;
    found: string[];
    missing: string[];
};
//# sourceMappingURL=detect.d.ts.map