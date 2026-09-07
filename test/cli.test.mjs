// End-to-end: the CLI against a real repository on disk. The unit tests prove
// the rules; this proves the wiring — that `harness check` reads the config,
// finds the documents, and exits non-zero on a broken claim.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), "../bin/harness.mjs");

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "harness-cli-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, dirname(path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

function run(dir, ...argv) {
  try {
    return { status: 0, out: execFileSync(process.execPath, [CLI, ...argv], { cwd: dir, encoding: "utf8" }) };
  } catch (error) {
    return { status: error.status ?? 1, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

const CONFIG = JSON.stringify({
  docs: { roots: [".", "specs"], mustCarryProof: ["README.md"], commands: { make: "Makefile" } },
  tracks: { file: "specs/TRACKS.md", log: "specs/TRACKS-LOG.md" },
});

const BASE = {
  "harness.config.json": CONFIG,
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
  assert.match(out, /no "make" command named "deploy"/);
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
  assert.match(out, /harness init/);
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
