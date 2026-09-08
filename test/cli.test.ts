// End-to-end: the CLI against a real repository on disk. The unit tests prove
// the rules; this proves the wiring — that `harnessimo check` reads the config,
// finds the documents, and exits non-zero on a broken claim.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  assert.match(out, /every configured check passes/);
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
