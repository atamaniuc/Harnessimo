# PROGRESS

State carried between sessions. Read this first; update it before you stop.

## Now

**The tool is complete and self-hosting.** Eight checks — proof markers, work tracks, the
task gate, the queue, locked surfaces, cold start, clean exit and the instruction-file
limit — all implemented, tested, and enforced against this repository by `npm run check`.

- 105 tests, zero runtime dependencies. Written in TypeScript (strict); Node runs the
  sources directly through type stripping, so tests and the CLI need no install, while
  `npm run build` emits `dist/` with declarations for consumers.
- Documentation is now anchored to
  [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/ru/):
  every check names the lecture it comes from, and `docs/GUIDE.md` (plus a Russian version)
  is the fifteen-minute way in, with diagrams for the session loop and the handoff cycle.
- The rules are pure functions in `src/`; `src/cli.ts` and `src/resolver.ts` are the
  only code that touches the world.
- `harnessimo init` scaffolds a working harness that passes its own check immediately —
  proven end to end in `test/cli.test.ts`, not asserted here.
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

0. Nothing blocking. The two source repositories run on the package, both hooks (git and
   agent-side) are installed in all three, and the docs site is live.

1. Adoption in the two repositories the tool came out of (see `specs/TRACKS.md`).
2. A published tag, so consumers pin a version instead of tracking a branch.

## Settled recently

- **Code-graph / codebase-memory tools are not bundled** (see `DECISIONS.md`). They answer
  "what do I need to read"; this answers "is it finished". Both, separately.
- **The pitch leads with autonomy**: an agent runs unattended exactly as far as something
  other than the agent decides when the work is done.

## Waiting on a human

- Nothing. The docs site is live at <https://atamaniuc.github.io/Harnessimo/> with all nine
  diagrams rendering, and every deploy run verifies that by fetching a MkDocs-only path and
  counting the diagram markup — not by trusting a 200 on the root, which is what let a
  Jekyll build masquerade as this one for an afternoon.
Both consumers now pin `#v0.1.0`.

## Open questions for the human

- None blocking. The one judgement call worth revisiting: `locked.paths` here covers CI
  and the constraints file only. Widening it is a human decision by design.

_Last updated: 2026-09-07_
