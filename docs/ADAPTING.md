# Adapting rules: thinking inside the bounds

**Who is this for?** Anyone writing rules an agent will follow, and the agent following them.
**When should I read it?** When a rule stands between the agent and the goal it was given — or
before writing rules, so they can be followed with judgement. Which model does what:
[Routing work](ROUTING.md).

---

Rules are written for the situation their author could see. An agent that follows every
rule literally stalls the first time the situation changes; an agent that bends rules when
convenient makes every rule meaningless. The harness has to teach the third behaviour: **think
and adapt, without leaving what is permitted.**

## Two kinds of rules

**Hard bounds** are never bent. When one is in the way, the agent stops and asks.

- Locked surfaces — the files that define success (`harnessimo locked`).
- Safety: secrets, destructive commands, production data.
- Bypassing a check: `--no-verify`, a weakened assertion, a skipped test.
- Faking evidence: a hand-edited queue state, a proof marker naming nothing.
- Anything the owner reserved for themselves.

**Process rules** exist to serve the goal: task order, review cadence, scope rules, lists of
settled decisions, tooling choices. They are how a team usually gets to "done" fast. When one
stops doing that, it is a rule that no longer fits, not a law.

## The decision procedure

1. **Is it a hard bound?** Stop. Ask the human, with the evidence.
2. **Does following it defeat the stated goal?** Amend it — within your authority:
   - **scoped** — to this branch or lane, not the repository;
   - **recorded** — in `DECISIONS.md`: the rule, the reason, the goal it serves;
   - **reversible** — the original stays where it was, the amendment says when it ends;
   - **never by editing a locked surface.** If the amendment needs a locked file, prepare the
     change and the exact command, and hand both to the human.
3. **Otherwise, follow it.** A rule that is merely inconvenient is still the rule.

<!-- proof: templates/.claude/agents/architect.md -->

This is why the agent templates `harnessimo init` writes give every rule a _why_: an agent
that knows what a rule protects can tell the day it stops protecting it.

## Three real cases

**A settled list against the branch's purpose.** The main line records "no Saga, no gRPC" as
settled. A branch exists precisely to demonstrate the saga across services. Following the list
defeats the branch's goal, and the list is a process rule — so the branch amends it, scoped to
that branch, with an entry in `DECISIONS.md` saying why. The main line's list is untouched.

**Per-task review stops serialising a parallel delivery.** The process says "review after
every task". With four streams in parallel, every stream waits for the reviewer after every
commit, and the parallelism is gone. The review is not dropped — it is batched, once per
stream, and nothing merges unreviewed. The cadence changed; the gate did not.

**A locked file the agent may not commit.** The amendment needs a new line in
`CONSTRAINTS.md`, which is a locked surface. The agent does not commit it and does not look for
a way around `harnessimo locked`. It writes the exact diff and the command into its report,
and the human applies it.

## What adapting is not

- **Not silence.** An amendment nobody can find is a bypass. It lives in `DECISIONS.md`.
- **Not the repository-wide default.** A scoped amendment that keeps proving right gets
  proposed as a change to the rule itself, by a person.
- **Not a check going red quietly.** A red check is information about the work, never a
  process rule in the way. The checks are what make adapting the process safe.
