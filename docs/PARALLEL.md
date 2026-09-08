# More than one agent

**Who is this for?** Someone running several agents against one repository — subagents in
one session, parallel worktrees, or a headless run beside a person typing.
**When should I read it?** When a second agent starts. With one lane in flight none of this
is needed, and turning it on early buys nothing. To learn the tool first, the
[guide](GUIDE.md).

---

Everything else this tool enforces was designed for one worker at a time. Three things break
when there are several, and none of them break with one.

## A lane says what it owns

A lane declares the paths it is working on, in its handoff:

```markdown
## Owns

- src/checkout/
- test/checkout.test.ts
```

A file, a directory, or a prefix ending in `/**` — and nothing else, because two claims have
to be comparable by reading them. A pattern whose overlap cannot be computed protects
nothing, and a fence that silently does not hold is worse than no fence.

`harnessimo tracks` then fails when two live lanes claim overlapping paths, naming both
lanes and both claims:

```
FAIL  work tracks
  specs/0007-totals/handoff.md:9  src/checkout/totals.ts
    also claimed by specs/0006-checkout as "src/checkout/" (specs/0006-checkout/handoff.md:7)
    — two lanes editing one path is a merge that resolves text and not intent;
      narrow one claim, or finish one lane first
```

<!-- proof: test/claims.test.ts#two live lanes cannot own the same path, and the failure names both -->

Declaring nothing is not an error. A repository with one lane in flight needs none of this;
two lanes declaring one path is what the rule is for.

Claims live in the handoff rather than in the spec or the index, and that is deliberate: a
handoff is deleted the moment its track closes, so a claim cannot outlive the work it
fences.

## Two lanes cannot answer to one number

`harnessimo track new` allocates from the filesystem — the highest number on disk, plus
one. Two worktrees read the same state and both get `0006`. The directories have different
names, so git merges them without a word, and the index ends up with two lanes answering to
one number that already appears in commit messages and handoffs.

A lock would not have helped: no lock in one worktree is visible in another. The check fails
on the merged tree, which is the only place the collision exists.
<!-- proof: src/claims.ts:duplicateNumbers -->

## A turn does not end on a claim

`harnessimo brief` gates the start of a session; the pre-commit hook gates the start of a
commit. Between those two points an agent can finish a turn saying "done" with the checks
red — and when the work passes to another agent instead of to a commit, no gate runs at all.

```bash
harnessimo hooks install --agent
```

installs `Stop` and `SubagentStop` alongside the startup hook. A red `check` blocks the end
of the turn and hands the report back to the agent, so the next thing it reads is the file,
the line and the fix.

`SubagentStop` matters as much as `Stop`: in a parallel run the subagent is the one
finishing a lane, and its turn is the one nobody is watching.

The hook does not block a turn that is already continuing because it blocked once. A gate
that cannot be satisfied is a loop, and a loop is how a gate gets deleted.
<!-- proof: test/hooks.test.ts#a turn already continuing from this hook is not blocked again -->

It runs `check` — the six rules that take about a second. Cold start, re-verification and
the test suite stay in CI, for the same reason the pre-commit hook leaves them there: a gate
that makes every turn slow is a gate somebody removes.

## Handing one lane to one agent

```bash
harnessimo brief --track checkout-totals
```

That lane's line from the index, its whole handoff, what it owns, and what the other live
lanes own — and none of their state. The unscoped `brief` is the index of everything in
flight, which is the right answer for the session that owns the repository and the wrong one
for an agent given a single lane.

<!-- proof: test/brief.test.ts#a scoped brief carries one lane, whole, and the fence around every other -->

## Worktrees

`claude --worktree` gives each session its own checkout under `.claude/worktrees/`, which is
the shape this whole page is about. The checks run inside a worktree exactly as they do in
the main checkout, and the main checkout does not see the worktree's copy of the repository.

That last part is not luck: a directory holding its own `.git` — a worktree, a submodule, a
vendored clone — is another repository, and its files are not this one's. Walking into it
would scan every document twice, and a worktree sitting on an older commit would then fail
on claims this repository has already fixed.
<!-- proof: test/resolver.test.ts#a repository nested inside this one is not scanned as part of it -->

The lane-number race above is the worktree case exactly: two sessions, two checkouts, the
same next number.

## What this deliberately does not do

Nothing here locks, waits or schedules. A tool that owns the order of work is a tool a
project cannot get out of, so this is declaration and detection only: it says when two lanes
disagree, and who gives way stays a decision a person makes.

Two things are specified and not built, for honesty about where the edge currently is:

- **A stale claim.** A lane abandoned mid-flight holds its paths until somebody closes or
  pauses it. Noticing that needs an age, and an age needs a clock this tool does not keep.
- **Declared dependencies between lanes.** When one lane builds on another's interface,
  ordering is the problem, not collision — a different rule.
