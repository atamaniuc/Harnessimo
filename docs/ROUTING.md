# Routing work: which agent, which model, how many at once

**Who is this for?** Someone orchestrating agents on a repository the checks already guard —
deciding which model takes which work, when to fan out, and when to stop for review.
**When should I read it?** When a single agent is no longer fast enough, or when an expensive
model is doing cheap work. The collision rules for several agents live in
[More than one agent](PARALLEL.md); when a rule is in the way, [Adapting rules](ADAPTING.md).

---

The checks decide when work is finished. They say nothing about how fast it gets there, and
a harness that is slow to work inside is a harness people route around. This page is the
other half: how to spend models and parallelism so the checks stay green **and** the work
moves.

## Three roles

`harnessimo init` writes three agent definitions into `.claude/agents/` — starting points to
edit, not rules to obey. Each rule in them carries its _why_, so an agent can tell when one has
stopped applying.
<!-- proof: test/cli.test.ts#init writes the agent roles and the hooks they assume, and leaves existing settings alone -->

| Role | Model | Gets | Never |
| --- | --- | --- | --- |
| `architect` | the strongest (opus) | specs, ADRs, gate verdicts, cold review of risky diffs | writes production code |
| `implementer` | the workhorse (sonnet) | one lane's code, task by task, checks quoted | edits specs, spawns agents |
| `scout` | the cheapest (haiku) | read-only lookups: greps, `brief`, versions, logs | writes anything |

The rule underneath: **pay for judgement where a mistake is expensive and invisible; pay for
throughput everywhere else.** A wrong lock order, a rounding rule, an idempotency key or a
data migration is invisible in a green test run and expensive in production — that diff goes
to the architect, **with a fresh context**, because the author's context is the one that hid
the bug. A rename, a test, a doc fix is throughput.

Reasoning effort follows the same line: low for lookups and mechanical edits whose result
checks itself, high for the one piece that needs more thought than the work around it.

## Fan out when streams are independent

Two tasks are independent when neither reads what the other writes. Those run in parallel,
each in its own checkout:

```bash
harnessimo worktree add search     # ../<repo>-search on branch wt-search, install run
harnessimo worktree add billing
# … one implementer per worktree …
harnessimo worktree merge search   # --no-ff into the current branch
harnessimo worktree remove search  # refuses unmerged or uncommitted work
```

<!-- proof: test/cli.test.ts#worktree merge brings the stream in; remove refuses unmerged or dirty work, then cleans up -->

A fresh worktree runs the project's install step first (`worktree.install`, or the install
command in `coldStart.commands`), because its first commit would otherwise fail the
pre-commit hook far from the cause. Each lane still declares `## Owns`, so two streams that
turned out not to be independent fail `harnessimo tracks` instead of a merge.

The main checkout owns the shared state — `PROGRESS.md`, `TRACKS.md`, the handoffs. Side
branches carry code and their own lane's files, which keeps the merges boring.

## Chain tasks, batch reviews

- **An implementer may chain several tasks of one stream**: commit each, go straight to the
  next, report once at the end. A stop after every task turns parallel streams back into a
  queue with extra steps.
- **`[review]` tasks get one batched review per stream** instead of a stop after each. The
  gate is still the review — nothing merges on an unreviewed `[review]` task — but one cold
  read of a coherent diff finds more than five reads of fragments.

## The orchestrator never idles

The session that hands out work does not wait for it. When an agent reports, the orchestrator
in the same turn merges what is green, launches the next stream or the batched review, and
updates the shared state. An idle orchestrator is the bottleneck a parallel run was meant to
remove.

## Speed comes from parallelism, not shortcuts

The checks stay. Speed comes from not running them more often than they can change:

- the inner loop runs only what the edit touched; the full gate runs once per task;
- a gate's output is captured whole with its exit code (`cmd > log 2>&1; echo "exit=$?"`) —
  never piped through `tail`, whose exit code replaces the gate's;
- tests bind port `0` and poll for state, the two usual sources of flakes in parallel runs;
- background processes are stopped before reporting.

When a rule of the process — not a check — is what slows the work down, the answer is to
adapt the process inside the bounds, never to bypass the check. How: [Adapting rules](ADAPTING.md).
