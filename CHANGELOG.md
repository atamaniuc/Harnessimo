# Changelog

Every released version, what changed in it, and why. Newest first.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are
[semantic](https://semver.org/spec/v2.0.0.html). A release exists when its tag does — the
release workflow refuses to cut one from a commit that does not pass its own checks, and
`test/changelog.test.ts` refuses a version that is not written down here.

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

[0.4.3]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.4.3
[0.4.2]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.4.2
[0.4.1]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.4.1
[0.4.0]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.4.0
[0.3.0]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.3.0
[0.2.0]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.2.0
[0.1.0]: https://github.com/atamaniuc/Harnessimo/releases/tag/v0.1.0
