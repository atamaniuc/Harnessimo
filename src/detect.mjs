// Configuration written from what the repository already has.
//
// The alternative — a template full of paths the reader has to correct — is how
// adoption stalls: the first run fails on five settings nobody chose, and the
// honest response to that is to turn the tool off. So `harnessimo init` looks at
// the repository, turns on what it can actually satisfy, and says out loud what
// it did not find.
//
// Pure: it takes a description of the repository, not the repository. The
// filesystem edge is in bin/harnessimo.mjs.

/** Command runners, most specific first — a repo with both gets the one it drives CI with. */
const RUNNERS = [
  { file: "Taskfile.yml", prefix: "task" },
  { file: "Taskfile.yaml", prefix: "task" },
  { file: "Makefile", prefix: "make" },
  { file: "justfile", prefix: "just" },
];

const MIGRATION_DIRS = [
  "supabase/migrations",
  "migrations",
  "db/migrate",
  "prisma/migrations",
  "alembic/versions",
];

const CODE_DIRS = ["src", "lib", "app", "apps", "packages", "scripts", "test", "tests", "internal", "cmd"];
const DOC_DIRS = ["docs", "doc", "specs", "decisions", ".harness"];
const ENTRY_DOCS = ["AGENTS.md", "CLAUDE.md", "README.md", "CONTRIBUTING.md"];

/**
 * @typedef {object} Repo
 * @property {(path: string) => boolean} exists
 * @property {(path: string) => boolean} isDir
 * @property {(path: string) => string} read
 */

/**
 * @param {Repo} repo
 * @returns {{ config: object, found: string[], missing: string[] }}
 */
