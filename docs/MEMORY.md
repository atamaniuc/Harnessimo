# Memory: what the repository keeps, and what an external memory is for

**Who is this for?** Someone connecting an agent to a long-term memory — an MCP memory server,
a vector store, a notes file outside the repository.
**When should I read it?** Before the first fact is saved, so the memory does not become a
second, unchecked copy of the repository's state. How work is split between agents:
[Routing work](ROUTING.md).

---

## The repository is the source of truth

What the work is, how far it got and what was decided lives in the repository, where the
checks can see it:

| Question | Where it lives | What checks it |
| --- | --- | --- |
| What is in flight, and what next? | `specs/TRACKS.md`, each lane's `handoff.md` | `harnessimo tracks` |
| Where did the last session get to? | `.harness/4-state/PROGRESS.md` | `harnessimo clean-exit` |
| What was decided, and why? | `.harness/4-state/DECISIONS.md` | review |
| Is a task really done? | the queue, the proof markers | `harnessimo queue`, `harnessimo tasks` |

<!-- proof: src/brief.ts:briefText -->

`harnessimo brief` hands a new session all of it at startup. An external memory that answers
the same questions is a second source of truth, and the two drift the day one is updated
without the other.

## What an external memory is for

Recall that crosses the boundary of one repository or one checkout:

- **The owner's preferences** — "light theme by default", "reports in Russian", "ask before a
  force-push".
- **Learnings that generalise** — "a fresh worktree needs its install before the first commit",
  "piping a gate through `tail` hides its exit code".
- **Pointers, not copies** — "the reservation invariants are in `docs/PRD.md` §6 of project X".

## The checkpoint pattern

Save at the end of a piece of work, not continuously, and save **atomic facts**, not diaries:

1. At a checkpoint — the end of a turn, a merged stream, a gate verdict — ask: _did this
   session learn something a future session in another repository would need?_
2. If so, save one fact per entry, with its scope (this owner, this project, everywhere) and
   the date. Search for a duplicate first and update it rather than adding a second.
3. Anything about this repository's own state goes into `PROGRESS.md`, `DECISIONS.md` or the
   handoff instead — the memory may hold a pointer to it.

A `Stop` hook can carry the reminder: the gate runs `harnessimo check`; a second command
beside it can print the checkpoint question. Keep it a prompt, not an automatic dump — a
memory filled with transcripts is a memory nobody can search.

## A worked example: MemPalace

MemPalace is an MCP memory server: an agent reaches it through tools such as a search, a
duplicate check before saving, a "drawer" for one stored item and a knowledge graph of
facts. Used as above:

- at session start, **search** it for the owner's preferences and for learnings about the
  current task — after `harnessimo brief`, never instead of it;
- at a checkpoint, **check for a duplicate**, then save one fact or update the existing one;
- keep project state out of it: a drawer saying "lane 0007 is half done" is stale tomorrow,
  while the handoff saying so is checked today.

Nothing in this package depends on MemPalace or on any memory server. The pattern is the same
with any of them, or with a plain file outside the repository.

## What must never go there

- **Secrets** — tokens, keys, passwords, connection strings. A memory is read back into
  prompts, logs and other projects.
- **Unverified claims** — "the tests pass", "this is fixed". A claim in memory carries no
  proof marker and no check re-runs it; it will be believed long after it stops being true.
- **The repository's state** — progress, open tasks, decisions. They belong where the checks
  are.
