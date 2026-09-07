# Handoff — 0001 Adoption in the two source repositories

## Context

The tool is finished and self-hosting; what remains is making the two repositories it came
from actually use it. Until they do, this repository is a good idea with no consumers, and
the drift it exists to prevent continues in both.

Both repositories were red in CI when this lane started, for unrelated reasons, and both
were fixed first so that a failure during adoption is unambiguous — a red build afterwards
means adoption broke something, not that it was already broken.

## What to load

- This file, then `spec.md` and `tasks.md` in this directory.
- `docs/ADOPTING.md` — the steps, written before the first migration and therefore the
  thing most likely to be wrong. Correcting it is T8.
- In `code-knowledge-base`: `Makefile`, `.github/workflows/ci.yml`,
  `.harness/2-tools/harness.ts`, `.harness/2-tools/locked-surfaces.sh`,
  `.harness/2-tools/cold-start.sh`.
- In `ledger-lens`: `src/platform/docs-proof.ts`, `src/platform/tasks-proof.ts`,
  `scripts/verify-docs.ts`, `Taskfile.yml` (the `docs-check` target).

**What NOT to load:** neither repository's product code. Adoption touches the harness
layer, its CI wiring and its documentation gate. `ledger-lens` in particular is a large
application; reading it will consume a session's budget and change nothing about this lane.

## State

Nothing has been changed in either repository for this lane yet — the two commits already
pushed there are the CI fixes, not adoption.

The consuming side is designed and not yet exercised:

- Install is `pnpm add -D github:atamaniuc/harness#<tag>` in both, since both are pnpm
  workspaces on Node >= 22. No tag exists yet (the second track in `TRACKS.md`), so the
  first migration will have to track a branch and be re-pinned afterwards.
- `code-knowledge-base` is the easier of the two and should go first: its checks map onto
  the shared ones almost exactly, so it is a translation rather than a redesign.
- `ledger-lens` keeps its TypeScript wrapper — `task check` and its own unit tests call
  into it — but the wrapper should delegate to the package rather than re-implement the
  rules. Its `MUST_CARRY_PROOF` list and its Supabase migration resolver become
  configuration.

## Decisions taken

- **A dependency, not vendored files.** See `.harness/4-state/DECISIONS.md`. Do not
  reintroduce a sync script.
- **Adoption never trades a check away.** If the shared implementation cannot express
  something a repository already enforces, the repository keeps its own check and the gap
  is written down — silently losing a gate to make a migration tidy is the failure this
  whole tool exists to prevent.
- **`ledger-lens` does not adopt the queue.** It runs on lane task lists, which the task
  gate already covers; two overlapping notions of "the current item" would be worse than
  one.

## First step

In `code-knowledge-base`: add the dependency, write `harness.config.json` translating the
existing checks (locked paths from `locked-surfaces.sh`, cold-start commands from
`cold-start.sh`, the queue file at `.harness/4-state/feature_list.json`), then run
`pnpm exec harness doctor` and compare its output line by line against what the Makefile
runs today. Delete nothing until that comparison is written down.
