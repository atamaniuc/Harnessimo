// The filesystem edge. Everything above this file is pure and unit-tested;
// this is the one place that reads the world, so the rules stay testable
// without a fixture tree and the world stays swappable in tests.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Parses the names a project's command runner exposes, so a
 * `<!-- proof: make check -->` marker can be resolved against the real file
 * rather than trusted.
 *
 * @param {string} root
 * @param {Record<string,string>} commands  marker prefix -> file that declares them
 */
function commandNamesFor(root, commands, kind) {
  const file = commands?.[kind];
  if (!file) return null;
  const path = join(root, file);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  if (/\.ya?ml$/.test(file)) {
    // Taskfile: two-space-indented keys under `tasks:`
    return [...text.matchAll(/^ {2}([A-Za-z][\w:-]*):$/gm)].map((m) => m[1]);
  }
  if (/package\.json$/.test(file)) {
    try {
      return Object.keys(JSON.parse(text).scripts ?? {});
    } catch {
      return [];
    }
  }
  // Makefile and anything else target-shaped
  return [...text.matchAll(/^([A-Za-z][\w.-]*):(?!=)/gm)].map((m) => m[1]);
}

/**
 * @param {string} root
 * @param {{ commands?: Record<string,string>, migrations?: string | null }} docs
 * @returns {import("./proof.mjs").Resolver}
 */
export function createResolver(root, docs = {}) {
  return {
    fileExists: (path) => existsSync(join(root, path)),
    readFile: (path) => readFileSync(join(root, path), "utf8"),
    commandNames: (kind) => commandNamesFor(root, docs.commands ?? {}, kind),
    migrationNames: () => {
      if (!docs.migrations) return null;
      const dir = join(root, docs.migrations);
      return existsSync(dir) ? readdirSync(dir) : [];
    },
  };
}

/**
 * Every Markdown document the gate should read, from the configured roots.
 *
 * @param {string} root
 * @param {{ roots: string[], skip: string[], maxDepth: number }} docs
 * @returns {string[]} repo-relative paths, sorted
 */
export function collectDocs(root, docs) {
  const skip = new Set(docs.skip ?? []);
  const out = [];
  const walk = (dir, depth) => {
    if (depth > (docs.maxDepth ?? 4)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || skip.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.name.endsWith(".md")) out.push(relative(root, full));
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
 * @param {string} root
 * @param {{ scan: string[], skip?: string[], maxDepth?: number }} options
 * @returns {string[]} repo-relative paths, sorted
 */
export function collectFiles(root, { scan, skip = [], maxDepth = 8 }) {
  const skipped = new Set(skip);
  const out = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth || !existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || skipped.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else out.push(relative(root, full));
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

/** @param {string} root @param {string[]} paths */
export function readAll(root, paths) {
  return paths.map((path) => ({ path, text: readFileSync(join(root, path), "utf8") }));
}
