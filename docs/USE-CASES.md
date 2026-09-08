# Use cases

Seven situations this was built for, and what actually happens in each. If you only read one
section, read the first — it is the whole point: **you configure it once, and after that
nobody has to remember it exists.**

## Set it up once, then forget it

Three commands, run a single time in a repository:

```bash
pnpm exec harnessimo init                    # writes harnessimo.config.json from what you already have
pnpm exec harnessimo hooks install --agent   # the agent gets a briefing at the start of every session
pnpm exec harnessimo hooks install           # the fast checks run before every commit
```

Plus ten lines in CI:

```yaml
- uses: actions/checkout@v5
  with: { fetch-depth: 0 }          # locked and clean-exit read a commit range
- uses: actions/setup-node@v5
  with: { node-version: 22 }
- run: npx harnessimo check --reverify
```

After that the harness fires at three moments on its own, with nobody in the loop:

```mermaid
flowchart LR
    S["Session starts"] -->|"SessionStart hook<br/>harnessimo brief"| A["Agent knows the tracks,<br/>the handoffs, what is in flight"]
    A --> W["It works"]
    W -->|"pre-commit hook<br/>harnessimo check"| C["Commit — or a red gate<br/>naming the file and the fix"]
    C -->|"push"| CI["CI: harnessimo check --reverify<br/>every passing claim re-run"]
    CI -->|"merge"| S

    style A stroke-width:3px
    style CI stroke-width:3px
```

This is the difference between a rule and a harness. A rule in `AGENTS.md` — *"verify before
you claim done"* — is obeyed on the runs you are watching. A hook is obeyed on the run at
3am that nobody sees. <!-- proof: src/hooks.mjs:hookScript -->

**Autonomy is the payoff.** An agent can only be left alone as far as something other than
the agent decides when the work is finished. Once these three touchpoints exist, a long
unattended run either produces work that passes them or stops with a specific, actionable
failure — instead of a cheerful summary of things that did not happen.

---

## 1. The README describes software that does not exist

*Brownfield, inherited repo, or an agent that documented its intentions.*

You write a claim once and attach its evidence:

```markdown
Every rule in here is enforced by a command. <!-- proof: docs/STANDARD.md -->
Run them all with `npm run check`. <!-- proof: npm run check -->
```

Delete that document, or rename the script, and the build says so:

```
FAIL  proof markers
  README.md:31  docs/STANDARD.md
      no such file
  README.md:32  npm run check
      no npm run command named "check"
```

**Turn on:** `docs`. Add the documents that may never drift to `docs.mustCarryProof` — those
must carry at least one marker, so a rewrite cannot quietly drop the evidence.
<!-- proof: src/proof.mjs:verifyProofs -->

## 2. "Works on my machine" — and only there

*Onboarding, a new agent session, a fresh CI runner.*

`cold-start` clones your repository into an empty directory and runs the commands your own
documentation gives a newcomer. No caches, no environment carried over, nothing that only
exists on the machine that built it.

```
FAIL  cold start
  the clone ran: npm ci && npm test
    npm ci failed: package-lock.json is not committed
```

**Turn on:** `coldStart`, listing `requiredFiles`, `entryDocs` and the `commands` a newcomer
runs. <!-- proof: src/coldstart.mjs:coldStartProblems -->

## 3. A feature that takes four sessions

*Context dies at the end of every session; the next one re-derives it, or re-decides a
question that was already settled.*

Live work lives in `specs/TRACKS.md` — one line per track, each pointing at a `handoff.md`
that says what to load, what *not* to load, where the work stopped and what the first step
is. The next session gets it handed over at startup rather than re-reading the repository:

```
$ harnessimo brief
== specs/TRACKS.md (live work tracks — load a track's handoff first) ==
- Retrieval quality — [handoff](specs/0004-retrieval/handoff.md) — active, next: T3 recall eval
- Hosted deploy — none — blocked (on an API token)
```

