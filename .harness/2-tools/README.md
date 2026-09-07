# Tools

Everything this repository runs, and everything it offers other repositories, is the same
command line: `bin/harnessimo.mjs`.

```
npm test                     the rules, against in-memory trees and real fixtures on disk
npm run check                the tests, then this repository's own gates
node bin/harnessimo.mjs doctor  what is actually enforced here
node bin/harnessimo.mjs queue status
```

There is no build step and no install step. `node --test test/*.test.mjs` runs on a clean
checkout, because the package has no dependencies — which is what makes the cold-start
test here mean something rather than measure npm.

## Why the queue is a command and not a file you edit

An item is finished when its check passes, not when someone believes it is. Models are
consistently over-confident about their own work, so the judgement is taken away from them
and given to a command — and `harnessimo check --reverify` re-runs every passing claim in CI,
so a hand-edited state is detected rather than trusted.
