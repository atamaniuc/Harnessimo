# Tasks — 0012 Agent teams and herdr, and switching goals

## P0

- [x] T1 — Lane planning, agent names, kickoff and herdr's JSON are pure and tested
      <!-- proof: test/herd.test.ts#lanes on disjoint paths run side by side; an overlapping one is held, naming the other -->
- [x] T2 — `herd plan|up|status` against a fake herdr
      <!-- proof: test/cli.test.ts#herd up starts every runnable lane, staggered, and leaves the held one -->
- [x] T3 — `hook task-completed` exit mapping
      <!-- proof: test/hooks.test.ts#a red check refuses the task's completion with exit 2 and the failing lines -->
- [x] T4 — Settings template and teammate sections in the agent roles
      <!-- proof: test/cli.test.ts#init writes the agent roles and the hooks they assume, and leaves existing settings alone -->

- [x] T6 — Goal switches: `track pause|resume`, paused lanes spared, `queue.maxActive`
      <!-- proof: test/cli.test.ts#switching goals: pause with a reason, start the new lane on the same paths, and check stays green -->

## P1

- [x] T5 — TEAMS page, translated, with a contract; README quick guide in both languages
      <!-- proof: docs/TEAMS.md -->

## Notes

A ticked box carries its evidence inline: a proof marker naming the test that proves it.
