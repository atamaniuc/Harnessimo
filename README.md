# Harnessimo

[![CI](https://github.com/atamaniuc/Harnessimo/actions/workflows/ci.yml/badge.svg)](https://github.com/atamaniuc/Harnessimo/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![release](https://img.shields.io/github/v/release/atamaniuc/Harnessimo?label=release)](https://github.com/atamaniuc/Harnessimo/releases/latest)
[![docs](https://img.shields.io/badge/docs-atamaniuc.github.io%2FHarnessimo-blue)](https://atamaniuc.github.io/Harnessimo/)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)

<p align="center">
  <img src="docs/assets/harnessimo.jpg"
       alt="Robots in a server room wrestling a firehose of data while one of them holds a loop of it steady, under a sign reading HARNESSIMO"
       width="720">
</p>

**Checks that stop an AI agent from calling unfinished work done.**

Eight of them. You turn on the ones you need. They run in CI and before every commit, and
they fail with a file, a line and a fix.

Zero dependencies, one config file, any language — it reads your files, runs your commands,
walks your git history. <!-- proof: package.json:"files" -->

```bash
pnpm add -D github:atamaniuc/Harnessimo#v0.3.0
pnpm exec harnessimo init      # scans your repo, writes a config that already passes
pnpm exec harnessimo check     # run this in CI
```

<details>
<summary>npm, yarn, bun</summary>

```bash
npm i -D github:atamaniuc/Harnessimo#v0.3.0     && npx harnessimo init  && npx harnessimo check
yarn add -D github:atamaniuc/Harnessimo#v0.3.0  && yarn harnessimo init && yarn harnessimo check
bun add -d github:atamaniuc/Harnessimo#v0.3.0   && bunx harnessimo init && bunx harnessimo check
```

All four were run against this release before being written down. On the
[docs site](https://atamaniuc.github.io/Harnessimo/) the same commands are tabs, one per
package manager.

</details>

## What it catches

Three real failures from the repos this came out of.

**A README that lies.** It said infrastructure was "stood up through a single Pulumi program
in `infra/`". There was no `infra/`. Ten claims like that turned up in one audit.

```
FAIL  proof markers
  README.md:14  make deploy
      no make command named "deploy"
```

Every claim in your docs names the file, test or command behind it. Delete that, and the
build breaks. <!-- proof: src/proof.ts:checkTarget -->

**A task marked done that nobody re-ran.** It sat at `passing` with made-up evidence.

```
FAIL  queue
  "checkout-totals" claims passing but its verification fails now
    command: npm test -- checkout
    fix:  fix the regression, or the claim was never true
```

Only the tool writes `passing`, and only after the task's own command exits 0. CI re-runs
every one of them. <!-- proof: src/queue.ts:checkQueue -->

**A session that starts blind.** The agent reopens half the repo to work out where the last
one stopped. Now it gets handed the answer at startup:

```
$ harnessimo brief
== specs/TRACKS.md (live work tracks — load a track's handoff first) ==
- Checkout totals — [handoff](specs/0007-checkout/handoff.md) — active, next: T3 currency rounding

== work queue ==
active: checkout-totals — an order total matches the sum of its lines, in every currency
  verify with: harnessimo queue verify checkout-totals

== enforced here ==
proof, tracks, tasks, queue, coldStart, cleanExit
not enforced: locked, instructions
```

One command wires that into your agent: `harnessimo hooks install --agent`.
<!-- proof: src/brief.ts:briefText -->

## All eight checks

| Command | Fails when |
|---|---|
| `harnessimo proof` | a documented claim's file, test or command is gone |
| `harnessimo queue` | a task claiming `passing` fails when re-run |
| `harnessimo tracks` | a work track links a handoff that was deleted |
| `harnessimo tasks` | a ticked checkbox names no check |
| `harnessimo locked` | an agent commit touched the files that grade it |
| `harnessimo cold-start` | a fresh clone can't install and verify itself |
| `harnessimo clean-exit` | a session left `TODO`, `debugger`, `.only(` behind |
| `harnessimo instructions` | your AGENTS.md grew past the line limit you set |

`harnessimo doctor` prints which of these are on — and which are off. Nothing is switched on
that you didn't ask for.
<!-- proof: test/cli.test.ts#doctor reports what is enforced and what is not, without overstating -->

## Starting a new project

```bash
pnpm exec harnessimo init && pnpm exec harnessimo check
```

`init` looks at what you already have — Makefile or Taskfile, source layout, migrations, CI
— and writes a config from it. **The first run is green**, so the first red one means
something. <!-- proof: test/detect.test.ts#strict mode is off until a document actually carries a marker -->

You also get `.harness/` (rules, tools, environment, state, feedback) and `specs/` (work
tracks and handoffs) scaffolded.

## Adding it to an existing project

Turn on one check, make it green, commit. Then the next one.

| What's going wrong | Turn on |
|---|---|
| The README describes things that no longer exist | `docs` |
| Every session starts over from nothing | `tracks` |
| Ticked boxes nobody can trace to anything | `tracks.gateTasks` |
| "Done" that turns out not to be | `queue` |
| It only works on the machine that built it | `coldStart` |
| Debug leftovers, stale notes | `cleanExit` |
| The agent file is a 600-line manual | `instructions` |
| An agent editing what grades it | `locked` |

Details: [Adopting an existing repo](https://atamaniuc.github.io/Harnessimo/ADOPTING/).

## Who runs it

Two production repos, both of which deleted their own versions of these checks:

- [`ledger-lens`](https://github.com/atamaniuc/ledger-lens) — Next.js, Supabase, Python.
  Swapped its documentation gates for this package; all 38 of its own unit tests passed
  without edits, and the counts matched exactly (183 markers across 71 documents).
- [`code-knowledge-base`](https://github.com/atamaniuc/code-knowledge-base) — dropped four
  local scripts, picked up proof markers, work tracks and the task gate.

This repo runs all eight checks on itself, including from a fresh clone.
<!-- proof: npm run check -->

## What it isn't

- **Not a sandbox.** `locked` catches an agent editing its own scoring *in CI*. It won't stop
  someone determined to work around it.
- **Not a code reviewer.** It doesn't judge correctness, security or style.
- **Not a test-quality checker.** A test that asserts nothing passes every rule here.
- **Not a context tool.** Pair it with a code-graph or codebase-memory MCP — those answer
  "what should I read", this answers "is it done".

## Docs

**<https://atamaniuc.github.io/Harnessimo/>**

- [15-minute guide](https://atamaniuc.github.io/Harnessimo/GUIDE/) · [по-русски](https://atamaniuc.github.io/Harnessimo/GUIDE.ru/)
- [Use cases](https://atamaniuc.github.io/Harnessimo/USE-CASES/) — seven situations, and how it runs itself once installed
- [SDD](https://atamaniuc.github.io/Harnessimo/SDD/) — OpenSpec, Agent OS, Spec Kit, BMAD, HDD, TDD: what was taken from each, what was left, where every piece is implemented and how to use it
- [Why each rule exists](https://atamaniuc.github.io/Harnessimo/STANDARD/)
- [Adopting an existing repo](https://atamaniuc.github.io/Harnessimo/ADOPTING/)
- [Contributing](CONTRIBUTING.md)

## Development

```bash
npm test          # 105 tests, no install — Node runs the TypeScript directly
npm run check     # tests, then this repo's own checks
npm run typecheck # tsc, strict, over src and test (needs npm i first)
npm run build     # what a consumer installs: dist/, with declarations
```

TypeScript, strict, ESM, no runtime dependencies. Rules live in `src/` as pure functions
over strings and in-memory trees; `src/resolver.ts` and `src/cli.ts` are the only files that
touch the disk. <!-- proof: test/cli.test.ts -->

There is no build step in the way of running it: sources import each other as `.ts`, so
Node's own type stripping runs them as they are — which is why `npm test` needs nothing
installed and the cold-start check still measures the repository rather than npm. `tsc`
emits `dist/` for consumers, rewriting those specifiers to `.js`, and a git install builds
it through `prepare`. <!-- proof: test/types.test.ts -->

## License

[MIT](LICENSE). Fork it, vendor it, ship it commercially. If you improve a rule, send a PR —
one copy is the whole point.
