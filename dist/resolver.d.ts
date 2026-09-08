import type { DocsConfig, Resolver } from "./types.ts";
export declare function createResolver(root: string, docs?: Pick<Partial<DocsConfig>, "commands" | "migrations">): Resolver;
/**
 * Every Markdown document the gate should read, from the configured roots.
 *
 * Returns repo-relative paths, sorted.
 */
export declare function collectDocs(root: string, docs: {
    roots: string[];
    skip: string[];
    maxDepth: number;
}): string[];
/**
 * Every file under the configured prefixes, whatever its extension — the
 * clean-state check reads code, not only documents.
 *
 * Returns repo-relative paths, sorted.
 */
export declare function collectFiles(root: string, { scan, skip, maxDepth }: {
    scan: string[];
    skip?: string[];
    maxDepth?: number;
}): string[];
/** @param root @param paths */
export declare function readAll(root: string, paths: string[]): {
    path: string;
    text: string;
}[];
//# sourceMappingURL=resolver.d.ts.map