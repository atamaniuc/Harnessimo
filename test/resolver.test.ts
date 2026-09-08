// What counts as this repository's files, and what does not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectDocs, collectFiles } from "../src/resolver.ts";

test("a repository nested inside this one is not scanned as part of it", () => {
  // A `claude --worktree` session, a submodule, or a vendored clone. Walking in
  // scans every document twice, and a worktree sitting on an older commit then
  // fails on claims this repository has already fixed. Found by putting a real
  // worktree under specs/ and watching 45 documents become 88.
  const dir = mkdtempSync(join(tmpdir(), "harness-nested-"));
  mkdirSync(join(dir, "specs", "wt", "specs"), { recursive: true });
  writeFileSync(join(dir, "specs", "mine.md"), "# Mine\n");
  // A worktree's `.git` is a file; a clone's is a directory. Existence is the test.
  writeFileSync(join(dir, "specs", "wt", ".git"), "gitdir: /elsewhere/.git/worktrees/wt\n");
  writeFileSync(join(dir, "specs", "wt", "specs", "theirs.md"), "# Theirs\n");

  assert.deepEqual(
    collectDocs(dir, { roots: ["specs"], skip: [], maxDepth: 4 }),
    ["specs/mine.md"],
    "the nested repository's documents are not this repository's",
  );
  assert.deepEqual(
    collectFiles(dir, { scan: ["specs"], skip: [] }),
    ["specs/mine.md"],
    "and the same for the clean-state scan, which reads code rather than documents",
  );

  rmSync(dir, { recursive: true, force: true });
});

test("a nested clone is skipped too, not only a worktree", () => {
  const dir = mkdtempSync(join(tmpdir(), "harness-nested-"));
  mkdirSync(join(dir, "docs", "vendor", ".git", "objects"), { recursive: true });
  writeFileSync(join(dir, "docs", "ours.md"), "# Ours\n");
  writeFileSync(join(dir, "docs", "vendor", "theirs.md"), "# Theirs\n");

  assert.deepEqual(collectDocs(dir, { roots: ["docs"], skip: [], maxDepth: 4 }), ["docs/ours.md"]);
  rmSync(dir, { recursive: true, force: true });
});
