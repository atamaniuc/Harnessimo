# 0012 — Agent teams and herdr, and switching goals

**Status:** shipped · **Owner:** atamaniuc

## Why

Claude Code agent teams give a lead and teammates a shared task list, but every teammate works
in the lead's checkout: there is no per-teammate worktree, so a team cannot safely be the unit
of parallel lanes. herdr manages terminal workspaces with a worktree each and recognises agent
states. Several agents also share
one API rate limit, and a run that starts them all at once spends its first minutes on 429s.
And goals change mid-flight: a lane put down for another goal tripped staleness, fences, the
task gate and the one-active-item queue, none of which protect anything once the lane is
paused with a reason.

## Acceptance criteria

**AC-01** — GIVEN live lanes WHEN `harnessimo herd plan` runs THEN lanes on disjoint `## Owns`
with closed dependencies are runnable within `herd.maxWorking`, and every other lane is held
with its reason.
<!-- proof: test/cli.test.ts#herd plan runs fenced lanes side by side and holds the one that overlaps -->

**AC-02** — GIVEN a herdr pane WHEN `harnessimo herd up` runs with plain `claude` THEN each lane
gets a worktree, a herdr pane, an agent named by its slug and a kickoff prompt.
<!-- proof: test/cli.test.ts#herd up opens a worktree per lane and starts a named agent with its kickoff -->

**AC-03** — GIVEN three live lanes, one overlapping another WHEN `herd up` runs without names
THEN every runnable lane gets an agent and the held one is reported, not started.
<!-- proof: test/cli.test.ts#herd up starts every runnable lane, staggered, and leaves the held one -->

**AC-04** — GIVEN no herdr pane WHEN `herd up` runs THEN it fails with a fix and starts nothing.
<!-- proof: test/cli.test.ts#herd up outside herdr fails with the fix, and refuses a lane the plan holds -->

**AC-05** — GIVEN a red check WHEN `harnessimo hook task-completed` runs THEN it exits 2 with the
failing lines; green exits 0.
<!-- proof: test/cli.test.ts#hook task-completed exits 2 with the failure while check is red, and 0 when green -->

**AC-06** — `init` writes `.claude/settings.json` with agent teams on, `teammateMode: "auto"`,
`subagentPromptCacheTtl: "1h"` and the `TaskCompleted` hook, only when the file is absent.
<!-- proof: test/cli.test.ts#init writes the agent roles and the hooks they assume, and leaves existing settings alone -->

**AC-07** — GIVEN two live lanes on one path WHEN one is paused with a reason THEN `check` is
green — the paused lane is not gated, fenced or stale — and after `track resume` the overlap
fails again; a pause without a reason is refused.
<!-- proof: test/cli.test.ts#switching goals: pause with a reason, start the new lane on the same paths, and check stays green -->

**AC-08** — GIVEN `queue.maxActive: 2` WHEN a second item is activated THEN it starts, and a
third is refused naming the setting.
<!-- proof: test/queue.test.ts#queue.maxActive raises the cap where goals switch mid-item, and the cap still holds above it -->

## Invariants

- No runtime dependency; planning and every reading of herdr's JSON are pure, in `src/herd.ts`.
- `herd` and `hook` are commands, not checks: the check count stays eleven.
- herdr's environment is informational in `doctor`; it never fails a gate.

## Out of scope

- A `TeammateIdle` gate: the hook has no re-entry flag, so a check a teammate cannot fix would
  hold it in a loop that spends the rate limit.
- Closing herdr panes or stopping the herdr server: `herd` never closes what it did not create.
