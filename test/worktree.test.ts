// The decisions behind `harnessimo worktree`, against plain values: what a
// worktree is called, what runs in it, and when add, merge and remove refuse.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addProblem, installCommands, mergeProblem, nameProblem, removeProblem, worktreeTarget } from "../src/worktree.ts";
import { reason } from "./helpers.ts";

test("a worktree sits beside the repository, named after it, on a prefixed branch", () => {
  assert.deepEqual(worktreeTarget({ mainRoot: "/work/shop", name: "search" }), {
    path: "/work/shop-search",
    branch: "wt-search",
  });
  assert.deepEqual(worktreeTarget({ mainRoot: "/work/shop", name: "search", prefix: "ms-", dir: "../streams" }), {
    path: "/work/streams/shop-search",
    branch: "ms-search",
  });
});

test("a name that cannot be both a directory and a branch is refused, with what can", () => {
  assert.equal(nameProblem("search-v2"), null);
  assert.match(reason(nameProblem(undefined)), /needs a name/);
  for (const bad of ["../escape", "a/b", "-flag", "x.lock", "a..b", "has space", "x".repeat(49)]) {
    assert.match(reason(nameProblem(bad)), /letters, digits/, bad);
  }
});

test("the install step comes from the config, or from the cold-start install command", () => {
  assert.deepEqual(installCommands(["make deps"], ["npm ci"]), ["make deps"]);
  assert.deepEqual(installCommands([], ["npm ci"]), [], "an empty list is a choice to run nothing");
  assert.deepEqual(installCommands(null, ["npm ci", "npm test", "node src/cli.ts check"]), ["npm ci"]);
  assert.deepEqual(installCommands(undefined, ["make test"]), [], "a verification is never mistaken for an install");
});

test("add refuses an existing directory and an existing branch, and says what to do", () => {
  const base = { path: "/w/shop-search", branch: "wt-search" };
  assert.equal(addProblem({ ...base, dirExists: false, branchExists: false }), null);
  assert.match(reason(addProblem({ ...base, dirExists: true, branchExists: false })), /already exists[\s\S]*fix:/);
  assert.match(reason(addProblem({ ...base, dirExists: false, branchExists: true })), /git worktree add \/w\/shop-search wt-search/);
});

test("merge refuses uncommitted work on either side, a missing branch, and merging into itself", () => {
  const base = { branch: "wt-search", path: "/w/shop-search", current: "main", branchExists: true, worktreeDirty: false, hereDirty: false };
  assert.equal(mergeProblem(base), null);
  assert.match(reason(mergeProblem({ ...base, branchExists: false })), /no branch wt-search/);
  assert.match(reason(mergeProblem({ ...base, current: "wt-search" })), /on wt-search itself/);
  assert.match(reason(mergeProblem({ ...base, worktreeDirty: true })), /stays behind and looks merged/);
  assert.match(reason(mergeProblem({ ...base, hereDirty: true })), /commit or stash/);
});

test("remove refuses a dirty worktree and an unmerged branch, naming the deliberate way out", () => {
  const base = { branch: "wt-search", path: "/w/shop-search", registered: true, branchExists: true, dirty: false, merged: true };
  assert.equal(removeProblem(base), null);
  assert.match(reason(removeProblem({ ...base, dirty: true })), /git worktree remove --force/);
  assert.match(reason(removeProblem({ ...base, merged: false })), /not merged[\s\S]*git branch -D wt-search/);
  assert.match(reason(removeProblem({ ...base, registered: false, branchExists: false })), /no worktree/);
  assert.equal(removeProblem({ ...base, registered: false }), null, "a branch whose directory is gone can still be cleaned up");
});
