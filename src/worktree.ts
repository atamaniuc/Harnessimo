// Parallel worktrees (spec 0011): one checkout per independent stream of work.
//
// Pure decisions only — what a worktree is called, where it goes, what to run
// in it, and whether an add, a merge or a remove is safe. `src/cli.ts` asks git
// the questions and hands the answers here, so every refusal is testable
// without a repository on disk.
//
// Each refusal says what to do instead. A parallel run is where an agent is
// least watched, and "fatal: already exists" leaves it guessing.

import { basename, join, resolve } from "node:path";

export const WORKTREE_DEFAULTS = {
  /** Branch prefix: `wt-search` for `worktree add search`. */
  prefix: "wt-",
  /** Where worktrees go, relative to the main checkout. ".." is beside it. */
  dir: "..",
  /** Commands run in a fresh worktree. Null means: the install step of coldStart.commands. */
  install: null as string[] | null,
};

/**
 * A worktree name is a branch suffix and a directory suffix at once, so it has
 * to be valid as both — and short enough to type.
 */
export function nameProblem(name: string | undefined): string | null {
  if (!name) return "a worktree needs a name\n  fix:  harnessimo worktree add <name>   (e.g. `harnessimo worktree add search`)";
  if (!/^[a-z0-9][a-z0-9._-]{0,47}$/i.test(name) || name.includes("..") || name.endsWith(".lock") || name.endsWith(".")) {
    return (
      `"${name}" cannot name a worktree\n` +
      "  why:  it becomes both a directory and a branch name, so it must be valid as each\n" +
      "  fix:  letters, digits, '.', '_' and '-', starting with a letter or digit, at most 48 characters"
    );
  }
  return null;
}

/** Where a named worktree lives and which branch it is on. */
export function worktreeTarget({
  mainRoot,
  name,
  prefix = WORKTREE_DEFAULTS.prefix,
  dir = WORKTREE_DEFAULTS.dir,
}: {
  mainRoot: string;
  name: string;
  prefix?: string;
  dir?: string;
}): { path: string; branch: string } {
  // The directory carries the repository's name, or `../search` from two
  // repositories would be the same directory.
  const path = join(resolve(mainRoot, dir), `${basename(resolve(mainRoot))}-${name}`);
  return { path, branch: `${prefix}${name}` };
}

/**
 * Commands that turn a fresh worktree into one the checks can run in. A fresh
 * checkout has no dependencies, and a pre-commit hook that needs them fails on
 * the first commit — far from the cause.
 */
const INSTALL = /^(npm (ci|install|i)|pnpm (install|i)|yarn( install)?|bun install|pip install|poetry install|uv sync|bundle install|go mod download|cargo fetch|composer install)(\s|$)/;

export function installCommands(install: string[] | null | undefined, coldStart: string[] = []): string[] {
  if (Array.isArray(install)) return install;
  return coldStart.filter((cmd) => INSTALL.test(cmd.trim()));
}

export function addProblem({
  path,
  branch,
  dirExists,
  branchExists,
}: {
  path: string;
  branch: string;
  dirExists: boolean;
  branchExists: boolean;
}): string | null {
  if (dirExists) {
    return (
      `${path} already exists\n` +
      "  why:  adding a worktree over a directory would mix two checkouts' files\n" +
      "  fix:  pick another name, or remove it first: harnessimo worktree remove <name>"
    );
  }
  if (branchExists) {
    return (
      `branch ${branch} already exists\n` +
      "  why:  a new stream on an old branch inherits work nobody in this stream wrote\n" +
      `  fix:  pick another name; or, to resume that branch on purpose: git worktree add ${path} ${branch}`
    );
  }
  return null;
}

export function mergeProblem({
  branch,
  path,
  current,
  branchExists,
  worktreeDirty,
  hereDirty,
}: {
  branch: string;
  path: string;
  current: string;
  branchExists: boolean;
  worktreeDirty: boolean;
  hereDirty: boolean;
}): string | null {
  if (!branchExists) return `there is no branch ${branch}\n  fix:  harnessimo worktree list   shows what exists`;
  if (current === branch) {
    return (
      `this checkout is on ${branch} itself\n` +
      "  fix:  run the merge from the checkout the stream merges into"
    );
  }
  if (worktreeDirty) {
    return (
      `${path} has uncommitted changes\n` +
      "  why:  a merge takes commits; what is not committed stays behind and looks merged\n" +
      `  fix:  commit them in ${path} (or discard them), then merge`
    );
  }
  if (hereDirty) {
    return (
      "this checkout has uncommitted changes\n" +
      "  why:  a merge on top of them mixes two pieces of work in one conflict\n" +
      "  fix:  commit or stash them first"
    );
  }
  return null;
}

export function removeProblem({
  branch,
  path,
  registered,
  branchExists,
  dirty,
  merged,
}: {
  branch: string;
  path: string;
  registered: boolean;
  branchExists: boolean;
  dirty: boolean;
  merged: boolean;
}): string | null {
  if (!registered && !branchExists) {
    return `there is no worktree at ${path} and no branch ${branch}\n  fix:  harnessimo worktree list   shows what exists`;
  }
  if (registered && dirty) {
    return (
      `${path} has uncommitted changes\n` +
      "  why:  removing the worktree deletes them, and nothing else has a copy\n" +
      `  fix:  commit and merge them; to throw them away deliberately: git worktree remove --force ${path}`
    );
  }
  if (branchExists && !merged) {
    return (
      `${branch} is not merged into this checkout\n` +
      "  why:  deleting the branch would lose commits nobody has merged\n" +
      `  fix:  harnessimo worktree merge <name> first; to drop the work deliberately: git branch -D ${branch}`
    );
  }
  return null;
}
