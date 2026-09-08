# Harnessimo

[![CI](https://github.com/atamaniuc/Harnessimo/actions/workflows/ci.yml/badge.svg)](https://github.com/atamaniuc/Harnessimo/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![release](https://img.shields.io/github/v/release/atamaniuc/Harnessimo?label=release)](https://github.com/atamaniuc/Harnessimo/releases/latest)
[![docs](https://img.shields.io/badge/docs-atamaniuc.github.io%2FHarnessimo-blue)](https://atamaniuc.github.io/Harnessimo/)
[![npm](https://img.shields.io/npm/v/harnessimo?label=npm)](https://www.npmjs.com/package/harnessimo)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)

<p align="center">
  <img src="https://raw.githubusercontent.com/atamaniuc/Harnessimo/main/docs/assets/harnessimo.jpg"
       alt="Robots in a server room wrestling a firehose of data while one of them holds a loop of it steady, under a sign reading HARNESSIMO"
       width="720">
</p>

**Checks that stop an AI agent from calling unfinished work done.**

Nine of them. You turn on the ones you need. They run in CI and before every commit, and
they fail with a file, a line and a fix.

Zero dependencies, one config file, any language — it reads your files, runs your commands,
walks your git history. <!-- proof: package.json:"files" -->

<!-- demo:start -->
<p align="center">
  <img src="https://raw.githubusercontent.com/atamaniuc/Harnessimo/main/docs/assets/demo.png"
       alt="A terminal: harnessimo init writes a config, check passes, someone renames a function the README pointed at, and check now fails naming the file, the line and the claim"
       width="860">
</p>

Nobody drew that: `npm run demo` runs those commands in a throwaway repository and records
what they print. <!-- proof: scripts/record-demo.ts -->
<!-- demo:end -->

<!-- install:start -->
```bash
pnpm add -D harnessimo
pnpm exec harnessimo init      # scans your repo, writes a config that already passes
pnpm exec harnessimo check     # run this in CI
```

<details>
<summary>npm, yarn, bun</summary>

```bash
npm i  -D harnessimo && npx  harnessimo init && npx  harnessimo check
yarn add -D harnessimo && yarn harnessimo init && yarn harnessimo check
bun add  -d harnessimo && bunx harnessimo init && bunx harnessimo check
```

All four were run against this release before being written down.

</details>
<!-- install:end -->

## Who this is for

**You, if an agent writes a meaningful share of your code and you are the only one checking
its work.** One person with three agents has the review load of a team lead and none of the
team. These checks are the part of a reviewer's job that a command can do.

Concretely:

| | What changes |
|---|---|
| **Solo developer, agent-assisted** | You stop re-reading diffs to find out whether the thing it said it finished is finished |
| **Vibe coding a real project** | The README stays true as the project moves, so the next session — yours or the agent's — is not working from fiction |
| **A team running an agentic SDLC** | "Done" becomes a command's exit code instead of a status somebody typed, and it means the same thing for every person and every agent |
| **A long-running codebase with agents in it** | Work survives session boundaries: tracks and handoffs are checked, not hoped for |

**Not for you** if the project is a weekend script, if you write everything yourself and
review it yourself, or if nobody will write the one-line proof markers — they are the only
manual part, and a repository where nobody writes them ends up with a gate that enforces
nothing.

## Why this, when Kiro and Spec Kit exist

Because they solve a different half. Kiro, Spec Kit, BMAD, Copilot's coding agent and the
agent CLIs are about **producing** work: context, specs, planning, tools, sandboxes. Their
answer to "is it actually done" is the one everybody already has — run the tests, ask a
human.

This is the other half, and it is the half nobody ships: **the arbiter**. Documentation that
fails the build when it stops being true. A work queue whose state only a passing command
can write. Scoring files an agent's own commit may not touch.

It is also deliberately not a platform. No runtime, no daemon, no dependencies, no lock-in:
one npm package and a JSON file that work the same under Claude Code, Cursor, Codex, Kiro or
a person with a keyboard — and keep working when you switch.

The full comparison, layer by layer, is
[Why this exists](https://atamaniuc.github.io/Harnessimo/WHY/).

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

## All nine checks

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
| `harnessimo release` | the version in the manifest, the changelog and the tags disagree |

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

## Any agent, any model

Nothing here knows which model wrote the code. The checks read files, run your commands and
walk your git history — so they work the same under Claude Code, Codex, Cursor, Gemini CLI,
a self-hosted DeepSeek, two of them at once, or nobody at all.
<!-- proof: test/brief.test.ts#nothing in the contract is specific to one vendor's agent -->

One piece is tool-specific, and only because tools differ: the automatic session briefing.
`harnessimo hooks install --agent` writes it as a SessionStart hook for Claude Code, which
has an API for that. Every other tool gets the same thing in one line — `harnessimo agent`
prints the contract to paste into whatever instruction file it reads, be that `AGENTS.md`,
`CLAUDE.md`, `GEMINI.md` or a Cursor rule:

```
$ harnessimo agent
## Harness

- Run `harnessimo brief` at the start of a session: it prints the live tracks, the
  head of each handoff and what is in flight. Read it before touching anything.
- Run `harnessimo check` before saying anything is done. Green is the claim; your
  summary is not.
- Never edit state in the queue file. `harnessimo queue verify <id>` runs the item's
  own command and records the outcome — that is the only way something becomes passing.
```

That is the whole integration surface. There is no plugin to install, no model to configure
and nothing to migrate when you switch — which is the point of keeping the rules in files
rather than in a vendor's format.

## Using it, by hand and by agent

Same checks, two ways in.

**A person** runs `harnessimo check` before pushing — or lets the pre-commit hook do it —
and `harnessimo doctor` when they want to know what this repository actually guarantees.
Nothing else is required: the checks read files and run commands, so they work in a
repository with no agents anywhere near it.

**An agent** gets three things it cannot get from an instruction file. At session start a
hook hands it the live tracks, the head of each handoff and what is in flight, so it does
not re-derive them. During the work, `harnessimo queue verify <id>` is the only way an item
becomes `passing` — the agent runs the command, the tool records the outcome. At commit, the
same gate a person gets.

```bash
harnessimo hooks install --agent   # SessionStart briefing, merged into .claude/settings.json
harnessimo hooks install           # the fast gates, before every commit
```

Both flows in detail: [Use cases](https://atamaniuc.github.io/Harnessimo/USE-CASES/).

## Why you can trust it

Every line here is checkable, which is the only kind of trust argument this project is
entitled to make:

- **Published by a workflow, not a person.** Releases are built and signed in GitHub Actions
  and authenticated by OIDC — there is no npm token in this repository or in its secrets to
  steal. Each version carries a provenance statement naming the commit and workflow that
  produced it; `npm audit signatures` verifies it.
- **Zero runtime dependencies**, by a rule its own CI enforces. Nothing it pulls in can break
  the project it is guarding, and there is no supply chain under it to audit but this one.
- **It is held to its own standard.** All nine checks run against this repository, including
  a cold start that clones it into an empty directory and runs the documented commands, and
  a re-verification of every passing claim. The badge above is that.
- **Every rule has a test that proves it fires on bad input** — a rule that has only ever
  passed is an assumption wearing a rule's clothes.
- **Used in production, not only demonstrated.** Two repositories deleted their own versions
  of these checks to adopt it; both are linked below and both are public.
- **MIT, and small enough to read.** About three thousand lines. If it disappeared tomorrow
  you could vendor it in an afternoon.

## Who runs it

Two production repos, both of which deleted their own versions of these checks:

- [`ledger-lens`](https://github.com/atamaniuc/ledger-lens) — Next.js, Supabase, Python.
  Swapped its documentation gates for this package; all 38 of its own unit tests passed
  without edits, and the counts matched exactly (183 markers across 71 documents).
- [`code-knowledge-base`](https://github.com/atamaniuc/code-knowledge-base) — dropped four
  local scripts, picked up proof markers, work tracks and the task gate.

This repo runs all nine checks on itself, including from a fresh clone.
<!-- proof: npm run check -->

## What it isn't

- **Not a sandbox.** `locked` catches an agent editing its own scoring *in CI*. It won't stop
  someone determined to work around it.
- **Not a code reviewer.** It doesn't judge correctness, security or style.
- **Not a test-quality checker.** A test that asserts nothing passes every rule here.
- **Not a context tool.** Pair it with a code-graph or codebase-memory MCP — those answer
  "what should I read", this answers "is it done".

## Docs

**<https://atamaniuc.github.io/Harnessimo/>** — every page is also in Russian:
[по-русски](https://atamaniuc.github.io/Harnessimo/ru/), or the language switcher in the
header.

- [Why this exists](https://atamaniuc.github.io/Harnessimo/WHY/) — who it is for, when it is worth it, and how it sits next to Kiro, Spec Kit, Copilot and the agent CLIs
- [15-minute guide](https://atamaniuc.github.io/Harnessimo/GUIDE/)
- [Use cases](https://atamaniuc.github.io/Harnessimo/USE-CASES/) — seven situations, and how it runs itself once installed
- [SDD](https://atamaniuc.github.io/Harnessimo/SDD/) — OpenSpec, Agent OS, Spec Kit, BMAD, HDD, TDD: what was taken from each, what was left, where every piece is implemented and how to use it
- [Why each rule exists](https://atamaniuc.github.io/Harnessimo/STANDARD/)
- [Adopting an existing repo](https://atamaniuc.github.io/Harnessimo/ADOPTING/)
- [Contributing](CONTRIBUTING.md)

## Development

```bash
npm test          # the whole suite, no install — Node runs the TypeScript directly
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
emits `dist/` (rewriting those specifiers to `.js`) and that is what gets published. Build
output is not committed.
<!-- proof: test/types.test.ts -->

## License

[MIT](LICENSE). Fork it, vendor it, ship it commercially. If you improve a rule, send a PR —
one copy is the whole point.
