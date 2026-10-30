# 0011 — Delivery kit: worktrees, model routing, memory

**Status:** shipped · **Owner:** atamaniuc

## Why

A consumer repository delivering a branch with several agents in parallel wrote, by hand,
four things every such repository needs: a `worktree.sh` that opens, merges and removes one
checkout per stream; agent definitions routing work by model (architect on the strongest model
with a fresh context for risky diffs, implementer on the workhorse, scout on the cheapest);
`settings.json` hooks for the brief and the gate; and a delivery section — chained tasks,
batched review, an orchestrator that never idles. A memory integration (an MCP memory server)
was used beside the repository state with no written rule about which holds what.

The same repository's agents also kept stalling on rules that no longer fitted the situation
(a settled "no Saga" list on a branch built to show the saga; a review stop per task in a
parallel delivery). The harness had no way to say which rules may be adapted and how.

## Acceptance criteria

**AC-01** — GIVEN a git repository WHEN `harnessimo worktree add <name>` runs THEN
`../<repo>-<name>` exists on branch `<prefix><name>` with the install step run, and a second
add refuses with a fix.
<!-- proof: test/cli.test.ts#worktree add makes a checkout beside the repository, on its branch, with the install run -->

**AC-02** — GIVEN a worktree with commits WHEN `remove` runs before `merge` THEN it refuses;
`merge` refuses uncommitted work; after `merge`, `remove` deletes the checkout and the branch.
<!-- proof: test/cli.test.ts#worktree merge brings the stream in; remove refuses unmerged or dirty work, then cleans up -->

**AC-03** — GIVEN a repository WHEN `harnessimo init` runs THEN `.claude/agents/` holds the
three roles and `.claude/settings.json` runs the brief and the gate; an existing settings file
is left untouched.
<!-- proof: test/cli.test.ts#init writes the agent roles and the hooks they assume, and leaves existing settings alone -->

**AC-04** — Routing, adapting and memory are documented, in both languages, with contracts.
<!-- proof: docs/ROUTING.md -->

## Invariants

- No runtime dependency; the worktree decisions are pure functions in `src/worktree.ts`.
- `worktree` is a command, not a check: the check count stays eleven.

## Out of scope

- A `--force` on `remove`: discarding work stays a deliberate git command the message names.
- Bundling or depending on any memory server.
