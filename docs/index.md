# Harnessimo

<p align="center">
  <img src="assets/harnessimo.jpg"
       alt="Robots in a server room wrestling a firehose of data while one of them holds a loop of it steady, under a sign reading HARNESSIMO"
       width="720">
</p>

## Autonomy needs an arbiter

An agent runs unattended exactly as far as something **other than the agent** decides when
the work is done. Take that away and you are not supervising less — you are trusting a
self-report, and self-reports are where unattended runs go wrong.

Harnessimo is that arbiter: eight checks that turn *"I believe this is done"* into *"a
command says so"*, plus the structure that makes those checks possible — rules, a work
queue, protected scoring, and state that survives a session ending.

Zero dependencies, no build step, one config file.

```bash
pnpm add -D github:atamaniuc/Harnessimo
pnpm exec harnessimo init      # reads your repo and writes a config that already passes
pnpm exec harnessimo doctor    # what is actually enforced here
pnpm exec harnessimo check     # the one command CI runs
```

## Where to start

| If you want to… | Read |
|---|---|
| understand it in fifteen minutes and get a green check | [The guide](GUIDE.md) · [по-русски](GUIDE.ru.md) |
| know why each rule exists, and which lecture it came from | [The standard](STANDARD.md) |
| migrate a repository that already has its own checks | [Adopting](ADOPTING.md) |

## What it checks

| Check | Fails when |
|---|---|
| `harnessimo proof` | a documented claim's test, file or command no longer exists |
| `harnessimo tracks` | a work track links a deleted handoff, or carries no status |
| `harnessimo tasks` | a checked box names no executable check |
| `harnessimo queue` | an item claiming `passing` fails when re-run |
| `harnessimo locked` | an agent commit touched the files that define success |
| `harnessimo cold-start` | a fresh clone cannot install and verify itself |
| `harnessimo clean-exit` | a session left debris, or never wrote down where it got to |
| `harnessimo instructions` | the instruction file grew from a router into a manual |

A section left out of `harnessimo.config.json` is a check that does not run, and
`harnessimo doctor` reports it as absent rather than implying otherwise. Claiming
enforcement that does not exist is worse than claiming none: it stops anyone from looking
for the missing check.

## Where it comes from

The model and its vocabulary come from
[Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/ru/);
handoff-driven development from
[yetanothervan/handoff-driven-development](https://github.com/yetanothervan/handoff-driven-development).
The implementation was extracted from two working repositories, each of which had grown
half of it — and both now depend on this one instead.

[Source on GitHub](https://github.com/atamaniuc/Harnessimo) · MIT
