# Tools

Everything this repository runs, and everything it offers other repositories, is the same
command line: `src/cli.ts`.

```
npm test                     the rules, against in-memory trees and real fixtures on disk
npm run check                the tests, then this repository's own gates
node src/cli.ts doctor  what is actually enforced here
node src/cli.ts queue status
node src/cli.ts hooks status   # is the pre-commit hook wired up at all
```

The hook here runs the same fast gates before a commit lands. It is checked in
at `.githooks/pre-commit`, so it is a reviewed file rather than a local artifact
somebody has to be told about.

No install step to run any of it: `node --test test/*.test.ts` works on a clean checkout,
because the package has no runtime dependencies and Node strips the types itself. That is
what makes the cold-start test here mean something rather than measure npm. Building
`dist/` for consumers is a separate job that does install the two devDependencies.

## Why the queue is a command and not a file you edit

An item is finished when its check passes, not when someone believes it is. Models are
consistently over-confident about their own work, so the judgement is taken away from them
and given to a command — and `harnessimo check --reverify` re-runs every passing claim in CI,
so a hand-edited state is detected rather than trusted.
