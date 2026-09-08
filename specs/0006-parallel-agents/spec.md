# 0006 — More than one agent

## Why

Everything this tool enforces was designed for one worker at a time: one
session, one lane, one handoff picked up by whoever comes next. That
assumption is no longer true. Work now runs as several agents against the same
repository — subagents in one session, sessions in parallel worktrees, a
headless run overnight next to a person typing.

Three things break at that point, and none of them break with one worker:

- **Two lanes edit the same files.** Nothing declares what a lane is working
  on, so nothing can notice. The collision surfaces as a merge, and a merge
  resolves text, not intent.
- **Two lanes take the same number.** `track new` reads the highest number on
  disk and adds one. Two worktrees read the same disk state and both get
  `0006`. The directories differ, so git merges them without a word, and the
  index ends up with two lanes answering to one number.
- **A turn ends on a claim.** The harness runs at session start (`brief`) and
  at commit (the pre-commit hook). Between those two points an agent can
  finish a turn saying "done" with `check` red, and in a parallel setup the
  work is handed to somebody else before a commit ever happens.

The third is the widest hole: the input side of a session is gated and the
output side is not.

## The boundary, stated first

This does not add scheduling, locking or an orchestrator. Nothing here decides
what runs next, waits for another agent, or holds a lock — a tool that owns the
order of work is a tool the project cannot get out of.

What is added is **declaration and detection**: a lane says which paths it is
working on, and the check says when two live lanes disagree. A declaration that
is missing is not an error; a declaration that collides is.

The same rule as spec 0005: automate what a person gets wrong the same way
every time, leave what they get wrong differently.

## What

### 1. A lane declares what it owns

`handoff.md` grows an optional section:

```markdown
## Owns

- src/tokens.ts
- test/tokens.test.ts
- docs/agent/**
```

Read only from live lanes — a handoff is deleted when its track closes, so a
claim cannot outlive the work by construction.

A claim is a repository-relative path: a file, a directory ending in `/`, or a
prefix ending in `/**`. No other glob. Two claims overlap when one is a prefix
of the other, which is decidable by reading them — a claim whose overlap cannot
be computed protects nothing, and pretending otherwise is worse than having no
claim at all. Entries carrying `<placeholder>` brackets are template text and
are skipped, the same convention proof markers already use.

The `tracks` check fails when two live lanes claim overlapping paths, naming
both lanes and the two claims.

### 2. Two lanes cannot answer to one number

The `tracks` check fails when `specsDir` holds two directories with the same
four-digit prefix. This is the merge-time catch for the race in `track new`:
each worktree is right on its own, and only the merged tree is wrong.

Not solved with a lock. The number is allocated from the filesystem, and no
lock in one worktree is visible in another; a check on the merged result is
the only place the truth exists.

### 3. The turn boundary is gated

`harnessimo hooks install --agent` additionally installs `Stop` and
`SubagentStop` hooks running `harnessimo check`. A red check blocks the end of
the turn and returns the report to the agent instead of to a log nobody reads.

`check` is the right command here: it is the six checks that take about a
second. Cold start, re-verification and the test suite stay in CI, for the same
reason the pre-commit hook leaves them there.

The hook honours `stop_hook_active`: when the turn is already continuing
because this hook blocked it, it does not block again. A gate that cannot be
satisfied is a loop, and a loop is how a gate gets deleted.

### 4. A brief can be scoped to one lane

```
harnessimo brief --track <slug>
```

Prints one lane's handoff instead of every lane's, plus what that lane owns and
what the other live lanes own. This is the unit handed to a subagent: its own
context, its own fence, and none of the other lanes' state.

An unscoped `brief` is unchanged — with one lane in flight it is the right
answer, and it is what the SessionStart hook runs.

## Acceptance criteria

1. `test/claims.test.ts::a claim is a path, not a pattern` — a claim with an
   interior `*`, an absolute path or a `..` segment is refused with a reason
   naming the three shapes that are legal.
2. `test/claims.test.ts::overlap is prefix containment` — `src/` overlaps
   `src/a.ts`; `src/a.ts` does not overlap `src/ab.ts`.
3. `test/claims.test.ts::two live lanes cannot own the same path` — the problem
   names both lanes and both claims.
4. `test/claims.test.ts::a placeholder is not a claim` — the shipped handoff
   template declares nothing.
5. `test/claims.test.ts::two directories cannot share a number` — and the
   problem names both directories.
6. `test/tracks.test.ts::the tracks check reports claim collisions` — the
   wiring, not the rule.
7. `test/hooks.test.ts::the stop hook runs check and honours stop_hook_active`.
8. `test/hooks.test.ts::installing agent hooks leaves other events alone` — a
   settings file with hooks of its own keeps them.
9. `test/brief.test.ts::a scoped brief carries one lane and every fence` — the
   named lane's handoff, its own claims, and the other lanes' claims.
10. `test/cli.test.ts::track new then check` still passes — a lane created by
    the tool, with the template's `## Owns` section, survives the new rules.

## Out of scope

- Locking, queueing or any wait. See the boundary.
- Glob intersection beyond prefix containment.
- Stale claims: a lane abandoned mid-flight holds its paths until someone
  closes or pauses it. Detecting that needs an age, and an age needs a clock
  the repository does not currently keep. Recorded here, not built.
- Declared dependencies between lanes (`depends-on`). The next thing, and a
  different rule: this one is about collision, that one about ordering.
