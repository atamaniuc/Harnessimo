# Handoff — 0006 More than one agent

_Written for a session that has none of this context and cannot ask a question._

## Context

Every rule in this package was designed for one worker at a time. Work now runs
as several agents against one repository, and three things break there that
never break with one: two lanes editing the same files, two lanes taking the
same number, and a turn that ends on a claim because nothing gates the end of a
turn. `spec.md` in this directory has the reasoning and the boundary.

## What to load

- `spec.md` here, then `src/claims.ts` and `test/claims.test.ts`.
- `src/hooks.ts` (`agentGateScript`) and `src/brief.ts` (`mergeHook`, `focus`).
- **Do NOT load** the whole of `src/cli.ts` — only `runTracks`, `cmdBrief` and
  the `hooks install --agent` branch touch this lane. The rest is a long file
  whose other commands have nothing to do with it.
- **Do NOT re-read** `docs/SDD.md` to decide the boundary: it is settled in
  `spec.md` under "The boundary, stated first".

## Owns

- src/claims.ts
- test/claims.test.ts
- specs/0006-parallel-agents/

## State

Built and proven: claims and duplicate numbers (`test/claims.test.ts`), their
wiring into the `tracks` check (`test/cli.test.ts`), the `Stop` and
`SubagentStop` hooks (`test/hooks.test.ts`), and `brief --track`
(`test/brief.test.ts`).

Not started: the two items named under "Out of scope" in `spec.md` — stale
claims and declared dependencies between lanes.

## Decisions taken

- Claims live in `handoff.md`, not in `spec.md` or the index. A handoff is
  deleted when the track closes, so a claim cannot outlive the work it fences.
- Overlap is prefix containment only. Glob intersection is not decidable by
  reading, and a fence that silently does not hold is worse than none.
- Both rules joined the `tracks` check rather than becoming a tenth. They are
  about the set of live lanes being coherent, which is what `tracks` means.
- Nothing here locks, waits or schedules. Rejected on purpose: a tool that owns
  the order of work is a tool a project cannot get out of.

## First step

Nothing outstanding in this lane. The next thing is a different rule —
`depends-on` between lanes, which is about ordering rather than collision.
