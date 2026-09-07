# Tools — what this project can run

The harness itself is a dependency (`@atamaniuc/harness`), not a folder of scripts copied
into this repository. A copied script is a fork the day after it is copied; a dependency
is one implementation with one set of tests, and this project configures it in
`harness.config.json` rather than editing it.

```
harness check [--reverify]   every configured gate; the one command CI runs
harness doctor               what is actually enforced here, honestly
harness queue status         what is in flight
harness queue verify <id>    run that item's own check and record the outcome
harness locked               an agent commit did not touch the files defining success
harness cold-start           a fresh clone installs and verifies from the repo alone
```

Project-specific tooling belongs here as well — anything this project runs that the
shared harness knows nothing about.

**Why the queue is a tool and not a file you edit:** an item is finished when its check
passes, not when someone believes it is. Models are consistently over-confident about
their own work, so the judgement is taken away from them and given to a command.
