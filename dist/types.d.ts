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
    hooks?: HooksConfig;
}
/** Which checks a configuration turns on. */
export type EnabledChecks = Record<"proof" | "tracks" | "tasks" | "queue" | "locked" | "coldStart" | "cleanExit" | "instructions", boolean>;
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
}
/** One entry in Claude Code's SessionStart hook array. */
export interface SessionStartEntry {
    hooks?: {
        type?: string;
        command?: string;
        timeout?: number;
        statusMessage?: string;
    }[];
    [key: string]: unknown;
}
/** The subset of an agent settings file this package touches. */
export interface AgentSettings {
    /** Every hook array the file declares, keyed by event. Others are left untouched. */
    hooks?: {
        SessionStart?: SessionStartEntry[];
        [event: string]: SessionStartEntry[] | undefined;
    };
    [key: string]: unknown;
}
/**
 * What `init` writes: a configuration built section by section from what the
 * repository already has, plus the schema pointer an editor follows.
 */
export type DetectedConfig = {
    $schema: string;
} & {
    [K in keyof Omit<LoadedConfig, "root" | "path">]?: Partial<NonNullable<LoadedConfig[K]>>;
};
//# sourceMappingURL=types.d.ts.map