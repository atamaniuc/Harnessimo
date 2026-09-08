#!/usr/bin/env node
// The command line. Everything it does is implemented in ../src as pure
// functions; this file is the edge that reads the repository, runs commands,
// and turns problems into exit codes.
//
// One rule shapes the output: a failure is written to be acted on, not just
// read. Each says what failed, why it matters, and what to do — because the
// next person to see it is often a fresh session with no memory of the design,
// and "invalid" leaves them guessing.

import { execFileSync, execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig, enabledChecks, ConfigError, CONFIG_FILE } from "./config.ts";
import { collectDocs, collectFiles, createResolver, readAll } from "./resolver.ts";
import { findMarkers, verifyProofs } from "./proof.ts";
import { checkHandoffRefs, checkTracks, staleProblems, trackLines } from "./tracks.ts";
import {
  checkClaims,
  checkDependencies,
  closingProblem,
  duplicateNumbers,
  parseClaims,
  parseDependencies,
} from "./claims.ts";
import { verifyTaskGates } from "./tasks.ts";
import { liveTrackSpecDirs } from "./tracks.ts";
import {
  HarnessError,
  activate,
  checkQueue,
  formatStatus,
  lastLines,
  verifyItem,
} from "./queue.ts";
import { formatLockedViolations, lockedViolations } from "./locked.ts";
import { coldStartProblems } from "./coldstart.ts";
import { debrisProblems, instructionProblems, progressProblems } from "./cleanexit.ts";
import { releaseProblems } from "./release.ts";
import { boundaryProblems } from "./boundaries.ts";
import { thresholdProblems, unprotectedFloors } from "./thresholds.ts";
import { detectConfig } from "./detect.ts";
import { DEFAULT_LEVEL, MEANING, addedBy, effectiveLevel, levelProblem, required, unbacked } from "./autonomy.ts";
import type { Level } from "./autonomy.ts";
import { AGENT_GATE_PATH, HOOKS_DIR, HOOK_PATH, agentGateScript, hookScript, hookStatus } from "./hooks.ts";
import { agentContract, briefJson, briefText, handoffPaths, mergeHook, mergeSessionStartHook } from "./brief.ts";
import { DEFAULT_WINDOW_MINUTES, decideRead, emptyState, ledger, ledgerReport } from "./tokens.ts";
import {
  fillTemplate,
  findLane,
  indexLine,
  nextNumber,
  outcomeEntry,
  slugProblem,
  withLine,
  withOutcome,
  withoutLane,
} from "./track.ts";
import type {
  ReadState,
  AgentSettings,
  EnabledChecks,
  DocsConfig,
  FeatureList,
  LoadedConfig,
  Problem,
  QueueConfig,
  QueueItem,
  RunResult,
  SourceFile,
} from "./types.ts";

/** What every check function here returns: what is wrong, and one line saying what ran. */
interface CheckResult {
  problems: Problem[];
  summary: string;
}

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = process.cwd();

const args = process.argv.slice(2);
const command = args[0] ?? "help";
const flags = new Set(args.filter((a) => a.startsWith("--")));

/**
 * Flags that take a value, so the value is not mistaken for a positional.
 * `check --autonomy reviewed` read "reviewed" as a filename before this
 * existed, and tried to open it.
 */
const VALUED = new Set(["--autonomy", "--range", "--title", "--outcome", "--track"]);
const positional = (() => {
  const rest: string[] = [];
  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith("--")) {
      if (VALUED.has(arg)) i++;
      continue;
    }
    rest.push(arg);
  }
  return rest;
})();

const ok = (message: string): void => console.log(message);
// Annotated rather than inferred on purpose: TypeScript only treats a call as
// unreachable-after when the callee's type is written down, and half this file
// relies on `die()` ending the branch.
const die: (message: string, code?: number) => never = (message, code = 1) => {
  console.error(message);
  process.exit(code);
};

function config(): LoadedConfig {
  try {
    return loadConfig(ROOT);
  } catch (error) {
    if (error instanceof ConfigError) die(`harnessimo: ${error.message}`);
    throw error;
  }
}

function requireSection<K extends keyof LoadedConfig>(
  cfg: LoadedConfig,
  section: K,
  hint: string,
): NonNullable<LoadedConfig[K]> {
  const value = cfg[section];
  if (!value) {
    die(
      `harnessimo: this repository has no "${section}" section in harnessimo.config.json, so there is nothing to check\n` +
        `  fix:  ${hint}`,
    );
  }
  return value as NonNullable<LoadedConfig[K]>;
}

function formatProblems(problems: Problem[]): string {
  return problems.map((p) => `${p.file}:${p.line}  ${p.target}\n    ${p.reason}`).join("\n");
}

// ---------------------------------------------------------------- runners

/**
 * Runs a verification. stdin is closed so a command that stops to ask a
 * question fails instead of hanging the loop forever, and a hard timeout means
 * a command that never returns is a failure with a stated cause rather than a
 * hang. A harness without a stop condition is not a harness.
 */
function makeRunner(timeoutMinutes: number): (cmd: string) => RunResult {
  return (cmd: string): RunResult => {
    try {
      const output = execSync(cmd, {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: timeoutMinutes * 60 * 1000,
        // A nested harness call degrades to a plain invariant check: without
        // this, an item whose verification runs `harnessimo queue check
        // --reverify` recurses until it is killed.
        env: { ...process.env, HARNESS_REVERIFY: "1" },
      });
      return { ok: true, output };
    } catch (caught) {
      const error = caught as NodeJS.ErrnoException & { signal?: string; stdout?: string; stderr?: string };
      if (error.signal === "SIGTERM") {
        return {
          ok: false,
          output:
            `verification exceeded ${timeoutMinutes} minutes and was killed\n` +
            "  why:  a verification that never returns blocks the loop indefinitely\n" +
            "  fix:  make the command terminate, or split the item into smaller ones",
        };
      }
      return { ok: false, output: [error.stdout, error.stderr, error.message].filter(Boolean).join("\n") };
    }
  };
}

const git = (...argv: string[]): string =>
  execFileSync("git", argv, { cwd: ROOT, encoding: "utf8" }).trim();

// ---------------------------------------------------------------- checks

function runProof({ strict }: { strict?: boolean } = {}): CheckResult {
  const cfg = config();
  const docs = requireSection(cfg, "docs", 'add a "docs" section naming the roots to scan');
  const resolver = createResolver(ROOT, docs);
  const paths = positional.length > 0 ? positional : collectDocs(ROOT, docs);
  const files = readAll(ROOT, paths);
  const problems = verifyProofs(files, resolver, {
    strict: strict || flags.has("--strict"),
    mustCarryProof: docs.mustCarryProof,
  });
  for (const file of files) {
    problems.push(...checkHandoffRefs(file.text, resolver, file.path, cfg.tracks?.log ?? "the track log"));
  }
  const markers = files.reduce((n, f) => n + findMarkers(f.text).length, 0);
  return {
    problems,
    summary: `${markers} proof marker(s) across ${files.length} document(s) all resolve`,
  };
}

