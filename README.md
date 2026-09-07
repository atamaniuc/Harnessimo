# harness

[![CI](https://github.com/atamaniuc/harness/actions/workflows/ci.yml/badge.svg)](https://github.com/atamaniuc/harness/actions/workflows/ci.yml)

A capable model with a bad harness produces work that looks finished and is not. This is
the harness: six checks that turn "I believe this is done" into "a command says so", and a
structure for the parts of a project that decide whether that command can exist at all.

Zero runtime dependencies, no build step, one config file.
<!-- proof: package.json:"files" -->

```bash
pnpm add -D github:atamaniuc/harness
pnpm exec harness init      # scaffold .harness/, specs/, harness.config.json
pnpm exec harness doctor    # what is actually enforced here
pnpm exec harness check     # the one command CI runs
```

## The problem it solves

Every failure below is real, taken from the two repositories this was extracted from:

- A README claimed "all deployable infrastructure is stood up through a single Pulumi
  program in `infra/`" while `infra/` did not exist. Ten such claims came out of one audit.
- A queue item was marked `passing` with invented evidence. Nothing re-ran it.
- A harness reorganisation moved a script and left the command that verifies it pointing at
  the old path. CI failed on every push for a day before anyone read the log.
- An agent file routed the reader to a plans directory in the author's home folder,
  outside the repository. The project only documented itself for the person who wrote it.

None of these are exotic. They are what happens when the thing that decides "done" is
prose, memory, or a copy of a script that drifted. Each has a check here.

## What it checks

| Check | What fails | Why it exists |
|---|---|---|
| `harness proof` | A documented claim whose test, file or command no longer exists <!-- proof: src/proof.mjs:checkTarget --> | Prose cannot be trusted to stay true on its own |
| `harness tracks` | A work-track index linking a handoff that was deleted, or a track with no status <!-- proof: src/tracks.mjs:checkTracks --> | Unfinished work has to cross a session boundary intact |
| `harness tasks` | A checked box that names no executable check <!-- proof: src/tasks.mjs:checkTaskGate --> | A tick written by whoever wrote the code is not evidence |
| `harness queue` | An item claiming to pass whose verification fails when re-run <!-- proof: src/queue.mjs:checkQueue --> | Models are over-confident about their own work |
| `harness locked` | An agent commit touching the files that define success <!-- proof: src/locked.mjs:lockedViolations --> | A loop that can edit its own scorer will |
| `harness cold-start` | A fresh clone that cannot install and verify itself <!-- proof: src/coldstart.mjs:coldStartProblems --> | Every session after the first arrives fresh |

Failures are written to be acted on, not just read:

```
  FAIL  proof markers
    README.md:14  make deploy
        no "make" command named "deploy"
```

## The model

A harness has five parts. The folder structure states them, so a newcomer reads the design
instead of reconstructing it from artifacts:

```
.harness/
  1-instructions/   the rules, each labelled with what enforces it   (the recipe shelf)
  2-tools/          what the project can run                          (the knife rack)
  3-environment/    what it runs in, and what is out of reach         (the cooking surface)
  4-state/          what survives a session ending                    (the prep table)
  5-feedback/       how it knows it worked                  (the quality-control window)
specs/
  TRACKS.md         the index of live work tracks
  NNNN-<slug>/      spec.md, tasks.md, handoff.md per lane
```

The five layers say how a project is governed. They say nothing about what happens when a
session ends mid-lane — so handoff-driven development supplies the sixth thing: an index of
live tracks, a handoff per track written for a reader with none of your context, and a rule
that a handoff is deleted when its track closes. A handoff that lies is worse than none,
which is why the index is machine-checked.

Full reasoning, and where each idea came from: [`docs/STANDARD.md`](docs/STANDARD.md).

## Configuration

`harness.config.json`. Every section is optional, and **a section you leave out is a check
that does not run** — `harness doctor` reports it as not set rather than implying otherwise.
<!-- proof: test/cli.test.mjs#doctor reports what is enforced and what is not, without overstating -->

```jsonc
{
  "docs":   { "roots": [".", "docs", "specs"],
              "mustCarryProof": ["README.md"],
              "commands": { "make": "Makefile" } },   // or task / npm run / pnpm run
  "tracks": { "file": "specs/TRACKS.md", "gateTasks": true },
  "queue":  { "file": ".harness/4-state/feature_list.json" },
  "locked": { "paths": [".github/workflows/"], "agentTrailer": "Co-Authored-By: Claude" },
  "coldStart": { "requiredFiles": ["AGENTS.md"], "commands": ["make setup", "make check"] }
}
```

Adopting an existing repository, step by step: [`docs/ADOPTING.md`](docs/ADOPTING.md).

## What this does not do

Stated plainly, because a check that overstates its guarantee stops anyone looking for the
missing one:

- **`harness locked` is drift detection, not a sandbox.** It assumes commits pass through
  CI. An agent with push access that strips its own authorship trailer defeats it. Closing
  that properly means filesystem-level read-only paths in the run environment.
- **It cannot tell whether a check is any good.** A test that asserts nothing satisfies
  every rule here. The harness makes claims falsifiable; it does not make them true.
- **It does not review code.** Nothing here reads for correctness, security or taste.
- **Four of this repository's own nine constraints are review-only**, and
  [say so](.harness/1-instructions/CONSTRAINTS.md).

## Development

```bash
npm test        # 59 tests, no install needed — the package has no dependencies
npm run check   # the tests, then this repository's own gates
```

The rules in `src/` are pure functions over strings and in-memory trees;
`src/resolver.mjs` and `bin/harness.mjs` are the only code that touches the filesystem.
That split is why the rule layer is exhaustively tested and the wiring gets end-to-end
tests against real directories. <!-- proof: test/cli.test.mjs -->

This repository runs every check it defines against itself, including from a fresh clone.
A standard whose own repository does not meet it is a suggestion. <!-- proof: npm run check -->

## Where it came from

Two repositories, each with half of it:
[`code-knowledge-base`](https://github.com/atamaniuc/code-knowledge-base) contributed the
five-layer structure, the queue that owns state transitions, locked surfaces and the
cold-start test; [`ledger-lens`](https://github.com/atamaniuc/ledger-lens) contributed
proof markers, handoff-driven development and the task gate. Neither could use the other's
half without copying it, and a copied check is a fork the day after it is copied.

The ideas behind the five layers and the queue come from the *Learn Harness Engineering*
material; handoff-driven development comes from
[yetanothervan/handoff-driven-development](https://github.com/yetanothervan/handoff-driven-development).

## License

MIT.
