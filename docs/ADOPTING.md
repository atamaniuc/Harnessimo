# Adopting the harness

Two paths: a new repository, which is one command, and an existing one, which is a
translation exercise. The second is the interesting case and most of this document.

If you have not met the tool yet, read [`GUIDE.md`](GUIDE.md) first — it covers the "why"
in fifteen minutes and this document assumes it.

## A new repository

=== "pnpm"

    ```bash
    pnpm add -D github:atamaniuc/Harnessimo#v0.3.0
    pnpm exec harnessimo init
    pnpm exec harnessimo check
    ```

=== "npm"

    ```bash
    npm i -D github:atamaniuc/Harnessimo#v0.3.0
    npx harnessimo init
    npx harnessimo check
    ```

=== "yarn"

    ```bash
    yarn add -D github:atamaniuc/Harnessimo#v0.3.0
    yarn harnessimo init
    yarn harnessimo check
    ```

=== "bun"

    ```bash
    bun add -d github:atamaniuc/Harnessimo#v0.3.0
    bunx harnessimo init
    bunx harnessimo check
    ```

Later examples write `harnessimo …` on its own: prefix it with your runner — `pnpm exec`,
`npx`, `yarn` or `bunx`.

`init` writes `.harness/` (five layers, with starter documents), `specs/` (the track index,
its log, and templates for a spec and a handoff), and `harnessimo.config.json`. The scaffolded
harness passes its own check immediately, so the first green run costs nothing and every
later red one means something.
<!-- proof: test/cli.test.mjs#init scaffolds a working harness that immediately passes its own check -->

Then, in order:

1. **Rewrite `CONSTRAINTS.md` with your project's real rules.** Keep the shape: the rule,
   then who catches it, then why. Delete every example you have not adopted — an
   aspirational constraint is a lie with good intentions.
2. **Point `docs.commands` at your command runner** — `{ "make": "Makefile" }`,
   `{ "task": "Taskfile.yml" }`, `{ "pnpm run": "package.json" }`. Without it, a
   `<!-- proof: make <target> -->` marker cannot be resolved and says so rather than passing.
3. **Add your central document to `docs.mustCarryProof`.** Usually `README.md`. This is
   what makes strict mode mean anything.
4. **Wire `harnessimo check` into CI** next to your existing gate.
5. **Install both hooks.** `harnessimo hooks install` runs the fast gates before a commit
   lands; `harnessimo hooks install --agent` hands the harness state to every new agent
   session at startup. The second one is what stops "read the handoff first" from being a
   rule that depends on memory.

## An existing repository

The rule for the whole migration: **adoption never trades a check away.** If the shared
implementation cannot express something you already enforce, keep your check and write the
gap down. Silently losing a gate to make a migration tidy is the exact failure this tool
exists to prevent.

### 1. Inventory before you delete anything

List what you enforce today and what enforces it. Then run:

```bash
harnessimo doctor
```

and compare, line by line. `doctor` reports what is configured, never what is aspirational,
so the diff between those two lists is the real work.
<!-- proof: test/cli.test.mjs#doctor reports what is enforced and what is not, without overstating -->

### 2. Translate, one section at a time

Each section of `harnessimo.config.json` maps onto something you probably already have:

| You have | Becomes |
|---|---|
| A script listing paths an agent may not touch | `locked.paths` + `locked.baseline` |
| A clone-and-run smoke script | `coldStart.requiredFiles` / `.commands` / `.entryDocs` |
| A feature list or item queue with states | `queue.file` |
| A hand-maintained index of in-flight work | `tracks.file`, plus a handoff per track |
| A docs audit script | `docs.roots`, `docs.mustCarryProof`, `docs.commands` |
| A hand-written SessionStart hook | `harnessimo hooks install --agent` |
| A hand-written pre-commit hook | `harnessimo hooks install` + `hooks.before` |
| A grep for `TODO` / `console.log` in review | `cleanExit.markers` + `cleanExit.scan` |
| A note asking people to keep `AGENTS.md` short | `instructions.limits` |

Turn one on, run `harnessimo check`, fix what it finds, commit. Then the next. A migration that
turns on six checks at once produces one enormous red run that nobody can read.

### 3. Keep your wrapper if you have one

A repository whose gate is a task in a `Taskfile`, or a TypeScript module with its own unit
tests, does not have to give that up. Keep the wrapper and have it call the package, so the
rule has one implementation and your project keeps its own entry point and its
project-specific parts:

```ts
import { verifyProofs, createResolver } from "harnessimo";
```
<!-- proof: src/index.mjs -->

The test for whether the migration worked is not that the wrapper disappeared. It is that
the *rule* exists once.

### 4. Delete the copies, in the same commit as the switch

A vendored script that is no longer called is worse than one that is: the next person edits
it and nothing happens. Delete it in the commit that switches over, so the diff shows the
exchange rather than an accumulation.

## Two worked examples

**`code-knowledge-base`** (Make, pnpm workspace). Its harness maps almost exactly onto the
shared one: `locked-surfaces.sh` becomes `locked.paths`, `cold-start.sh` becomes the
`coldStart` section, `harness.ts` becomes `queue.file`. It gains what it did not have —
proof markers, work tracks, the task gate — for the price of a config file.

Its adoption also has one prerequisite worth copying: it was red in CI first, for an
unrelated reason (a script moved during a reorganisation, and the queue item verifying it
kept pointing at the old path). **Fix CI before adopting.** Otherwise the first red run
after the migration is ambiguous, and an ambiguous red run gets ignored.

**`ledger-lens`** (Taskfile, Next.js, Supabase, Python). It already had proof markers,
tracks and the task gate as TypeScript with its own unit tests, so its migration is the
"keep your wrapper" case: the module delegates to the package, and its project-specific
resolver — Supabase migration prefixes, its own `MUST_CARRY_PROOF` list — becomes
configuration. It gains locked surfaces and cold start, which it never had.

## After adoption

- Cut a tag and pin it: `pnpm add -D github:atamaniuc/Harnessimo#v0.3.0`. Tracking `main`
  means a rule can tighten under you between two green runs, which is exactly the surprise
  a gate must not produce.
- Run `harnessimo doctor` in CI on a schedule, or read it before each release. It is the one
  answer to "what does this repository actually guarantee".
