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
node bin/harness.mjs doctor    # what is enforced here
node bin/harness.mjs help      # every command
```

Eight checks: `proof`, `tracks`, `tasks`, `queue`, `locked`, `cold-start`, `clean-exit`,
`instructions`. What each is for, and which lecture of
[Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/ru/) it
comes from: `docs/STANDARD.md`. The fastest way in for a newcomer: `docs/GUIDE.md`.

Node >= 22. There is nothing to provision and no key to configure.

## Layout

```
bin/harness.mjs   the command line: the only place that runs processes
src/              the rules, as pure functions — no filesystem except resolver.mjs
test/             one test file per rule, plus cli.test.mjs against real directories
templates/        what `harness init` writes into a consuming repository
schema/           JSON Schema for harness.config.json
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
- **Never edit `state` or `evidence` by hand.** Run `node bin/harness.mjs queue verify <id>`;
  CI re-runs every passing claim, so a hand-written state is detected rather than trusted.
- **Never add a runtime dependency.** See `.harness/1-instructions/CONSTRAINTS.md` #1.
- **A rule ships with a test proving it fires on bad input.** A rule with no failing test is
  an assumption wearing a rule's clothes.
- **Enforcement is labelled honestly.** If a rule is caught only in review, it says so.
- **Leave a clean state.** No debris, `PROGRESS.md` updated, work committed. Enforced by
  `harness clean-exit`, which reads what this session changed rather than the whole tree.

Hard constraints: `.harness/1-instructions/CONSTRAINTS.md`. Read it before changing a rule.
