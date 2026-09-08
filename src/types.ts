// The shapes the rules pass around.
//
// They live in one file because more than one module speaks each of them, and
// because this is the package's published contract: what a TypeScript consumer
// compiles against. When these and the code disagreed — and they did, while the
// contract was a hand-written .d.ts alongside JSDoc — the consumer believed the
// wrong one. There is now a single source, and `tsc` is what keeps it true.

/** One thing that is wrong, phrased for whoever has to fix it. */
export interface Problem {
  file: string;
  line: number;
  target: string;
  reason: string;
}

/**
 * How a rule reaches the world. Every rule above this interface is pure, so a
 * caller can resolve against a real repository, a fixture tree, or an object
 * literal in a test.
 */
export interface Resolver {
  fileExists(path: string): boolean;
  readFile(path: string): string;
  /** Names the given runner declares (`make`, `task`, `npm run`…), or null when the project declares none. */
  commandNames(kind: string): string[] | null;
  /** Migration filenames, or null when the project declares no migrations directory. */
  migrationNames(): string[] | null;
}

/** A readiness or doneness rule that did not hold. */
export interface Violation {
  what: string;
  why: string;
  fix: string;
}

/** One unit of work in the queue, sized to be finished in a session. */
export interface QueueItem {
  id: string;
  kind?: string;
  behavior: string;
  verification: string;
  state: string;
  evidence: string | null;
  depends_on?: string[];
  notes?: string;
  phase?: string;
  /** The tail of what the last failing verification printed, or null once it passes. */
  last_failure?: string | null;
  [key: string]: unknown;
}

/** The queue file: the items, and the limits that keep it a queue. */
export interface FeatureList {
  wip_limit?: number;
  review_queue_limit?: number;
  items: QueueItem[];
  [key: string]: unknown;
}

/** What a rule may ask of a file, and everything `detect` is allowed to do. */
export interface Repo {
  exists(path: string): boolean;
  isDir(path: string): boolean;
  read(path: string): string;
}

/** A file already read into memory, which is what the pure rules take. */
export interface SourceFile {
  path: string;
  text: string;
}

/** The result of running one command, as the queue's verifier sees it. */
export interface RunResult {
  ok: boolean;
  output: string;
}

// ---- configuration
//
// One interface per section of harnessimo.config.json. A section left out is a
// check that does not run, which is why every one of them is optional here and
// why `doctor` exists to say so out loud.

export interface DocsConfig {
  roots: string[];
  skip: string[];
  maxDepth: number;
  mustCarryProof: string[];
  /** Runner name (`make`, `npm run`…) -> the file that declares its commands. */
  commands: Record<string, string>;
  migrations: string | null;
}

export interface TracksConfig {
  file: string;
  log: string;
  specsDir: string;
  taskFile: string;
  gateTasks: boolean;
}

export interface QueueConfig {
  file: string;
  timeoutMinutes: number;
  terminalByKind: Record<string, string>;
}

export interface LockedConfig {
  paths: string[];
  baseline: string;
  agentTrailer: string;
}

export interface ColdStartConfig {
  requiredFiles: string[];
  entryDocs: string[];
  commands: string[];
}

export interface CleanExitConfig {
  /** Null means the module's own defaults. */
  markers: string[] | null;
  allow: string[];
  scan: string[];
  /** Null turns the progress rule off, which is the honest answer for a repository that has no single progress file. */
  progressFile: string | null;
  codePrefixes: string[];
  progressThreshold: number;
  requireCleanTree: boolean;
}

export interface ReleaseConfig {
  /** Where the version being shipped is declared. */
  manifest: string;
  changelog: string;
  /** What a tag for version x.y.z looks like: `v` gives `v1.2.3`. */
  tagPrefix: string;
}

/** The read guard (spec 0004): enforcement while the work happens, not after it. */
export interface TokensConfig {
  /** How long a read is remembered. A session that ran longer is not one session. */
  windowMinutes?: number;
  /** Where the per-session state lives. Never committed: it describes one run. */
  statePath?: string;
}

export interface InstructionsConfig {
  /** Path -> maximum lines. */
  limits: Record<string, number>;
}

