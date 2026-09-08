// A resolver over an in-memory tree: every rule in src/ is pure, so its tests
// need no fixture directory and no cleanup.
import assert from "node:assert/strict";
import type { DetectedConfig, LoadedConfig, Resolver } from "../src/types.ts";

export function fakeResolver({
  files = {},
  commands = {},
  migrations = null,
}: {
  files?: Record<string, string>;
  commands?: Record<string, string[]>;
  migrations?: string[] | null;
} = {}): Resolver {
  return {
    fileExists: (path) => Object.hasOwn(files, path),
    readFile: (path) => files[path] ?? "",
    commandNames: (kind) => commands[kind] ?? null,
    migrationNames: () => migrations,
  };
}

/**
 * The failure a rule produced, asserting there was one. Rules return null when
 * the claim holds, so a test that expects a message has to say so — and this
 * says it once instead of at every call site.
 */
export function reason(value: string | null | undefined): string {
  assert.ok(value !== null && value !== undefined, "expected a failure message, got none");
  return value;
}

/**
 * A configuration section, asserting it was written at all. `detect` and
 * `loadConfig` both return configurations whose sections are optional — that is
 * the point of them — so a test reading one has to say which it expects.
 */
export function section<C extends DetectedConfig | LoadedConfig, K extends keyof C>(
  config: C,
  name: K,
): NonNullable<C[K]> {
  const value = config[name];
  assert.ok(value, `expected a "${String(name)}" section, and there is none`);
  return value as NonNullable<C[K]>;
}
