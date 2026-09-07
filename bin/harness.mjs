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
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig, enabledChecks, ConfigError } from "../src/config.mjs";
import { collectDocs, createResolver, readAll } from "../src/resolver.mjs";
import { findMarkers, verifyProofs } from "../src/proof.mjs";
import { checkHandoffRefs, checkTracks, trackLines } from "../src/tracks.mjs";
import { verifyTaskGates } from "../src/tasks.mjs";
import { liveTrackSpecDirs } from "../src/tracks.mjs";
import {
  HarnessError,
  activate,
  checkQueue,
  formatStatus,
  lastLines,
  verifyItem,
} from "../src/queue.mjs";
import { formatLockedViolations, lockedViolations } from "../src/locked.mjs";
import { coldStartProblems } from "../src/coldstart.mjs";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = process.cwd();

const args = process.argv.slice(2);
const command = args[0] ?? "help";
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.slice(1).filter((a) => !a.startsWith("--"));

const ok = (message) => console.log(message);
const die = (message, code = 1) => {
  console.error(message);
  process.exit(code);
};

function config() {
  try {
    return loadConfig(ROOT);
  } catch (error) {
    if (error instanceof ConfigError) die(`harness: ${error.message}`);
    throw error;
  }
}

function requireSection(cfg, section, hint) {
  if (!cfg[section]) {
    die(
      `harness: this repository has no "${section}" section in harness.config.json, so there is nothing to check\n` +
        `  fix:  ${hint}`,
    );
  }
  return cfg[section];
}

function formatProblems(problems) {
  return problems.map((p) => `${p.file}:${p.line}  ${p.target}\n    ${p.reason}`).join("\n");
}

// ---------------------------------------------------------------- runners

/**
 * Runs a verification. stdin is closed so a command that stops to ask a
 * question fails instead of hanging the loop forever, and a hard timeout means
 * a command that never returns is a failure with a stated cause rather than a
 * hang. A harness without a stop condition is not a harness.
 */
function makeRunner(timeoutMinutes) {
  return (cmd) => {
    try {
      const output = execSync(cmd, {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: timeoutMinutes * 60 * 1000,
        // A nested harness call degrades to a plain invariant check: without
        // this, an item whose verification runs `harness queue check
        // --reverify` recurses until it is killed.
        env: { ...process.env, HARNESS_REVERIFY: "1" },
      });
      return { ok: true, output };
    } catch (error) {
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

const git = (...argv) => execFileSync("git", argv, { cwd: ROOT, encoding: "utf8" }).trim();

// ---------------------------------------------------------------- checks

function runProof({ strict }) {
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
          reason: `the track index does not exist — run \`harness init\` or point tracks.file somewhere real`,
        },
      ],
      summary: "",
    };
  }
  const text = resolver.readFile(tracks.file);
  const problems = checkTracks(text, resolver, tracks.file);
  const lines = trackLines(text).length;
  return { problems, summary: `${lines} live track(s) in ${tracks.file} resolve and carry a status` };
}

