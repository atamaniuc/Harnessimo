# CONSTRAINTS

The rules for working in this repository. Enforcement is stated per rule and it is
literal: **enforced** means a command fails.

## The tool

1. **Never add a runtime dependency.** _(enforced: `dependencies` is absent from
   package.json and `npm test` runs on a clean checkout with no install step)_
   A harness that can break the project it guards is worse than no harness. Zero
   dependencies is also what makes the cold-start test trivial and honest here.
   TypeScript and `@types/node` are devDependencies: they build `dist/` for
   consumers and check the types, and neither is needed to run anything here.

2. **Never write syntax Node cannot strip.** _(enforced: `erasableSyntaxOnly` in
   tsconfig.json)_
   The sources are run two ways — directly by Node for tests and the CLI, and
   compiled by `tsc` for what consumers install. Enums, namespaces and parameter
   properties exist in only one of those worlds, and a package that behaves
   differently depending on how it was started is not a harness.

3. **Never put filesystem access in a rule.** _(review only)_
   Rules live in `src/*.ts` as pure functions and are tested against in-memory trees;
   `src/resolver.ts` and `src/cli.ts` are the only places that read the world. A
   rule that reads the disk needs a fixture tree to test, and a rule that is annoying to
   test stops being tested.

4. **Never ship a rule without a test that proves it fires on bad input.** _(review only,
   but the bar is not negotiable — every rule in `src/` has one)_
   A rule with no failing test is an assumption wearing a rule's clothes.

5. **Never let a check pass by finding nothing.** _(review only)_
   An unknown marker prefix reports that it cannot be checked instead of returning "fine";
   a missing track index is a problem, not silence. A gate that errors open is not a gate.

## Claims

6. **Never write a claim into a document without a proof marker.** _(enforced:
   `npm run check`)_
   This repository's README makes claims about what the tool does. Each names the test or
   file that makes it true.

7. **Never state an enforcement that does not exist.** _(review only, and it is the rule
   most worth reviewing)_
   Every rule here says whether a command catches it. Four of the ten are review-only and
   say so. Claiming enforcement that is absent is worse than claiming none: it stops
   anyone from looking for the missing check.

## Work discipline

8. **Never mark an item done without running its verification.** _(enforced: only
   `harnessimo queue verify` writes evidence, and CI re-runs every passing claim)_

9. **Never hold more than one item active.** _(enforced: `harnessimo queue activate`)_

10. **Never modify a locked surface in an agent commit.** _(enforced: `harnessimo locked` in
   CI)_ `.github/workflows/` and this file. A loop that can edit its own scoring will.
   **Limit, stated rather than hidden:** this assumes commits pass through CI. It is drift
   detection, not a sandbox.
