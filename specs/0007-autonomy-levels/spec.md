# 0007 — How much was this run watched

## Why

Every check here answers one question: is this finished. None of them ask how
the answer was arrived at.

So the same green report means two different things. A person who read every
step and then ran `check` has two independent judgements agreeing. An overnight
headless run that ends green has one, and it is the run's own. The bar was
identical either way, while the supervision behind it moved from "everything"
to "nothing".

The rule this lane implements is one sentence: **verify a run in proportion to
how little anyone watched it.**

## The boundary, stated first

**The tool does not guess how closely anyone was watching.** It could look at
`CI`, at whether stdin is a terminal, at the number of commits — and every one
of those is a guess about a person's attention dressed up as a fact. A guess
would be a claim of its own, in a package that exists because claims get
checked rather than believed.

So the level is declared, and what is enforced is that the declaration is
backed: a run claiming nobody watched it, in a repository that cannot show a
fresh clone works, is an unsupervised run with nothing behind the claim.

## What

Three levels, least supervision first. Each adds what supervision at the level
below could no longer catch, and costs more for the same reason.

| Level | What it means | What it adds |
|---|---|---|
| `watched` | a person is reading each step as it happens | the fast checks: proof, tracks, tasks, queue, instructions, release |
| `reviewed` | nobody watched the steps; a person will read the diff | re-verification, and the locked-surface check |
| `unattended` | nobody looked at all | clean exit, and cold start |

The ladder is the reasoning. A person reading each step still misses a
documented claim that quietly stopped being true, so the fast checks are there
from the start. A person reading only the diff cannot re-run every `passing`
claim, and will not notice an agent editing the file that grades it. Nobody at
all means nobody notices debris, and nobody notices that the repository stopped
running from a clean clone.

### Declaring it

```json
{ "autonomy": { "level": "reviewed" } }
```

A **floor**, not a setting. `--autonomy <level>` and `HARNESSIMO_AUTONOMY` can
raise it; neither can lower it, and an attempt says so rather than silently
getting what it asked for. A bar an unattended run can argue its way under is
not a bar.

### The rule

`check` refuses a level whose additions the repository cannot run: at
`unattended` without a `coldStart` section, the run is claiming something
nothing in the repository can support.

`watched` demands nothing extra. A person is the supervision there, the checks
supplement them, and "a section you leave out is a check that does not run" is
a promise this tool has made since its first version. The rule bites where a
claim is actually being made.

### Saying it out loud

- `check` prints the level and what it means before the report, so a green
  report says what its green covers.
- `doctor` marks a configured check that the current level does not ask for as
  `above` rather than `enforced` — configured and not running is exactly the
  overstatement `doctor` exists to avoid.
- `brief` tells a session the level at startup. An agent that does not know how
  closely it is watched cannot know what it will be held to at the end of the
  turn.

## Acceptance criteria

1. `test/autonomy.test.ts::each level requires everything the level below it does` —
   including that the three levels between them cover all nine checks.
2. `test/autonomy.test.ts::re-verification starts where a diff-reader stops being able to catch it`.
3. `test/autonomy.test.ts::a declared floor cannot be argued down at the command line`.
4. `test/autonomy.test.ts::a level the repository cannot back is refused, naming the section to add`.
5. `test/autonomy.test.ts::a lower level is not held to what it never claimed` — the
   same repository passes at `watched` and is refused at `unattended`.
6. `test/cli.test.ts::a level the repository cannot back is refused, and names the section to add` —
   the wiring, against a repository on disk.
7. `test/cli.test.ts::a declared floor cannot be argued down from the command line`.
8. `test/cli.test.ts::the report says which level it ran at, and green means that level`.

## Out of scope

- Inferring the level. See the boundary.
- Per-check overrides ("run cold start at `watched` but not clean exit"). The
  ladder is the argument; an à-la-carte list is a preferences file, and a
  preferences file is how a bar stops meaning anything.
- A fourth level. Three is what the distinction supports: watched, read, and
  neither.
