# Tasks — 0007 How much was this run watched

## P0

- [x] T1 — Three levels, each requiring everything below it, together covering every check
      <!-- proof: test/autonomy.test.ts#each level requires everything the level below it does, and more -->
- [x] T2 — The additions land where supervision below stops catching them
      <!-- proof: test/autonomy.test.ts#re-verification starts where a diff-reader stops being able to catch it -->
- [x] T3 — The declared level is a floor a flag can raise and cannot lower
      <!-- proof: test/cli.test.ts#a declared floor cannot be argued down from the command line -->
- [x] T4 — A level the repository cannot back is refused, naming the section to add
      <!-- proof: test/cli.test.ts#a level the repository cannot back is refused, and names the section to add -->
- [x] T5 — A level demands nothing of the repository that it never claimed
      <!-- proof: test/autonomy.test.ts#a lower level is not held to what it never claimed -->
- [x] T6 — `check` says which level it ran at, so a green report says what it covers
      <!-- proof: test/cli.test.ts#the report says which level it ran at, and green means that level -->
- [x] T7 — A name that is not a level is refused with the ones that are
      <!-- proof: test/cli.test.ts#a level that is not a level is refused with the ones that are -->

## P1

- [x] T8 — `doctor` distinguishes "configured" from "running at this level"
      <!-- proof: src/cli.ts:cmdDoctor -->
- [x] T9 — `brief` tells a session the level it is held to
      <!-- proof: test/brief.test.ts#a session is told how closely it is being watched -->
- [x] T10 — Documented in both languages, and the config key described in both
      <!-- proof: test/generated-docs.test.ts#every key in the schema is described in every language -->

## Notes

A ticked box carries its evidence inline: after the task text, a proof marker naming the
test that proves it.
