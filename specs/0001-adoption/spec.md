# 0001 — Adoption in the two source repositories

**Status:** in progress · **Owner:** unassigned

## Why

This tool is the two halves of one idea, taken from two repositories that each had one of
them:

- `code-knowledge-base` had the five-layer harness — instructions, tools, environment,
  state, feedback — with a work queue that owns state transitions, a locked-surface rule,
  and a cold-start test. It had no way to carry unfinished work across a session boundary.
- `ledger-lens` had handoff-driven development — a track index, per-lane handoffs, a gate
  that fails when a track links a handoff that no longer exists — and proof markers tying
  every documented claim to a test, a command or a file. It had no queue, no locked
  surfaces, and no cold-start test.

Neither could use the other's half without copying it, and a copied check is a fork the
day after it is copied. Extracting both into one dependency is what makes each repository
gain the half it is missing at the cost of a configuration file.

## User stories

**US-01** — As an agent starting work in either repository, I want one command that runs
every gate, so that "is this finished" has a single answer.

**US-02** — As the maintainer, I want a rule fixed once, so that a fix does not have to be
remembered twice.

**US-03** — As a newcomer to either repository, I want the same structure and the same
vocabulary, so that what I learn in one transfers to the other.

## Acceptance criteria

**AC-01** — GIVEN the shared package WHEN a rule fires THEN it names the document, the
line and the reason <!-- proof: test/cli.test.mjs#naming the document and line -->

**AC-02** — GIVEN a fresh repository WHEN `harness init` runs THEN the scaffolded harness
passes its own check with no editing
<!-- proof: test/cli.test.mjs#init scaffolds a working harness that immediately passes its own check -->

**AC-03** — GIVEN `code-knowledge-base` WHEN it adopts the package THEN its vendored
`locked-surfaces.sh`, `cold-start.sh` and queue implementation are deleted and its CI runs
the shared CLI instead.

**AC-04** — GIVEN `ledger-lens` WHEN it adopts the package THEN its documentation gate
delegates to the shared implementation and its own `docs-proof` copy is reduced to the
project-specific parts.

**AC-05** — GIVEN either repository WHEN CI runs THEN it is green.

## Invariants

- Neither repository loses a check it already had. Adoption adds and consolidates; it
  never trades a gate away for tidiness.
- The shared package keeps zero runtime dependencies, because both consumers install it
  into their own dependency tree.

## Out of scope

- Publishing to a package registry. Both consumers can install from git, and a registry
  release is a decision about maintenance commitments, not about this lane.
- Migrating historical lanes in `ledger-lens` to the task gate. The gate applies to live
  tracks by design.

## Tasks

See [tasks.md](tasks.md).
