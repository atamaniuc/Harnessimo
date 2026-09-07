# Feedback

```
npm run check
```

Runs the tests, then this repository's own gates. It is what CI runs, and passing it is
what "finished" means here.

**1. The rules.** 105 tests over `src/`, each rule with at least one test proving it fires
on bad input. The rules are pure functions, so this level needs no fixture tree and takes
under a second.

**2. The wiring.** `test/cli.test.mjs` builds real repositories in a temporary directory
and runs the command line against them: a passing repository, one with a claim whose
evidence disappeared, one whose handoff was deleted, and one with no configuration at all.
Unit tests prove the rules; this proves they are actually reached.

**3. The whole thing on itself.** `node bin/harnessimo.mjs check` runs every gate this
repository defines against this repository. `harnessimo cold-start` then does it again in a
fresh clone, with nothing carried over.

## Re-checking claims

`node bin/harnessimo.mjs check --reverify` re-runs the verification of every item claiming to
pass. An item marked finished by hand fails here. CI runs it on every push, which is what
makes the queue's state evidence rather than assertion.
