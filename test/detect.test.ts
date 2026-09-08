import { test } from "node:test";
import assert from "node:assert/strict";
import { section } from "./helpers.ts";
import { detectConfig } from "../src/detect.ts";
import type { Repo } from "../src/types.ts";

/** A repository described as a set of paths, so detection is testable without one. */
function repoOf(files: Record<string, string>, dirs: string[] = []): Repo {
  const dirSet = new Set(dirs);
  return {
    exists: (p) => Object.hasOwn(files, p) || dirSet.has(p),
    isDir: (p) => dirSet.has(p),
    read: (p) => files[p] ?? "",
  };
}

test("a Make project gets make commands and its check target as cold start", () => {
  const { config } = detectConfig(
    repoOf({ Makefile: "setup:\n\tpnpm i\ncheck:\n\tpnpm test\n", "README.md": "# x", "pnpm-lock.yaml": "" }, ["src"]),
  );
  assert.deepEqual(section(config, "docs").commands, { make: "Makefile" });
  assert.deepEqual(section(config, "coldStart").commands, ["pnpm install --frozen-lockfile", "make check"]);
});

test("a Taskfile project gets task commands, and package.json scripts alongside", () => {
  const { config } = detectConfig(
    repoOf({ "Taskfile.yml": "tasks:\n  check:\n    cmds: []\n", "package.json": '{"scripts":{"test":"vitest"}}' }),
  );
  assert.equal(section(config, "docs").commands!.task, "Taskfile.yml");
  assert.equal(section(config, "docs").commands!["npm run"], "package.json");
  assert.equal(section(config, "coldStart").commands!.at(-1), "task check");
});

test("only directories that exist are scanned or locked", () => {
  const { config } = detectConfig(repoOf({ "README.md": "# x" }, ["src", "docs"]));
  assert.deepEqual(section(config, "cleanExit").scan, ["src"]);
  assert.deepEqual(section(config, "docs").roots, [".", "docs", "specs"]);
  assert.equal(config.locked, undefined); // no workflow directory: nothing to protect
});

test("strict mode is off until a document actually carries a marker", () => {
  // The failure this prevents: `init` producing a configuration whose very
  // first run is red for a setting the user never chose.
  const without = detectConfig(repoOf({ "README.md": "# x\nWe do things." }));
  assert.deepEqual(section(without.config, "docs").mustCarryProof, []);
  assert.ok(without.missing.some((m) => m.includes("strict mode off")));

  const with_ = detectConfig(repoOf({ "README.md": "# x\nWe do things. <!-- proof: src/a.ts -->" }));
  assert.deepEqual(section(with_.config, "docs").mustCarryProof, ["README.md"]);
});

test("a migrations directory is wired up when one exists", () => {
  const { config, found } = detectConfig(repoOf({}, ["supabase/migrations"]));
  assert.equal(section(config, "docs").migrations, "supabase/migrations");
  assert.ok(found.some((f) => f.includes("supabase/migrations")));
});

test("what could not be configured is reported rather than guessed", () => {
  const { missing } = detectConfig(repoOf({}));
  assert.ok(missing.some((m) => m.includes("no command runner")));
  assert.ok(missing.some((m) => m.includes("locked surfaces left off")));
});
