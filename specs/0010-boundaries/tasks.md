# Tasks — 0010 A line the code may not cross

## P0

- [x] T1 — A pattern is caught where the boundary applies and nowhere else
      <!-- proof: test/boundaries.test.ts#a pattern is caught where the boundary applies, and nowhere else -->
- [x] T2 — The reason is required, and it is what the failure prints
      <!-- proof: test/boundaries.test.ts#a boundary with no reason is refused, because a hit would say nothing -->
- [x] T3 — One legitimate place can be allowed without dropping the rule
      <!-- proof: test/boundaries.test.ts#one legitimate place can be allowed without dropping the rule -->
- [x] T4 — A pattern that does not compile is reported, not thrown
      <!-- proof: test/boundaries.test.ts#a pattern that is not a regular expression is reported, not thrown -->
- [x] T5 — A first run on an existing codebase does not print a novel
      <!-- proof: test/boundaries.test.ts#a first run does not print a novel -->
- [x] T6 — Wired into `check`, against a repository on disk
      <!-- proof: test/cli.test.ts#a line that crosses a boundary fails, with the reason and not the pattern -->

## P1

- [x] T7 — This repository runs one on itself: CONSTRAINTS #1 as a line that fails
      <!-- proof: harnessimo.config.json -->

## Notes

A ticked box carries its evidence inline: a proof marker naming the test that proves it.