function runTracks() {
  const cfg = config();
  const tracks = requireSection(cfg, "tracks", 'add a "tracks" section naming the track index');
  const resolver = createResolver(ROOT, cfg.docs ?? {});
  if (!resolver.fileExists(tracks.file)) {
    return {
      problems: [
        {
          file: tracks.file,
          line: 1,
          target: "(missing)",
          reason: `the track index does not exist — run \`harnessimo init\` or point tracks.file somewhere real`,
        },
      ],
      summary: "",
    };
  }
  const text = resolver.readFile(tracks.file);
  const problems = checkTracks(text, resolver, tracks.file);

  // Spec 0006. Two agents on one repository break what one agent never does.
  // Both rules belong to this check rather than to a tenth: they are about the
  // set of live lanes being coherent, which is what `tracks` already means.
  problems.push(...duplicateNumbers(laneNames(tracks.specsDir), tracks.specsDir));
  const lanes = liveTrackSpecDirs(text, tracks.specsDir).map((lane) => {
    const file = `${lane}/handoff.md`;
    const handoff = resolver.fileExists(file) ? resolver.readFile(file) : "";
    return {
      lane,
      file,
      slug: lane.slice(tracks.specsDir.length + 6),
      claims: parseClaims(handoff),
      deps: parseDependencies(handoff),
    };
  });
  problems.push(...checkClaims(lanes));

  // Spec 0008. Collision is one half of working in parallel; ordering is the
  // other, and it costs rework rather than a merge conflict, which is why
  // nothing was catching it.
  problems.push(...checkDependencies(lanes, laneNames(tracks.specsDir).map((name) => name.slice(5))));

  // Spec 0009. A lane abandoned mid-flight keeps its status and its fence, and
  // neither decays on its own.
  problems.push(
    ...staleProblems(text, {
      today: new Date().toISOString().slice(0, 10),
      afterDays: tracks.staleAfterDays ?? 0,
      filePath: tracks.file,
      claimed: new Set(lanes.filter((lane) => lane.claims.length > 0).map((lane) => lane.lane)),
    }),
  );

  const lines = trackLines(text).length;
  const claimed = lanes.reduce((n, lane) => n + lane.claims.length, 0);
  const fences = claimed > 0 ? `, ${claimed} declared path(s) do not collide` : "";
  return { problems, summary: `${lines} live track(s) in ${tracks.file} resolve and carry a status${fences}` };
}

