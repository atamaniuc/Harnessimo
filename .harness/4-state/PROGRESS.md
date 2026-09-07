# PROGRESS

State carried between sessions. Read this first; update it before you stop.

## Now

**The tool is complete and self-hosting.** Eight checks — proof markers, work tracks, the
task gate, the queue, locked surfaces, cold start, clean exit and the instruction-file
limit — all implemented, tested, and enforced against this repository by `npm run check`.

- 82 tests, zero dependencies, no build step.
- Documentation is now anchored to
  [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/ru/):
  every check names the lecture it comes from, and `docs/GUIDE.md` (plus a Russian version)
  is the fifteen-minute way in, with diagrams for the session loop and the handoff cycle.
- The rules are pure functions in `src/`; `bin/harnessimo.mjs` and `src/resolver.mjs` are the
  only code that touches the world.
- `harnessimo init` scaffolds a working harness that passes its own check immediately —
  proven end to end in `test/cli.test.mjs`, not asserted here.
- **Both source repositories now depend on this package and have deleted their copies.**
  `code-knowledge-base` removed `harness.ts`, `locked-surfaces.sh`, `cold-start.sh` and
  `packages/harness`; `ledger-lens` kept its TypeScript entry points and delegated the rules,
  with all 38 of its existing unit tests passing untouched. Both CIs run the shared CLI.
- Run against `ledger-lens`, this package reproduces that repository's own gate exactly:
  183 proof markers across 71 documents, same scoping of the task gate. The rules moved
  without changing behaviour, which is the only evidence that matters for adoption.

## Done

- The proof-marker gate, generalised so a project declares its own command runner
  (`make`, `task`, `npm run`) rather than the rule assuming one.
- Handoff-driven development: the track index, dead-handoff references, and the task gate.
- The queue, with Definition of Ready enforced at activation and re-verification of every
  passing claim.
- Locked surfaces and the cold-start test, both with their limits stated in the code
  rather than in a flattering summary.
- Templates, so adoption is one command instead of a copying exercise.

## Next

1. Adoption in the two repositories the tool came out of (see `specs/TRACKS.md`).
2. A published tag, so consumers pin a version instead of tracking a branch.

## Open questions for the human

- None blocking. The one judgement call worth revisiting: `locked.paths` here covers CI
  and the constraints file only. Widening it is a human decision by design.

_Last updated: 2026-09-07_
