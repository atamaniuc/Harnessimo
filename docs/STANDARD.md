# The standard

What a harness is, what the parts are for, and why each rule here exists. The tool is the
enforcement; this is the thing being enforced.

## The claim

A harness is everything around the model: the instructions it is given, the tools it can
run, the environment it runs in, the state it carries between sessions, and the checks that
tell it whether it succeeded.

The failure mode it addresses is specific. A capable model does not usually fail by
producing obvious nonsense; it fails by producing work that **looks finished and is not** —
a documented capability that was never built, a ticked box nobody re-ran, a passing test
suite that stopped asserting anything. Every one of those is invisible to a reader and
visible to a command. So the design principle is: **move every judgement about "done" out
of prose and into something that exits non-zero.**
<!-- proof: src/queue.mjs:checkQueue -->

## Layer 1 — Instructions: the rules, each labelled with what enforces it

Deliberately short. A long instruction file eats working memory and buries the important
parts in the middle, where they get ignored.

The rule that makes this layer worth having is the labelling: every constraint states
whether a command fails on it or whether it is caught in review. In a real repository, four
of nine constraints are review-only, and they say so.

**Why labelling matters more than the rules:** claiming enforcement that does not exist is
worse than claiming none. A team that believes a check exists stops looking for the missing
one. Two of the repositories this came from had a constraints file asserting "enforced by
CI" at a time when CI had never run once — in one case because the workflow triggered on
`main` while the branch was called `master`.

The Definition of Ready and the Definition of Done live here, referenced and never copied.
The decidable parts are enforced at the two moments they matter: when an item is started,
and when it is closed. <!-- proof: src/readiness.mjs:readiness -->

## Layer 2 — Tools: what the project can run

One command surface, and the queue is a *command*, not a file you edit.

That distinction is the layer's whole content. An item is finished when its check passes,
not when someone believes it is. Models are consistently over-confident about their own
work, so the judgement is taken away from them: only the tool writes `state` and `evidence`,
and it only writes them after running the item's own verification.

Two details that came out of running this in anger:

- **Verification runs with stdin closed and a hard timeout.** A command that stops to ask a
  question would otherwise block forever, and a loop that can hang silently has no stop
  condition. A harness without a stop condition is not a harness.
- **Nested calls degrade.** An item whose verification invokes the harness would recurse
  until killed, so a nested run checks invariants only.
  <!-- proof: bin/harness.mjs:HARNESS_REVERIFY -->

## Layer 3 — Environment: what it runs in, and what is out of reach

Reproducibility, so that "works here" and "works anywhere" are the same statement: a pinned
runtime, a lockfile, and an honest list of services.

Then the part people leave out: **locked surfaces.** A system that improves itself will,
given the opportunity, improve its own score instead of its own work. Every documented
reward hack broke this invariant — the agent edited or removed the instrumentation its
checker depended on. So the files that define the acceptance signal are placed out of the
loop's reach, and the reach is enforced by a command rather than an instruction, because
instructions get optimised away. <!-- proof: src/locked.mjs:lockedViolations -->

The baseline exists because the commit that creates a protected file necessarily touches
it. Moving it forward widens what the system may change, which is a human decision.

**The limit is part of the design, not an omission:** this assumes commits pass through CI.
It is drift detection. A loop with push access that strips its own trailer defeats it.

## Layer 4 — State: what survives a session ending

A session ends and its memory is gone. What is written down is all that survives.

Three artifacts, each answering a different question:

- **PROGRESS.md** — where things stand. Read first, updated last.
- **DECISIONS.md** — what was decided, why, and what was rejected. Append-only, so a later
  session does not quietly undo a deliberate choice, and a rejected option stays rejected
  instead of being rediscovered every few weeks.
- **The queue** — one item at a time, each carrying the behaviour it must produce, the
  command that proves it, its state, and the output that proved it.

Work in progress is capped at one. Splitting attention produces work that is started
everywhere and finished nowhere, and a wide half-finished diff is worse than a narrow done
one.

## Layer 5 — Feedback: how it knows it worked

Checks live next to the code they check; one document maps them. A rule kept far from what
it governs goes stale without anyone noticing.

Three levels, and skipping any of them means not finished: types and schemas, then tests —
especially negative ones — then an end-to-end run. The third is the one most projects skip
and the one that catches the class of problem the first two are blind to: something that
works only because of state on this machine. `harness cold-start` clones the project into
an empty directory and runs the documented commands there.
<!-- proof: src/coldstart.mjs:coldStartProblems -->

Cold start is also the honest test of the documentation. What is not written down does not
exist for someone arriving fresh — and every session after the first arrives fresh.

## The sixth thing — handoff-driven development

The five layers describe how a project is governed. They say nothing about what happens
when a session ends **mid-lane**, which is the normal case. Specs describe what a lane must
deliver; they do not describe where the work stopped, what was already tried and rejected,
or — most valuably — what the next session must *not* read.

So:

- **`specs/TRACKS.md`** indexes live tracks. One line each: essence, link to its handoff,
  status, next step. Switching task becomes choosing a handoff rather than an excavation.
- **A handoff per track**, next to its spec, written for a reader with none of your context:
  context, what to load *and what not to*, state, decisions taken, and one concrete first
  step. Edited in place, never appended to.
- **Closing a track is a distillation:** the outcome in one or two sentences into
  `TRACKS-LOG.md`, lasting decisions into `DECISIONS.md`, then the handoff is deleted. Git
  carries the rest.

All three rules are machine-checked, because **a handoff that lies is worse than no
handoff** — the next session trusts it. A track line with no status, a link to a deleted
handoff, or any document elsewhere still pointing at one, fails the gate.
<!-- proof: src/tracks.mjs:checkHandoffRefs -->

The "what not to load" section is the part that is easy to skip and pays for the practice
on its own: a fresh session's budget goes on whatever you failed to rule out.

## How the pieces meet

A claim is a claim wherever it appears, so all three claim-shaped things go through one
checker:

| Where the claim lives | What proves it |
|---|---|
| Prose in a document | `<!-- proof: path[:symbol|#test] -->` |
| A ticked box in a task list | the same marker, on the task |
| An item in the queue | its `verification` command, re-run in CI |

That is deliberate. A second, divergent notion of "verified" is how a project ends up with
a gate that agrees with itself and disagrees with reality.
<!-- proof: src/tasks.mjs:checkTaskGate -->

## What is deliberately not here

- **Coverage thresholds.** They measure lines executed, not behaviour verified, and a team
  that has to hit one writes tests for the easy paths.
- **Estimates.** Work in progress is capped at one item; duration is information, not a
  commitment.
- **Per-item human review as a gate.** Reserved for what humans are actually needed for:
  changing the gates, widening the editable surface, licence and legal decisions, and
  deciding to abandon a direction. Models trained on successful outcomes are badly
  calibrated about when to stop.
- **Any judgement of whether a check is good.** A test that asserts nothing satisfies every
  rule here. This makes claims falsifiable; it does not make them true.

## Provenance

The five-layer model and the queue come from the *Learn Harness Engineering* material and
from a working implementation in
[`code-knowledge-base`](https://github.com/atamaniuc/code-knowledge-base). Handoff-driven
development comes from
[yetanothervan/handoff-driven-development](https://github.com/yetanothervan/handoff-driven-development)
and from its implementation in
[`ledger-lens`](https://github.com/atamaniuc/ledger-lens), which also contributed proof
markers and the task gate.
