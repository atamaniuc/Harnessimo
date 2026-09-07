# Tasks — 0001 Adoption

P0 gates the lane. A checked box carries the marker that proves it.

## P0

- [x] **T1** The rules from both repositories exist as one tested implementation: proof
      markers with a configurable command runner, the track index and dead-handoff audit,
      the task gate, the queue with Definition of Ready, locked surfaces, cold start
      <!-- proof: src/index.mjs:verifyProofs -->
- [x] **T2** Every rule has a test proving it fires on bad input, and the wiring has
      end-to-end tests against real repositories on disk <!-- proof: npm run test -->
- [x] **T3** `harness init` scaffolds a harness that passes immediately, so adoption is a
      command rather than a copying exercise
      <!-- proof: test/cli.test.mjs#init scaffolds a working harness that immediately passes its own check -->
- [ ] **T4** `code-knowledge-base` depends on the package; its vendored scripts are
      deleted and CI runs the shared CLI
- [ ] **T5** `ledger-lens` depends on the package; its documentation gate delegates to the
      shared implementation
- [ ] **T6** CI is green in both repositories after adoption

## P1

- [ ] **T7** A `v0.1.0` tag, so consumers pin a version instead of tracking `main`
- [ ] **T8** The adoption steps in `docs/ADOPTING.md` re-checked against what the two
      migrations actually required, and corrected where they differ
