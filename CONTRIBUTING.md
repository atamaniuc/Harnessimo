# Contributing

The useful contribution is a rule that turned out to be wrong, or one that is missing. A
rule forked into your own repository is the problem this project exists to remove — open an
issue or a pull request instead.

## Running it

```bash
npm test        # every rule, plus the CLI against real repositories in a temp directory
npm run check   # the tests, then this repository's own gates
```

No install step to run those: the package has no runtime dependencies, by rule, and Node
(>= 22) runs the TypeScript sources through its own type stripping.

`npm run typecheck` and `npm run build` are the two that need `npm i` — `typescript` and
`@types/node` are devDependencies and nothing ships with the package. Run the typecheck
before a push: it is strict, the types are the package's published contract, and no test
here checks them.

## The three rules a change has to meet

1. **No runtime dependency.** A harness that can break the project it guards is worse than
   no harness, and zero dependencies is what makes the cold-start test measure the
   repository rather than a package registry.
2. **Rules stay pure.** Everything in `src/` is a function over strings and in-memory
   trees; `src/resolver.ts` and `src/cli.ts` are the only code that touches the
   world. A rule that needs a fixture tree to test is a rule that stops being tested.
3. **A rule ships with a test proving it fires on bad input.** A rule with no failing test
   is an assumption wearing a rule's clothes.

## Proposing a new check

Answer these in the issue or the PR description, in this order:

- **What went wrong, concretely?** Every check here came from a real failure — a README
  claiming infrastructure that did not exist, an item marked passing with invented
  evidence, a script that moved and left its verification behind. A check with no incident
  behind it tends to be ceremony.
- **What does it fail on, and what does it deliberately let through?** A rule that fires on
  false positives gets turned off, and a rule that is off enforces nothing. Two rules here
  needed a threshold or a scope after meeting real code; expect yours to.
- **Who catches it if the command does not?** Every constraint in this repository states
  whether a command enforces it or a person has to notice. Claiming enforcement that does
  not exist is worse than claiming none.

## Changing the docs

Claims carry evidence: `<!-- proof: path/to/file.ts:<symbol> -->` next to the sentence.
`npm run check` fails when a marker's target is gone, so a claim cannot outlive the thing
it describes.

## What is deliberately out of scope

Reviewing code for correctness, security or taste; deciding whether a check is any *good*;
indexing a codebase for context (see "What pairs with it" in the README). Proposals that
extend the tool into those are likely to be declined — with the reason, not silently.

## License

MIT. By contributing you agree your work ships under it.

## What only a workflow can do

Two things are out of reach from an agent session, deliberately: its git credentials may
push a branch but not create a tag or delete a ref, and `GITHUB_TOKEN` cannot hold
Administration rights at all — no `permissions:` block grants them.

`.github/workflows/ops.yml` holds that half. The About panel is a file
(`.github/repo-about.json`) applied when it changes; branch cleanup and tag repair are
dispatchable with a fixed list of what they may touch. It needs a `SUDO_TOKEN`
secret — a fine-grained token scoped to this repository only, with Administration: write
and Contents: write — and skips itself, saying so, until that exists.

The token stays in the secret store: it is read inside a run, used there, and every use is
logged with its author, time and inputs. Releases need none of this — publishing
authenticates by OIDC and has no token at all.
