// Public API, for a project that wants a rule inside its own test suite rather
// than only at the command line.
//
// The types come first because they are half of what a consumer imports, and
// leaving them out is not a compile error here — it is a compile error in their
// repository, which is where it was found: a TypeScript consumer could import
// checkTarget and then had no way to name what it takes.
export type * from "./types.ts";
export { checkTarget, findMarkers, isSyntaxExample, verifyProofs } from "./proof.ts";
export { checkTracks, checkHandoffRefs, liveTrackSpecDirs, staleProblems, trackLines } from "./tracks.ts";
export {
  checkClaims,
  checkDependencies,
  claimProblem,
  closingProblem,
  duplicateNumbers,
  normalize,
  overlaps,
  parseClaims,
  parseDependencies,
} from "./claims.ts";
export type { Claim, LaneClaims, LaneDeps } from "./claims.ts";
export { checkTaskGate, verifyTaskGates, taskBlocks } from "./tasks.ts";
export { readiness, doneness, formatViolations } from "./readiness.ts";
export { activate, checkQueue, verifyItem, formatStatus, findItem, HarnessError } from "./queue.ts";
export { lockedViolations, formatLockedViolations } from "./locked.ts";
export { coldStartProblems } from "./coldstart.ts";
export { debrisProblems, progressProblems, instructionProblems, DEFAULT_MARKERS } from "./cleanexit.ts";
export { boundaryProblems } from "./boundaries.ts";
export { thresholdProblems, unprotectedFloors } from "./thresholds.ts";
export type { BoundaryRule } from "./boundaries.ts";
export { agentGateScript, hookScript, hookStatus, AGENT_GATE_PATH, HOOK_PATH, HOOKS_DIR } from "./hooks.ts";
export { agentContract, briefText, briefJson, handoffPaths, mergeHook, mergeSessionStartHook, sectionOf } from "./brief.ts";
export { changelogVersions, releaseProblems } from "./release.ts";
export { loadConfig, enabledChecks, ConfigError } from "./config.ts";
export { LEVELS, DEFAULT_LEVEL, MEANING, addedBy, effectiveLevel, levelProblem, required, unbacked } from "./autonomy.ts";
export type { Level } from "./autonomy.ts";
export { createResolver, collectDocs, collectFiles, readAll } from "./resolver.ts";
