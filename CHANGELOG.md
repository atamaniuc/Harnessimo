# Changelog

Every released version, what changed in it, and why. Newest first.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are
[semantic](https://semver.org/spec/v2.0.0.html). A release exists when its tag does — the
release workflow refuses to cut one from a commit that does not pass its own checks, and
`test/changelog.test.ts` refuses a version that is not written down here.

## [0.10.0] — 2026-09-08

Two checks, both of them rules that existed already — in scripts, in review habits, in
somebody's memory — in the two repositories this package was extracted from. Neither was
designed here; both were found by asking which generic rule those repositories had written
by hand because the tool could not say it.

### Added

- **`boundaries` — a pattern that must not appear in a named part of the tree.** One
  repository forbids the service-role key under `app/` (it bypasses row-level security, so a
  client-side use is a data leak wearing an ordinary import) and hard-coded colours in
  components; the other forbids placeholder markers in published content. Three rules, one
  shape: *this pattern, not in these files, for this reason*. `reason` is required and is
  what the failure prints — a boundary that says "matched /service_role/" reports what
  happened rather than what to do. `allow` names the one legitimate place; a pattern that
  does not compile is reported rather than thrown; beyond ten hits per rule the report says
  how many are left. This repository now runs one on itself: an import in `src/` that is
  neither a `node:` builtin nor relative is the runtime dependency its constraints forbid,
  which until now was prose a reviewer had to remember.
- **`thresholds` — a scored metric stays at or above its declared floor.** This closes the
  oldest open track: both source repositories invented the rule independently, and the
  question it left open was whether it earned a check or was configuration of the queue. A
  check — the queue believes an exit code, so expressing a threshold there means every
  project writes the same comparison script, which is exactly what both of them did. It does
  not run your scoring: your command writes the results file and this reads and compares. A
  metric with a floor that nobody measured fails too, because a scoring step that did not run
  is not a scoring step that passed. Floors only; a metric where lower is better is the same
  rule mirrored, and inventing a direction on zero real cases would be a guess. Where a
  repository already declares `locked.paths` and the floors are not among them, the check
  says so: an agent that can lower its own pass mark grades itself.
- **A lane declares what it waits on.** `## Depends on` in a handoff, by slug. `tracks`
  refuses a slug naming no lane, a lane waiting on itself, and a cycle; `track close` refuses
  while something the lane was built on is still open; `brief --track` carries what it waits
  on, as heads. Collision was half of working in parallel — this is the other half, and it
  costs rework rather than a merge conflict, which is why nothing was catching it.
- **`tracks.staleAfterDays`.** A live track line nobody has refreshed is reported with its
  age, and named as holding its fence when the lane declares paths. Spec 0006 deferred this
  for want of a clock; the date the index line already carries turned out to be one. `0` (the
  default) turns it off.

### Changed

- Eleven checks, and this repository runs ten of them on itself — it has no scored metric to
  hold to a floor, and `doctor` says so rather than implying otherwise. A test now holds the
  README to that count, because "all of them" while one is switched off is the drift this
  whole tool is about.
- `docs/STANDARD.md` no longer says this tool "says nothing yet about running many" agents,
  which stopped being true in 0.8.0, and records why skill and prompt hygiene is still not
  here: every rule in this package came from watching two independent repositories write the
  same thing by hand, and one vendor's documentation is not that.

## [0.9.1] — 2026-09-08

### Fixed

- **A repository nested inside this one is no longer scanned as part of it.** A git worktree
  under a configured docs root — `git worktree add specs/wt`, or any submodule or vendored
  clone — doubled the scan: 45 documents became 88 in this repository's own tree, and a
  worktree sitting on an older commit would fail on claims already fixed here. A directory
  holding its own `.git` is another repository, and its files are not this one's. Found by
  running the checks inside real worktrees rather than reasoning about them; `claude
  --worktree` puts them under `.claude/`, where the scanner never went, so this needed
  looking for.

## [0.9.0] — 2026-09-08

### Added

- **A run declares how closely it was watched, and the level decides how much is
  re-checked.** Every check answers "is this finished"; none of them asked how the answer
  was arrived at, so the same green report meant two different things depending on whether
  a person read every step or nobody looked. Three levels, each adding what supervision at
  the level below could no longer catch: `watched` runs the fast checks, `reviewed` adds
  re-verification and the locked-surface check, `unattended` adds clean exit and cold start.
- `harnessimo check --autonomy <level>` and `HARNESSIMO_AUTONOMY`, over a floor declared as
  `{ "autonomy": { "level": "reviewed" } }`. The floor can be raised and never lowered — a
  bar an unattended run can argue its way under is not a bar — and an attempt to lower it
  says so instead of silently getting what it asked for.
- **A level the repository cannot back is refused.** Claiming `unattended` where no
  cold-start check is configured is an unsupervised run with nothing behind the claim, and
  a green report there would mean less than it looks like. The refusal names the section to
  add. `watched` demands nothing extra: a section left out is still a check that does not
  run, which this tool has said out loud since its first version.
- `check --range <base>..<head>`, for the two checks that read a commit range, so CI can be
  one command.

### Changed

- `check` prints the level and what it means before the report, and ends with "every check
  required at `<level>` passes" rather than a green that does not say what it covers.
- `doctor` marks a configured check the current level does not ask for as `above` rather
  than `enforced` — configured and not running is exactly the overstatement `doctor` exists
  to avoid — and reports the level and where it came from.
- `brief` tells a session its supervision level. An agent that does not know how closely it
  is watched cannot know what it will be held to at the end of the turn.
- The level is **declared, never inferred.** Reading `CI`, a TTY or the commit history
  would be a guess about a person's attention dressed as a fact.

### Fixed

- A flag's value could be read as a positional argument: `check --autonomy reviewed` tried
  to open a file called `reviewed`.

## [0.8.0] — 2026-09-08

### Added

- **A lane declares what it owns.** `## Owns` in a handoff lists the paths that lane is
  working on — a file, a directory, or a prefix ending in `/**`. `harnessimo tracks` fails
  when two live lanes claim overlapping paths, naming both lanes and both claims. Overlap
  is prefix containment and nothing cleverer: a pattern whose intersection cannot be
  computed by reading it protects nothing, and a fence that silently does not hold is worse
  than no fence. Declaring nothing stays legal — a repository with one lane in flight needs
  none of this.
- **Two lane directories can no longer share a number.** `track new` allocates from the
  filesystem, so two worktrees read the same state and both take `0006`; the directories
  differ, so git merges them without a word. The check fails on the merged tree, which is
  the only place the collision exists. A lock would not have helped: no lock in one worktree
  is visible in another.
- **`Stop` and `SubagentStop` hooks**, installed by `harnessimo hooks install --agent`
  alongside the startup hook. A red `check` blocks the end of a turn and hands the report
  back to the agent. Until now the harness gated the start of a session and the start of a
  commit, and an agent could finish a turn saying "done" with the checks red — which is
  every turn, in a run where work passes to another agent instead of to a commit. The hook
  does not block a turn already continuing because it blocked once: a gate that cannot be
  satisfied is a loop, and a loop is how a gate gets deleted.
- **`harnessimo brief --track <slug>`** — one lane's track line, its whole handoff, what it
  owns and what the other live lanes own, and none of their state. The unit handed to a
  second agent. The unscoped `brief` is unchanged.
- `docs/PARALLEL.md` (and `.ru`), a page for the reader who has more than one agent, plus
  the `## Owns` section in the shipped handoff template.

### Changed

- `mergeHook(settings, event, command)` generalises `mergeSessionStartHook`, which stays as
  a named wrapper. Every other event's hooks are carried over untouched: the settings file
  belongs to the project, not to this package.

## [0.7.0] — 2026-09-08

### Added

- `harnessimo track new <slug>` and `harnessimo track close <slug> --outcome "..."` — the
  lane lifecycle, which until now was a convention held together by memory. The command
  writes only what is mechanical: the next free number, the directory, the templates copied
  unchanged, and the line in the track index that `harnessimo brief` reads at the start of
  every session. It does not draft a spec, judge its shape, or have an opinion on what a
  lane contains — a generator that writes prose turns a project's convention into this
  tool's property.
- `templates/specs/tasks.template.md`, so a scaffolded lane has the task list the task gate
  reads. Its first draft showed a ticked example and the gate rejected it, which is the test
  that matters: a lane this tool creates has to survive this tool's own rules.

### Changed

- The positioning says what this is: **spec-driven development, and the harness that makes
  it stick.** Both halves were always here — a lane is a contract, the checks decide when it
  is met — but the front page led with the checks alone, which described half the tool. It
  works on an empty repository and on one with years of history; nothing has to be rewritten
  to start.

## [0.6.0] — 2026-09-08

### Added

- `harnessimo budget` and `harnessimo guard read` — the first rules here that fire while the
  work happens rather than at the end of it. The guard refuses a second read of a file whose
  size and mtime have not changed, and the budget reports what a session read, what it
  repeated, and what the refusals saved. Every token figure is an estimate at four bytes per
  token and is printed as one: the model's context is not visible from here, and a precise
  number nobody can verify is worse than an approximate one that admits it.
- `tokens` in the configuration, generated into the reference like every other section.
  Absent means the guard does not run, and `doctor` now lists it **apart from the nine
  checks** — it answers a different question, and printing it in the same list would be the
  overstatement `doctor` exists to avoid.

### Changed

- Six configuration keys had no description in the JSON schema, so nothing could document
  them and editors completed them blindly. They have one now.
- The documentation is eight pages with one stated job each, held to that by
  `docs/contracts.json`; `CONFIGURATION` is generated from the schema and `llms.txt` from
  the pages, both drift-checked. Retired URLs redirect in both languages.

## [0.5.4] — 2026-09-08

### Fixed

- The documentation contradicted itself about how many checks there are: the ninth shipped
  in 0.5.0 and seven sentences across both languages kept saying eight, including the first
  paragraph of the README the registry serves. The guide told readers not to switch on all
  nine at once and then listed eight. A second, unrelated "nine" — the constraints, now ten
  — used the same word for a different count on the same site.
- Test counts in prose were stale in five places. They are gone: the claim beside them,
  that every rule has a test proving it fires on bad input, is the part that matters.

### Added

- `test/counts.test.ts`: the check count is read from `EnabledChecks` and the constraint
  counts from `CONSTRAINTS.md`, and every sentence and table that states a number is held
  to them, in English and Russian. A tenth check cannot ship half-documented.

## [0.5.3] — 2026-09-08

### Fixed

- The README's demo image was broken on GitHub and on npm: its URL carried an unexpanded
  `''' + RAW + '''` from the heredoc that wrote the file. The docs site never showed it,
  because its generator replaces that region with the player — a single-sourced document
  drifting on one surface only, which is the failure mode single-sourcing is supposed to
  remove. This release exists so the registry stops serving the broken page.

### Added

- `test/readme-links.test.ts`: every link in both READMEs must be free of unexpanded
  templates, and every file this repository points at must exist. Quoted terminal output
  is left alone — the sample from `harnessimo brief` names a spec that is not here on
  purpose.
- The version the adoption guide tells people to pin is now held to the manifest by a test.
  The English page said 0.4.1 and the Russian 0.4.3 while the registry served 0.5.2.

## [0.5.2] — 2026-09-08

### Fixed

- The `check` report printed its failures on stderr and its passes on stdout. Under a log
  collector the two buffers interleave, so a problem appeared under a different check's
  name — a report that misattributes a failure is worse than no report. One stream now;
  the exit code still carries the verdict.
- The CI job that runs the compiled CLI checked out shallowly, so the release check
  correctly reported that it could not see any tags, and the build went red for a repository
  that was fine. The job fetches tags.

### Added

- `test/workflows.test.ts`: every job that runs `check` must check out with `fetch-depth: 0`.
  Twice now a workflow has starved a check of the evidence it reads, and a requirement that
  lives in each job's memory is a requirement that gets missed.

## [0.5.1] — 2026-09-08

### Fixed

- The release check treated a checkout with no tags as eight unreleased versions. That is
  not what it means: `actions/checkout` is shallow by default and fetches none, so the
  check was blind and said something else. It now reports the blindness once, and names the
  fix. The workflows that run it fetch tags.

### Note

- 0.5.0 was tagged and released on GitHub but never reached the registry: publishing was
  waiting on a trigger that a workflow-created release does not raise. Fixed in the same
  breath, but the version stays where it is rather than being quietly reused.

## [0.5.0] — 2026-09-08

### Added

- A ninth check, `harnessimo release`: the version in the manifest, the versions in the
  changelog and the git tags must agree. It exists because this repository published 0.4.2,
  0.4.3 and 0.4.4 to npm through a manual workflow run while its own tags stopped at
  v0.4.1 — the release badge and the registry disagreed, and nothing was watching the most
  duplicated claim a project makes.
- `harnessimo agent`: the three-line contract to paste into any tool's instruction file, so
  the session briefing is not limited to the one agent with a hook API.
- `templates/README.md` and `test/templates.test.ts`, so the starter documents `init` ships
  cannot quietly become copies of this repository's own rules.

### Changed

- Publishing refuses a version that has no matching GitHub release, so the registry cannot
  get ahead of the repository — checked as a step rather than implied by the trigger, since
  a release created by a workflow raises no events and the trigger alone published nothing.
  A version already on the registry is skipped rather than failing the run.
- The generated pre-commit hook prefers the sources over `dist/`, which had it checking
  commits against a stale build.
- The three versions that shipped without tags now have them, on the commits that actually
  shipped them.

## [0.4.4] — 2026-09-08

### Added

- Every documentation page in Russian as well as English, with a language switcher and
  `/ru/` served alongside the English site. `test/translations.test.ts` fails when a page
  exists in one language and not the other, so the site cannot half-drift into being
  bilingual.
- A changelog — this file — gated by `test/changelog.test.ts`, which refuses a version that
  is not described here.
- A demo recorded rather than drawn: `npm run demo` runs the commands in a throwaway
  repository and renders what they printed as an asciinema cast for the site and an image
  for the README.

### Changed

- The Russian README is the source of the Russian home page, the same way the English one
  is; both are generated by `npm run docs:sync`.

## [0.4.3] — 2026-09-08

### Changed

- Documentation rewritten around three questions it never answered: who this is for, why
  it is not the same thing as Kiro or Spec Kit, and why it can be trusted. New
  [Why this exists](https://atamaniuc.github.io/Harnessimo/WHY/) page; the README carries
  the same three sections plus one on using it by hand and by agent.
- The site's home page is generated from the README, so the repository, npmjs and the
  documentation site cannot drift. A test fails when it has.

## [0.4.2] — 2026-09-08

### Changed

- Published by OIDC trusted publishing. There is no npm token in the repository or its
  secrets: npm verifies a short-lived token minted for the run and matched against a
  publisher configured on the package. The workflow filename is part of that credential.

## [0.4.1] — 2026-09-08

### Changed

- What consumers install is the tarball `npm pack` produces, attached to the release,
  rather than build output committed to the repository.

### Fixed

- A `prepare` script had been the way a git install built itself. It works on npm and fails
  on two of the four managers this documents: pnpm 10 refuses to run a dependency's
  lifecycle scripts, and yarn 1 does not build git dependencies. Both left consumers with a
  package containing no JavaScript.

## [0.4.0] — 2026-09-08

### Changed

- Rewritten in TypeScript 7, strict, with `noUncheckedIndexedAccess`. The types are now the
  package's contract rather than a hand-written `.d.ts` alongside JSDoc that said something
  different. Sources import each other as `.ts`, so Node's type stripping runs them with
  nothing installed — `npm test` and the cold-start check are unchanged in that respect.

### Fixed

- Four declarations that were wrong and could not have been caught by a test: `findItem`
  declared as possibly undefined when it throws, `last_failure` typed as an object when it
  holds a string, `detectConfig` returning "an object", and `briefText` demanding a string
  where every caller has `string | null`.
- The package exported its functions and none of the types they take, so a TypeScript
  consumer could call `checkTarget` and had no way to name its `Resolver`.

## [0.3.0] — 2026-09-07

### Added

- `harnessimo brief` and the SessionStart agent hook: a session is handed the live tracks,
  the head of each handoff, what is in flight and what this repository enforces, instead of
  being told in an instruction file to go and look.
- `harnessimo hooks install --agent`, which merges that hook into `.claude/settings.json`
  without disturbing anything else in it.

## [0.2.0] — 2026-09-07

### Added

- `harnessimo hooks install`: the fast checks before every commit, as a file in the
  repository rather than a local artifact each person has to be told about. `hooks status`
  answers the question that matters — whether git is actually running it.

## [0.1.0] — 2026-09-07

### Added

- The eight checks: proof markers over documentation, work tracks and handoffs, the task
  gate, the work queue with re-verification, locked scoring surfaces, cold start, clean
  exit, and the instruction-file limit.
- `harnessimo init`, which reads a repository — command runner, source layout, migrations,
  CI — and writes a configuration whose first run is green.
- `harnessimo doctor`, which reports what is enforced *and what is not*.
- The five-subsystem scaffold (`.harness/`) and the `specs/` track index, spec and handoff
  templates.

[0.10.0]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.10.0
[0.9.1]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.9.1
[0.9.0]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.9.0
[0.8.0]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.8.0
[0.7.0]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.7.0
[0.6.0]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.6.0
[0.5.4]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.5.4
[0.5.3]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.5.3
[0.5.2]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.5.2
[0.5.1]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.5.1
[0.5.0]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.5.0
[0.4.4]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.4.4
[0.4.3]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.4.3
[0.4.2]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.4.2
[0.4.1]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.4.1
[0.4.0]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.4.0
[0.3.0]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.3.0
[0.2.0]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.2.0
[0.1.0]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.1.0
