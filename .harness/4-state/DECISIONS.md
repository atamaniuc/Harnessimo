# DECISIONS

What was decided, why, and what was rejected. Append; do not rewrite history.

---

## 2026-09-07 — One dependency, not two vendored copies

The harness is a package a repository depends on, configured through
`harnessimo.config.json`, rather than scripts copied into each project.

**Why:** the two repositories this came out of had complementary halves of the same idea
and no shared implementation. A copied script is a fork the day after it is copied, and
the drift is invisible until one copy breaks.

**Rejected:** a `curl`-based sync script that vendors the files. It keeps the copies and
adds a ritual for refreshing them, which is the same problem with extra steps.

---

## 2026-09-07 — Zero runtime dependencies

**Why:** a harness that can break the project it guards is worse than no harness. It also
makes the cold-start test honest here: a fresh clone runs every check with no install
step, so the test measures the repository rather than a package registry.

**Cost, accepted:** no schema library, no argument parser, no colours. The configuration
loader hand-rolls its validation, which is about forty lines. That is cheaper than the
first transitive advisory.

---

## 2026-09-07 — The rules are pure; one file touches the world

`src/*.ts` are functions over strings and in-memory trees. `src/resolver.ts` and
`src/cli.ts` are the filesystem and process edge.

**Why:** a rule that needs a fixture tree to test is a rule that stops being tested. The
whole rule layer runs in under a second against in-memory objects, and the wiring gets its
own end-to-end tests against real directories.

---

## 2026-09-07 — A check the project did not configure is reported as absent, never as passing

Every section of `harnessimo.config.json` is optional, and `harnessimo doctor` prints what is
enforced and what is not.

**Why:** claiming enforcement that does not exist is worse than claiming none — it stops
anyone from looking for the missing check. The same reason every rule in
`../1-instructions/CONSTRAINTS.md` is labelled with what catches it, including the four
that nothing does.

**Consequence, deliberate:** a repository can adopt one check and still be honest about
the other five.

---

## 2026-09-07 — An unknown command prefix reports that it cannot be checked

A `<!-- proof: just <target> -->` marker in a project that declares no `just` runner fails
with "declares no such command file", rather than resolving to nothing and passing.

**Why:** a gate that errors open is not a gate. This is the failure mode where a rule
keeps running for months while checking nothing, and nobody notices because it is green.

---

## 2026-09-07 — The task gate applies to live lanes only

A checked box must name its proof, but only in a lane currently listed in the track index.

**Why:** applying it retroactively turns adoption into a migration project across every
lane a repository ever shipped, and the value is in the boxes being ticked now. A lane
retired from the index drops out of scope with no further action.

---

## 2026-09-07 — Corrected during implementation: a fenced example is not a track

The first version of the track-index summary counted every line starting with `- `,
including the example inside a fenced block in the template — so a freshly initialised
repository reported one live track and had none.

The gate itself was already fence-aware; the counter was not, which is the more common
shape of this bug: the rule is right and something next to it quietly disagrees. Both now
go through one `trackLines` helper.

**Found by:** the end-to-end test that runs `harnessimo init` and then `harnessimo check`, which
is the test most worth having.

---

## 2026-09-07 — TypeScript, with nothing between the source and running it

The package is written in TypeScript (7, strict, `noUncheckedIndexedAccess`) and ships
compiled JavaScript with generated declarations.

**Why:** it had two descriptions of the same functions — JSDoc in `src/`, and a
hand-written `types/index.d.ts` — and they had already drifted in sixteen signatures.
Three of those were wrong rather than cosmetic, including a parameter documented as a
number that is a map, and a nullable field the annotation denied. Nothing could catch
that, because tests check behaviour and the two files were never compared. One source
settles it.

**The cost that was not paid:** a build step between an author and running the code.
Sources import each other with `.ts` specifiers, so Node's type stripping runs them as
they are — `npm test` and `node src/cli.ts check` still need no install, which is what
keeps the cold-start check honest. `tsc` rewrites those specifiers to `.js` when it emits
`dist/`.

**What consumers install is the tarball attached to a release.** This took three attempts
and each failure was measured, not guessed:

1. `prepare`, the documented way to make a git dependency build itself. Works on npm;
   pnpm 10 refuses to run a dependency's lifecycle scripts and aborts the install, and
   yarn 1 installs the repository without building it. Two of four managers left the
   consumer with a directory of TypeScript and no CLI.
2. Committing `dist/`. It works everywhere, and it is build output in version control —
   a second copy of every module, in every diff, for a distribution problem.
3. `npm pack` in the release workflow, uploaded as a release asset. Every manager installs
   a tarball URL, nothing is built at install time, no scripts need approving, and the
   repository holds only source.

**The better answer is the npm registry**, where the install line is `harnessimo@0.4.1` and
none of this is interesting. It needs a publish token, which is a human decision rather than
a technical one; `.github/workflows/publish.yml` is written and skips itself until the
secret exists.

