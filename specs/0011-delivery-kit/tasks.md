# Tasks — 0011 Delivery kit: worktrees, model routing, memory

## P0

- [x] T1 — Worktree names, targets and install commands are pure and tested
      <!-- proof: test/worktree.test.ts#a worktree sits beside the repository, named after it, on a prefixed branch -->
- [x] T2 — Add, merge and remove refuse unsafe states with a fix
      <!-- proof: test/worktree.test.ts#remove refuses a dirty worktree and an unmerged branch, naming the deliberate way out -->
- [x] T3 — `harnessimo worktree` against real git repositories
      <!-- proof: test/cli.test.ts#worktree merge brings the stream in; remove refuses unmerged or dirty work, then cleans up -->
- [x] T4 — `init` writes the agent roles and the agent hooks
      <!-- proof: test/cli.test.ts#init writes the agent roles and the hooks they assume, and leaves existing settings alone -->

## P1

- [x] T5 — ROUTING, ADAPTING and MEMORY pages, translated, with contracts
      <!-- proof: docs/contracts.json -->

## Notes

A ticked box carries its evidence inline: a proof marker naming the test that proves it.
