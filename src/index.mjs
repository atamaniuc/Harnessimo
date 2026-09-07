// Public API, for a project that wants a rule inside its own test suite rather
// than only at the command line.
export { checkTarget, findMarkers, isSyntaxExample, verifyProofs } from "./proof.mjs";
export { checkTracks, checkHandoffRefs, liveTrackSpecDirs, trackLines } from "./tracks.mjs";
export { checkTaskGate, verifyTaskGates, taskBlocks } from "./tasks.mjs";
export { readiness, doneness, formatViolations } from "./readiness.mjs";
export { activate, checkQueue, verifyItem, formatStatus, findItem, HarnessError } from "./queue.mjs";
export { lockedViolations, formatLockedViolations } from "./locked.mjs";
export { coldStartProblems } from "./coldstart.mjs";
export { debrisProblems, progressProblems, instructionProblems, DEFAULT_MARKERS } from "./cleanexit.mjs";
export { hookScript, hookStatus, HOOK_PATH, HOOKS_DIR } from "./hooks.mjs";
export { loadConfig, enabledChecks, ConfigError } from "./config.mjs";
export { createResolver, collectDocs, collectFiles, readAll } from "./resolver.mjs";
