# 0009 — A lane nobody has touched

## Why

Spec 0006 named this and did not build it: a lane abandoned mid-flight keeps
its status, its next step and — now that lanes declare what they own — its
fence around files nobody is working in. None of that decays. The index says
`active` until a person says otherwise, and the longer it says it the more it
is believed.

Spec 0006 recorded the reason for deferring: "detecting that needs an age, and
an age needs a clock the repository does not currently keep." That turned out
to be wrong in a useful way. The line `track new` writes already carries a
date, and every session that touches a track is required to update it. The
clock was there.

## What

```json
{ "tracks": { "staleAfterDays": 14 } }
```

A live track line whose date is more than that many days old is reported, with
its age and what to do: update the line, mark it `paused` with what it is
waiting on, or close the track. When the lane also declares paths, the failure
says it is holding them — that is the harm, not the untidiness.

`0` is the default and turns the rule off, because a repository with one lane
in flight does not need it.

Today is passed in rather than read from the clock: a rule that consults the
clock is a rule whose test depends on the day it runs.

A line with no date is not this rule's business. The `tracks` check requires a
status, not a date, and inventing a second requirement here would make an old
index fail for a reason nobody asked about.

## Acceptance criteria

1. `test/tracks.test.ts::a live track line nobody has refreshed is reported, with its age`.
2. `test/tracks.test.ts::the fence is named when the stale lane is holding one`.
3. `test/tracks.test.ts::the rule stays quiet unless it was asked for, and never invents a date`.

## Out of scope

- Closing or pausing a stale lane automatically. What a stalled lane means is
  judgement — waiting on a person, on a decision, or genuinely abandoned — and
  the tool does not have it.