export function detectConfig(repo) {
  const found = [];
  const missing = [];
  const config = { $schema: "https://raw.githubusercontent.com/atamaniuc/harnessimo/main/schema/harnessimo.config.schema.json" };

  // --- how this project runs commands, so `proof: make check` can be resolved
  const commands = {};
  for (const runner of RUNNERS) {
    if (repo.exists(runner.file)) {
      commands[runner.prefix] = runner.file;
      found.push(`${runner.prefix} commands in ${runner.file}`);
      break; // one is enough; a second would resolve the same markers twice
    }
  }
  if (repo.exists("package.json")) {
    const prefix = repo.exists("pnpm-lock.yaml") ? "pnpm run" : "npm run";
    commands[prefix] = "package.json";
    found.push(`${prefix} scripts in package.json`);
  }
  if (Object.keys(commands).length === 0) {
    missing.push("no command runner found — `proof: make check` style markers will not resolve");
  }

  // --- documents to scan
  //
  // The specs directory is included whether or not it exists yet: `init`
  // creates it, and leaving it out would mean the track index it writes is
  // never read by the gate that checks it.
  const specsDir = repo.isDir("docs/specs") ? "docs/specs" : "specs";
  const roots = ["."];
  for (const dir of DOC_DIRS) if (repo.isDir(dir)) roots.push(dir);
  if (!roots.includes(specsDir)) roots.push(specsDir);
  // Strict mode is where a project arrives, not where it starts. A document is
  // held to account only once it carries at least one marker: switching it on
  // for a README that has never had one makes the first run after `init` red
  // for a setting nobody chose, and the honest response to that is to turn the
  // tool off.
  const candidates = ENTRY_DOCS.filter((d) => repo.exists(d) && d !== "CLAUDE.md");
  const mustCarryProof = candidates.filter((d) => /<!--\s*proof:/.test(repo.read(d))).slice(0, 2);
  config.docs = {
    roots,
    skip: ["node_modules", ".git", ".next", "dist", "build", "coverage", "vendor", "target"],
    mustCarryProof,
    commands,
  };
  const migrations = MIGRATION_DIRS.find((d) => repo.isDir(d));
  if (migrations) {
    config.docs.migrations = migrations;
    found.push(`migrations in ${migrations}`);
  }
  found.push(`documents under ${roots.join(", ")}`);
  if (mustCarryProof.length === 0) {
    missing.push(
      candidates.length === 0
        ? "no README.md or AGENTS.md — strict mode has nothing to hold to account"
        : `strict mode off: ${candidates.join(", ")} carry no proof marker yet. Add one ` +
          `(<!-- proof: path/to/file --> beside a claim), then list the file in docs.mustCarryProof`,
    );
  }

  // --- work tracks: scaffolded by init, so always on
  config.tracks = {
    file: `${specsDir}/TRACKS.md`,
    log: `${specsDir}/TRACKS-LOG.md`,
    specsDir,
    taskFile: "tasks.md",
    gateTasks: true,
  };
  found.push(`work tracks in ${specsDir}/TRACKS.md`);

  // --- the queue
  config.queue = { file: ".harness/4-state/feature_list.json", timeoutMinutes: 10 };
  found.push("work queue in .harness/4-state/feature_list.json");

  // --- locked surfaces: only what exists, because a prefix that matches nothing is theatre
  const lockedPaths = [];
  if (repo.isDir(".github/workflows")) lockedPaths.push(".github/workflows/");
  if (repo.exists(".harness/1-instructions/CONSTRAINTS.md")) lockedPaths.push(".harness/1-instructions/CONSTRAINTS.md");
  if (lockedPaths.length > 0) {
    config.locked = {
      paths: lockedPaths,
      baseline: ".harness/3-environment/locked-baseline",
      agentTrailer: "Co-Authored-By: Claude",
    };
    found.push(`locked surfaces: ${lockedPaths.join(", ")}`);
  } else {
    missing.push("no CI workflow found — locked surfaces left off (nothing to protect yet)");
  }

  // --- cold start
  const requiredFiles = [
    ...ENTRY_DOCS.filter((d) => repo.exists(d)),
    ...RUNNERS.map((r) => r.file).filter((f) => repo.exists(f)),
  ];
  const setup = repo.exists("pnpm-lock.yaml")
    ? "pnpm install --frozen-lockfile"
    : repo.exists("package-lock.json")
      ? "npm ci"
      : null;
  const checkCommand = pickCheckCommand(repo, commands);
  const commandsToRun = [setup, checkCommand].filter(Boolean);
  if (commandsToRun.length > 0) {
    config.coldStart = {
      requiredFiles,
      entryDocs: ENTRY_DOCS.filter((d) => repo.exists(d) && d !== "CLAUDE.md"),
      commands: commandsToRun,
    };
    found.push(`cold start: ${commandsToRun.join(" && ")}`);
  } else {
    missing.push("no install or check command detected — cold start left off");
  }

  // --- clean exit
  const scan = CODE_DIRS.filter((d) => repo.isDir(d));
  if (scan.length > 0) {
    config.cleanExit = {
      scan,
      progressFile: ".harness/4-state/PROGRESS.md",
      codePrefixes: scan.map((d) => `${d}/`),
    };
    found.push(`clean exit over ${scan.join(", ")}`);
  } else {
    missing.push("no source directories recognised — clean exit left off");
  }

  // --- instruction size
  const limits = {};
  for (const doc of ["AGENTS.md", "CONTRIBUTING.md"]) if (repo.exists(doc)) limits[doc] = 200;
  if (Object.keys(limits).length > 0) {
    config.instructions = { limits };
    found.push(`instruction limit: ${Object.entries(limits).map(([f, n]) => `${f} ≤ ${n} lines`).join(", ")}`);
  } else {
    missing.push("no AGENTS.md — the instruction-size check has nothing to measure");
  }

  return { config, found, missing };
}

/** The command a newcomer would run to verify the project, if one is declared. */
function pickCheckCommand(repo, commands) {
  for (const [prefix, file] of Object.entries(commands)) {
    if (!repo.exists(file)) continue;
    const text = repo.read(file);
    const names = file.endsWith("package.json")
      ? Object.keys(safeJson(text).scripts ?? {})
      : /\.ya?ml$/.test(file)
        ? [...text.matchAll(/^ {2}([A-Za-z][\w:-]*):$/gm)].map((m) => m[1])
        : [...text.matchAll(/^([A-Za-z][\w.-]*):(?!=)/gm)].map((m) => m[1]);
    for (const candidate of ["check", "ci", "test", "verify"]) {
      if (names.includes(candidate)) return `${prefix} ${candidate}`;
    }
  }
  return null;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
