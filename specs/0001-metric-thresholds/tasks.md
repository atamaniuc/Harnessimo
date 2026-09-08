# Tasks — 0001 Metric thresholds as a check

## P0

- [x] T1 — Answer the tenth-check-or-pattern question in the spec, before any code
      <!-- proof: specs/0001-metric-thresholds/spec.md -->
- [x] T2 — A score below its floor fails, naming both numbers
      <!-- proof: test/thresholds.test.ts#a score below its floor fails, naming both numbers -->
- [x] T3 — A metric with a floor that nobody measured fails too
      <!-- proof: test/thresholds.test.ts#a metric with a floor that nobody scored is not a metric that passed -->
- [x] T4 — Missing results fail, naming the command, which is never run from here
      <!-- proof: test/thresholds.test.ts#a scoring step that did not run is not a scoring step that passed -->
- [x] T5 — Floors within the agent's reach are reported where success is already declared
      <!-- proof: test/thresholds.test.ts#floors within reach of the agent are reported, but only where success is already declared -->

## Notes

A ticked box carries its evidence inline: a proof marker naming the test that proves it.
