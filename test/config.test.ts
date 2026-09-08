import { test } from "node:test";
import assert from "node:assert/strict";
import { section } from "./helpers.ts";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigError, enabledChecks, loadConfig } from "../src/config.ts";

const withConfig = <T,>(contents: string | null, fn: (dir: string) => T): T => {
  const dir = mkdtempSync(join(tmpdir(), "harness-config-"));
  try {
    if (contents !== null) writeFileSync(join(dir, "harnessimo.config.json"), contents);
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("a repository with no config has no configured checks", () => {
  withConfig(null, (dir) => {
    const cfg = loadConfig(dir);
    assert.equal(cfg.path, null);
    assert.deepEqual(Object.values(enabledChecks(cfg)).filter(Boolean), []);
  });
});

test("a declared section is merged onto its defaults", () => {
  withConfig('{"docs":{"mustCarryProof":["README.md"]}}', (dir) => {
    const cfg = loadConfig(dir);
    assert.deepEqual(section(cfg, "docs").mustCarryProof, ["README.md"]);
    assert.deepEqual(section(cfg, "docs").roots, [".", "docs", "specs"]);
    assert.equal(enabledChecks(cfg).proof, true);
    assert.equal(enabledChecks(cfg).queue, false);
  });
});

test("a misspelled section is rejected rather than silently ignored", () => {
  // A typo that disables a check without telling anyone is the exact failure
  // this configuration format refuses to have.
  withConfig('{"trakcs":{}}', (dir) => {
    assert.throws(() => loadConfig(dir), (e: unknown) => e instanceof ConfigError && /unknown section/.test(e.message));
  });
});

test("unreadable configuration fails loudly instead of skipping every check", () => {
  withConfig("{not json", (dir) => {
    assert.throws(() => loadConfig(dir), (e: unknown) => e instanceof ConfigError && /not valid JSON/.test(e.message));
  });
});

test("a per-section $comment is documentation, not a typo", () => {
  withConfig('{"cleanExit":{"$comment":"why we chose these","scan":["src"]}}', (dir) => {
    assert.equal(enabledChecks(loadConfig(dir)).cleanExit, true);
  });
});

test("a misspelled key inside a section is rejected too", () => {
  // The dangerous shape: the section is right, one key is wrong, so the check
  // runs with a default nobody chose and reports green.
  withConfig('{"cleanExit":{"scann":["src"]}}', (dir) => {
    assert.throws(() => loadConfig(dir), (e: unknown) => e instanceof ConfigError && /unknown key/.test(e.message));
  });
});

test("locked surfaces count as enforced only when paths are actually listed", () => {
  withConfig('{"locked":{"paths":[]}}', (dir) => assert.equal(enabledChecks(loadConfig(dir)).locked, false));
  withConfig('{"locked":{"paths":["src/evaluator/"]}}', (dir) => assert.equal(enabledChecks(loadConfig(dir)).locked, true));
});
