// Configuration: what this repository asked the harness to enforce.
//
// Every section is optional, and an absent section means that check does not
// run. That is deliberate and it is why `harnessimo doctor` exists: a project
// adopts the checks it can actually satisfy today, and the tool reports which
// ones are live rather than implying all of them are. Claiming enforcement
// that does not exist is worse than claiming none — it stops anyone from
// looking for the missing check.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { EnabledChecks, LoadedConfig } from "./types.ts";

export const CONFIG_FILE = "harnessimo.config.json";

/** Defaults applied to a section the project declared but left partly blank. */
const SECTION_DEFAULTS = {
  docs: {
    roots: [".", "docs", "specs"],
    skip: ["node_modules", ".git", ".next", "dist", "build", "coverage", "vendor"],
    maxDepth: 4,
    mustCarryProof: [],
    commands: {},
    migrations: null,
  },
  tracks: { file: "specs/TRACKS.md", log: "specs/TRACKS-LOG.md", specsDir: "specs", taskFile: "tasks.md", gateTasks: true },
  queue: { file: ".harness/4-state/feature_list.json", timeoutMinutes: 10, terminalByKind: { content: "awaiting_gates" } },
  locked: { paths: [], baseline: ".harness/3-environment/locked-baseline", agentTrailer: "Co-Authored-By: Claude" },
  coldStart: { requiredFiles: [], entryDocs: [], commands: [] },
  cleanExit: {
    markers: null, // null means the module's defaults
    allow: [],
    scan: [],
    progressFile: ".harness/4-state/PROGRESS.md", // null turns the progress rule off
    codePrefixes: [],
    progressThreshold: 50, // changed lines below which the progress rule stays quiet
    requireCleanTree: false,
  },
  instructions: { limits: {} },
  release: { manifest: "package.json", changelog: "CHANGELOG.md", tagPrefix: "v" },
  // The read guard (spec 0004). Not a check: it fires while the work happens,
  // and `doctor` lists it apart from the nine for exactly that reason.
  tokens: { windowMinutes: 20, statePath: ".harness/3-environment/.reads.json" },
  // How much a run was watched (spec 0007). A floor, not a setting: `check`
  // runs at this level or higher, and --autonomy can only raise it.
  autonomy: { level: "watched" },
  hooks: { before: [] }, // project commands the pre-commit hook runs before the gates
};

export class ConfigError extends Error {}

/**
 */
export function loadConfig(root: string = process.cwd()): LoadedConfig {
  const path = join(root, CONFIG_FILE);
  if (!existsSync(path)) {
    return { root, path: null };
  }
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch (error) {
    throw new ConfigError(
      `${CONFIG_FILE} is not valid JSON: ${(error as Error).message}\n` +
        `  fix:  a harness that cannot read its own configuration must fail loudly, not silently skip every check`,
    );
  }
  // The merge is the one place this file is dynamic: sections are data, and a
  // per-section branch would be eight copies of the same three lines. The cast
  // is confined to the assignment, and the shape it produces is LoadedConfig.
  const config: Record<string, unknown> = { root, path };
  for (const [section, defaults] of Object.entries(SECTION_DEFAULTS) as [string, Record<string, unknown>][]) {
    if (raw[section] === undefined) continue;
    if (raw[section] === null || typeof raw[section] !== "object") {
      throw new ConfigError(`${CONFIG_FILE}: "${section}" must be an object`);
    }
    // A per-section "$comment" is documentation, not configuration: a project
    // explaining why it chose a setting should not have to explain it
    // somewhere else.
    const declared = Object.fromEntries(
      Object.entries(raw[section] as Record<string, unknown>).filter(([k]) => !k.startsWith("$")),
    );
    const unknownKeys = Object.keys(declared).filter((k) => !(k in defaults));
    if (unknownKeys.length > 0) {
      throw new ConfigError(
        `${CONFIG_FILE}: unknown key(s) ${unknownKeys.join(", ")} in "${section}"\n` +
          `  why:  a misspelled key silently keeps the default, which is the failure this rejects\n` +
          `  fix:  known keys are ${Object.keys(defaults).join(", ")}`,
      );
    }
    config[section] = { ...defaults, ...declared };
  }
  const unknown = Object.keys(raw).filter((k) => !k.startsWith("$") && !(k in SECTION_DEFAULTS));
  if (unknown.length > 0) {
    throw new ConfigError(
      `${CONFIG_FILE}: unknown section(s) ${unknown.join(", ")}\n` +
        `  why:  a typo in a section name silently disables a check, which is the failure this rejects\n` +
        `  fix:  known sections are ${Object.keys(SECTION_DEFAULTS).join(", ")}`,
    );
  }
  return config as unknown as LoadedConfig;
}

/** Which checks this configuration turns on, for `harnessimo doctor`. */
export function enabledChecks(config: LoadedConfig): EnabledChecks {
  return {
    proof: Boolean(config.docs),
    tracks: Boolean(config.tracks),
    tasks: Boolean(config.tracks?.gateTasks),
    queue: Boolean(config.queue),
    locked: Boolean(config.locked?.paths?.length),
    coldStart: Boolean(config.coldStart?.commands?.length),
    cleanExit: Boolean(config.cleanExit?.scan?.length),
    instructions: Boolean(Object.keys(config.instructions?.limits ?? {}).length),
    release: Boolean(config.release),
  };
}
