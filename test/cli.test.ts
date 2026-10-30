// End-to-end: the CLI against a real repository on disk. The unit tests prove
// the rules; this proves the wiring — that `harnessimo check` reads the config,
// finds the documents, and exits non-zero on a broken claim.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), "../src/cli.ts");

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "harness-cli-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, dirname(path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

function run(dir: string, ...argv: string[]): { status: number; out: string } {
  try {
    return { status: 0, out: execFileSync(process.execPath, [CLI, ...argv], { cwd: dir, encoding: "utf8" }) };
  } catch (caught) {
    const error = caught as { status?: number; stdout?: string; stderr?: string };
    return { status: error.status ?? 1, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

const CONFIG = JSON.stringify({
  docs: { roots: [".", "specs"], mustCarryProof: ["README.md"], commands: { make: "Makefile" } },
  tracks: { file: "specs/TRACKS.md", log: "specs/TRACKS-LOG.md" },
});

const BASE = {
  "harnessimo.config.json": CONFIG,
  Makefile: "check:\n\techo ok\n",
  "README.md": "# Project\n\nThe gate runs in CI. <!-- proof: make check -->\n",
  "specs/TRACKS.md": "# Work tracks\n\n- **Search** — [handoff](specs/0001-search/handoff.md) — active, next: T1\n",
  "specs/TRACKS-LOG.md": "# Closed tracks\n",
  "specs/0001-search/handoff.md": "# Handoff — search\n",
};

test("a repository whose claims hold passes", () => {
  const dir = fixture(BASE);
  const { status, out } = run(dir, "check");
  assert.equal(status, 0, out);
  assert.match(out, /every check required at "watched" passes/);
  assert.match(out, /a person is reading each step/, "the report says what the green means");
  rmSync(dir, { recursive: true, force: true });
});

test("a claim whose evidence disappeared fails, naming the document and line", () => {
  const dir = fixture({ ...BASE, "README.md": "# Project\n\nRuns in CI. <!-- proof: make deploy -->\n" });
  const { status, out } = run(dir, "check");
  assert.equal(status, 1);
  assert.match(out, /README\.md:3/);
  assert.match(out, /no make command named "deploy"/);
  rmSync(dir, { recursive: true, force: true });
});

test("a track whose handoff was deleted fails", () => {
  const { "specs/0001-search/handoff.md": _deleted, ...withoutHandoff } = BASE;
  const dir = fixture(withoutHandoff);
  const { status, out } = run(dir, "check");
  assert.equal(status, 1);
  assert.match(out, /handoff\.md" does not exist/);
  rmSync(dir, { recursive: true, force: true });
});

test("doctor reports what is enforced and what is not, without overstating", () => {
  const dir = fixture(BASE);
  const { status, out } = run(dir, "doctor");
  assert.equal(status, 0, out);
  assert.match(out, /enforced\s+proof markers/);
  assert.match(out, /not set\s+locked surfaces/);
  rmSync(dir, { recursive: true, force: true });
});

test("a repository with no configuration is told how to get one", () => {
  const dir = fixture({ "README.md": "# Project\n" });
  const { status, out } = run(dir, "check");
  assert.equal(status, 1);
  assert.match(out, /harnessimo init/);
  rmSync(dir, { recursive: true, force: true });
});

test("init scaffolds a working harness that immediately passes its own check", () => {
  const dir = fixture({ "README.md": "# Project\n" });
  const init = run(dir, "init");
  assert.equal(init.status, 0, init.out);
  const check = run(dir, "check");
  assert.equal(check.status, 0, check.out);
  rmSync(dir, { recursive: true, force: true });
});

test("init writes the agent roles and the hooks they assume, and leaves existing settings alone", () => {
  const dir = fixture({ "README.md": "# Project\n" });
  try {
    const init = run(dir, "init");
    assert.equal(init.status, 0, init.out);
    for (const role of ["architect", "implementer", "scout"]) {
      assert.ok(existsSync(join(dir, ".claude", "agents", `${role}.md`)), `${role}.md was not written`);
    }
    const settings = readFileSync(join(dir, ".claude", "settings.json"), "utf8");
    for (const event of ["SessionStart", "Stop", "SubagentStop", "TaskCompleted"]) assert.match(settings, new RegExp(`"${event}"`));
    const parsed = JSON.parse(settings) as { env: Record<string, string>; teammateMode: string; subagentPromptCacheTtl: string };
    assert.equal(parsed.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, "1", "agent teams are on");
    assert.equal(parsed.teammateMode, "auto");
    assert.equal(parsed.subagentPromptCacheTtl, "1h");
    assert.equal(settings.split("harnessimo-gate.sh").length - 1, 2, "the merge did not duplicate the template's hooks");
    assert.ok(existsSync(join(dir, ".claude", "hooks", "harnessimo-gate.sh")), "a Stop hook pointing at nothing");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const mine = fixture({ "README.md": "# Project\n", ".claude/settings.json": '{ "theme": "light" }\n' });
  try {
    const init = run(mine, "init");
    assert.equal(init.status, 0, init.out);
    assert.equal(readFileSync(join(mine, ".claude", "settings.json"), "utf8"), '{ "theme": "light" }\n');
    assert.match(init.out, /= \.claude\/settings\.json/);
  } finally {
    rmSync(mine, { recursive: true, force: true });
  }
});

// Spec 0004. The guard is the only rule here that answers while the work
// happens, so its exit codes are part of the contract: a refusal has to read
// differently from a crash, or a broken guard becomes an open gate.
const GUARDED = { ...BASE, "harnessimo.config.json": JSON.stringify({ ...JSON.parse(CONFIG), tokens: {} }) };

test("guard allows a first read, refuses the second, and budget reports both", () => {
  const dir = fixture({ ...GUARDED, "notes.md": "x".repeat(4000) });

  const first = run(dir, "guard", "read", "notes.md");
  assert.equal(first.status, 0, first.out);
  assert.match(first.out, /first read/);

  const second = run(dir, "guard", "read", "notes.md");
  assert.equal(second.status, 2, "a refusal exits 2 — a crash and a verdict must not look alike");
  assert.match(second.out, /already read/);
  assert.match(second.out, /fix:/);

  const budget = run(dir, "budget");
  assert.equal(budget.status, 0);
  assert.match(budget.out, /estimated at 4 bytes per token/);
  assert.match(budget.out, /refused re-read/);
});

test("guard allows the read again once the file has changed", () => {
  const dir = fixture({ ...GUARDED, "notes.md": "one" });
  run(dir, "guard", "read", "notes.md");
  writeFileSync(join(dir, "notes.md"), "one, and then rather more than before");

  const again = run(dir, "guard", "read", "notes.md");
  assert.equal(again.status, 0, "changed content is content the agent does not have");
});

test("guard allows anything when the repository has not asked for it", () => {
  const dir = fixture({ ...BASE, "notes.md": "x".repeat(500) });
  run(dir, "guard", "read", "notes.md");
  const second = run(dir, "guard", "read", "notes.md");
  assert.equal(second.status, 0, "a rule nobody configured must not block anybody");
  assert.match(second.out, /not configured/);
});

// Spec 0005, criterion 7 — the one that matters: a lane this tool creates has
// to survive this tool's own rules. It did not, at first: the tasks template
// showed a ticked example, and the task gate rejected it. A template that
// fails the rule it teaches is a template nobody should trust.
test("a lane opened by the tool passes the tool's own checks, and closing it distils", () => {
  const dir = fixture(BASE);
  run(dir, "init", "--force");

  const opened = run(dir, "track", "new", "checkout-totals", "--title", "Checkout totals");
  assert.equal(opened.status, 0, opened.out);
  // The number depends on what the fixture already has, and asserting it here
  // would be testing the fixture rather than the tool.
  assert.match(opened.out, /specs\/\d{4}-checkout-totals\/spec\.md/);
  assert.match(opened.out, /specs\/\d{4}-checkout-totals\/tasks\.md/);

  const checked = run(dir, "check");
  assert.equal(checked.status, 0, `a scaffolded lane must pass:\n${checked.out}`);

  const second = run(dir, "track", "new", "checkout-totals");
  assert.notEqual(second.status, 0, "the same work must not be opened twice");

  const bare = run(dir, "track", "close", "checkout-totals");
  assert.notEqual(bare.status, 0, "a close that writes nothing down is an archive move");

  const closed = run(dir, "track", "close", "checkout-totals", "--outcome", "It rounds per currency.");
  assert.equal(closed.status, 0, closed.out);
  assert.equal(run(dir, "check").status, 0, "and it still passes with the handoff gone");
});

// ---- spec 0006: more than one agent

const TWO_LANES = {
  ...BASE,
  "specs/TRACKS.md":
    "# Work tracks\n\n" +
    "- **Search** — [handoff](specs/0001-search/handoff.md) — active, next: T1\n" +
    "- **Totals** — [handoff](specs/0002-totals/handoff.md) — active, next: T1\n",
  "specs/0001-search/handoff.md": "# Handoff — search\n\n## Owns\n\n- src/search/\n",
  "specs/0002-totals/handoff.md": "# Handoff — totals\n\n## Owns\n\n- src/totals.ts\n",
};

test("two lanes working in different places both pass, and the check says so", () => {
  const dir = fixture(TWO_LANES);
  const { status, out } = run(dir, "check");
  assert.equal(status, 0, out);
  assert.match(out, /2 declared path\(s\) do not collide/);
  rmSync(dir, { recursive: true, force: true });
});

test("two lanes claiming one path fail, naming the other lane", () => {
  const dir = fixture({
    ...TWO_LANES,
    "specs/0002-totals/handoff.md": "# Handoff — totals\n\n## Owns\n\n- src/search/totals.ts\n",
  });
  const { status, out } = run(dir, "check");
  assert.equal(status, 1);
  assert.match(out, /specs\/0002-totals\/handoff\.md:5/);
  assert.match(out, /also claimed by specs\/0001-search/);
  rmSync(dir, { recursive: true, force: true });
});

test("two lane directories sharing a number fail, which is how the merge is caught", () => {
  const dir = fixture({ ...BASE, "specs/0001-totals/spec.md": "# 0001 — totals\n" });
  const { status, out } = run(dir, "check");
  assert.equal(status, 1);
  assert.match(out, /0001-search and 0001-totals share one number/);
  rmSync(dir, { recursive: true, force: true });
});

// ---- spec 0007: how much was this run watched

test("the report says which level it ran at, and green means that level", () => {
  const dir = fixture(BASE);
  const { status, out } = run(dir, "check");
  assert.equal(status, 0, out);
  assert.match(out, /watched — a person is reading each step/);
  assert.match(out, /every check required at "watched" passes/);
  rmSync(dir, { recursive: true, force: true });
});

test("a level the repository cannot back is refused, and names the section to add", () => {
  const dir = fixture(BASE);
  const { status, out } = run(dir, "check", "--autonomy", "unattended");

  assert.equal(status, 1);
  assert.match(out, /supervision level "unattended"/);
  assert.match(out, /nobody looked at all/, "the failure says what the claim meant");
  for (const missing of ["locked", "cleanExit", "coldStart"]) {
    assert.match(out, new RegExp(`no "${missing}" section`), `${missing} is what this level adds`);
  }
  rmSync(dir, { recursive: true, force: true });
});

test("the same repository passes at the level it does back", () => {
  // The proportionality, end to end: nothing about the repository changed.
  const dir = fixture(BASE);
  assert.equal(run(dir, "check", "--autonomy", "watched").status, 0);
  rmSync(dir, { recursive: true, force: true });
});

test("a declared floor cannot be argued down from the command line", () => {
  const dir = fixture({
    ...BASE,
    "harnessimo.config.json": JSON.stringify({
      ...JSON.parse(CONFIG),
      autonomy: { level: "unattended" },
    }),
  });
  const { status, out } = run(dir, "check", "--autonomy", "watched");

  assert.equal(status, 1, "asking for less must not get less");
  assert.match(out, /below this repository's floor of "unattended"/);
  rmSync(dir, { recursive: true, force: true });
});

test("a level that is not a level is refused with the ones that are", () => {
  const dir = fixture(BASE);
  const { status, out } = run(dir, "check", "--autonomy", "yolo");
  assert.equal(status, 1);
  assert.match(out, /watched, reviewed, unattended/);
  rmSync(dir, { recursive: true, force: true });
});

// ---- spec 0008: one lane built on another

const DEPENDENT = {
  ...TWO_LANES,
  "specs/0001-search/handoff.md": "# Handoff — search\n\n## Owns\n\n- src/search/\n",
  "specs/0002-totals/handoff.md":
    "# Handoff — totals\n\n## Owns\n\n- src/totals.ts\n\n## Depends on\n\n- search\n",
};

test("a lane may declare what it is built on", () => {
  const dir = fixture(DEPENDENT);
  const { status, out } = run(dir, "check");
  assert.equal(status, 0, out);
  rmSync(dir, { recursive: true, force: true });
});

test("a dependency naming no lane fails, and says which lanes exist", () => {
  const dir = fixture({
    ...DEPENDENT,
    "specs/0002-totals/handoff.md": "# Handoff\n\n## Depends on\n\n- pricing\n",
  });
  const { status, out } = run(dir, "check");
  assert.equal(status, 1);
  assert.match(out, /no lane with this slug/);
  assert.match(out, /name one of search, totals/);
  rmSync(dir, { recursive: true, force: true });
});

test("a lane cannot be closed while what it was built on is still open", () => {
  const dir = fixture(DEPENDENT);
  const blocked = run(dir, "track", "close", "totals", "--outcome", "Totals round per currency.");
  assert.equal(blocked.status, 1);
  assert.match(blocked.out, /still waits on search/);

  // Close the foundation, and the lane built on it may close.
  assert.equal(run(dir, "track", "close", "search", "--outcome", "Search returns ranked chunks.").status, 0);
  const now = run(dir, "track", "close", "totals", "--outcome", "Totals round per currency.");
  assert.equal(now.status, 0, now.out);
  rmSync(dir, { recursive: true, force: true });
});

test("a scoped brief carries the lanes this one waits on, as heads", () => {
  const dir = fixture(DEPENDENT);
  const { status, out } = run(dir, "brief", "--track", "totals");
  assert.equal(status, 0, out);
  assert.match(out, /specs\/0001-search\/handoff\.md.*this lane waits on it/);
  rmSync(dir, { recursive: true, force: true });
});

// ---- spec 0010: a line the code may not cross

const BOUNDED = {
  ...BASE,
  "harnessimo.config.json": JSON.stringify({
    ...JSON.parse(CONFIG),
    boundaries: {
      scan: ["app"],
      rules: [
        {
          pattern: "service_role",
          paths: ["app/"],
          reason: "the service-role key bypasses row-level security; it belongs on the server",
        },
      ],
    },
  }),
  "app/page.ts": "export const ok = 1;\n",
};

test("a boundary that holds is reported as holding", () => {
  const dir = fixture(BOUNDED);
  const { status, out } = run(dir, "check");
  assert.equal(status, 0, out);
  assert.match(out, /1 boundary\(ies\) hold across 1 file\(s\)/);
  rmSync(dir, { recursive: true, force: true });
});

test("a line that crosses a boundary fails, with the reason and not the pattern", () => {
  const dir = fixture({ ...BOUNDED, "app/page.ts": "const k = process.env.service_role;\n" });
  const { status, out } = run(dir, "check");

  assert.equal(status, 1);
  assert.match(out, /app\/page\.ts:1/);
  assert.match(out, /bypasses row-level security/);
  rmSync(dir, { recursive: true, force: true });
});

// ---- worktree (spec 0011), against real git repositories

function repo(files: Record<string, string>): { dir: string; git: (...a: string[]) => string; cleanup: () => void } {
  const dir = fixture(files);
  const git = (...a: string[]): string =>
    execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", "-c", "commit.gpgsign=false", ...a], {
      cwd: dir,
      encoding: "utf8",
    });
  git("init", "-q", "-b", "main");
  // Repository-local, so the CLI's own merge commit has an author on a CI
  // runner that has no global git identity.
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  git("config", "commit.gpgsign", "false");
  git("add", "-A");
  git("commit", "-qm", "init");
  const parent = dirname(dir);
  const name = dir.slice(parent.length + 1);
  const cleanup = (): void => {
    rmSync(dir, { recursive: true, force: true });
    for (const suffix of ["-search", "-api"]) rmSync(join(parent, name + suffix), { recursive: true, force: true });
  };
  return { dir, git, cleanup };
}

const WT_CONFIG = JSON.stringify({
  worktree: { install: ["node -e \"require('fs').writeFileSync('installed.txt', 'yes')\""] },
});

test("worktree add makes a checkout beside the repository, on its branch, with the install run", () => {
  const { dir, git, cleanup } = repo({ "harnessimo.config.json": WT_CONFIG, ".gitignore": "installed.txt\n" });
  try {
    const add = run(dir, "worktree", "add", "search");
    assert.equal(add.status, 0, add.out);
    const path = `${dir}-search`;
    assert.ok(existsSync(join(path, "installed.txt")), "the install command ran inside the new worktree");
    assert.match(git("worktree", "list"), /\[wt-search\]/);
    const again = run(dir, "worktree", "add", "search");
    assert.equal(again.status, 1);
    assert.match(again.out, /already exists[\s\S]*fix:/);
  } finally {
    cleanup();
  }
});

test("worktree merge brings the stream in; remove refuses unmerged or dirty work, then cleans up", () => {
  const { dir, git, cleanup } = repo({ "harnessimo.config.json": JSON.stringify({ worktree: { install: [] } }) });
  try {
    assert.equal(run(dir, "worktree", "add", "api").status, 0);
    const path = `${dir}-api`;
    writeFileSync(join(path, "api.txt"), "v1\n");
    execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", "-c", "commit.gpgsign=false", "add", "api.txt"], { cwd: path });
    execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", "-c", "commit.gpgsign=false", "commit", "-qm", "api"], { cwd: path });

    const early = run(dir, "worktree", "remove", "api");
    assert.equal(early.status, 1, "an unmerged branch is not deleted");
    assert.match(early.out, /not merged[\s\S]*worktree merge/);

    writeFileSync(join(path, "scratch.txt"), "unsaved\n");
    const dirtyMerge = run(dir, "worktree", "merge", "api");
    assert.equal(dirtyMerge.status, 1);
    assert.match(dirtyMerge.out, /uncommitted changes/);
    rmSync(join(path, "scratch.txt"));

    const merge = run(dir, "worktree", "merge", "api");
    assert.equal(merge.status, 0, merge.out);
    assert.ok(existsSync(join(dir, "api.txt")), "the stream's commit is in the main checkout");

    writeFileSync(join(path, "scratch.txt"), "unsaved\n");
    const dirtyRemove = run(dir, "worktree", "remove", "api");
    assert.equal(dirtyRemove.status, 1);
    assert.match(dirtyRemove.out, /git worktree remove --force/);
    rmSync(join(path, "scratch.txt"));

    const remove = run(dir, "worktree", "remove", "api");
    assert.equal(remove.status, 0, remove.out);
    assert.ok(!existsSync(path));
    assert.doesNotMatch(git("branch"), /wt-api/);
  } finally {
    cleanup();
  }
});

test("a worktree name that would escape its directory is refused before git runs", () => {
  const { dir, cleanup } = repo({ "README.md": "# x\n" });
  try {
    const bad = run(dir, "worktree", "add", "../escape");
    assert.equal(bad.status, 2);
    assert.match(bad.out, /cannot name a worktree/);
  } finally {
    cleanup();
  }
});

// ---- spec 0011: a herd of lane agents in herdr panes
//
// herdr itself is not installed on a CI runner, and a test must not drive a
// real terminal session. A fake `herdr` on PATH records every call and answers
// with the JSON shapes herdr documents.

const FAKE_HERDR = `#!/usr/bin/env node
const fs = require("node:fs");
const argv = process.argv.slice(2);
fs.appendFileSync(process.env.HERDR_LOG, JSON.stringify(argv) + "\\n");
const [group, verb] = argv;
// Ids count up from 10 so each pane a call makes is told apart in the log.
const counter = require("node:path").join(require("node:path").dirname(process.env.HERDR_LOG), "n");
const next = () => {
  const n = Number(fs.existsSync(counter) ? fs.readFileSync(counter, "utf8") : 10);
  fs.writeFileSync(counter, String(n + 1));
  return n;
};
const answers = {
  "pane current": () => ({ result: { pane: { pane_id: "w1:p5", tab_id: "w1:t2" } } }),
  "tab list": () => JSON.parse(process.env.HERDR_TABS || '{"result":{"tabs":[{"tab_id":"w1:t2","pane_count":1}]}}'),
  "pane split": () => ({ result: { pane: { pane_id: "w1:p" + next() } } }),
  "tab create": () => { const n = next(); return { result: { tab: { tab_id: "w1:t" + n }, root_pane: { pane_id: "w1:p" + n } } }; },
  "agent list": () => JSON.parse(process.env.HERDR_AGENTS || '{"result":{"agents":[]}}'),
};
const answer = answers[group + " " + verb];
process.stdout.write(JSON.stringify(answer ? answer() : { result: {} }));
`;

const HERD_TRACKS =
  "# Work tracks\n\n" +
  "- **Search** — [handoff](specs/0001-search/handoff.md) — active, 2026-10-30, next: T1\n" +
  "- **Api** — [handoff](specs/0002-api/handoff.md) — active, 2026-10-30, next: T1\n" +
  "- **Ranking** — [handoff](specs/0003-ranking/handoff.md) — active, 2026-10-30, next: T1\n";

function herdRepo(herd: Record<string, unknown>, extra: Record<string, string> = {}) {
  const made = repo({
    ...extra,
    "harnessimo.config.json": JSON.stringify({
      tracks: { file: "specs/TRACKS.md", log: "specs/TRACKS-LOG.md" },
      worktree: { install: [] },
      herd: { staggerSeconds: 0, ...herd },
    }),
    "specs/TRACKS.md": HERD_TRACKS,
    "specs/TRACKS-LOG.md": "# Closed tracks\n",
    "specs/0001-search/handoff.md": "# Handoff\n\n## Owns\n\n- src/search/\n",
    "specs/0002-api/handoff.md": "# Handoff\n\n## Owns\n\n- src/api/\n",
    "specs/0003-ranking/handoff.md": "# Handoff\n\n## Owns\n\n- src/search/rank.ts\n",
  });
  const bin = mkdtempSync(join(tmpdir(), "harness-bin-"));
  writeFileSync(join(bin, "herdr"), FAKE_HERDR, { mode: 0o755 });
  const log = join(bin, "calls.log");
  // Only the fake bin and node's own directory: a real herdr on the
  // developer's PATH must never be the one these tests drive.
  const env = { ...process.env, PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, HERDR_LOG: log, HERDR_ENV: "1", HERDR_TAB_ID: "w1:t2" };
  const calls = (): string[][] =>
    existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as string[]) : [];
  return {
    ...made,
    env,
    calls,
    cleanup: () => {
      made.cleanup();
      rmSync(bin, { recursive: true, force: true });
    },
  };
}

function runEnv(dir: string, env: NodeJS.ProcessEnv, ...argv: string[]): { status: number; out: string } {
  try {
    return { status: 0, out: execFileSync(process.execPath, [CLI, ...argv], { cwd: dir, encoding: "utf8", env }) };
  } catch (caught) {
    const error = caught as { status?: number; stdout?: string; stderr?: string };
    return { status: error.status ?? 1, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

test("herd plan runs fenced lanes side by side and holds the one that overlaps", () => {
  const { dir, env, cleanup } = herdRepo({});
  try {
    const plan = runEnv(dir, { ...env, HERDR_ENV: "" }, "herd", "plan");
    assert.equal(plan.status, 0, plan.out);
    assert.match(plan.out, /runnable now, side by side: search, api/);
    assert.match(plan.out, /held  ranking — its ## Owns overlaps search's/);
  } finally {
    cleanup();
  }
});

test("herd up opens a worktree per lane and starts a named agent with its kickoff", () => {
  const { dir, env, calls, cleanup } = herdRepo({ agentArgs: ["--model", "sonnet"] });
  try {
    const up = runEnv(dir, env, "herd", "up", "search");
    assert.equal(up.status, 0, up.out);
    assert.ok(existsSync(`${dir}-search`), "the lane's worktree exists beside the repository");
    const made = calls();
    const open = made.find((c) => c[0] === "pane" && c[1] === "split")!;
    assert.deepEqual(open.slice(0, 5), ["pane", "split", "--current", "--direction", "right"]);
    assert.ok(open[open.indexOf("--cwd") + 1]!.endsWith("-search") && open.includes("--no-focus"), JSON.stringify(open));
    assert.ok(!made.some((c) => c[0] === "worktree"), "a lane goes in a pane of this tab, not a workspace of its own");
    const start = made.find((c) => c[0] === "agent" && c[1] === "start")!;
    assert.deepEqual(start.slice(0, 7), ["agent", "start", "search", "--kind", "claude", "--pane", "w1:p10"]);
    // The explicit model wins over the (missing) role file; sonnet's default effort still applies.
    assert.deepEqual(start.slice(-5), ["--", "--effort", "high", "--model", "sonnet"]);
    const prompt = made.find((c) => c[0] === "agent" && c[1] === "prompt")!;
    assert.equal(prompt[2], "search");
    assert.match(prompt[3]!, /specs\/0001-search\/handoff\.md/);
    assert.ok(!made.some((c) => c[0] === "pane" && c[1] === "close"), "herd never closes a pane");
  } finally {
    cleanup();
  }
});

const ROLE_FILES = {
  ".claude/agents/implementer.md": "---\nname: implementer\nmodel: sonnet\n---\n\nBody.\n",
  ".claude/agents/architect.md": "---\nname: architect\nmodel: opus\neffort: xhigh\n---\n\nBody.\n",
  ".claude/agents/scout.md": "---\nname: scout\nmodel: haiku\n---\n\nBody.\n",
};

test("herd up starts an implementer lane on its role's model: --model sonnet --effort high, never /model", () => {
  const { dir, env, calls, cleanup } = herdRepo({}, ROLE_FILES);
  try {
    const plan = runEnv(dir, { ...env, HERDR_ENV: "" }, "herd", "plan");
    assert.match(plan.out, /search\s+implementer\s+--model sonnet --effort high\s+\(model: \.claude\/agents\/implementer\.md; effort: default for sonnet\)/);
    const up = runEnv(dir, env, "herd", "up", "search");
    assert.equal(up.status, 0, up.out);
    assert.match(up.out, /started  search in w1:p10 .* as implementer: --model sonnet --effort high in this tab/);
    const made = calls();
    const start = made.find((c) => c[0] === "agent" && c[1] === "start")!;
    assert.deepEqual(start, ["agent", "start", "search", "--kind", "claude", "--pane", "w1:p10", "--timeout", "60000", "--", "--model", "sonnet", "--effort", "high"]);
    // The kickoff is the only text sent to the agent: a model is never switched by typing into the session.
    const sent = made.filter((c) => c[0] === "agent" && c[1] === "prompt").map((c) => c[3]!);
    assert.ok(sent.length === 1 && !sent.some((t) => /^\/(model|effort)\b/.test(t)), JSON.stringify(sent));
  } finally {
    cleanup();
  }
});

test("herd up gives a lane its configured role: architect from its file, effort from the frontmatter", () => {
  const { dir, env, calls, cleanup } = herdRepo({ laneRoles: { api: "architect" } }, ROLE_FILES);
  try {
    const up = runEnv(dir, env, "herd", "up");
    assert.equal(up.status, 0, up.out);
    const starts = calls().filter((c) => c[0] === "agent" && c[1] === "start");
    assert.deepEqual(starts.map((c) => [c[2], ...c.slice(c.indexOf("--") + 1)]), [
      ["search", "--model", "sonnet", "--effort", "high"],
      ["api", "--model", "opus", "--effort", "xhigh"],
    ]);
  } finally {
    cleanup();
  }
});

test("herd up with a role that has no file falls back to herd.roles, and warns when nothing names a model", () => {
  const withFallback = herdRepo({ roles: { implementer: { model: "sonnet", effort: "medium" } } });
  try {
    const up = runEnv(withFallback.dir, withFallback.env, "herd", "up", "search");
    assert.equal(up.status, 0, up.out);
    const start = withFallback.calls().find((c) => c[1] === "start")!;
    assert.deepEqual(start.slice(start.indexOf("--") + 1), ["--model", "sonnet", "--effort", "medium"]);
  } finally {
    withFallback.cleanup();
  }
  const bare = herdRepo({});
  try {
    const plan = runEnv(bare.dir, { ...bare.env, HERDR_ENV: "" }, "herd", "plan");
    assert.match(plan.out, /warn  role implementer names no model[\s\S]*run on the default model[\s\S]*fix:/);
    const up = runEnv(bare.dir, bare.env, "herd", "up", "search");
    assert.equal(up.status, 0, up.out);
    const start = bare.calls().find((c) => c[1] === "start")!;
    assert.equal(start.indexOf("--") + 1, start.length, "no flags: the warning was the whole point");
  } finally {
    bare.cleanup();
  }
});

test("herd up refuses an effort claude would not accept, before starting anything", () => {
  const { dir, env, calls, cleanup } = herdRepo({}, {
    ".claude/agents/implementer.md": "---\nname: implementer\nmodel: sonnet\neffort: turbo\n---\n",
  });
  try {
    const up = runEnv(dir, env, "herd", "up");
    assert.equal(up.status, 1);
    assert.match(up.out, /role implementer: effort "turbo"[\s\S]*fix:/);
    assert.ok(!calls().some((c) => c[1] === "start"), "nothing was started");
  } finally {
    cleanup();
  }
});

const splits = (made: string[][]): string[][] =>
  made.filter((c) => (c[0] === "pane" && c[1] === "split") || (c[0] === "tab" && c[1] === "create"));

test("herd up fills this tab to the cap, coordinator included, then opens a tab named for the lane", () => {
  // The coordinator's tab already holds 3 panes: one free place, then a new tab.
  const tabs = JSON.stringify({ result: { tabs: [{ tab_id: "w1:t2", pane_count: 3 }] } });
  const { dir, env, calls, cleanup } = herdRepo({}, ROLE_FILES);
  try {
    const plan = runEnv(dir, { ...env, HERDR_TABS: tabs }, "herd", "plan");
    assert.match(plan.out, /at most 4 panes each \(herd\.panesPerTab\); this tab holds 3, coordinator included\n/);
    assert.match(plan.out, /search .*→ this tab\n/);
    assert.match(plan.out, /api .*→ new tab "api"\n/);
    assert.equal(calls().filter((c) => c[0] === "agent" && c[1] === "start").length, 0, "plan starts nothing");
    const up = runEnv(dir, { ...env, HERDR_TABS: tabs }, "herd", "up");
    assert.equal(up.status, 0, up.out);
    const [first, second] = splits(calls());
    assert.deepEqual(first!.slice(0, 5), ["pane", "split", "--current", "--direction", "down"]);
    assert.deepEqual(second!.slice(0, 2), ["tab", "create"]);
    assert.equal(second![second!.indexOf("--label") + 1], "api");
    assert.ok(second![second!.indexOf("--cwd") + 1]!.endsWith("-api"));
    // The agent for the lane in the new tab starts in that tab's root pane, not in this tab's.
    const starts = calls().filter((c) => c[0] === "agent" && c[1] === "start");
    assert.deepEqual(starts.map((c) => [c[2], c[c.indexOf("--pane") + 1]]), [["search", "w1:p10"], ["api", "w1:p11"]]);
    assert.match(up.out, /started  api in w1:p11 .* in new tab "api"/);
  } finally {
    cleanup();
  }
});

test("with room in this tab agents split it: the first to the right, the next below the newest pane", () => {
  const { dir, env, calls, cleanup } = herdRepo({ panesPerTab: 4 }, ROLE_FILES);
  try {
    const up = runEnv(dir, env, "herd", "up");
    assert.equal(up.status, 0, up.out);
    const made = splits(calls());
    assert.deepEqual(made.map((c) => c.slice(0, 5)), [
      ["pane", "split", "--current", "--direction", "right"],
      ["pane", "split", "--pane", "w1:p10", "--direction"],
    ]);
    assert.equal(made[1]![5], "down");
    assert.ok(!made.some((c) => c[0] === "tab"), "two agents and a coordinator fit in four");
  } finally {
    cleanup();
  }
});

test("herd.panesPerTab moves the cap: at 2 the coordinator's tab has room for one agent", () => {
  const { dir, env, calls, cleanup } = herdRepo({ panesPerTab: 2 }, ROLE_FILES);
  try {
    const up = runEnv(dir, env, "herd", "up");
    assert.equal(up.status, 0, up.out);
    assert.deepEqual(splits(calls()).map((c) => c.slice(0, 2).join(" ")), ["pane split", "tab create"]);
    const bad = runEnv(dir, env, "herd", "plan");
    assert.equal(bad.status, 0, bad.out);
  } finally {
    cleanup();
  }
});

test("herd plan outside herdr assumes the coordinator is alone in its tab, and says so", () => {
  const { dir, env, cleanup } = herdRepo({}, ROLE_FILES);
  try {
    const plan = runEnv(dir, { ...env, HERDR_ENV: "" }, "herd", "plan");
    assert.match(plan.out, /this tab holds 1, coordinator included \(assumed: not inside a herdr pane\)/);
    assert.match(plan.out, /→ this tab/);
  } finally {
    cleanup();
  }
});

test("herd up starts every runnable lane, staggered, and leaves the held one", () => {
  const { dir, env, calls, cleanup } = herdRepo({});
  try {
    const up = runEnv(dir, env, "herd", "up");
    assert.equal(up.status, 0, up.out);
    const starts = calls().filter((c) => c[0] === "agent" && c[1] === "start");
    assert.deepEqual(starts.map((c) => c[2]), ["search", "api"], "one per runnable lane, ranking held");
    assert.match(up.out, /still held: ranking/);
  } finally {
    cleanup();
  }
});

test("herd up outside herdr fails with the fix, and refuses a lane the plan holds", () => {
  const { dir, env, calls, cleanup } = herdRepo({});
  try {
    const outside = runEnv(dir, { ...env, HERDR_ENV: "" }, "herd", "up");
    assert.equal(outside.status, 1);
    assert.match(outside.out, /inside a herdr pane[\s\S]*fix:/);
    const held = runEnv(dir, env, "herd", "up", "ranking");
    assert.equal(held.status, 1);
    assert.match(held.out, /ranking cannot start now/);
    assert.ok(!calls().some((c) => c[1] === "start" || c[1] === "run"), "nothing was started");
  } finally {
    cleanup();
  }
});

test("herd status joins herdr's agents with the lanes, blocked first", () => {
  const { dir, env, cleanup } = herdRepo({});
  try {
    const agents = JSON.stringify({ result: { agents: [{ name: "search", pane_id: "w1:p2", state: "working" }, { name: "api", pane_id: "w1:p3", state: "blocked" }] } });
    const status = runEnv(dir, { ...env, HERDR_AGENTS: agents }, "herd", "status");
    assert.equal(status.status, 0, status.out);
    const order = status.out.split("\n").filter((l) => /^\s+(blocked|working|not started)\s/.test(l)).map((l) => l.trim().split(/\s+/)[0]);
    assert.deepEqual(order, ["blocked", "working", "not"]);
    assert.match(status.out, /yes  herdr on PATH/);
  } finally {
    cleanup();
  }
});

test("hook task-completed exits 2 with the failure while check is red, and 0 when green", () => {
  const green = fixture(BASE);
  const red = fixture({ ...BASE, "README.md": "# Project\n\nRuns in CI. <!-- proof: make deploy -->\n" });
  try {
    assert.equal(run(green, "hook", "task-completed").status, 0);
    const refused = run(red, "hook", "task-completed");
    assert.equal(refused.status, 2, refused.out);
    assert.match(refused.out, /no make command named "deploy"/);
    assert.match(refused.out, /cannot be marked completed/);
  } finally {
    rmSync(green, { recursive: true, force: true });
    rmSync(red, { recursive: true, force: true });
  }
});

// ---- spec 0012: switching goals is a normal path, not an exception

test("switching goals: pause with a reason, start the new lane on the same paths, and check stays green", () => {
  const today = new Date().toISOString().slice(0, 10);
  const dir = fixture({
    "harnessimo.config.json": JSON.stringify({ tracks: { file: "specs/TRACKS.md", log: "specs/TRACKS-LOG.md", staleAfterDays: 7 } }),
    "specs/TRACKS.md":
      "# Work tracks\n\n" +
      "- **Totals (spec 0001)** — [handoff](specs/0001-totals/handoff.md) — active, 2020-01-01, next: T2 rounding\n" +
      `- **Billing (spec 0002)** — [handoff](specs/0002-billing/handoff.md) — active, ${today}, next: T1\n`,
    "specs/TRACKS-LOG.md": "# Closed tracks\n",
    "specs/0001-totals/handoff.md": "# Handoff\n\n## Owns\n\n- src/checkout/\n\n## State\n\nT1 done.\n",
    "specs/0001-totals/tasks.md": "- [x] **T1** half of the lane, ticked before the switch\n",
    "specs/0002-billing/handoff.md": "# Handoff\n\n## Owns\n\n- src/checkout/billing.ts\n",
  });
  try {
    const before = run(dir, "check");
    assert.equal(before.status, 1, "two live lanes on one path, a stale line and an unproven box");
    assert.match(before.out, /also claimed by/);

    const bare = run(dir, "track", "pause", "totals");
    assert.equal(bare.status, 1, "a pause needs its reason");
    assert.match(bare.out, /--reason/);

    const pause = run(dir, "track", "pause", "totals", "--reason", "owner switched to billing");
    assert.equal(pause.status, 0, pause.out);
    assert.match(readFileSync(join(dir, "specs/TRACKS.md"), "utf8"), new RegExp(`paused \\(owner switched to billing\\), ${today}, next: T2 rounding`));
    assert.match(readFileSync(join(dir, "specs/0001-totals/handoff.md"), "utf8"), /## State\n\n- \*\*Paused [\d-]+:\*\* owner switched to billing/);

    const during = run(dir, "check");
    assert.equal(during.status, 0, `the goal switch itself must not turn anything red:\n${during.out}`);

    const resume = run(dir, "track", "resume", "totals");
    assert.equal(resume.status, 0, resume.out);
    const after = run(dir, "check");
    assert.equal(after.status, 1, "resumed, the fence and the gate apply again");
    assert.match(after.out, /also claimed by/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
