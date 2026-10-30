# Agent teams and herdr

**Who is this for?** Someone running Claude Code on a harnessimo repository who wants several
agents working at once — lanes in parallel, a few teammates inside one lane — without them
colliding or burning through the API rate limit.
**When should I read it?** When one agent is no longer enough. The collision rules underneath
are in [More than one agent](PARALLEL.md); which model takes which work, in
[Routing work](ROUTING.md).

---

Two tools, two levels, one rule: **never two agents on one file.**

| Level | Tool | What it gives | What keeps it safe |
| --- | --- | --- | --- |
| Between lanes | [herdr](https://herdr.dev) + `harnessimo herd` | one worktree, one pane, one `claude` per lane | separate checkouts — a cross-lane file collision cannot happen |
| Inside one lane | Claude Code agent teams | a lead and a few teammates on a shared task list | disjoint files per teammate; the `TaskCompleted` gate |

## Why herdr owns the topology

Agent teams share the lead's checkout. There is no per-teammate worktree, and an `isolation`
option on an agent call means that agent is not a teammate. So a team cannot be the unit of
parallel *lanes*: two teammates working two lanes in one checkout are one bad edit away from
overwriting each other, and nothing stops them.

herdr can: it manages terminal workspaces, opens a worktree per workspace, and recognises an
agent's state in a pane — `idle`, `working`, `blocked`, `done`, `unknown`. One lane is one
worktree with one `claude` process, so files cannot collide across lanes. The `## Owns`
fences still decide **which** lanes may run at once, because two lanes editing one path
collide at merge time instead. The decision is recorded in `.harness/4-state/DECISIONS.md`.

## Setup

```bash
# herdr — the terminal workspace manager: install it from https://herdr.dev
herdr --version

npx harnessimo init        # writes .claude/settings.json when the project has none
npx harnessimo doctor      # reports whether herdr is on PATH and this is a herdr pane
```

Then start `herdr`, open a pane in the repository, and run `claude` there. That is the whole
requirement: with the settings below, teammates run in-process in the lead's terminal, and
`herd` starts lane agents with `herdr agent start --kind claude`.

**How teammates are displayed** is Claude Code's own `teammateMode`: `in-process` (Claude
Code's default — every teammate inside the lead's terminal, switched between in place), `tmux`
or `iterm2` (a split pane per teammate), or `auto`, which picks split panes when the session
runs inside tmux or iTerm2 and in-process otherwise. The template sets `auto`. Either way the
teammates share the lead's checkout — the display changes, the topology does not.

`init` writes `.claude/settings.json` only when the project has none; an existing one is
merged into, never replaced:
<!-- proof: test/cli.test.ts#init writes the agent roles and the hooks they assume, and leaves existing settings alone -->

```json
{
  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" },
  "teammateMode": "auto",
  "subagentPromptCacheTtl": "1h",
  "hooks": { "TaskCompleted": [{ "hooks": [{ "type": "command",
    "command": "npx --no-install harnessimo hook task-completed" }] }] }
}
```

plus the `SessionStart` brief and the `Stop`/`SubagentStop` gate. `subagentPromptCacheTtl`
keeps teammates' prompt caches warm for an hour instead of five minutes — a teammate waiting
on a review would otherwise pay for its whole context again.

## Between lanes: `harnessimo herd`

```bash
harnessimo herd plan            # which lanes can run now, side by side, and why the rest wait
harnessimo herd up [lane…]      # inside a herdr pane: worktree, pane and agent per lane
harnessimo herd status          # every lane beside its agent's state, blocked first
```

`plan` takes the live lanes in index order and runs one when its track line says `active`,
every lane under its `## Depends on` is closed, its `## Owns` overlaps no lane already chosen,
and fewer than `herd.maxWorking` agents are working. A lane that declares no `## Owns` runs
only alone, because nothing shows it does not collide.
<!-- proof: test/herd.test.ts#lanes on disjoint paths run side by side; an overlapping one is held, naming the other -->

`up` must run inside a herdr pane (`HERDR_ENV=1`); elsewhere it fails and says so. For each
lane it makes the worktree exactly as `harnessimo worktree add` does — install step included —
opens a pane in it, starts the agent named after the lane slug, waits `herd.staggerSeconds`
between starts, and sends a one-line kickoff: read `AGENTS.md`, load the handoff, work the
tasks inside `## Owns`, run the checks, commit, back off on a 429.
<!-- proof: test/cli.test.ts#herd up opens a worktree per lane and starts a named agent with its kickoff -->

Each lane agent is `claude`, started with `herdr agent start --kind claude` (`herd.agentKind`),
so herdr knows it as an agent and reports its state. `up` without lane names
starts every lane `plan` allows and leaves the held ones.
<!-- proof: test/cli.test.ts#herd up starts every runnable lane, staggered, and leaves the held one -->

### The role sets the model — as a launch flag

A lane agent plays a role (`herd.defaultRole`, `implementer`; `herd.laneRoles` for the lane that
is not one), and `up` starts it on that role's model. The model and `effort:` are read from
`.claude/agents/<role>.md` and passed as `herdr agent start … -- --model sonnet --effort high`:

```
$ harnessimo herd plan
each starts as (lane, role, flags after `herdr agent start … --`, tab):
  search               implementer  --model sonnet --effort high   (model: .claude/agents/implementer.md; effort: default for sonnet)  → this tab
```

