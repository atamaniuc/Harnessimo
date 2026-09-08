// Public API, for a project that wants a rule inside its own test suite rather
// than only at the command line.
export { checkTarget, findMarkers, isSyntaxExample, verifyProofs } from "./proof.js";
export { checkTracks, checkHandoffRefs, liveTrackSpecDirs, trackLines } from "./tracks.js";
export { checkTaskGate, verifyTaskGates, taskBlocks } from "./tasks.js";
export { readiness, doneness, formatViolations } from "./readiness.js";
export { activate, checkQueue, verifyItem, formatStatus, findItem, HarnessError } from "./queue.js";
export { lockedViolations, formatLockedViolations } from "./locked.js";
export { coldStartProblems } from "./coldstart.js";
export { debrisProblems, progressProblems, instructionProblems, DEFAULT_MARKERS } from "./cleanexit.js";
export { hookScript, hookStatus, HOOK_PATH, HOOKS_DIR } from "./hooks.js";
export { briefText, briefJson, handoffPaths, mergeSessionStartHook, sectionOf } from "./brief.js";
export { loadConfig, enabledChecks, ConfigError } from "./config.js";
export { createResolver, collectDocs, collectFiles, readAll } from "./resolver.js";
//# sourceMappingURL=index.js.map