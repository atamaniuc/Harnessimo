# CONSTRAINTS

Hard rules. Not guidelines — a violation is a defect, not a style disagreement.

**Enforcement is stated per rule, and it is literal.** _enforced_ means a command fails.
Everything else is caught in review, which means it can be missed. Claiming enforcement
that does not exist is worse than claiming none: it stops anyone from looking for the
missing check.

> Replace these with your project's real rules. The shape matters more than the
> examples: a rule, then who catches it, then why it exists.

## Work discipline

1. **Never mark an item done without running its verification.** _(enforced: only
   `harnessimo queue verify` writes evidence, and `harnessimo queue check --reverify` re-runs
   every passing claim in CI)_
   Evidence, not confidence.

2. **Never hold more than one item active.** _(enforced: `harnessimo queue activate`)_
   Split attention produces work that is started everywhere and finished nowhere.

3. **Never report work complete without linking the evidence.** _(enforced: an item in a
   terminal state with no evidence fails `harnessimo queue check`)_

4. **Never add items to the queue.** _(review only — the harness cannot tell a
   human-requested item from a self-assigned one)_
   Scope belongs to the human. A loop that rewrites its own goal has no goal.

5. **Never refactor before verification passes.** _(review only)_
   Refactoring unverified code destroys the evidence of which parts were ever correct.

## Documentation integrity

6. **Never write a claim into the docs without a proof marker.** _(enforced:
   `harnessimo proof --strict`)_
   `<!-- proof: path[:symbol|#test] -->` next to the claim. Prose cannot be trusted to
   stay true on its own.

7. **Never leave a reference to a deleted handoff.** _(enforced: `harnessimo proof`)_
   A handoff dies when its track closes; a dead reference is a marker the next session
   trusts.

## Locked surfaces

8. **Never modify a locked surface.** _(enforced: `harnessimo locked` in CI, when
   `locked.paths` is configured)_
   The scoring code, the acceptance rules, the CI workflow, and the check itself. These
   define or enforce the acceptance signal; a loop that can edit them can grant itself a
   passing score. Changing them is a human act, in a commit without the agent trailer.

   **Limit, stated rather than hidden:** this assumes commits pass through CI. It is
   drift detection, not a sandbox.
