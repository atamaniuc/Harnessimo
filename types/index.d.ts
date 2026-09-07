// Type declarations for Harnessimo's public API.
//
// The implementation is plain JavaScript with JSDoc; these declarations are what
// a TypeScript consumer compiles against. They are written by hand and checked
// by the consumers rather than by a build step here, because installing
// TypeScript to type-check a zero-dependency package would break the property
// that makes its cold-start test meaningful: `npm test` on a clean checkout,
// with no install at all.

export interface Problem {
  file: string;
  line: number;
  target: string;
  reason: string;
}

/**
 * How a rule reaches the world. Everything above this interface is pure, so a
 * caller can resolve against a real repository, a fixture tree, or an in-memory
 * object.
 */
export interface Resolver {
  fileExists(path: string): boolean;
  readFile(path: string): string;
  /** Names the given runner declares (`make`, `task`, `npm run`…), or null when the project declares none. */
  commandNames(kind: string): string[] | null;
  /** Migration filenames, or null when the project declares no migrations directory. */
  migrationNames(): string[] | null;
}

export interface Violation {
  what: string;
  why: string;
  fix: string;
}

export interface QueueItem {
  id: string;
  kind?: string;
  behavior: string;
  verification: string;
  state: string;
  evidence: string | null;
  depends_on?: string[];
  [key: string]: unknown;
}

export interface FeatureList {
  wip_limit?: number;
  review_queue_limit?: number;
  items: QueueItem[];
  [key: string]: unknown;
}

// ---- proof markers

export function checkTarget(target: string, resolver: Resolver): string | null;
export function isSyntaxExample(target: string): boolean;
export function findMarkers(text: string): { line: number; target: string }[];
export function verifyProofs(
  files: { path: string; text: string }[],
  resolver: Resolver,
  options?: { strict?: boolean; mustCarryProof?: string[] },
): Problem[];

// ---- work tracks (handoff-driven development)

export function trackLines(text: string): { line: number; text: string }[];
export function checkTracks(text: string, resolver: Resolver, filePath?: string): Problem[];
export function checkHandoffRefs(
  text: string,
  resolver: Resolver,
  filePath: string,
  log?: string,
): Problem[];
export function liveTrackSpecDirs(tracksText: string, specsDir?: string): string[];

// ---- the task gate

export function taskBlocks(text: string): { startLine: number; text: string }[];
export function checkTaskGate(text: string, filePath: string, resolver: Resolver): Problem[];
export function verifyTaskGates(
  files: { path: string; text: string }[],
  tracksText: string,
  resolver: Resolver,
  options?: { specsDir?: string; taskFile?: string },
): Problem[];

// ---- Definition of Ready and Done

export function readiness(item: QueueItem, all: QueueItem[]): Violation[];
export function doneness(item: QueueItem, verificationPassed: boolean): Violation[];
export function formatViolations(id: string, violations: Violation[]): string;

// ---- the queue

export class HarnessError extends Error {
  constructor(what: string, fix: string);
  what: string;
  fix: string;
}
export function findItem(list: FeatureList, id: string): QueueItem;
export function formatStatus(list: FeatureList): string;
export function activate(list: FeatureList, id: string): QueueItem;
export function verifyItem(
  list: FeatureList,
  id: string,
  runner: (command: string) => { ok: boolean; output: string },
  options?: { terminalByKind?: Record<string, string> },
): { item: QueueItem; ok: boolean; output: string };
export function checkQueue(
  list: FeatureList,
  options?: { reverify?: boolean; runner?: (command: string) => { ok: boolean; output: string } },
): string[];

// ---- locked surfaces

export function lockedViolations(
  commits: { sha: string; message: string; files: string[] }[],
  config: { paths: string[]; agentTrailer: string; exempt?: Set<string> },
): { sha: string; hits: string[] }[];
export function formatLockedViolations(violations: { sha: string; hits: string[] }[]): string;

// ---- cold start

export function coldStartProblems(
  input: { requiredFiles: string[]; escapes: { path: string; text: string }[] },
  exists: (path: string) => boolean,
): string[];

// ---- clean state

export const DEFAULT_MARKERS: string[];
export function debrisProblems(
  files: { path: string; text: string }[],
  options?: { markers?: string[]; allow?: string[] },
): Problem[];
export function progressProblems(input: {
  changed: string[];
  progressFile: string | null;
  codePrefixes?: string[];
  changedLines?: Record<string, number> | null;
  threshold?: number;
}): Problem[];
export function instructionProblems(
  files: { path: string; text: string }[],
  limits: Record<string, number>,
): Problem[];

// ---- configuration and the filesystem edge

export class ConfigError extends Error {}
export function loadConfig(root?: string): Record<string, any>;
export function enabledChecks(config: Record<string, any>): Record<string, boolean>;
export function createResolver(root: string, docs?: Record<string, any>): Resolver;
export function collectDocs(root: string, docs: Record<string, any>): string[];
export function collectFiles(
  root: string,
  options: { scan: string[]; skip?: string[]; maxDepth?: number },
): string[];
export function readAll(root: string, paths: string[]): { path: string; text: string }[];