export interface HooksConfig {
  /** Project commands the pre-commit hook runs before the gates. */
  before: string[];
}

/** A configuration file, read and merged with the defaults of each declared section. */
export interface LoadedConfig {
  root: string;
  /** Null when the repository has no configuration file at all. */
  path: string | null;
  docs?: DocsConfig;
  tracks?: TracksConfig;
  queue?: QueueConfig;
  locked?: LockedConfig;
  coldStart?: ColdStartConfig;
  cleanExit?: CleanExitConfig;
  instructions?: InstructionsConfig;
  release?: ReleaseConfig;
  tokens?: TokensConfig;
  hooks?: HooksConfig;
}

/** Which checks a configuration turns on. */
export type EnabledChecks = Record<
  | "proof"
  | "tracks"
  | "tasks"
  | "queue"
  | "locked"
  | "coldStart"
  | "cleanExit"
  | "instructions"
  | "release",
  boolean
>;

// ---- session brief

/** A handoff as the brief prints it: where it lives, and what it says. */
export interface Handoff {
  path: string;
  text: string;
}

/**
 * The part of a queue a brief reads. Stated as the minimum rather than as
 * FeatureList so a caller — or a test — can hand over what it has.
 */
export interface BriefQueue {
  wip_limit?: number;
  items: Pick<QueueItem, "id" | "state" | "behavior" | "last_failure">[];
}

/** What a session should be told before it starts working. */
export interface BriefInput {
  /** Contents of the track index. Null or empty when the project has none. */
  tracksText: string | null;
  handoffs?: Handoff[];
  /** The parsed feature list, when the project has a queue. */
  queue?: BriefQueue | null;
  /** The progress file, when the project keeps one. */
  progressText?: string | null;
  /** Which checks are configured, so the brief can say what is *not* enforced. */
  enabled?: Partial<EnabledChecks>;
  tracksPath?: string;
  /**
   * One lane directory, when the brief is being handed to an agent working on
   * that lane alone: its track line and its whole handoff, instead of every
   * lane's.
   */
  focus?: string;
  /** What each live lane declares it is working on. */
  fences?: { lane: string; paths: string[] }[];
}

/** One entry in Claude Code's SessionStart hook array. */
export interface SessionStartEntry {
  hooks?: { type?: string; command?: string; timeout?: number; statusMessage?: string }[];
  [key: string]: unknown;
}

/** The subset of an agent settings file this package touches. */
export interface AgentSettings {
  /** Every hook array the file declares, keyed by event. Others are left untouched. */
  hooks?: { SessionStart?: SessionStartEntry[]; [event: string]: SessionStartEntry[] | undefined };
  [key: string]: unknown;
}

/**
 * What `init` writes: a configuration built section by section from what the
 * repository already has, plus the schema pointer an editor follows.
 */
export type DetectedConfig = { $schema: string } & {
  // Each section is itself partial: detection writes the keys it can see and
  // leaves the rest to the defaults in loadConfig, rather than guessing.
  [K in keyof Omit<LoadedConfig, "root" | "path">]?: Partial<NonNullable<LoadedConfig[K]>>;
};

// ---- token economics (spec 0004)

/** One file, as the read guard remembers it within a session. */
export interface ReadRecord {
  size: number;
  mtimeMs: number;
  /** When it was last read, so a stale entry can be forgotten. */
  at: number;
  reads: number;
  /** Re-reads the guard refused: what the ledger reports as saved. */
  refused?: number;
  /** Re-reads allowed because the caller insisted. Visible on purpose. */
  overrides?: number;
}

/** Everything the guard remembers about one session. Never committed. */
export interface ReadState {
  reads: Record<string, ReadRecord>;
}

/** The verdict on one read, with the reason a person needs to act on it. */
export interface ReadDecision {
  allow: boolean;
  reason: string;
  savedTokens?: number;
  message?: string;
}

/** What a session cost and what it repeated. Every token figure is an estimate. */
export interface ReadLedger {
  files: number;
  reads: number;
  tokensRead: number;
  repeated: number;
  tokensRepeated: number;
  refused: number;
  tokensSaved: number;
  overrides: number;
  largest?: { path: string; tokens: number; reads: number };
}