**Cost, accepted:** two devDependencies, a `dist/` to build before publishing, and
`erasableSyntaxOnly` as a permanent restriction — no enums, no namespaces, no parameter
properties, because Node must be able to strip every file that `tsc` compiles.

**Rejected:** keeping `.mjs` with richer JSDoc plus a generated `.d.ts`. It closes the
same gap, and was in place for an afternoon, but it spends annotation syntax on what the
language does natively and leaves the checker optional.

---

## 2026-09-08 — Publishing authenticates by OIDC, and stores nothing

The package is published from GitHub Actions through npm's trusted publishing:
npmjs verifies a short-lived OIDC token minted for that run, matched against a publisher
configured on the package — repository `atamaniuc/Harnessimo`, workflow `publish.yml`.
There is no npm token in the repository, in the secrets, or in the workflow.

**Why:** a stored publish token outlives the job it was made for, works from anywhere, and
is one leaked log away from someone else publishing under this name. This session is itself
the argument: a token was pasted into a chat to get the first release out, which burned it
immediately. The OIDC token cannot be reused — it is scoped to one repository, one workflow
file, one run, and expires in minutes.

**What it costs:** the workflow filename is part of the credential. Renaming `publish.yml`,
or moving the publish step into another workflow, breaks publishing until the trusted
publisher is updated to match. That is the right way round, and it is written into the
workflow's own header so the next person renaming it finds out before CI does.

**Two settings this depends on, both on the package rather than here:** the trusted
publisher must allow `npm publish` and not only `npm stage publish` — the default permits
staging alone, and a direct publish fails with `OIDC permission denied` until it is granted.
And publishing access is set to require two-factor authentication and disallow tokens, so
the trusted workflow is the only way in.

**Rejected:** staged publishing, where each release waits for a maintainer to approve it on
npmjs. It is stricter, and for a one-person project it is a manual step per release that
would eventually be skipped by publishing another way — which is worse than not having it.

---

## 2026-09-08 — The privileged half is a workflow, not a person

Operations an agent session cannot perform — creating tags, deleting refs, editing the
About panel — are done by `.github/workflows/ops.yml` with a repository-scoped token in a
secret, rather than by asking someone to click through a web form.

**Why:** every such ask is an interruption with a delay attached, and the things being asked
for are small and repetitive. Worse, they are invisible: a description typed into a form is
not reviewed, not versioned, and nobody can tell later what it used to say. As a file it is
a diff.

**Why not simply give the session a token:** a token in a session's context can be logged,
echoed into a transcript, or carried into a tool call that was not the one it was meant for
— which already happened once in this project's short history. Inside a workflow it is read
and used in the same run, and every use is a line in the Actions log with an author, a time
and its inputs.

**The limits, stated rather than discovered later:** the token may edit this repository's
settings, and anyone with write access can dispatch the workflow. So the operations are a
closed list, deletion is refused for anything that does not look like scaffolding
(`tag-*`, `release-*`, `claude/*`, never `main` or `gh-pages`), and retagging demands a
full commit sha. Publishing is deliberately not among them: it authenticates by OIDC and
needs no token at all.

---

## 2026-10-30 — The delivery kit lives here, and process rules may be adapted

`harnessimo worktree`, the three agent roles, the agent hooks in `init`, and the routing,
adapting and memory pages (spec 0011).

**Why:** a consumer repository wrote all of it by hand for a parallel delivery, and every
repository running more than one agent needs the same pieces. Its agents also stalled on rules
written for another situation, so the kit states which rules bend: process rules, scoped and
recorded, when they defeat the stated goal — never the hard bounds.

**Rejected:** a `--force` on `worktree remove` (discarding work stays a deliberate git
command the message names); bundling a memory server (the pattern is vendor-neutral, and this
package takes no dependency); making `worktree` a twelfth check (it decides nothing about
whether work is finished).

---

## 2026-10-30 — herdr owns the topology; agent teams work inside one lane

`harnessimo herd` starts one herdr pane, one worktree and one agent per lane; Claude Code agent
teams are used inside a lane, on disjoint files (spec 0012).

**Why:** agent teams have no per-teammate worktree — teammates share the lead's checkout, and
an `isolation` option on an agent call means it is not a teammate. So a team cannot be the
unit of parallel lanes without two teammates one edit away from overwriting each other. herdr
gives each lane its own checkout and reports each agent's state, which makes cross-lane file
collisions impossible; `## Owns` still decides which lanes may run at once, because a shared
path collides at merge.

**Rate limits are a design input:** several agents share one API limit, so the defaults cap
working agents at 3, stagger starts by 20 s, write a 60/120/240 s backoff into every kickoff,
and keep teammate caches warm for an hour.