The reason is that routing in a role file is read by Claude Code for a *subagent*. A pane agent
is a top-level session and never reads it, so before this it ran on the default model whatever
the role said.

- **Where a value comes from**, first match: an explicit `--model`/`--effort` in
  `herd.agentArgs` (it wins for that flag; the plan names it as the source), the role's
  frontmatter, `herd.roles.<role>` (the fallback for a missing or silent file), and for
  effort only, **`high` for Sonnet**. A role that names no model anywhere starts with no
  `--model` and `plan` and `up` warn about it.
- **Never `/model` or `/effort` in a running session.** Both save the choice as the user's
  global default in `~/.claude/settings.json`, changing every other session they have open. To
  change an agent's model, stop it and start it with the flags.
- **The coordinator does the routine herdr work itself**: opening panes, starting agents,
  sending prompts. A prompt to a pane agent is self-contained and uses absolute paths, because
  a side worktree may not contain the coordination files. The owner is never handed a manual
  step for any of it.
<!-- proof: test/cli.test.ts#herd up starts an implementer lane on its role's model: --model sonnet --effort high, never /model -->
<!-- proof: test/herd.test.ts#an explicit --model or --effort in herd.agentArgs wins for that flag only, and is not doubled -->

### At most four panes per tab

A tab of more than four panes is unreadable, so `herd.panesPerTab` (default 4) caps it,
**the coordinator's pane included**. `up` fills the coordinator's tab to the cap — the first
agent splits to the right, the next ones below the newest pane — then opens a new tab, named for
its first lane and itself filled to the cap, for the rest. `plan` shows the tab each agent lands
in (`→ this tab`, `→ new tab "billing"`). Outside herdr it assumes the coordinator is alone in
its tab and says so.
<!-- proof: test/cli.test.ts#herd up fills this tab to the cap, coordinator included, then opens a tab named for the lane -->
<!-- proof: test/herd.test.ts#agents fill the coordinator's tab to the cap, then each new tab to the same cap -->

When a lane is done: review it, `harnessimo worktree merge <slug>`, then
`harnessimo worktree remove <slug>`. The main checkout keeps the shared state.

## Inside one lane: agent teams

- **Few, focused teammates.** Three to five, five or six tasks each. Each one costs a full
  context; more teammates is more cost and more coordination, rarely more speed.
- **Disjoint files.** Split the lane's tasks so no two teammates touch one file — or give one
  of them a reviewer's role, which edits nothing. Never two writers on one file.
- **Sonnet teammates, Opus reviews.** The agent definitions in `.claude/agents/` set the model
  (spawn prompt > definition `model` > `CLAUDE_CODE_SUBAGENT_MODEL` > the lead's). Mechanical
  work on Sonnet or Haiku; Opus for architecture and the cold review of a risky diff.
- **Self-sufficient definitions.** A split-pane teammate (`tmux` or `iterm2` mode) gets its definition's body *instead
  of* the default system prompt, so each template carries its key rules and an
  "As a teammate" section: claim from the shared list, touch only your files, message the
  lead, stop when done.
- **A task does not close on a red check.** `harnessimo hook task-completed` runs the gates
  and exits 2 with the failing lines, which Claude Code shows the teammate and uses to refuse
  the completion.
  <!-- proof: test/cli.test.ts#hook task-completed exits 2 with the failure while check is red, and 0 when green -->
- **No `TeammateIdle` gate.** That hook has no flag saying it already kept a teammate going,
  so a check the teammate cannot fix would hold it in a loop that spends the rate limit on
  nothing. The `TaskCompleted` gate is where the claim is made, so that is where it is held.

Limits worth knowing: one team per session, the lead is fixed, teammates cannot spawn
teammates, in-process teammates cannot be resumed, and task status can lag — read the agent
before acting on its status.

## The lead protocol

The lead — a person, or the session that ran `herd up` — **never idles**:

1. On `idle` or `done`: review that lane's commits, merge what is green, hand out the next
   task or start the next lane `herd plan` allows.
2. Batch reviews: one cold review per stream, not one stop per task.
3. On `blocked`: `herdr agent read <name>` first, then answer or escalate to the owner.
   `herd status` lists blocked agents first for this reason.
4. Shut agents down when their lane is finished; an idle agent still holds a slot.

## The rate-limit protocol

Parallel agents share one API rate limit, and a 429 ends a teammate's turn and notifies the
lead. The defaults keep a plan under most limits:

- **Cap working agents** — `herd.maxWorking`, default 3. `plan` and `up` count agents already
  running against it.
- **Stagger starts** — `herd.staggerSeconds`, default 20, so first requests do not land together.
- **Cheap models for cheap work** — Sonnet or Haiku for mechanical tasks, Opus only for
  architecture and review.
- **Warm caches** — `subagentPromptCacheTtl: "1h"`.
- **Back off, then shrink** — on a 429 wait 60, 120, then 240 seconds (`herd.backoffSeconds`,
  written into every kickoff), re-prompt, and lower the number of working agents by one.
- **A timeout does not prove non-delivery.** A prompt that timed out may have arrived:
  `herdr agent read <name>` before sending it again.
- `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (default 20) caps subagents, not teammates — lower it
  as well if subagents run beside the team.

Every key: [Configuration → herd](CONFIGURATION.md#herd).