/** Lane directory names under a specs directory, or none when it does not exist. */
function laneNames(specsDir: string): string[] {
  try {
    return readdirSync(join(ROOT, specsDir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function runBoundaries(): CheckResult {
  const cfg = config();
  const bounds = requireSection(cfg, "boundaries", 'add a "boundaries" section listing the lines the code may not cross');
  if (!bounds.rules.length) return { problems: [], summary: "no boundaries declared, nothing to cross" };
  const paths = collectFiles(ROOT, { scan: bounds.scan ?? ["."], skip: cfg.docs?.skip ?? [] });
  const files = readAll(ROOT, paths);
  const problems = boundaryProblems(files, bounds.rules);
  return {
    problems,
    summary: `${bounds.rules.length} boundary(ies) hold across ${files.length} file(s)`,
  };
}

function runThresholds(): CheckResult {
  const cfg = config();
  const t = requireSection(cfg, "thresholds", 'add a "thresholds" section naming the results and floors files');
  if (!t.floors) return { problems: [], summary: "no floors declared, nothing to hold a score to" };

  const readJson = (path: string): Record<string, unknown> | null => {
    if (!path || !existsSync(join(ROOT, path))) return null;
    try {
      return JSON.parse(readFileSync(join(ROOT, path), "utf8")) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const floors = readJson(t.floors);
  const problems = thresholdProblems({
    results: readJson(t.results),
    floors,
    resultsPath: t.results,
    floorsPath: t.floors,
    command: t.command || undefined,
  });
  const reachable = unprotectedFloors(t.floors, cfg.locked?.paths ?? []);
  if (reachable) problems.push(reachable);

  const measured = Object.keys(floors ?? {}).filter((k) => !k.startsWith("$")).length;
  return { problems, summary: `${measured} metric(s) at or above the floors in ${t.floors}` };
}

function runTasks() {
  const cfg = config();
  const tracks = requireSection(cfg, "tracks", 'add a "tracks" section to gate task lists');
  if (!tracks.gateTasks) return { problems: [], summary: "task gating is off (tracks.gateTasks=false)" };
  const docs: DocsConfig =
    cfg.docs ??
    ({ roots: [tracks.specsDir], skip: [], maxDepth: 3, mustCarryProof: [], commands: {}, migrations: null } satisfies DocsConfig);
  const resolver = createResolver(ROOT, docs);
  if (!resolver.fileExists(tracks.file)) return { problems: [], summary: "no track index, nothing to gate" };
  const tracksText = resolver.readFile(tracks.file);
  const files = readAll(ROOT, collectDocs(ROOT, docs).filter((p) => p.endsWith(`/${tracks.taskFile}`)));
  const problems = verifyTaskGates(files, tracksText, resolver, {
    specsDir: tracks.specsDir,
    taskFile: tracks.taskFile,
  });
  // Count what was actually gated, not what was read. A summary that reports
  // every task list in the repository as "live" overstates the gate's reach —
  // the same defect this tool refuses everywhere else.
  const live = new Set(liveTrackSpecDirs(tracksText, tracks.specsDir));
  const gated = files.filter((f) => live.has(f.path.slice(0, -(tracks.taskFile.length + 1))));
  return {
    problems,
    summary:
      `checked boxes in ${gated.length} live task list(s) name a passing check` +
      (files.length > gated.length ? ` (${files.length - gated.length} closed lane(s) not gated)` : ""),
  };
}

function readQueue(cfg: LoadedConfig & { queue: QueueConfig }): FeatureList {
  const path = join(ROOT, cfg.queue.file);
  if (!existsSync(path)) die(`harnessimo: no queue at ${cfg.queue.file}\n  fix:  run \`harnessimo init\` or point queue.file at the real file`);
  return JSON.parse(readFileSync(path, "utf8")) as FeatureList;
}

function writeQueue(cfg: LoadedConfig & { queue: QueueConfig }, list: FeatureList): void {
  writeFileSync(join(ROOT, cfg.queue.file), JSON.stringify(list, null, 2) + "\n");
}

function runQueueCheck({ reverify }: { reverify?: boolean } = {}): CheckResult {
  const cfg = config();
  if (!cfg.queue) return { problems: [], summary: "no queue configured" };
  const withQueue = cfg as LoadedConfig & { queue: QueueConfig };
  const list = readQueue(withQueue);
  // A nested run degrades to invariants only, for the same reason the runner
  // sets the variable: an item that verifies through the harness would
  // otherwise re-enter this command forever.
  const nested = process.env.HARNESS_REVERIFY === "1";
  const doReverify = reverify && !nested;
  const problems = checkQueue(list, {
    reverify: doReverify,
    runner: makeRunner(withQueue.queue.timeoutMinutes),
  }).map((text) => ({ file: withQueue.queue.file, line: 1, target: "(queue)", reason: text }));
  return {
    problems,
    summary:
      `queue invariants hold` +
      (doReverify ? " (every passing claim re-verified)" : nested ? " (nested run: invariants only)" : ""),
  };
}

/**
 * Clean state at session exit (lecture 12). Scoped to what the session
 * actually changed: a repository adopting this should not be blocked by debris
 * that predates the rule, and the rule is about what a session leaves, not
 * about history.
 */
function runCleanExit(base: string, head: string): CheckResult {
  const cfg = config();
  const clean = requireSection(cfg, "cleanExit", 'add a "cleanExit" section naming what to scan');
  if (!clean.scan.length) return { problems: [], summary: "no paths configured to scan" };
  let changed: string[] = [];
  try {
    changed = git("diff", "--name-only", `${base}..${head}`).split("\n").filter(Boolean);
  } catch {
    return {
      problems: [],
      summary: `cannot resolve ${base}..${head} — unknown revision, or a clone too shallow to hold it; skipped`,
    };
  }
  const inScope = new Set(collectFiles(ROOT, { scan: clean.scan, skip: cfg.docs?.skip ?? [] }));
  const touched = changed.filter((p) => inScope.has(p) && existsSync(join(ROOT, p)));
  const problems = debrisProblems(readAll(ROOT, touched), { markers: clean.markers ?? undefined, allow: clean.allow });
  // Line counts, so the progress rule can stay quiet for a typo fix and speak
  // for a session's worth of work.
  const changedLines: Record<string, number> = {};
  try {
    for (const row of git("diff", "--numstat", `${base}..${head}`).split("\n").filter(Boolean)) {
      const [added, removed, path] = row.split("\t");
      if (path) changedLines[path] = (Number(added) || 0) + (Number(removed) || 0);
    }
  } catch {
    /* leave it empty: the rule then falls back to firing on any code change */
  }
  problems.push(
    ...progressProblems({
      changed,
      progressFile: clean.progressFile,
      codePrefixes: clean.codePrefixes,
      changedLines: Object.keys(changedLines).length > 0 ? changedLines : null,
      threshold: clean.progressThreshold,
    }),
  );
  if (clean.requireCleanTree) {
    const dirty = git("status", "--porcelain").split("\n").filter(Boolean);
    if (dirty.length > 0) {
      problems.push({
        file: "(working tree)",
        line: 1,
        target: `${dirty.length} uncommitted change(s)`,
        reason: "a session ends with its work committed; what is not committed does not exist for the next one",
      });
    }
  }
  return { problems, summary: `${touched.length} changed file(s) carry no debris, and progress is written down` };
}

/** The instruction file, kept a router rather than a manual (lecture 04). */
function runInstructions() {
  const cfg = config();
  const instructions = requireSection(cfg, "instructions", 'add an "instructions" section with per-file line limits');
  const limits = instructions.limits ?? {};
  const paths = Object.keys(limits).filter((p) => existsSync(join(ROOT, p)));
  const problems = instructionProblems(readAll(ROOT, paths), limits);
  return { problems, summary: `${paths.length} instruction file(s) within their line limits` };
}

/**
 * The version claims agree. A version reaches people through the registry, the
 * tags and the changelog, and those go out of step the moment one of them is
 * updated by a path that skips the others — which is how this repository ended
 * up serving 0.4.4 from npm while its own history stopped at v0.4.1.
 */
function runRelease(): CheckResult {
  const cfg = config();
  const release = requireSection(cfg, "release", 'add a "release" section naming the manifest and changelog');
  const manifestPath = join(ROOT, release.manifest);
  const changelogPath = join(ROOT, release.changelog);
  if (!existsSync(manifestPath) || !existsSync(changelogPath)) {
    return {
      problems: [
        {
          file: existsSync(manifestPath) ? release.changelog : release.manifest,
          line: 1,
          target: "(missing)",
          reason: "the release check needs both the manifest and the changelog to exist",
        },
      ],
      summary: "",
    };
  }
  const version = String(
    (JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: string }).version ?? "",
  );
  let tags: string[] = [];
  try {
    tags = git("tag", "--list").split("\n").filter(Boolean);
  } catch {
    /* no tags, or no git: the checks below then report what is untagged */
  }
  const problems = releaseProblems({
    version,
    changelog: readFileSync(changelogPath, "utf8"),
    tags,
    manifestPath: release.manifest,
    changelogPath: release.changelog,
    tagPrefix: release.tagPrefix,
  });
  return {
    problems,
    summary: `version ${version} agrees with ${release.changelog} and the tags`,
  };
}

// ---------------------------------------------------------------- commands

/**
 * The supervision level in force, and where it came from.
 *
 * The repository declares a floor; `--autonomy` and `HARNESSIMO_AUTONOMY` can
 * raise it and cannot lower it. A bar that an unattended run could argue its
 * way under is not a bar.
 */
function resolveLevel(cfg: LoadedConfig): { level: Level; from: string } {
  const declared = cfg.autonomy?.level ?? DEFAULT_LEVEL;
  const badFloor = levelProblem(declared);
  if (badFloor) die(`harnessimo: ${CONFIG_FILE} — ${badFloor}`);

  const fromFlag = flagValue("--autonomy");
  const asked = fromFlag ?? process.env.HARNESSIMO_AUTONOMY;
  if (asked !== undefined) {
    const bad = levelProblem(asked);
    if (bad) die(`harnessimo: ${bad}`);
  }

  const level = effectiveLevel(declared as Level, asked as Level | undefined);
  if (asked && level !== asked) {
    // Said out loud rather than silently ignored: a run that asked for less
    // than the repository allows should know it did not get it.
    ok(`harnessimo: "${asked}" is below this repository's floor of "${declared}" — running at "${level}"`);
  }
  const from = level !== declared ? (fromFlag ? "--autonomy" : "HARNESSIMO_AUTONOMY") : cfg.autonomy ? CONFIG_FILE : "the default";
  return { level, from };
}

function cmdCheck() {
  const cfg = config();
  if (!cfg.path) {
    die(
      "harnessimo: no harnessimo.config.json in this repository\n" +
        "  fix:  run `harnessimo init` to scaffold the harness, or add the config by hand",
    );
  }
  const enabled = enabledChecks(cfg);
  const { level, from } = resolveLevel(cfg);

  // Spec 0007. A run that says nobody watched it, in a repository that cannot
  // run the checks that claim depends on, is an unsupervised run with nothing
  // behind the claim — and a green report there means less than it looks like.
  const gaps = unbacked(level, enabled);
  if (gaps.length > 0) {
    ok(`  FAIL  supervision level "${level}" (from ${from})`);
    ok(formatProblems(gaps).replace(/^/gm, "    "));
    ok(`\nharnessimo: ${gaps.length} problem(s).`);
    process.exit(1);
  }

  // What the level requires, minus what this repository has not configured.
  // Leaving a section out is still a check that does not run — `doctor` says
  // so, and the level does not quietly turn it into an error.
  const { checks, reverify } = required(level);
  const runs = new Set(checks.filter((name) => enabled[name]));
  const [base, head] = (flagValue("--range") ?? "HEAD~1..HEAD").split("..");

  ok(`harnessimo: ${level} — ${MEANING[level]}\n`);
  const results: [string, CheckResult][] = [];
  if (runs.has("proof")) results.push(["proof markers", runProof({ strict: true })]);
  if (runs.has("tracks")) results.push(["work tracks", runTracks()]);
  if (runs.has("tasks")) results.push(["task gate", runTasks()]);
  if (runs.has("queue")) results.push(["queue", runQueueCheck({ reverify: reverify || flags.has("--reverify") })]);
  if (runs.has("instructions")) results.push(["instructions", runInstructions()]);
  if (runs.has("boundaries")) results.push(["boundaries", runBoundaries()]);
  if (runs.has("thresholds")) results.push(["thresholds", runThresholds()]);
  if (runs.has("release")) results.push(["release", runRelease()]);
  if (runs.has("locked")) results.push(["locked surfaces", runLocked(base || "HEAD~1", head || "HEAD")]);
  if (runs.has("cleanExit")) results.push(["clean state", runCleanExit(base || "HEAD~1", head || "HEAD")]);
  if (runs.has("coldStart")) results.push(["cold start", runColdStart()]);

  let failed = 0;
  for (const [name, result] of results) {
    if (result.problems.length === 0) {
      ok(`  ok    ${name.padEnd(14)} ${result.summary}`);
    } else {
      failed += result.problems.length;
      // One stream for the whole report. Split across stdout and stderr, the
      // two buffers interleave under a log collector and a problem prints
      // under a different check's name — a report that lies about which rule
      // failed is worse than no report. The exit code carries the failure.
      ok(`  FAIL  ${name}`);
      ok(formatProblems(result.problems).replace(/^/gm, "    "));
    }
  }
  if (failed > 0) {
    ok(`\nharnessimo: ${failed} problem(s).`);
    process.exit(1);
  }
  ok(`\nharnessimo: every check required at "${level}" passes.`);
}

function cmdDoctor() {
  const cfg = config();
  if (!cfg.path) die("harnessimo: no harnessimo.config.json here.\n  fix:  run `harnessimo init`");
  const enabled = enabledChecks(cfg);
  const version = /"version":\s*"([^"]+)"/.exec(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8"))?.[1] ?? "unknown";
  const { from } = resolveLevel(cfg);
  ok(`harnessimo ${version} — ${cfg.path}\n`);
  ok("what this repository has asked to be enforced:\n");
  const rows: [string, boolean, string][] = [
    ["proof markers", enabled.proof, "docs claims resolve to real files, tests and commands"],
    ["work tracks", enabled.tracks, "the track index resolves and every track carries a status"],
    ["task gate", enabled.tasks, "a checked box names a check that passes"],
    ["queue", enabled.queue, "state moves only through a passing verification"],
    ["locked surfaces", enabled.locked, "the files defining success are out of the agent's reach"],
    ["cold start", enabled.coldStart, "a fresh clone runs from the repository alone"],
    ["clean exit", enabled.cleanExit, "a session leaves no debris and writes down where it got to"],
    ["instructions", enabled.instructions, "the instruction file stays a router, not a manual"],
    ["boundaries", enabled.boundaries, "a pattern the code may not use lives nowhere it is banned from"],
    ["thresholds", enabled.thresholds, "a scored metric stays at or above the floor declared for it"],
    ["release", enabled.release, "the version agrees across the manifest, the changelog and the tags"],
  ];
  // Spec 0007. "Enforced" alone was half the answer: a check can be configured
  // and still not run, because the level this repository declares does not ask
  // for it yet. Saying which is the same honesty the rest of this command is for.
  const { level } = resolveLevel(cfg);
  const { checks: at } = required(level);
  const running = new Set(at);
  const key = new Map<string, keyof EnabledChecks>([
    ["proof markers", "proof"], ["work tracks", "tracks"], ["task gate", "tasks"], ["queue", "queue"],
    ["locked surfaces", "locked"], ["cold start", "coldStart"], ["clean exit", "cleanExit"],
    ["instructions", "instructions"], ["boundaries", "boundaries"], ["release", "release"],
  ]);
  for (const [name, on, what] of rows) {
    const check = key.get(name)!;
    const state = !on ? "not set  " : running.has(check) ? "enforced " : "above    ";
    ok(`  ${state} ${name.padEnd(16)} ${what}`);
  }
  ok(
    `\n  supervision: "${level}" (from ${from}) — ${MEANING[level]}.` +
      (level === "unattended"
        ? "\n  Everything this repository configures runs at this level."
        : `\n  "above" means configured, and asked for only at a higher level;` +
          ` \`check --autonomy\` raises the bar, never lowers it.`),
  );
  // Listed apart, and after a blank line, because it is not a tenth check: the
  // nine answer "is this finished", and this one fires while the work happens.
  // Printing it in the same list would be the overstatement `doctor` exists to
  // avoid.
  ok(
    `\n  ${cfg.tokens ? "enforced " : "not set  "} read guard       ` +
      "a re-read of an unchanged file is refused; `harnessimo budget` reports the cost",
  );

  const off = rows.filter(([, on]) => !on).length;
  ok(
    off === 0
      ? "\nEvery check this tool offers is live here."
      : `\n${off} check(s) are not configured. That is a choice, not a failure — but it is` +
          "\nthe honest reading of what this repository actually enforces.",
  );
}

function cmdQueue() {
  const cfg = config();
  requireSection(cfg, "queue", 'add a "queue" section naming the feature list');
  const withQueue = cfg as LoadedConfig & { queue: QueueConfig };
  const sub = positional[0] ?? "status";
  const id = positional[1];
  const list = readQueue(withQueue);
  try {
    if (sub === "status") return ok(formatStatus(list));
    if (sub === "activate") {
      if (!id) die("harnessimo: `harnessimo queue activate <id>` needs an id");
      const item = activate(list, id);
      writeQueue(withQueue, list);
      return ok(`active: ${id}\n  ${item.behavior}\n  verify with: harnessimo queue verify ${id}`);
    }
    if (sub === "verify") {
      if (!id) die("harnessimo: `harnessimo queue verify <id>` needs an id");
      const runner = makeRunner(withQueue.queue.timeoutMinutes);
      const before = list.items.find((i) => i.id === id);
      ok(`running: ${before?.verification}\n`);
      const { item, ok: passed, output } = verifyItem(list, id, runner, {
        terminalByKind: withQueue.queue.terminalByKind,
      });
      writeQueue(withQueue, list);
      if (!passed) {
        console.error(output);
        die(`harnessimo: "${id}" failed verification and is now blocked\n  fix:  fix the cause, then verify again; do not edit state by hand`);
      }
      ok(output);
      return ok(`${id} -> ${item.state}`);
    }
    if (sub === "check") {
      const result = runQueueCheck({ reverify: flags.has("--reverify") });
      if (result.problems.length > 0) die(formatProblems(result.problems));
      return ok(`harnessimo: ${result.summary}`);
    }
    die(`harnessimo: unknown queue subcommand "${sub}" (status | activate | verify | check)`);
  } catch (error) {
    if (error instanceof HarnessError) die(`harnessimo: ${error.message}`);
    throw error;
  }
}

function runLocked(base: string, head: string): CheckResult {
  const cfg = config();
  const locked = requireSection(cfg, "locked", 'add a "locked" section listing the paths that define success');
  if (!locked.paths.length) return { problems: [], summary: "no locked paths configured, nothing to protect" };
  let shas: string[] = [];
  try {
    shas = git("rev-list", `${base}..${head}`).split("\n").filter(Boolean);
  } catch {
    return { problems: [], summary: `cannot list commits ${base}..${head} (shallow clone?); skipped` };
  }
  const exempt = new Set<string>();
  const baselinePath = join(ROOT, locked.baseline);
  if (existsSync(baselinePath)) {
    const baseline = readFileSync(baselinePath, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#"));
    if (baseline) {
      for (const sha of shas) {
        try {
          execFileSync("git", ["merge-base", "--is-ancestor", sha, baseline], { cwd: ROOT, stdio: "ignore" });
          exempt.add(sha);
        } catch {
          /* not an ancestor: enforcement applies */
        }
      }
    }
  }
  const commits = shas.map((sha) => ({
    sha,
    message: git("log", "-1", "--format=%B", sha),
    files: git("diff-tree", "--no-commit-id", "--name-only", "-r", sha).split("\n").filter(Boolean),
  }));
  const violations = lockedViolations(commits, {
    paths: locked.paths,
    agentTrailer: locked.agentTrailer,
    exempt,
  });
  const problems = violations.map((violation) => ({
    file: violation.hits[0] ?? locked.paths[0]!,
    line: 1,
    target: violation.sha.slice(0, 8),
    reason: formatLockedViolations([violation]),
  }));
  return { problems, summary: `locked surfaces intact across ${commits.length} commit(s)` };
}

function runColdStart(): CheckResult {
  const cfg = config();
  const cold = requireSection(cfg, "coldStart", 'add a "coldStart" section listing the commands a newcomer runs');
  if (!cold.commands.length) return { problems: [], summary: "no cold-start commands configured" };
  const work = mkdtempSync(join(tmpdir(), "harness-cold-"));
  const clone = join(work, "clone");
  try {
    ok(`cold start: cloning HEAD into ${clone}`);
    execFileSync("git", ["clone", "--quiet", ROOT, clone], { stdio: "inherit" });
    const problems = coldStartProblems(
      {
        requiredFiles: cold.requiredFiles,
        escapes: cold.entryDocs
          .filter((p) => existsSync(join(clone, p)))
          .map((p) => ({ path: p, text: readFileSync(join(clone, p), "utf8") })),
      },
      (p) => existsSync(join(clone, p)),
    );
    if (problems.length > 0) {
      return {
        problems: problems.map((problem) => ({
          file: cold.requiredFiles[0] ?? "the repository",
          line: 1,
          target: "(cold start)",
          reason: `${problem}\n    why:  every session after the first arrives fresh, and this is what it sees`,
        })),
        summary: "",
      };
    }
    for (const cmd of cold.commands) {
      ok(`cold start: ${cmd}`);
      execSync(cmd, { cwd: clone, stdio: ["ignore", "ignore", "inherit"] });
    }
    return { problems: [], summary: "a fresh clone installs and verifies from the repository alone" };
  } catch (caught) {
    const error = caught as { status?: number };
    if (error?.status === undefined) throw caught;
    return {
      problems: [
        {
          file: "harnessimo.config.json",
          line: 1,
          target: "coldStart.commands",
          reason: `a documented command exited ${error.status} in a fresh clone of this repository`,
        },
      ],
      summary: "",
    };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function cmdInit() {
  const force = flags.has("--force");
  const templates = join(PACKAGE_ROOT, "templates");
  const written = [];
  const skipped = [];

  // Everything except the configuration comes from the templates: the five
  // subsystems, the track index, the spec and handoff shapes.
  cpSync(templates, ROOT, {
    recursive: true,
    force,
    filter: (src, dest) => {
      if (statSync(src).isDirectory()) return true;
      const rel = dest.slice(ROOT.length + 1);
      // The configuration is written from this repository, not copied.
      if (rel === CONFIG_FILE) return false;
      // An existing file is never overwritten without --force: adopting the
      // harness must not silently rewrite rules a project already wrote.
      if (!force && existsSync(dest)) {
        skipped.push(rel);
        return false;
      }
      written.push(rel);
      return true;
    },
  });

  // The configuration is detected rather than templated. A template full of
  // paths the reader has to correct is how adoption stalls: the first run fails
  // on five settings nobody chose, and the honest response is to turn the tool
  // off.
  const configPath = join(ROOT, CONFIG_FILE);
  let detected = null;
  if (existsSync(configPath) && !force) {
    skipped.push(CONFIG_FILE);
  } else {
    detected = detectConfig({
      exists: (p) => existsSync(join(ROOT, p)),
      isDir: (p) => existsSync(join(ROOT, p)) && statSync(join(ROOT, p)).isDirectory(),
      read: (p) => readFileSync(join(ROOT, p), "utf8"),
    });
    writeFileSync(configPath, JSON.stringify(detected.config, null, 2) + "\n");
    written.push(CONFIG_FILE);
  }

  ok(`harnessimo init: wrote ${written.length} file(s)`);
  for (const f of written) ok(`  + ${f}`);
  if (skipped.length > 0) {
    ok(`\nkept ${skipped.length} existing file(s) (pass --force to overwrite):`);
    for (const f of skipped) ok(`  = ${f}`);
  }

  if (detected) {
    ok(`\nconfigured from what this repository has:`);
    for (const line of detected.found) ok(`  on   ${line}`);
    if (detected.missing.length > 0) {
      ok(`\nleft off, and why — these are gaps, not failures:`);
      for (const line of detected.missing) ok(`  off  ${line}`);
    }
  }

  ok(
    "\nnext:\n" +
      "  1. rewrite .harness/1-instructions/CONSTRAINTS.md with your real rules\n" +
      "  2. run `harnessimo doctor` to see what is enforced\n" +
      "  3. run `harnessimo check` and wire it into CI",
  );
}

/**
 * The local half of the gate. Installing writes a hook into the repository and
 * points git at it, so the hook is a reviewed file everyone gets rather than a
 * local artifact each person has to be told about.
 */
/**
 * What a session should read before it does anything: the live tracks, the head
 * of each handoff, what is in flight, and what this repository actually
 * enforces. A rule saying "load the handoff first" depends on the reader
 * remembering it; this hands it over whether they do or not.
 */
function cmdBrief() {
  const cfg = config();
  const read = (p: string): string | null =>
    existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : null;

  const tracksPath = cfg.tracks?.file ?? "specs/TRACKS.md";
  const tracksText = read(tracksPath);
  const handoffs = tracksText
    ? handoffPaths(tracksText)
        .filter((p) => existsSync(join(ROOT, p)))
        .map((p) => ({ path: p, text: readFileSync(join(ROOT, p), "utf8") }))
    : [];

  let queue = null;
  if (cfg.queue?.file) {
    const raw = read(cfg.queue.file);
    if (raw) {
      try {
        queue = JSON.parse(raw);
      } catch {
        /* a broken queue file is the check's problem, not the brief's */
      }
    }
  }

  // What every live lane says it is working on, so a brief can print the fence
  // as well as the work. Read from the handoffs, which is where a claim lives
  // and dies with the lane.
  const specsDir = cfg.tracks?.specsDir ?? "specs";
  const fences = (tracksText ? liveTrackSpecDirs(tracksText, specsDir) : []).map((lane) => ({
    lane,
    paths: parseClaims(read(`${lane}/handoff.md`) ?? "").map((claim) => claim.path),
  }));

  const briefLevel = cfg.path ? resolveLevel(cfg).level : "watched";

  // `--track` narrows the brief to one lane: the unit handed to a second agent.
  let focus: string | undefined;
  const wanted = flagValue("--track");
  if (wanted !== undefined) {
    if (!wanted || wanted.startsWith("--")) die("harnessimo: usage — `harnessimo brief --track <slug>`");
    const lanes = fences.map((f) => f.lane);
    focus = lanes.find((lane) => lane === wanted || lane.slice(specsDir.length + 6) === wanted);
    if (!focus) {
      die(
        `harnessimo: no live track named "${wanted}"\n` +
          (lanes.length > 0
            ? `  fix:  one of ${lanes.map((l) => l.slice(specsDir.length + 6)).join(", ")}`
            : `  fix:  ${tracksPath} lists no live track with a handoff`),
      );
    }
  }

  // A scoped brief carries the lanes this one is built on, as heads: an agent
  // writing against a moving interface is the cost ordering exists to avoid.
  let scoped = handoffs;
  if (focus) {
    const mine = handoffs.filter((h) => h.path.startsWith(`${focus}/`));
    const waits = new Set(mine.flatMap((h) => parseDependencies(h.text).map((d) => d.path)));
    scoped = [
      ...mine,
      ...handoffs
        .filter((h) => !h.path.startsWith(`${focus}/`) && waits.has(h.path.split("/")[1]?.slice(5) ?? ""))
        .map((h) => ({ ...h, head: true })),
    ];
  }

  const text = briefText({
    tracksText,
    handoffs: scoped,
    queue,
    progressText: cfg.cleanExit?.progressFile ? read(cfg.cleanExit.progressFile) : null,
    enabled: cfg.path ? enabledChecks(cfg) : {},
    tracksPath,
    focus,
    fences,
    supervision: cfg.path ? { level: briefLevel, meaning: MEANING[briefLevel] } : undefined,
  });

  if (flags.has("--json")) {
    // Claude Code reads a SessionStart hook's stdout as JSON.
    return ok(JSON.stringify(briefJson(text)));
  }
  return ok(text || "harnessimo: nothing to brief — no track index, queue or progress file configured");
}

function cmdHooks() {
  const sub = positional[0] ?? "status";
  const cfg = config();
  const hookFile = join(ROOT, HOOK_PATH);
  const currentPath = () => {
    try {
      return git("config", "--get", "core.hooksPath") || null;
    } catch {
      return null;
    }
  };

  if (sub === "status") {
    const status = hookStatus({ hookExists: existsSync(hookFile), hooksPath: currentPath() });
    if (!status.ok) die(`harnessimo: ${status.message}`);
    return ok(`harnessimo: ${status.message}`);
  }

  if (sub === "install" && flags.has("--agent")) {
    // The agent-side hook: a session receives the harness state at startup
    // instead of being trusted to go and read it.
    const dir = join(ROOT, ".claude", "hooks");
    const script = join(dir, "harnessimo-brief.sh");
    const command = "$CLAUDE_PROJECT_DIR/.claude/hooks/harnessimo-brief.sh";
    mkdirSync(dir, { recursive: true });
    if (!existsSync(script) || flags.has("--force")) {
      writeFileSync(
        script,
        [
          "#!/usr/bin/env sh",
          "# Prints the harness state as SessionStart additionalContext.",
          "# Written by `harnessimo hooks install --agent`. Read-only: no writes,",
          "# no network, safe on startup, resume, clear and compact.",
          "set -e",
          'cd "${CLAUDE_PROJECT_DIR:-.}"',
          "if [ -x node_modules/.bin/harnessimo ]; then",
          '  exec node_modules/.bin/harnessimo brief --json',
          "elif [ -f bin/harnessimo.mjs ]; then",
          '  exec node bin/harnessimo.mjs brief --json',
          "elif command -v harnessimo >/dev/null 2>&1; then",
          '  exec harnessimo brief --json',
          "fi",
          "# No CLI, no context — and no noise on startup either.",
          "exit 0",
        ].join("\n") + "\n",
        { mode: 0o755 },
      );
      ok("harnessimo: wrote .claude/hooks/harnessimo-brief.sh");
    } else {
      ok("harnessimo: .claude/hooks/harnessimo-brief.sh already exists (--force overwrites)");
    }

    const settingsPath = join(ROOT, ".claude", "settings.json");
    let settings = {};
    if (existsSync(settingsPath)) {
      try {
        settings = JSON.parse(readFileSync(settingsPath, "utf8")) as AgentSettings;
      } catch (error) {
        die(
          `harnessimo: .claude/settings.json is not valid JSON (${(error as Error).message})\n` +
            "  fix:  repair it before installing, so nothing here overwrites what it holds",
        );
      }
    }
    // The other half of the gate (spec 0006): a turn does not end on a claim.
    // `brief` covers the start of a session and the pre-commit hook covers the
    // start of a commit; between them an agent can finish a turn saying "done"
    // with the checks red, and hand the work on before a commit ever happens.
    const gate = join(ROOT, AGENT_GATE_PATH);
    if (!existsSync(gate) || flags.has("--force")) {
      writeFileSync(gate, agentGateScript(), { mode: 0o755 });
      ok(`harnessimo: wrote ${AGENT_GATE_PATH}`);
    } else {
      ok(`harnessimo: ${AGENT_GATE_PATH} already exists (--force overwrites)`);
    }
    const gateCommand = `$CLAUDE_PROJECT_DIR/${AGENT_GATE_PATH}`;

    let settingsOut: AgentSettings = settings;
    const wired: string[] = [];
    for (const [event, cmd, meta] of [
      ["SessionStart", command, { timeout: 10, statusMessage: "Loading harness state…" }],
      // SubagentStop as well as Stop: in a parallel run the subagent is the
      // one finishing a lane, and it is the turn nobody is watching.
      ["Stop", gateCommand, { timeout: 120, statusMessage: "Running the harness gates…" }],
      ["SubagentStop", gateCommand, { timeout: 120, statusMessage: "Running the harness gates…" }],
    ] as const) {
      const { settings: next, added } = mergeHook(settingsOut, event, cmd, meta);
      settingsOut = next;
      if (added) wired.push(event);
    }
    if (wired.length > 0) {
      writeFileSync(settingsPath, JSON.stringify(settingsOut, null, 2) + "\n");
      ok(`harnessimo: added ${wired.join(", ")} to .claude/settings.json`);
    } else {
      ok("harnessimo: .claude/settings.json already runs all of them");
    }
    return ok(
      "\nA new session now starts with the live tracks, the head of each handoff,\n" +
        "what is in flight, and what this repository enforces — and a turn does not\n" +
        "end while `harnessimo check` is red.\n\n" +
        "Using something other than Claude Code? `harnessimo agent` prints the same\n" +
        "contract for any tool that reads an instruction file.",
    );
  }

  if (sub === "install") {
    if (existsSync(hookFile) && !flags.has("--force")) {
      ok(`harnessimo: ${HOOK_PATH} already exists, leaving it alone (--force overwrites)`);
    } else {
      // A project's own fast command runs first when one is declared: content
      // validation, a schema check — whatever is cheap and catches a lot.
      const extra = cfg.hooks?.before ?? [];
      mkdirSync(join(ROOT, HOOKS_DIR), { recursive: true });
      writeFileSync(hookFile, hookScript(extra), { mode: 0o755 });
      ok(`harnessimo: wrote ${HOOK_PATH}`);
    }
    execFileSync("git", ["config", "core.hooksPath", HOOKS_DIR], { cwd: ROOT });
    ok(`harnessimo: git will run hooks from ${HOOKS_DIR}/`);
    return ok("\nCommit to try it. It runs the fast gates only — the rest belongs in CI,\nbecause a hook that makes every commit slow gets bypassed.");
  }

  if (sub === "uninstall") {
    try {
      execFileSync("git", ["config", "--unset", "core.hooksPath"], { cwd: ROOT });
    } catch {
      /* not set: nothing to unset */
    }
    return ok(`harnessimo: git no longer uses ${HOOKS_DIR}/ (the file is left in place)`);
  }

  die(`harnessimo: unknown hooks subcommand "${sub}" (status | install | uninstall)`);
}

function cmdHelp() {
  ok(`Harnessimo — a checkable harness for agent-driven work

usage: harnessimo <command> [options]

  check [--autonomy <level>] [--range a..b]  the one command for CI; the level decides
                         how much is re-checked — watched | reviewed | unattended
  doctor                 what this repository actually enforces, honestly
  proof [--strict] [f…]  documentation claims resolve to real evidence
  tracks                 the work-track index resolves and carries statuses
  tasks                  checked boxes in live task lists name a passing check
  queue <sub> [id]       status | activate <id> | verify <id> | check [--reverify]
  locked [base] [head]   commits by an agent did not touch the files defining success
  cold-start             a fresh clone installs and verifies from the repo alone
  clean-exit [base] [head]  the session left no debris and wrote down where it got to
  instructions           the instruction file is still a router, not a manual
  release                the version agrees across manifest, changelog and tags
  brief [--json] [--track <slug>]  what a session reads first; --track narrows it to one lane
  track <sub> <slug>     new [--title] | close --outcome — open and close a lane
  budget [--reset]       what this session read, and what it read twice
  guard read <path>      refuse a re-read of a file that has not changed (exit 2)
  agent                  the contract to paste into any agent's instruction file
  hooks <sub>            status | install [--agent] | uninstall — the gates, on commit
  init [--force]         scaffold .harness/, specs/ and harnessimo.config.json

Configuration lives in harnessimo.config.json — run \`harnessimo init\` and it is written
for you from what this repository already has. A section you leave out is a check that does
not run, and \`harnessimo doctor\` says so rather than implying otherwise.

Docs: https://github.com/atamaniuc/Harnessimo`);
}

// ---------------------------------------------------------------- dispatch

function single(name: string, result: CheckResult): void {
  if (result.problems.length > 0) {
    console.error(formatProblems(result.problems));
    die(`\nharnessimo: ${result.problems.length} problem(s) in ${name}.`);
  }
  ok(`harnessimo: ${result.summary}`);
}

// ---- the read guard (spec 0004)
//
// The only rule here that fires while the work happens rather than at the end
// of it. Kept out of `check` on purpose: a completion gate that depended on
// session state would be a gate nobody could reproduce.

const DEFAULT_STATE_PATH = ".harness/3-environment/.reads.json";

function statePath(): string {
  return join(ROOT, config().tokens?.statePath ?? DEFAULT_STATE_PATH);
}

function loadReadState(): ReadState {
  try {
    return JSON.parse(readFileSync(statePath(), "utf8")) as ReadState;
  } catch {
    // No state is the normal case at the start of a session, not an error.
    return emptyState();
  }
}

function saveReadState(state: ReadState): void {
  const path = statePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state));
}

function cmdBudget(): void {
  if (flags.has("--reset")) {
    saveReadState(emptyState());
    return ok("harnessimo: the read ledger is empty again.");
  }
  ok(ledgerReport(ledger(loadReadState())));
}

/**
 * Decides one read. Exits 0 to allow and 2 to refuse, which is what a tool-use
 * hook reads — a refusal has to be a different code from a crash, or a broken
 * guard silently becomes an open gate.
 */
function cmdGuard(): void {
  const target = positional[1];
  if (positional[0] !== "read" || !target) {
    die("harnessimo: usage — `harnessimo guard read <path> [--partial] [--override]`");
  }
  const cfg = config();
  if (!cfg.tokens) {
    // Not configured is not an error: it is a rule this repository did not ask
    // for, and `doctor` says so.
    return ok("harnessimo: the read guard is not configured here; allowing.");
  }

  let size: number;
  let mtimeMs: number;
  try {
    const stats = statSync(join(ROOT, target));
    size = stats.size;
    mtimeMs = Math.round(stats.mtimeMs);
  } catch {
    // A file the guard cannot stat is a file it has nothing to say about.
    return ok(`harnessimo: ${target} cannot be read from here; allowing.`);
  }

  const { decision, state } = decideRead(loadReadState(), {
    path: target,
    size,
    mtimeMs,
    partial: flags.has("--partial"),
    override: flags.has("--override"),
    windowMinutes: cfg.tokens.windowMinutes ?? DEFAULT_WINDOW_MINUTES,
  });
  saveReadState(state);

  if (decision.allow) return ok(`harnessimo: ${target} — ${decision.reason}`);
  ok(`harnessimo: ${decision.message}`);
  process.exit(2);
}

// ---- the lane lifecycle (spec 0005)
//
// Only the mechanical half. The next free number, the directory, the templates
// copied unchanged, the index line the session brief reads. What the lane is
// for, and what done means, stays the human's — a generator that writes prose
// turns a convention into this tool's property.

/** The value after a flag: `--title "Checkout totals"`. */
function flagValue(name: string): string | undefined {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
}

function trackPaths(): { specsDir: string; index: string; log: string } {
  const cfg = config();
  if (!cfg.tracks) die("harnessimo: no `tracks` section in harnessimo.config.json.");
  return {
    specsDir: cfg.tracks.specsDir,
    index: cfg.tracks.file,
    log: cfg.tracks.log,
  };
}

function cmdTrack(): void {
  const sub = positional[0];
  const slug = positional[1];
  if ((sub !== "new" && sub !== "close") || !slug) {
    die(
      "harnessimo: usage —\n" +
        '  harnessimo track new <slug> [--title "..."]\n' +
        '  harnessimo track close <slug> --outcome "what came out of it"',
    );
  }

  const { specsDir, index, log } = trackPaths();
  const dir = join(ROOT, specsDir);
  const existing = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
  const lane = findLane(existing, slug);

  if (sub === "close") return closeTrack({ slug, lane, specsDir, index, log });

  const bad = slugProblem(slug, specsDir);
  if (bad) die(`harnessimo: ${bad.target} — ${bad.reason}`);
  if (lane) die(`harnessimo: ${specsDir}/${lane} already exists.\n  fix:  pick another slug, or work in that lane`);

  const number = nextNumber(existing);
  // A title nobody gave is the slug read back as words: wrong often enough to
  // be edited, close enough to be useful, and never invented from nothing.
  const title = flagValue("--title") ?? slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
  const laneDir = join(dir, `${number}-${slug}`);
  mkdirSync(laneDir, { recursive: true });

  const written: string[] = [];
  for (const [template, file] of [
    ["spec.template.md", "spec.md"],
    ["tasks.template.md", "tasks.md"],
    ["handoff.template.md", "handoff.md"],
  ] as const) {
    const source = join(PACKAGE_ROOT, "templates", "specs", template);
    if (!existsSync(source)) continue;
    writeFileSync(join(laneDir, file), fillTemplate(readFileSync(source, "utf8"), { number, title }));
    written.push(`${specsDir}/${number}-${slug}/${file}`);
  }

  const indexPath = join(ROOT, index);
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(
    indexPath,
    withLine(readFileSync(indexPath, "utf8"), indexLine({ number, slug, title, specsDir, date })),
  );

  for (const file of written) ok(`  + ${file}`);
  ok(`  ~ ${index}`);
  ok(
    `\nharnessimo: lane ${number} is open. Write the acceptance criteria first — a criterion\n` +
      "that cannot run does not exist, and the checks will hold you to that one.",
  );
}

function closeTrack({
  slug,
  lane,
  specsDir,
  index,
  log,
}: {
  slug: string;
  lane: string | undefined;
  specsDir: string;
  index: string;
  log: string;
}): never | void {
  if (!lane) die(`harnessimo: no lane with the slug "${slug}" in ${specsDir}/`);
  const outcome = flagValue("--outcome");
  if (!outcome) {
    die(
      "harnessimo: closing a track is a distillation, not an archive move.\n" +
        '  fix:  harnessimo track close ' + slug + ' --outcome "what came out of it, in a sentence"',
    );
  }

  // Closing is a claim that the work stands. A lane whose foundation is still
  // being poured is a claim about somebody else's unfinished work.
  const handoffPath = join(ROOT, specsDir, lane, "handoff.md");
  if (existsSync(handoffPath)) {
    const indexText = existsSync(join(ROOT, index)) ? readFileSync(join(ROOT, index), "utf8") : "";
    const live = liveTrackSpecDirs(indexText, specsDir).map((dir) => dir.slice(specsDir.length + 6));
    const waiting = closingProblem(slug, parseDependencies(readFileSync(handoffPath, "utf8")), live);
    if (waiting) die(`harnessimo: ${waiting}`);
  }

  const number = lane.slice(0, 4);
  const title = /^#\s+\d{4}\s+—\s+(.+)$/m.exec(
    existsSync(join(ROOT, specsDir, lane, "spec.md"))
      ? readFileSync(join(ROOT, specsDir, lane, "spec.md"), "utf8")
      : "",
  )?.[1]?.trim();

  const logPath = join(ROOT, log);
  writeFileSync(
    logPath,
    withOutcome(readFileSync(logPath, "utf8"), outcomeEntry(title ?? slug, number, outcome)),
  );

  const indexPath = join(ROOT, index);
  writeFileSync(indexPath, withoutLane(readFileSync(indexPath, "utf8"), specsDir, lane));

  // The spec and its tasks stay: git carries them and they are the record. The
  // handoff goes, because one kept "just in case" is a file nobody trusts and
  // everybody reads.
  const handoff = join(ROOT, specsDir, lane, "handoff.md");
  if (existsSync(handoff)) rmSync(handoff);

  ok(`  ~ ${log}\n  ~ ${index}\n  - ${specsDir}/${lane}/handoff.md`);
  ok(`\nharnessimo: lane ${number} is closed.`);
}

switch (command) {
  case "check":
    cmdCheck();
    break;
  case "doctor":
    cmdDoctor();
    break;
  case "proof":
    single("proof markers", runProof({ strict: false }));
    break;
  case "tracks":
    single("work tracks", runTracks());
    break;
  case "tasks":
    single("the task gate", runTasks());
    break;
  case "queue":
    cmdQueue();
    break;
  case "locked":
    single("locked surfaces", runLocked(positional[0] || "HEAD~1", positional[1] || "HEAD"));
    break;

  case "cold-start":
    single("cold start", runColdStart());
    break;

  case "clean-exit":
    single("clean state", runCleanExit(positional[0] || "HEAD~1", positional[1] || "HEAD"));
    break;
  case "boundaries":
    single("boundaries", runBoundaries());
    break;
  case "thresholds":
    single("thresholds", runThresholds());
    break;
  case "instructions":
    single("the instruction files", runInstructions());
    break;
  case "release":
    single("the version claims", runRelease());
    break;
  case "track":
    cmdTrack();
    break;
  case "budget":
    cmdBudget();
    break;
  case "guard":
    cmdGuard();
    break;
  case "init":
    cmdInit();
    break;
  case "hooks":
    cmdHooks();
    break;
  case "agent":
    // For every tool without a hook API: the same contract, as text to paste
    // into whatever instruction file it reads — AGENTS.md, CLAUDE.md,
    // GEMINI.md, .cursor/rules. The checks do not care which.
    ok(agentContract());
    break;
  case "brief":
    cmdBrief();
    break;
  case "help":
  case "--help":
  case "-h":
    cmdHelp();
    break;
  default:
    die(`harnessimo: unknown command "${command}"\n\nRun \`harnessimo help\` for the list.`);
}
