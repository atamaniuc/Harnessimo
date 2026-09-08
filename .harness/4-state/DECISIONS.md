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

