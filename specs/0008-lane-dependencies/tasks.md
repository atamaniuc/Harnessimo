# Tasks — 0008 One lane built on another

## P0

- [x] T1 — A lane declares what it waits on, in its own section, by slug
      <!-- proof: test/claims.test.ts#dependencies are read from their own section, by slug -->
- [x] T2 — A dependency that names no lane is refused, with the lanes that exist
      <!-- proof: test/claims.test.ts#a dependency naming no lane is refused, and lists the ones that exist -->
- [x] T3 — A cycle is reported once, naming the way round
      <!-- proof: test/claims.test.ts#a cycle is reported once, naming the way round -->
- [x] T4 — A lane cannot be closed while what it was built on is still open
      <!-- proof: test/cli.test.ts#a lane cannot be closed while what it was built on is still open -->
- [x] T5 — A scoped brief carries what the lane waits on, as heads
      <!-- proof: test/cli.test.ts#a scoped brief carries the lanes this one waits on, as heads -->

## P1

- [x] T6 — The handoff template shows the section and declares nothing
      <!-- proof: test/claims.test.ts#dependencies are read from their own section, by slug -->

## Notes

A ticked box carries its evidence inline: a proof marker naming the test that proves it.