function runTasks() {
  const cfg = config();
  const tracks = requireSection(cfg, "tracks", 'add a "tracks" section to gate task lists');
  if (!tracks.gateTasks) return { problems: [], summary: "task gating is off (tracks.gateTasks=false)" };
  const docs = cfg.docs ?? { roots: [tracks.specsDir], skip: [], maxDepth: 3 };
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

function readQueue(cfg) {
  const path = join(ROOT, cfg.queue.file);
  if (!existsSync(path)) die(`harness: no queue at ${cfg.queue.file}\n  fix:  run \`harness init\` or point queue.file at the real file`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeQueue(cfg, list) {
  writeFileSync(join(ROOT, cfg.queue.file), JSON.stringify(list, null, 2) + "\n");
}

function runQueueCheck({ reverify }) {
  const cfg = config();
  if (!cfg.queue) return { problems: [], summary: "no queue configured" };
  const list = readQueue(cfg);
  // A nested run degrades to invariants only, for the same reason the runner
  // sets the variable: an item that verifies through the harness would
  // otherwise re-enter this command forever.
  const nested = process.env.HARNESS_REVERIFY === "1";
  const doReverify = reverify && !nested;
  const problems = checkQueue(list, {
    reverify: doReverify,
    runner: makeRunner(cfg.queue.timeoutMinutes),
  }).map((text) => ({ file: cfg.queue.file, line: 1, target: "(queue)", reason: text }));
  return {
    problems,
    summary:
      `queue invariants hold` +
      (doReverify ? " (every passing claim re-verified)" : nested ? " (nested run: invariants only)" : ""),
  };
}

// ---------------------------------------------------------------- commands

function cmdCheck() {
  const cfg = config();
  if (!cfg.path) {
    die(
      "harness: no harness.config.json in this repository\n" +
        "  fix:  run `harness init` to scaffold the harness, or add the config by hand",
    );
  }
  const enabled = enabledChecks(cfg);
  const results = [];
  if (enabled.proof) results.push(["proof markers", runProof({ strict: true })]);
  if (enabled.tracks) results.push(["work tracks", runTracks()]);
  if (enabled.tasks) results.push(["task gate", runTasks()]);
  if (enabled.queue) results.push(["queue", runQueueCheck({ reverify: flags.has("--reverify") })]);

  let failed = 0;
  for (const [name, result] of results) {
    if (result.problems.length === 0) {
      ok(`  ok    ${name.padEnd(14)} ${result.summary}`);
    } else {
      failed += result.problems.length;
      console.error(`  FAIL  ${name}`);
      console.error(formatProblems(result.problems).replace(/^/gm, "    "));
    }
  }
  if (failed > 0) die(`\nharness: ${failed} problem(s).`);
  ok("\nharness: every configured check passes.");
}

function cmdDoctor() {
  const cfg = config();
  if (!cfg.path) die("harness: no harness.config.json here.\n  fix:  run `harness init`");
  const enabled = enabledChecks(cfg);
  ok(`harness ${readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8").match(/"version":\s*"([^"]+)"/)[1]} — ${cfg.path}\n`);
  ok("what this repository has asked to be enforced:\n");
  const rows = [
    ["proof markers", enabled.proof, "docs claims resolve to real files, tests and commands"],
    ["work tracks", enabled.tracks, "the track index resolves and every track carries a status"],
    ["task gate", enabled.tasks, "a checked box names a check that passes"],
    ["queue", enabled.queue, "state moves only through a passing verification"],
    ["locked surfaces", enabled.locked, "the files defining success are out of the agent's reach"],
    ["cold start", enabled.coldStart, "a fresh clone runs from the repository alone"],
  ];
  for (const [name, on, what] of rows) {
    ok(`  ${on ? "enforced " : "not set  "} ${name.padEnd(16)} ${what}`);
  }
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
  const sub = positional[0] ?? "status";
  const id = positional[1];
  const list = readQueue(cfg);
  try {
    if (sub === "status") return ok(formatStatus(list));
    if (sub === "activate") {
      if (!id) die("harness: `harness queue activate <id>` needs an id");
      const item = activate(list, id);
      writeQueue(cfg, list);
      return ok(`active: ${id}\n  ${item.behavior}\n  verify with: harness queue verify ${id}`);
    }
    if (sub === "verify") {
      if (!id) die("harness: `harness queue verify <id>` needs an id");
      const runner = makeRunner(cfg.queue.timeoutMinutes);
      const before = list.items.find((i) => i.id === id);
      ok(`running: ${before?.verification}\n`);
      const { item, ok: passed, output } = verifyItem(list, id, runner, {
        terminalByKind: cfg.queue.terminalByKind,
      });
      writeQueue(cfg, list);
      if (!passed) {
        console.error(output);
        die(`harness: "${id}" failed verification and is now blocked\n  fix:  fix the cause, then verify again; do not edit state by hand`);
      }
      ok(output);
      return ok(`${id} -> ${item.state}`);
    }
    if (sub === "check") {
      const result = runQueueCheck({ reverify: flags.has("--reverify") });
      if (result.problems.length > 0) die(formatProblems(result.problems));
      return ok(`harness: ${result.summary}`);
    }
    die(`harness: unknown queue subcommand "${sub}" (status | activate | verify | check)`);
  } catch (error) {
    if (error instanceof HarnessError) die(`harness: ${error.message}`);
    throw error;
  }
}

function cmdLocked() {
  const cfg = config();
  const locked = requireSection(cfg, "locked", 'add a "locked" section listing the paths that define success');
  if (!locked.paths.length) return ok("harness: no locked paths configured, nothing to protect");
  const base = positional[0] || "HEAD~1";
  const head = positional[1] || "HEAD";
  let shas = [];
  try {
    shas = git("rev-list", `${base}..${head}`).split("\n").filter(Boolean);
  } catch {
    return ok(`harness: cannot list commits ${base}..${head} (shallow clone?), skipping the locked-surface check`);
  }
  const exempt = new Set();
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
  if (violations.length > 0) die(formatLockedViolations(violations));
  ok(`harness: locked surfaces intact across ${commits.length} commit(s)`);
}

function cmdColdStart() {
  const cfg = config();
  const cold = requireSection(cfg, "coldStart", 'add a "coldStart" section listing the commands a newcomer runs');
  if (!cold.commands.length) return ok("harness: no cold-start commands configured");
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
      die(
        "cold start FAILED\n" +
          problems.map((p) => `  ${p}`).join("\n") +
          "\n\n  why:  every session after the first arrives fresh, and this is what it sees",
      );
    }
    for (const cmd of cold.commands) {
      ok(`cold start: ${cmd}`);
      execSync(cmd, { cwd: clone, stdio: ["ignore", "ignore", "inherit"] });
    }
    ok("cold start PASSED: a fresh clone installs and verifies from the repository alone");
  } catch (error) {
    if (error?.status !== undefined) die(`cold start FAILED: a documented command exited ${error.status}`);
    throw error;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function cmdInit() {
  const force = flags.has("--force");
  const templates = join(PACKAGE_ROOT, "templates");
  const written = [];
  const skipped = [];
  cpSync(templates, ROOT, {
    recursive: true,
    force,
    filter: (src, dest) => {
      if (statSync(src).isDirectory()) return true;
      const rel = dest.slice(ROOT.length + 1);
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
  ok(`harness init: wrote ${written.length} file(s)`);
  for (const f of written) ok(`  + ${f}`);
  if (skipped.length > 0) {
    ok(`\nkept ${skipped.length} existing file(s) (pass --force to overwrite):`);
    for (const f of skipped) ok(`  = ${f}`);
  }
  ok(
    "\nnext:\n" +
      "  1. edit harness.config.json — turn on only the checks you can satisfy today\n" +
      "  2. run `harness doctor` to see what is actually enforced\n" +
      "  3. run `harness check` and wire it into CI",
  );
}

function cmdHelp() {
  ok(`harness — a checkable harness for agent-driven work

usage: harness <command> [options]

  check [--reverify]     run every configured check; the one command for CI
  doctor                 what this repository actually enforces, honestly
  proof [--strict] [f…]  documentation claims resolve to real evidence
  tracks                 the work-track index resolves and carries statuses
  tasks                  checked boxes in live task lists name a passing check
  queue <sub> [id]       status | activate <id> | verify <id> | check [--reverify]
  locked [base] [head]   commits by an agent did not touch the files defining success
  cold-start             a fresh clone installs and verifies from the repo alone
  init [--force]         scaffold .harness/, specs/ and harness.config.json

Configuration lives in harness.config.json. A section you leave out is a check
that does not run, and \`harness doctor\` says so rather than implying otherwise.`);
}

// ---------------------------------------------------------------- dispatch

function single(name, result) {
  if (result.problems.length > 0) {
    console.error(formatProblems(result.problems));
    die(`\nharness: ${result.problems.length} problem(s) in ${name}.`);
  }
  ok(`harness: ${result.summary}`);
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
    cmdLocked();
    break;
  case "cold-start":
    cmdColdStart();
    break;
  case "init":
    cmdInit();
    break;
  case "help":
  case "--help":
  case "-h":
    cmdHelp();
    break;
  default:
    die(`harness: unknown command "${command}"\n\nRun \`harness help\` for the list.`);
}
