# AGENTS.md

Routing file for anyone — human or agent — working **on** this repository. For what the
tool does, read `README.md`; for the standard it implements, `docs/STANDARD.md`.

## What this is

A harness: six checks that decide whether work is finished, plus the structure those checks
assume. It is a dependency other repositories install, and it is governed by itself.

## How to run it

```
npm test        # the rules and the wiring; no install step, the package has no dependencies
npm run check   # the tests, then this repository's own gates
node src/cli.ts doctor    # what is enforced here
node src/cli.ts help      # every command
```

Eleven checks: `proof`, `tracks`, `tasks`, `queue`, `locked`, `cold-start`, `clean-exit`,
`instructions`, `boundaries`, `thresholds`, `release`. What each is for, and which lecture of
[Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/ru/) it
comes from: `docs/STANDARD.md`. The fastest way in for a newcomer: `docs/GUIDE.md`.
Published, with the diagrams rendered: <https://atamaniuc.github.io/Harnessimo/>.

Node >= 22. There is nothing to provision and no key to configure.

## Layout

```
src/cli.ts   the command line: the only place that runs processes
src/              the rules, as pure functions — no filesystem except resolver.mjs
test/             one test file per rule, plus cli.test.mjs against real directories
templates/        what `harnessimo init` writes into a consuming repository
schema/           JSON Schema for harnessimo.config.json
docs/             STANDARD.md (the model), ADOPTING.md (the migration)
.harness/         how this repository is governed — start at .harness/README.md
specs/            live work tracks and their handoffs
```

## Session protocol

**Start:** read `.harness/4-state/PROGRESS.md`, then `.harness/4-state/DECISIONS.md`, then
`specs/TRACKS.md`. If you are picking up a track, **load its handoff first** — it names
what to read and, more usefully, what not to.

**End:** update `PROGRESS.md`, update the handoff and track line of anything left
unfinished, run `npm run check`, commit. Leave the repository such that the next session
starts in minutes.

## Working rules

- **WIP = 1.** One queue item active at a time. Enforced.
- **Working beside another agent?** Declare the paths under `## Owns` in this lane's
  handoff, and what it waits on under `## Depends on`. Two live lanes claiming one path
  fails `tracks`, and so does a cycle. See `docs/PARALLEL.md`.
- **Never edit `state` or `evidence` by hand.** Run `node src/cli.ts queue verify <id>`;
  CI re-runs every passing claim, so a hand-written state is detected rather than trusted.
- **Never add a runtime dependency.** See `.harness/1-instructions/CONSTRAINTS.md` #1.
- **A rule ships with a test proving it fires on bad input.** A rule with no failing test is
  an assumption wearing a rule's clothes.
- **Enforcement is labelled honestly.** If a rule is caught only in review, it says so.
- **Leave a clean state.** No debris, `PROGRESS.md` updated, work committed. Enforced by
  `harnessimo clean-exit`, which reads what this session changed rather than the whole tree.

Hard constraints: `.harness/1-instructions/CONSTRAINTS.md`. Read it before changing a rule.
