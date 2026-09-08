# Handoff — metric thresholds as a check

## Context

An audit of the two repositories this package was extracted from asked a
narrow question: is there a rule in either of them that is *generic* — not
about invoices or wiki articles — and that `harnessimo` still cannot express?

There is exactly one, and both repositories invented it independently.

**ledger-lens** keeps `evals/thresholds.json`:

```json
{ "recall_at_5": 0.8, "abstention_rate": 1.0, "injection_safety": 1.0,
  "citation_validity": 0.95, "groundedness": 0.8 }
```

A CI job scores a dataset and fails when a metric falls below its floor. The
file is in `locked.paths`, so an agent cannot lower a threshold to make its own
run pass — which is the whole point, and is the same move `locked` makes for
the files that define success.

**code-knowledge-base** has the same shape in `scripts/verify-content.ts`: a
grounding gate with a pass mark, which promotes an article only when it clears
it, and reports honestly rather than passing when no model key is present.

The generic rule underneath both: **a scored metric has a declared floor, the
floor lives in a file the agent may not edit, and a run below it fails.** That
is harness-shaped in exactly the way the other nine are — it decides "is this
finished" by something other than the agent's opinion. `harnessimo` has no way
to say it, so both repositories wired it by hand, twice.

## What to load

- This file, then `src/release.ts` and `test/release.test.ts` — the newest
  check, and the closest model for a tenth: it reads declared facts from files,
  compares them, and returns `Problem[]` with a `fix:` line.
- `src/types.ts` (`EnabledChecks`, `Problem`), `src/config.ts` (`enabledChecks`).
- `/home/user/ledger-lens/evals/thresholds.json` and its CI job, as the
  reference case the design must actually serve.
- **Do NOT load** the rest of ledger-lens or code-knowledge-base. The domain
  code around these gates is not what is being extracted.

## State

**Nothing has been built.** This is a finding with evidence, not a design. No
`spec.md` yet; writing one is the first task, and `specs/DoR.md` has to hold
before it starts.

## Decisions already taken

- The check does **not** run the scoring. It reads a results file the project's
  own command produced and compares it to a floors file — the same division as
  every other check here: the project owns the commands, this owns the verdict.
  A rule that shells out to an eval harness would break CONSTRAINTS #3.
- The floors file is expected to be in `locked.paths`. Whether the check should
  *require* that, or merely report it, is open — requiring it couples two
  checks that are otherwise independent.

## Open questions

- Does this earn a tenth check, or is it configuration of `queue.verify`? The
  queue already re-runs a claim's verification; a threshold is a claim with a
  number. The cheaper answer may be a documented pattern rather than code.
- What is the results-file contract? JSON of `{metric: number}` is enough for
  both known cases, but a metric that is "higher is worse" (latency, cost) needs
  a direction, and inventing that before a second real case is speculation.

## First step

Write `spec.md` with acceptance criteria that are executable — a test name and
a fixture — and answer the tenth-check-or-pattern question in it before writing
any `src/` code. If the answer is "pattern", this track closes with a docs
change and a line in `TRACKS-LOG.md`, which is a legitimate outcome.
