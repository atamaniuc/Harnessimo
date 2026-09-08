import type { EnabledChecks, LoadedConfig } from "./types.ts";
export declare const CONFIG_FILE = "harnessimo.config.json";
export declare class ConfigError extends Error {
}
/**
 */
export declare function loadConfig(root?: string): LoadedConfig;
/** Which checks this configuration turns on, for `harnessimo doctor`. */
export declare function enabledChecks(config: LoadedConfig): EnabledChecks;
//# sourceMappingURL=config.d.ts.map