The index is machine-checked, because a handoff that lies is worse than no handoff: a track
with no status, or a link to a handoff someone deleted, fails the gate.

**Turn on:** `tracks`. <!-- proof: src/tracks.mjs:checkHandoffRefs -->

## 4. "Done" that stopped being true

*The task was genuinely finished in March. Something unrelated broke it in May, and the
board still says done.*

Each queue item carries its own verification command. Only the tool writes `passing`, and
only after that command exits 0 — and `--reverify` re-runs every one of them in CI:

```
FAIL  queue
  "rls-proof" claims passing but its verification fails now
    command: npm test -- rls
    fix:  fix the regression, or the claim was never true
```

Editing `state` by hand is not a shortcut; it is the thing this check catches.

**Turn on:** `queue`. <!-- proof: src/queue.mjs:checkQueue -->

## 5. An agent that edits its own exam

*The fastest way to make a red build green is to change what "green" means.*

Name the surfaces that define success — the CI workflows, the constraints file, the eval
thresholds. A commit carrying the agent trailer that touches them fails the build:

```
FAIL  locked surfaces
  a1b2c3d  Co-Authored-By: Claude  touched .github/workflows/ci.yml
    fix:  a human makes this change, or the baseline records why it moved
```

This is drift detection in CI, not a sandbox — it catches the honest case, which is the
common one.

**Turn on:** `locked`, with `paths`, a `baseline` and your `agentTrailer`.
<!-- proof: src/locked.mjs:lockedViolations -->

## 6. The long unattended run

*You start it and go to bed.*

`clean-exit` reads what the session actually changed and refuses the two ways a run ends
badly without failing: debris left in the code (`TODO`, `debugger`, `.only(` — you choose
the markers), and a progress file that stayed frozen while hundreds of lines changed around
it.

```
FAIL  clean exit
  src/features/agent/tools.ts:88   debugger
  .harness/4-state/PROGRESS.md     unchanged while 412 lines of code moved
    fix:  write down where this got to, or the next session starts blind
```

**Turn on:** `cleanExit`. The `progressThreshold` keeps a one-line fix from tripping it.
<!-- proof: src/cleanexit.mjs:progressProblems -->

## 7. "What does this repo actually enforce?"

*A new contributor, a code review, or you six months later.*

```
$ harnessimo doctor
  enforced      proof markers    docs claims resolve to real files, tests and commands
  enforced      work tracks      the track index resolves and every track carries a status
  not enforced  queue            no queue section in harnessimo.config.json
```

A check you did not configure is reported as *not enforced*, in the same output, with the
same weight. A harness that overstates its own coverage is the failure it exists to prevent.
<!-- proof: test/cli.test.mjs#doctor reports what is enforced and what is not, without overstating -->

---

## A full session, end to end

```
$ harnessimo brief
== specs/TRACKS.md (live work tracks — load a track's handoff first) ==
- Retrieval quality — [handoff](specs/0004-retrieval/handoff.md) — active, next: T3 recall eval

== work queue ==
active: rag-eval-set — 50 pairs measure recall@k and MRR over the wiki
  verify with: harnessimo queue verify rag-eval-set

== enforced here ==
proof, tracks, tasks, queue, coldStart, cleanExit

# ... the agent works ...

$ harnessimo queue verify rag-eval-set
running: pnpm exec vitest run packages/rag/test/eval.test.ts
  ✓ 12 tests passed
rag-eval-set: passing — evidence recorded

$ git commit -m "feat(rag): recall@5 eval set (0004)"
harnessimo: proof markers ok · tracks ok · task gate ok · queue ok
[main 4f1a2b9] feat(rag): recall@5 eval set (0004)
```

The commit went through because the checks passed, not because anybody said it was done.

---

Next: [what was taken from OpenSpec, Spec Kit, BMAD and the rest](METHODS.md), or
[adopting it in an existing repo](ADOPTING.md).
