# 0004 — Token economics: guards that fire at the moment of action

## Why

Every check here answers one question: *is this finished?* They run at the end
of the work — before a commit, in CI — and that is the right place for a
question about completion.

But an agent burns most of its budget long before anything is finished, and it
burns it on the same few mistakes:

- **Re-reading what it already read.** A file read twice in one session costs
  its full length twice, and the second read teaches the model nothing it does
  not already have in context. This is the single largest avoidable cost in a
  long session, and it is invisible: nothing reports it, so nobody fixes it.
- **Reading what it did not need.** A handoff exists to say *what NOT to load*,
  and nothing measures whether that advice was taken.
- **Scattering files.** A stray `notes.md` at the root is cheap once and
  expensive forever: every later session reads it while working out what it is.

None of that is caught by asking "is it finished". It needs enforcement at the
moment of the action, which is a second kind of gate this tool does not have.

**And nobody is counting.** The mature tools in this space treat tokens as an
acceptable cost of rigour — "spend 2× on analysis, it is cheaper than rework" —
which is true and is not a budget. A number nobody reports is a number nobody
manages. That gap is this spec.

## What

Two things, in that order.

### 1. A ledger

`harnessimo budget` reports what a session actually cost, from evidence rather
than estimate:

```
harnessimo budget — this session

  read          38 file(s), ~184k tokens
  re-read        9 file(s), ~41k tokens   ← 22% of everything read
  largest       src/features/agent/pipeline.ts, read 3×, ~7k each

  fix:  9 re-reads is a session that lost its place. `harnessimo guard`
        refuses the second read of an unchanged file.
```

Counting is useful on its own, and it comes first deliberately: a guard that
blocks before anyone has seen the numbers is a guard nobody trusts.

### 2. A guard

`harnessimo guard read <path>` decides whether a read should happen, as a
tool-use hook:

- **First read of a file** — allowed, recorded.
- **Second read, file unchanged** (same size and mtime) — refused, naming the
  tokens it saved and how to override.
- **Second read, file changed** — allowed. The content is genuinely new.
- **Partial reads** — allowed. A range is not the whole file.
- **Override** — a marked read is always allowed and recorded as an override,
  so a rule that gets in the way shows up in the ledger rather than in
  someone's frustration.

The state is per-session and out of git: it describes one run, not the
repository.

## What this is not

- **Not a tenth check.** `check` answers "is it finished"; this fires while the
  work happens. Mixing them would make a pre-commit gate depend on session
  state, which is exactly the kind of hidden coupling this repository refuses.
  `doctor` lists it separately.
- **Not a token counter for the model.** We do not see the model's context. We
  count bytes read and convert at four bytes per token — an estimate, labelled
  as one everywhere it is printed. A precise number nobody can verify is worse
  than an approximate one that says so.
- **Not on by default.** Like every other section, absent config means it does
  not run.

## Acceptance criteria

1. `test/tokens.test.ts::a re-read of an unchanged file is refused` — same path,
   same size and mtime, second call denies and names the tokens saved.
2. `test/tokens.test.ts::a changed file may be read again` — mtime or size
   differs, second call allows.
3. `test/tokens.test.ts::a partial read is not a full read` — a range read
   neither denies nor records the file as fully read.
4. `test/tokens.test.ts::an override is allowed and recorded as one` — the
   ledger separates overrides from ordinary reads.
5. `test/tokens.test.ts::the ledger totals what was read and what was repeated`
   — counts and estimates over a known state.
6. `test/tokens.test.ts::state older than the window is forgotten` — an entry
   past the TTL does not block.
7. `test/cli.test.ts::budget prints a ledger` and `::guard denies a second read`
   — the commands exist and exit as documented (0 allow, 2 deny).
8. `harnessimo doctor` lists the guard separately from the nine checks, on or
   off, with no wording that implies it is one of them.
9. Documented in both languages: a `REFERENCE` section, a `CONFIGURATION`
   section generated from the schema, and one FAQ entry.

## Boundary

- Node's own filesystem stats and nothing else. No dependency, no daemon, no
  model call — CONSTRAINTS #1 and #3 hold.
- The guard reads one payload and answers; it does not watch, poll, or keep a
  process alive.
- Two further guards are **out of scope here** and belong to a later spec:
  refusing a file written outside the conventions a repository declares, and
  requiring acknowledgement for a destructive command. Both are the same shape
  and neither is needed to prove the shape works.

## Phasing

1. `src/tokens.ts` (pure), its tests, `harnessimo budget`.
2. `harnessimo guard read`, the hook wiring, `doctor`.
3. Documentation in both languages.
