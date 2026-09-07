// Configuration: what this repository asked the harness to enforce.
//
// Every section is optional, and an absent section means that check does not
// run. That is deliberate and it is why `harness doctor` exists: a project
// adopts the checks it can actually satisfy today, and the tool reports which
// ones are live rather than implying all of them are. Claiming enforcement
// that does not exist is worse than claiming none — it stops anyone from
// looking for the missing check.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_FILE = "harness.config.json";

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
    progressFile: ".harness/4-state/PROGRESS.md",
    codePrefixes: [],
    requireCleanTree: false,
  },
  instructions: { limits: {} },
};

export class ConfigError extends Error {}

/**
 * @param {string} root
 * @returns {{ root: string, path: string | null, docs?: object, tracks?: object,
 *             queue?: object, locked?: object, coldStart?: object }}
 */
export function loadConfig(root = process.cwd()) {
  const path = join(root, CONFIG_FILE);
  if (!existsSync(path)) {
    return { root, path: null };
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ConfigError(
      `${CONFIG_FILE} is not valid JSON: ${error.message}\n` +
        `  fix:  a harness that cannot read its own configuration must fail loudly, not silently skip every check`,
    );
  }
  const config = { root, path };
  for (const [section, defaults] of Object.entries(SECTION_DEFAULTS)) {
    if (raw[section] === undefined) continue;
    if (raw[section] === null || typeof raw[section] !== "object") {
      throw new ConfigError(`${CONFIG_FILE}: "${section}" must be an object`);
    }
    // A per-section "$comment" is documentation, not configuration: a project
    // explaining why it chose a setting should not have to explain it
    // somewhere else.
    const declared = Object.fromEntries(Object.entries(raw[section]).filter(([k]) => !k.startsWith("$")));
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
  return config;
}

/** Which checks this configuration turns on, for `harness doctor`. */
export function enabledChecks(config) {
  return {
    proof: Boolean(config.docs),
    tracks: Boolean(config.tracks),
    tasks: Boolean(config.tracks?.gateTasks),
    queue: Boolean(config.queue),
    locked: Boolean(config.locked?.paths?.length),
    coldStart: Boolean(config.coldStart?.commands?.length),
    cleanExit: Boolean(config.cleanExit?.scan?.length),
    instructions: Boolean(Object.keys(config.instructions?.limits ?? {}).length),
  };
}
