// The filesystem edge. Everything above this file is pure and unit-tested;
// this is the one place that reads the world, so the rules stay testable
// without a fixture tree and the world stays swappable in tests.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import type { DocsConfig, Resolver, SourceFile } from "./types.ts";
import { join, relative } from "node:path";

/**
 * Parses the names a project's command runner exposes, so a
 * `<!-- proof: make check -->` marker can be resolved against the real file
 * rather than trusted.
 *
 * @param commands  marker prefix -> file that declares them
 */
function commandNamesFor(
  root: string,
  commands: Record<string, string>,
  kind: string,
): string[] | null {
  const file = commands?.[kind];
  if (!file) return null;
  const path = join(root, file);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  if (/\.ya?ml$/.test(file)) {
    // Taskfile: two-space-indented keys under `tasks:`
    return [...text.matchAll(/^ {2}([A-Za-z][\w:-]*):$/gm)].map((m) => m[1]!);
  }
  if (/package\.json$/.test(file)) {
    try {
      return Object.keys((JSON.parse(text) as { scripts?: Record<string, unknown> }).scripts ?? {});
    } catch {
      return [];
    }
  }
  // Makefile and anything else target-shaped
  return [...text.matchAll(/^([A-Za-z][\w.-]*):(?!=)/gm)].map((m) => m[1]!);
}

export function createResolver(
  root: string,
  docs: Pick<Partial<DocsConfig>, "commands" | "migrations"> = {},
): Resolver {
  return {
    fileExists: (path: string) => existsSync(join(root, path)),
    readFile: (path: string) => readFileSync(join(root, path), "utf8"),
    commandNames: (kind: string) => commandNamesFor(root, docs.commands ?? {}, kind),
    migrationNames: () => {
      if (!docs.migrations) return null;
      const dir = join(root, docs.migrations);
      return existsSync(dir) ? readdirSync(dir) : [];
    },
  };
}

/**
 * Whether a directory is a repository of its own — a git worktree, a submodule
 * or a vendored clone.
 *
 * Its files belong to that repository, not to this one. Walking into it scans
 * every document twice, and when the worktree sits on an older commit the
 * second copy fails on claims this repository already fixed. `.git` is a
 * directory in a clone and a file in a worktree, so existence is the test.
 */
function isOwnRepository(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}

/**
 * Every Markdown document the gate should read, from the configured roots.
 *
 * Returns repo-relative paths, sorted.
 */
export function collectDocs(root: string, docs: { roots: string[], skip: string[], maxDepth: number }): string[] {
  const skip = new Set(docs.skip ?? []);
  const out: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > (docs.maxDepth ?? 4)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || skip.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (isOwnRepository(full)) continue;
        walk(full, depth + 1);
      } else if (entry.name.endsWith(".md")) out.push(relative(root, full));
    }
  };
  for (const sub of docs.roots ?? ["."]) {
    const dir = join(root, sub);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    if (sub === ".") {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".md")) out.push(entry.name);
      }
    } else {
      walk(dir, 0);
    }
  }
  return [...new Set(out)].sort();
}

/**
 * Every file under the configured prefixes, whatever its extension — the
 * clean-state check reads code, not only documents.
 *
 * Returns repo-relative paths, sorted.
 */
export function collectFiles(root: string, { scan, skip = [], maxDepth = 8 }: { scan: string[], skip?: string[], maxDepth?: number }): string[] {
  const skipped = new Set(skip);
  const out: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth || !existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || skipped.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (isOwnRepository(full)) continue;
        walk(full, depth + 1);
      } else out.push(relative(root, full));
    }
  };
  for (const sub of scan) {
    const dir = join(root, sub);
    if (!existsSync(dir)) continue;
    if (statSync(dir).isDirectory()) walk(dir, 0);
    else out.push(sub);
  }
  return [...new Set(out)].sort();
}

/** @param root @param paths */
export function readAll(root: string, paths: string[]) {
  return paths.map((path) => ({ path, text: readFileSync(join(root, path), "utf8") }));
}