**Rejected:** a `TeammateIdle` gate (no re-entry flag, so an unfixable check would loop a
teammate and burn the limit); `herd` closing panes or stopping the herdr server (it never
closes what it did not create); making `herd` a twelfth check (it decides nothing about
whether work is finished).

---

## 2026-10-30 — Rules serve the goal; switching goals is a normal path

`harnessimo track pause|resume`, `queue.maxActive`, and paused-with-a-reason lanes spared the
task gate, the fences and the staleness rule (spec 0012).

**Why:** the owner works in an agile way — goals change mid-flight, to another lane, to harness
work, to another branch. Before this, a switch tripped checks that protected nothing: a lane put
down for a week went stale and turned every turn's Stop gate red; its fence blocked the lane
that took over its files; its half-ticked task list stayed gated; the one-active-item queue
forced a fake "blocked". Each of those rules is about live work, and a lane paused with a
written reason is not live — it is a decision someone recorded.

**What stays:** the hard bounds. Proof markers in a paused lane still resolve; a pause with no
reason gets no pass; locked surfaces, evidence and never bypassing a check are untouched.
Resuming restores the gate and the fence, so a real overlap is caught when it becomes real.

**Rejected:** scoping the Stop gate to "what this goal touched" (it would need to guess the
goal, and a gate that guesses is a gate nobody trusts); a `--force` to skip checks during a
switch (a bypass by another name).


---

## 2026-10-30 — A lane agent starts on its role's model, as a launch flag

`herd up` reads `.claude/agents/<role>.md`, takes `model:` and `effort:` from its frontmatter
and starts the agent with `-- --model <m> --effort <e>` (0.13.0).

**Why:** found in finverity, lane 0006. The coordinator started lane agents with no model
flags, so all of them ran on the default model (Opus) although routing says the implementer
is Sonnet. Role routing lived only in subagent frontmatter, and a pane agent is a top-level
session that never reads it. Changing the model afterwards with `/model` or `/effort` is not
the fix: both **save the choice as the user's global default** in `~/.claude/settings.json`,
changing every other session they have open. So the model is a launch flag, and a running
agent's model is changed by restarting it, never by typing into it.

**Choices, recorded:**
- Per value, the first that names it: `herd.agentArgs` → the role file → `herd.roles[role]` →
  (effort only) the model's default, which exists for Sonnet alone (`high`). A role with no
  model anywhere launches with no `--model` and `plan`/`up` print a warning; it does not fail,
  because a repository that never ran `init` was working before this change.
- **An explicit `--model`/`--effort` in `herd.agentArgs` wins** for that flag instead of
  being rejected as a conflict. Rejecting would break every repository that follows the
  documented `agentArgs: ["--model", "sonnet"]`, and the config is the owner's explicit,
  fleet-wide word. The cost: such a repository keeps running every role on one model, and the
  plan says `herd.agentArgs` is the source, so it is visible.
- The effective model decides the default effort: an `agentArgs` model of `opus` does not
  inherit the Sonnet role's `high`.
- `model: inherit` names nothing for a pane agent — it has no parent to inherit from.
- Unknown model names pass through (aliases and full ids both work); only `effort` is
  validated, against `low|medium|high|xhigh|max`, and a bad one stops `up` before any start.
- `effort:` goes in the `implementer` and `architect` templates. Not in `scout`: haiku has no
  effort setting worth pinning.
- Not done: `claude --agent <role>`, which would also load the role's body into the pane
  agent. It is a larger change (the role bodies are written for teammates) and was not asked.

**The coordinator does the routine herdr work itself** — opening panes, starting agents,
sending self-contained prompts with absolute paths (a side worktree may not contain the
coordination files) — and the owner is never handed a manual step for it. Written into TEAMS
and ROUTING.

---

## 2026-10-30 — At most four panes per herdr tab

`herd.panesPerTab` (default 4), coordinator included. `herd up` fills the current tab, then
opens a new tab for further agents; `herd plan` shows where each agent lands (0.13.0).

**Why:** an owner rule, for readability — past four, every pane is a sliver nobody looks at.

**Choices, recorded:**
- A new tab is filled to the same cap and named for **its first lane**; the other lanes in it
  are told apart by their panes' labels. One tab per lane would have honoured "label = lane"
  more literally but spent a tab on every agent.
- The first split in a tab goes right, the rest below the newest pane, so the coordinator
  keeps the left half and the agents stack on the right.
- The occupancy is read from herdr (`tab list`, the caller's tab from `HERDR_TAB_ID` or
  `pane current`). Outside herdr `plan` assumes the coordinator is alone and says it assumed.
- `herdr worktree open` is no longer called: it made a workspace per lane, which a tab cap
  cannot govern. The pane is a split or a tab root started with `--cwd <worktree>`.
- A lane agent already running counts only by occupying a pane: the count is herdr's.

**Rejected:** refusing to start when the tab is full (the point is to keep working); closing
or rearranging panes the owner opened (herd never closes what it did not create).
