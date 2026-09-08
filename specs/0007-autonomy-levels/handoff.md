# Handoff — 0007 How much was this run watched

_Written for a session that has none of this context and cannot ask a question._

## Context

Every check answers "is this finished"; none ask how the answer was arrived at.
The same green report therefore means two different things depending on whether
a person read every step or nobody looked. `spec.md` here carries the reasoning
and the boundary — chiefly that the level is declared, never inferred.

## What to load

- `spec.md` here, then `src/autonomy.ts` and `test/autonomy.test.ts`.
- In `src/cli.ts`: `resolveLevel`, `cmdCheck`, `cmdDoctor` — nothing else moved.
- **Do NOT load** the rest of `src/cli.ts`, and do NOT re-open the question of
  detecting supervision from `CI` or a TTY: it is settled in `spec.md` under
  "The boundary, stated first".

## Owns

- src/autonomy.ts
- test/autonomy.test.ts
- specs/0007-autonomy-levels/

## State

Built and proven: the ladder, the floor, the refusal of an unbacked level
(`test/autonomy.test.ts`), and the wiring end to end against a repository on
disk (`test/cli.test.ts`). `doctor` distinguishes `enforced` from `above`;
`brief` carries the level.

Left as it was on purpose: `.github/workflows/ci.yml` still runs the checks as
separate steps. It is a locked surface, so an agent commit may not touch it —
the rule working, not a rule in the way. Switching it to a single
`check --autonomy unattended` changes nothing about coverage.

## Decisions taken

- Declared, not inferred. A guess about a person's attention is a claim, and
  this package exists because claims get checked.
- A floor, not a setting: `--autonomy` raises and cannot lower it.
- `watched` demands nothing extra. Incremental adoption is a promise this tool
  has made since its first version, and a level must not quietly revoke it.
- Three levels, no à-la-carte overrides. A preferences file is how a bar stops
  meaning anything.

## First step

Nothing outstanding. The next lane is `depends-on` between lanes — ordering
rather than collision, and the last item named in spec 0006.
