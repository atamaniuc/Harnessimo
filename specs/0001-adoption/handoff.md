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

**Both repositories now carry the half they were missing, on a branch each:**

- `code-knowledge-base` → `feat/shared-harness-hdd`: `harnessimo.config.json` translating
  every check it already enforces, `specs/TRACKS.md` + `TRACKS-LOG.md`, a handoff of its
  own, and proof markers in `AGENTS.md`.
- `ledger-lens` → `claude/harness-repo-consolidation-phemlr`: `harnessimo.config.json`,
  `.harness/locked-baseline`, and track 0018 with its handoff.

**Verified, and the number to keep:** run against `ledger-lens`, this package reproduces
its own gate exactly — 183 proof markers across 71 documents, task gate scoping to 2 live
lanes with 15 closed ones out of scope. The migration there is a delegation, not a
behaviour change. If those numbers ever differ after the switch, the difference is the bug.

**Not landed in either:** the dependency itself and the switch of `Makefile` / `Taskfile`
/ CI onto the shared CLI, because the package is not installable until this repository is
public and carries a tag.

The consuming side is designed and not yet exercised:

- Install is `pnpm add -D github:atamaniuc/harnessimoimo#<tag>` in both, since both are pnpm
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

Cut `v0.1.0` here, then in `code-knowledge-base`'s branch:
`pnpm add -D github:atamaniuc/harnessimoimo#v0.1.0`, run `pnpm exec harnessimo doctor`, and compare
its output line by line against what `make check` and CI run today. Write the comparison
into that repository's handoff before deleting `.harness/2-tools/harness.ts`,
`locked-surfaces.sh`, `cold-start.sh` or `packages/harness/` — the config claims to cover
them, and that claim is the thing to check.
