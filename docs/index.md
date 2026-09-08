# Harnessimo

<p align="center">
  <img src="assets/harnessimo.jpg"
       alt="Robots in a server room wrestling a firehose of data while one of them holds a loop of it steady, under a sign reading HARNESSIMO"
       width="720">
</p>

**Checks that stop an AI agent from calling unfinished work done.**

Eight of them. You turn on the ones you need. They run in CI and before every commit, and
they fail with a file, a line and a fix.

=== "pnpm"

    ```bash
    pnpm add -D github:atamaniuc/Harnessimo#v0.3.0
    pnpm exec harnessimo init    # scans your repo, writes a config that already passes
    pnpm exec harnessimo check   # run this in CI
    ```

=== "npm"

    ```bash
    npm i -D github:atamaniuc/Harnessimo#v0.3.0
    npx harnessimo init    # scans your repo, writes a config that already passes
    npx harnessimo check   # run this in CI
    ```

=== "yarn"

    ```bash
    yarn add -D github:atamaniuc/Harnessimo#v0.3.0
    yarn harnessimo init    # scans your repo, writes a config that already passes
    yarn harnessimo check   # run this in CI
    ```

=== "bun"

    ```bash
    bun add -d github:atamaniuc/Harnessimo#v0.3.0
    bunx harnessimo init    # scans your repo, writes a config that already passes
    bunx harnessimo check   # run this in CI
    ```

Zero dependencies, one config file, any language — it reads your files, runs your commands,
walks your git history.

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
build breaks.

**A task marked done that nobody re-ran.** It sat at `passing` with made-up evidence.

```
FAIL  queue
  "checkout-totals" claims passing but its verification fails now
    command: npm test -- checkout
    fix:  fix the regression, or the claim was never true
```

Only the tool writes `passing`, and only after the task's own command exits 0. CI re-runs
every one of them.

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

## New project or existing one

**New:** `harnessimo init`, and the rules exist before the first bad habit does. You also get
`.harness/` (rules, tools, environment, state, feedback) and `specs/` (work tracks and
handoffs) scaffolded.

**Existing:** turn on one check, make it green, commit. Then the next one. Nothing switches
on by itself. The table of "what's going wrong → which check" is in
[Adopting an existing repo](ADOPTING.md).

## Where to go next

| If you want to… | Read |
|---|---|
| get a green check in fifteen minutes | [The guide](GUIDE.md) · [по-русски](GUIDE.ru.md) |
| see it on situations you recognise | [Use cases](USE-CASES.md) |
| know what was taken from OpenSpec, Spec Kit, BMAD, Agent OS, HDD — and what was not | [SDD](SDD.md) |
| know why each rule exists | [The standard](STANDARD.md) |
| migrate a repo that already has its own checks | [Adopting](ADOPTING.md) |

## Who runs it

Two production repos, both of which deleted their own versions of these checks:

- [`ledger-lens`](https://github.com/atamaniuc/ledger-lens) — Next.js, Supabase, Python.
  Swapped its documentation gates for this package; all 38 of its own unit tests passed
  without edits, and the counts matched exactly (183 markers across 71 documents).
- [`code-knowledge-base`](https://github.com/atamaniuc/code-knowledge-base) — dropped four
  local scripts, picked up proof markers, work tracks and the task gate.

Harnessimo runs all eight checks on itself, including from a fresh clone.

## What it isn't

- **Not a sandbox.** `locked` catches an agent editing its own scoring *in CI*. It won't stop
  someone determined to work around it.
- **Not a code reviewer.** It doesn't judge correctness, security or style.
- **Not a test-quality checker.** A test that asserts nothing passes every rule here.
- **Not a context tool.** Pair it with a code-graph or codebase-memory MCP — those answer
  "what should I read", this answers "is it done".

---

The model and its vocabulary come from
[Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/ru/);
handoff-driven development from
[yetanothervan/handoff-driven-development](https://github.com/yetanothervan/handoff-driven-development).

[Source on GitHub](https://github.com/atamaniuc/Harnessimo) · MIT
