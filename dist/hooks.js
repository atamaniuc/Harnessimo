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
export function hookScript(extraCommands = []) {
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
        'elif [ -f dist/cli.js ]; then',
        '  HARNESSIMO="node dist/cli.js"',
        'elif [ -f src/cli.ts ]; then',
        '  HARNESSIMO="node src/cli.ts"',
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
export function hookStatus({ hookExists, hooksPath }) {
    const configured = hooksPath === HOOKS_DIR;
    if (hookExists && configured) {
        return { ok: true, message: `pre-commit hook installed and active (core.hooksPath=${HOOKS_DIR})` };
    }
    if (hookExists && !configured) {
        return {
            ok: false,
            message: `${HOOK_PATH} exists but git is not using it` +
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
//# sourceMappingURL=hooks.js.map