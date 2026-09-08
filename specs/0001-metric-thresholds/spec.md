# 0001 — Metric thresholds as a check

## Why

`handoff.md` in this directory carried the finding: both repositories this
package was extracted from invented the same rule independently and wired it by
hand. A scored metric has a declared floor, the floor lives in a file the agent
may not edit, and a run below it fails.

## The open question, answered

The handoff asked: does this earn a check of its own, or is it configuration of
`queue.verify`?

**A check.** The queue re-runs a command and believes its exit code; expressing
a threshold that way means every project writes the same comparison script —
which is precisely what both repositories did, twice, differently. The shape is
the one `release` already has: read declared facts out of two files, compare
them, report with a `fix:` line. Nothing about it needs a process.

The second open question — the results-file contract — is settled as narrowly
as the evidence allows: JSON of `{ metric: number }`, floors only. A metric
where lower is better (latency, cost) is the same rule mirrored, and inventing
a direction field on zero real cases is a guess. Both known cases are floors. A
third case changes this and nothing else does.

## What

```json
{
  "thresholds": {
    "results": "evals/results.json",
    "floors": "evals/thresholds.json",
    "command": "npm run evals"
  }
}
```

- It does not run the scoring. The project's command writes the results; this
  reads and compares. Shelling out to an eval framework would break
  CONSTRAINTS #3.
- A score below its floor fails, naming both numbers and saying out loud that
  lowering the floor is the move this exists to catch.
- A metric with a floor that nobody measured fails: a scoring step that did not
  run is not a scoring step that passed.
- Missing results fail, naming `command` — which is never run from here.

**On protecting the floors file**, which the handoff left open: reported, not
required. When the repository declares `locked.paths` at all and the floors are
not among them, the check says so — the project has already named the files
that define success and left out the one whose edit turns every failure green.
A repository with no locked paths has made no such claim and is not held to it.

## Acceptance criteria

1. `test/thresholds.test.ts::a run at or above every floor passes`.
2. `test/thresholds.test.ts::a score below its floor fails, naming both numbers`.
3. `test/thresholds.test.ts::a metric with a floor that nobody scored is not a metric that passed`.
4. `test/thresholds.test.ts::a scoring step that did not run is not a scoring step that passed`.
5. `test/thresholds.test.ts::floors that are not numbers are refused, and a comment key is not a floor`.
6. `test/thresholds.test.ts::floors within reach of the agent are reported, but only where success is already declared`.

## Out of scope

- Ceilings, per the reasoning above.
- Trend ("no worse than last week"). That needs history, and history needs a
  store; a floor needs neither.
