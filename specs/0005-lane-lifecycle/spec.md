# 0005 — Opening and closing a lane

## Why

This tool is two halves. **SDD**: a lane is a contract — a numbered directory
with a spec whose acceptance criteria can run. **The harness**: the checks that
refuse to call that lane finished until they do. The second half is built and
enforced. The first is a convention held together by memory.

Opening a lane today is: work out the next number, make the directory, copy two
templates, and add a line to `specs/TRACKS.md` in the right shape with a status
and a date. Closing one is: distil the outcome into `TRACKS-LOG.md`, delete the
handoff, delete the index line.

Three lanes were opened by hand while writing this tool, and the mechanical
half is where the mistakes live:

- **A number already taken.** Nothing stops two lanes being `0003`.
- **A missing index line.** `harnessimo brief` reads `TRACKS.md` at the start of
  every session. A lane that is not in it does not exist as far as the next
  session is concerned — the work is on disk and invisible.
- **A handoff outliving its lane.** The `tracks` check catches the dangling
  link, but only after someone has already trusted it.

Every one of those is mechanical, and mechanical is what a tool is for.

## The boundary, stated first

`docs/SDD.md` records that OpenSpec's CLI and its change/archive machinery were
deliberately **not** taken. This does not reverse that.

The command writes **only what is mechanical**: the next free number, the
directory, the templates copied unchanged, and the index line. It does not
invent content, does not validate the shape of a spec, does not enforce a
status vocabulary, and has no opinion on what a lane should contain. The format
stays a convention a project can change without forking this tool — which is
exactly what it stops being if a generator starts producing prose.

The rule of thumb: **if a human would get it wrong the same way every time,
automate it. If they would get it wrong differently every time, that is
judgement — leave it.**

## What

```
harnessimo track new <slug> [--title "..."]
```

- Finds the next unused number in `tracks.specsDir` — the highest existing plus
  one, so a deleted lane's number is not recycled into a confusing reuse.
- Creates `<specsDir>/NNNN-<slug>/` with `spec.md`, `tasks.md` and `handoff.md`
  copied from the templates, with `NNNN` and the title substituted and nothing
  else touched.
- Appends a line to the track index in the documented shape, with today's date
  and the status `active`.
- Refuses when the slug is not a slug, or when a lane with that slug exists.

```
harnessimo track close <slug> --outcome "one or two sentences"
```

- Prepends the outcome to `tracks.log`, newest first.
- Removes the lane's line from the index.
- Deletes the lane's `handoff.md` — the spec and tasks stay; git carries them,
  and a handoff kept "just in case" is a file nobody trusts and everybody reads.
- Refuses without an outcome. Closing a track is a distillation; a close that
  writes nothing down is an archive move wearing its name.

## Acceptance criteria

1. `test/track.test.ts::the next number is one past the highest` — including
   when a number in the middle is missing.
2. `test/track.test.ts::a slug that is not a slug is refused` — spaces, slashes,
   capitals, empty.
3. `test/track.test.ts::an existing slug is refused` — with the directory named.
4. `test/track.test.ts::the index line carries a status and a resolving link` —
   the line the tool writes passes the `tracks` check itself.
5. `test/track.test.ts::closing removes the line and prepends the outcome`.
6. `test/track.test.ts::closing without an outcome is refused`.
7. `test/cli.test.ts::track new then check` — a repository with a lane created
   this way passes `harnessimo check`, including the task gate. This is the one
   that matters: the tool's own output must survive the tool's own rules.
8. `templates/specs/tasks.template.md` exists and `test/templates.test.ts`
   holds it to the same rule as the others.

## Out of scope

- Reopening a closed track. Git has it; retyping the line is not the expensive
  part.
- Editing a status in place. `paused (waiting on X)` is prose, and prose is the
  human's half.
- Any interactive prompt. A command that asks questions cannot run in a hook.
