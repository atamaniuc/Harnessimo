# Environment

- **Runtime** — Node >= 22, declared in `package.json` and used by CI. `node:test` and
  `node --test` are the whole test framework.
- **Dependencies** — none, by rule (`../1-instructions/CONSTRAINTS.md` #1). There is no
  lockfile to drift because there is nothing to lock.
- **Services** — none. Nothing to provision, no key needed to run any check.

## locked-baseline

Names the commit from which the locked-surface rule applies. The commit that *creates* a
protected path necessarily touches it, so enforcement starts after the bootstrap.

Moving this baseline forward widens what an agent may change. That is a human decision,
and it is the whole reason the file exists rather than the rule starting at the root
commit.
