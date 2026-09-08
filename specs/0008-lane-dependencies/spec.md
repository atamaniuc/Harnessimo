# 0008 — One lane built on another

## Why

Spec 0006 gave lanes a fence: two of them cannot edit the same paths without
being told. That is collision. The other half of working in parallel is
**ordering**, and nothing catches it.

When lane B builds on lane A's interface, the agent on B is writing against
ground that is still moving. The cost does not arrive as a merge conflict — the
files may not even overlap — it arrives as rework, days later, when A settles
somewhere else. On one worker this is a thing you remember. On several it is a
thing nobody is holding.

## What

A handoff may declare what its lane waits on, by slug:

```markdown
## Depends on

- retrieval-quality
```

Slugs and not numbers, because a number is an allocation detail and `0006`
tells a reader nothing.

The `tracks` check refuses:

- a slug that names no lane — the same failure as a handoff link that no longer
  resolves, and the same reason: a marker the next session trusts;
- a lane that waits on itself;
- a cycle, reported once, naming the way round. Every lane in a cycle is
  waiting for another and none of them can honestly start.

`track close` refuses to close a lane while something it waits on is still
open. Closing is a claim that the work stands; a lane whose foundation is still
being poured is a claim about somebody else's unfinished work.

`brief --track <slug>` carries the handoffs of the lanes it waits on, as heads
rather than whole — enough to know what is being built on, and no more.

## Out of scope

- Scheduling. Nothing here decides what runs next, waits, or holds a lock. The
  boundary from spec 0006 stands: declaration and detection only.
- Dependencies on anything but a lane. A lane waiting on a person, a release or
  a decision is what `paused (on X)` in the index already says.

## Acceptance criteria

1. `test/claims.test.ts::dependencies are read from their own section, by slug`.
2. `test/claims.test.ts::a dependency naming no lane is refused, and lists the ones that exist`.
3. `test/claims.test.ts::a lane cannot wait on itself`.
4. `test/claims.test.ts::a cycle is reported once, naming the way round`.
5. `test/claims.test.ts::a chain that is not a cycle is fine`.
6. `test/cli.test.ts::a lane cannot be closed while what it was built on is still open` —
   including that closing the foundation releases it.
7. `test/cli.test.ts::a scoped brief carries the lanes this one waits on, as heads`.
