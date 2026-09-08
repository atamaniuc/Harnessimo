// The local half of the gate: a pre-commit hook that runs the fast checks.
//
// It is deliberately not the whole suite. A hook that makes every commit slow
// gets bypassed with --no-verify, and a bypassed hook enforces nothing — so
// this runs the checks that take a second (proof markers, tracks, the task
// gate, queue invariants) and leaves re-verification, cold start and the test
// suite to CI, where waiting costs nobody anything.
//
// Installed into .githooks/ with core.hooksPath rather than into .git/hooks:
// the hook is then a file in the repository that everyone gets, reviewable
// like any other, instead of a local artifact each person has to be told about.

export const HOOK_PATH = ".githooks/pre-commit";
export const HOOKS_DIR = ".githooks";

/**
 * @param extraCommands  project commands to run before the harness
 *                                  gates, e.g. a content validator
 */
export function hookScript(extraCommands: string[] = []) {
  const lines = [
    "#!/usr/bin/env sh",
    "# Fast gate only — the harness checks that take about a second.",
    "#",
    "# The rest (tests, re-verification, cold start) runs in CI, where waiting is",
    "# free. A hook that makes every commit slow gets bypassed with --no-verify,",
    "# and a bypassed hook enforces nothing.",
    "#",
    "# Written by `harnessimo hooks install`. Edit it freely — it is a normal file",
    "# in the repository, and nothing here rewrites it without --force.",
    "set -e",
    "",
    "# Find the CLI without assuming it is on PATH — a git hook does not inherit",
    "# a shell's node_modules/.bin, which is exactly how the first version of",
    "# this script failed on its first run.",
    'if [ -x node_modules/.bin/harnessimo ]; then',
    '  HARNESSIMO="node_modules/.bin/harnessimo"',
    // Source before build: in the repository that develops this, dist/ is a
    // stale artifact between builds, and a hook checking a commit against
    // yesterday's rules is worse than no hook. A consumer has no src/cli.ts,
    // so the order costs them nothing.
    'elif [ -f src/cli.ts ]; then',
    '  HARNESSIMO="node src/cli.ts"',
    'elif [ -f dist/cli.js ]; then',
    '  HARNESSIMO="node dist/cli.js"',
    'elif command -v harnessimo >/dev/null 2>&1; then',
    '  HARNESSIMO="harnessimo"',
    "else",
    '  echo "pre-commit: harnessimo not found (install it, or delete this hook)" >&2',
    "  exit 1",
    "fi",
    "",
    ...extraCommands,
    '$HARNESSIMO check',
  ];
  return lines.join("\n") + "\n";
}

/**
 * What `hooks status` reports. Kept pure so the states are testable without a
 * git repository: the interesting one is "the file exists but git is not
 * looking at it", which is how a hook silently stops running.
 *
 */
export function hookStatus({ hookExists, hooksPath }: { hookExists: boolean, hooksPath: string | null }) {
  const configured = hooksPath === HOOKS_DIR;
  if (hookExists && configured) {
    return { ok: true, message: `pre-commit hook installed and active (core.hooksPath=${HOOKS_DIR})` };
  }
  if (hookExists && !configured) {
    return {
      ok: false,
      message:
        `${HOOK_PATH} exists but git is not using it` +
        (hooksPath ? ` (core.hooksPath=${hooksPath})` : " (core.hooksPath is unset)") +
        `\n  fix:  harnessimo hooks install`,
    };
  }
  if (!hookExists && configured) {
    return {
      ok: false,
      message: `core.hooksPath points at ${HOOKS_DIR}, which has no pre-commit hook\n  fix:  harnessimo hooks install`,
    };
  }
  return { ok: false, message: `no pre-commit hook\n  fix:  harnessimo hooks install` };
}

/**
 * The agent-side half of the gate: a turn does not end while `check` is red.
 *
 * `brief` covers the start of a session and the pre-commit hook covers the
 * start of a commit. Between them an agent can finish a turn saying "done"
 * with the checks failing — and when the work is handed to another agent
 * rather than committed, no other gate ever runs. This is that hole.
 *
 * `check` and not the full suite, for the reason the pre-commit hook gives:
 * these are the six checks that take about a second. Cold start,
 * re-verification and the tests belong in CI, where waiting costs nobody.
 */
export const AGENT_GATE_PATH = ".claude/hooks/harnessimo-gate.sh";

export function agentGateScript() {
  return (
    [
      "#!/usr/bin/env sh",
      "# Blocks the end of a turn while `harnessimo check` is red, and hands the",
      "# report back to the agent rather than to a log nobody reads.",
      "#",
      "# Written by `harnessimo hooks install --agent`. Edit it freely — it is a",
      "# normal file in the repository, and nothing here rewrites it without --force.",
      "set -e",
      'cd "${CLAUDE_PROJECT_DIR:-.}"',
      "",
      "# The turn is already continuing because this hook blocked it once.",
      "# Blocking again is a loop, and a loop is how a gate gets deleted.",
      "input=$(cat)",
      "case \"$input\" in",
      '  *\'"stop_hook_active":true\'*|*\'"stop_hook_active": true\'*) exit 0 ;;',
      "esac",
      "",
      "if [ -x node_modules/.bin/harnessimo ]; then",
      '  HARNESSIMO="node_modules/.bin/harnessimo"',
      "elif [ -f src/cli.ts ]; then",
      '  HARNESSIMO="node src/cli.ts"',
      "elif [ -f bin/harnessimo.mjs ]; then",
      '  HARNESSIMO="node bin/harnessimo.mjs"',
      "elif command -v harnessimo >/dev/null 2>&1; then",
      '  HARNESSIMO="harnessimo"',
      "else",
      "  # No CLI, no gate — and no noise at the end of every turn either.",
      "  exit 0",
      "fi",
      "",
      "if report=$($HARNESSIMO check 2>&1); then",
      "  exit 0",
      "fi",
      "",
      "# Exit code 2 is the one an agent is shown; the report goes with it, so the",
      "# next thing it reads is the file, the line and the fix.",
      '{ echo "$report"; echo; echo "harnessimo: this turn cannot end while a check is red."; } >&2',
      "exit 2",
    ].join("\n") + "\n"
  );
}
