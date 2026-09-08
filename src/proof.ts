// Proof markers: every claim in prose names the evidence that makes it true.
//
// The disease this cures, observed in a real repository: for weeks the README
// said "all deployable infrastructure is stood up through a single Pulumi
// program in infra/" while infra/ did not exist, and "LLM-as-judge
// groundedness blocks the merge" three screens above a TODO admitting it was
// never computed. Prose cannot be trusted to stay true on its own, so a
// document names its evidence and a gate fails when the evidence is gone.
//
// Marker syntax, in an HTML comment so it never renders:
//
//   <!-- proof: src/features/rag/search.ts -->            the file exists
//   <!-- proof: src/features/rag/search.ts:searchChunks -->  ...and contains that text
//   <!-- proof: test/rls.spec.ts#every table has RLS -->  ...and contains that test name
//   <!-- proof: task check -->                            the Taskfile defines that task
//   <!-- proof: make check -->                            the Makefile defines that target
//   <!-- proof: migration:20260821110000 -->               a migration with that prefix exists
//
// This module is the pure half: no filesystem access, so every rule in it is
// unit-testable without a fixture tree. The filesystem edge is src/resolver.mjs.

import type { Problem, Resolver, SourceFile } from "./types.ts";

const MARKER = /<!--\s*proof:\s*(.+?)\s*-->/g;

/**
 * Resolves one marker target. Returns null when the claim holds, or the reason
 * it does not — phrased for whoever has to fix it, which is usually a fresh
 * session with no memory of why the claim was made.
 *
 */
export function checkTarget(target: string, resolver: Resolver): string | null {
  const command = /^(task|make|npm run|pnpm run|just)\s+(.+)$/.exec(target.trim());
  if (command) {
    // Both groups matched or the regex would not have: the pattern has no
    // optional captures.
    const kind = command[1]!;
    const name = command[2]!;
    const names = resolver.commandNames(kind);
    if (names === null) {
      return `this repository declares no "${kind}" command file, so "${target}" cannot be checked (add it to harnessimo.config.json → docs.commands)`;
    }
    return names.includes(name.trim()) ? null : `no ${kind} command named "${name.trim()}"`;
  }

  if (target.startsWith("migration:")) {
    const prefix = target.slice("migration:".length).trim();
    const migrations = resolver.migrationNames();
    if (migrations === null) {
      return `this repository declares no migrations directory, so "${target}" cannot be checked (add it to harnessimo.config.json → docs.migrations)`;
    }
    return migrations.some((m) => m.startsWith(prefix)) ? null : `no migration starts with "${prefix}"`;
  }

  const hash = target.indexOf("#");
  if (hash !== -1) {
    const path = target.slice(0, hash).trim();
    const needle = target.slice(hash + 1).trim();
    if (!resolver.fileExists(path)) return `file "${path}" does not exist`;
    return resolver.readFile(path).includes(needle) ? null : `"${path}" does not contain "${needle}"`;
  }

  const colon = target.lastIndexOf(":");
  if (colon > 1) {
    const path = target.slice(0, colon).trim();
    const symbol = target.slice(colon + 1).trim();
    if (!resolver.fileExists(path)) return `file "${path}" does not exist`;
    return resolver.readFile(path).includes(symbol) ? null : `"${path}" does not contain "${symbol}"`;
  }

  return resolver.fileExists(target) ? null : `file "${target}" does not exist`;
}

/**
 * A marker that documents the syntax rather than making a claim.
 *
 * The rule has to exist because a project's own docs explain how to write a
 * marker, and their examples are written as markers. Placeholder punctuation —
 * `...`, `[optional]`, `<angle>` — is what separates an illustration from an
 * assertion, and no real path contains any of it.
 *
 */
export function isSyntaxExample(target: string) {
  return /\.\.\.|[[\]<>|]/.test(target);
}

export function findMarkers(text: string): { line: number; target: string }[] {
  const found: { line: number; target: string }[] = [];
  text.split("\n").forEach((lineText, index) => {
    for (const match of lineText.matchAll(MARKER)) {
      const target = match[1]!;
      if (isSyntaxExample(target)) continue;
      found.push({ line: index + 1, target });
    }
  });
  return found;
}

/**
 * Checks every marker in every document, and — in strict mode — that the
 * documents which carry the project's central claims carry at least one marker
 * at all. A document with no marker is not evidence of a document with no
 * claims; it is the state the gate exists to end.
 *
 */
export function verifyProofs(files: { path: string, text: string }[], resolver: Resolver, options: { strict?: boolean, mustCarryProof?: string[] } = {}): Problem[] {
  const { strict = false, mustCarryProof = [] } = options;
  const problems = [];
  for (const file of files) {
    const markers = findMarkers(file.text);
    if (strict && mustCarryProof.includes(file.path) && markers.length === 0) {
      problems.push({
        file: file.path,
        line: 1,
        target: "(none)",
        reason:
          "carries no proof marker; a claim with no evidence at all is the defect this gate exists for",
      });
    }
    for (const marker of markers) {
      const reason = checkTarget(marker.target, resolver);
      if (reason) {
        problems.push({ file: file.path, line: marker.line, target: marker.target, reason });
      }
    }
  }
  return problems;
}
