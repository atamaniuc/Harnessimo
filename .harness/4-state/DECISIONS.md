# DECISIONS

What was decided, why, and what was rejected. Append; do not rewrite history.

---

## 2026-09-07 — One dependency, not two vendored copies

The harness is a package a repository depends on, configured through
`harness.config.json`, rather than scripts copied into each project.

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

`src/*.mjs` are functions over strings and in-memory trees. `src/resolver.mjs` and
`bin/harness.mjs` are the filesystem and process edge.

**Why:** a rule that needs a fixture tree to test is a rule that stops being tested. The
whole rule layer runs in under a second against in-memory objects, and the wiring gets its
own end-to-end tests against real directories.

---

## 2026-09-07 — A check the project did not configure is reported as absent, never as passing

Every section of `harness.config.json` is optional, and `harness doctor` prints what is
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

**Found by:** the end-to-end test that runs `harness init` and then `harness check`, which
is the test most worth having.
