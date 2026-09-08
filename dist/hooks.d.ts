export declare const HOOK_PATH = ".githooks/pre-commit";
export declare const HOOKS_DIR = ".githooks";
/**
 * @param extraCommands  project commands to run before the harness
 *                                  gates, e.g. a content validator
 */
export declare function hookScript(extraCommands?: string[]): string;
/**
 * What `hooks status` reports. Kept pure so the states are testable without a
 * git repository: the interesting one is "the file exists but git is not
 * looking at it", which is how a hook silently stops running.
 *
 */
export declare function hookStatus({ hookExists, hooksPath }: {
    hookExists: boolean;
    hooksPath: string | null;
}): {
    ok: boolean;
    message: string;
};
//# sourceMappingURL=hooks.d.ts.map