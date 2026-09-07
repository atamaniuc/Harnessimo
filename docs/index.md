# Harnessimo

<p align="center">
  <img src="assets/harnessimo.jpg"
       alt="Robots in a server room wrestling a firehose of data while one of them holds a loop of it steady, under a sign reading HARNESSIMO"
       width="720">
</p>

> **An agent runs unattended exactly as far as something other than the agent decides when
> the work is done.** Harnessimo is that something: eight checks that turn *"I believe this
> is done"* into *"a command says so"*.

```bash
pnpm add -D github:atamaniuc/Harnessimo#v0.3.0
pnpm exec harnessimo init            # reads your repo, writes a config that already passes
pnpm exec harnessimo hooks install --agent   # every session starts knowing where things stand
pnpm exec harnessimo check           # the one command CI runs
```

Zero dependencies, no build step, one config file. It reads your files, runs your commands
and walks your git history, so the language of your project does not matter.

## The three ways agent work rots

Each is a real failure from the repositories this came out of.

1. **The docs describe software that does not exist.** A README claimed infrastructure
   "stood up through a single Pulumi program in `infra/`" while `infra/` had never been
   created. Ten such claims came out of one audit.
2. **"Done" is a self-report.** A queue item sat at `passing` with invented evidence, and
   nothing ever re-ran it.
3. **Every session starts from zero.** Context dies with the session; the next one
   re-derives it, re-decides settled questions, and re-reads what it should have skipped.

A capable model does not fix any of these. It produces them faster.

## What you get

| Killer feature | What it means |
|---|---|
| **The agent cannot mark its own work done** | Only `queue verify` writes state, after the item's own command exits zero — and CI re-runs every passing claim |
| **Documentation that cannot lie** | Every claim names its evidence; delete the test and the build goes red |
| **Sessions inherit state, not memory** | Tracks, handoffs, and a SessionStart hook that hands them to the agent at startup |
| **The scoring is out of reach** | An agent commit touching the files that define success fails the build |
| **A fresh clone must actually run** | Cold start, in an empty directory, using only what the repository says |
| **No debris left behind** | Leftover `TODO`, `debugger`, `.only(`, a progress file gone stale |
| **Honest about its own gaps** | `doctor` lists the checks you did *not* turn on |
| **Adoption is one command** | `init` writes a config whose first run is green |

## Greenfield or brownfield

**Greenfield:** `harnessimo init` and the discipline exists before the first bad habit does.

**Brownfield:** nothing switches on that you did not ask for. Take the check that matches a
problem you actually have, make it green, commit, take the next. Both paths are in
[Adopting](ADOPTING.md).

## Where to start

| If you want to… | Read |
|---|---|
| understand it in fifteen minutes and get a green check | [The guide](GUIDE.md) · [по-русски](GUIDE.ru.md) |
| know why each rule exists, and which lecture it came from | [The standard](STANDARD.md) |
| migrate a repository that already has its own checks | [Adopting](ADOPTING.md) |

## Proof it survives real repositories

- [`ledger-lens`](https://github.com/atamaniuc/ledger-lens) — Next.js, Supabase, Python,
  evals. Delegated its documentation gates to the package: all 38 of its own unit tests
  passed untouched, and the numbers matched to the marker.
- [`code-knowledge-base`](https://github.com/atamaniuc/code-knowledge-base) — deleted its
  queue tool, locked-surface and cold-start scripts; gained proof markers, work tracks and
  the task gate for the price of a config file.

## What it does not do

`locked` is drift detection, not a sandbox. It cannot tell whether a check is any *good* —
a test that asserts nothing satisfies every rule here. It does not review code. And it is
not a context tool: pair it with a code-graph or codebase-memory MCP, which answers "what do
I need to read" while this answers "is it finished".

---

The model and its vocabulary come from
[Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/ru/);
handoff-driven development from
[yetanothervan/handoff-driven-development](https://github.com/yetanothervan/handoff-driven-development).

[Source on GitHub](https://github.com/atamaniuc/Harnessimo) · MIT
