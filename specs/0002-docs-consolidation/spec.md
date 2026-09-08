# 0002 — Consolidate the documentation

## Why

Seven navigation entries and 3 745 lines of Markdown for a tool with nine
checks. The reader's complaint was "chaos", and the measurements agree:

- **The same job, twice.** "How to turn a check on" is in `GUIDE.md` §4 (a
  table of config keys) and in `ADOPTING.md` §2 (a table of the same keys, from
  the other direction). A reader who found one has no reason to look for the
  other, and the two drifted: the guide's table was missing `release` for four
  versions.
- **Motivation, three times.** The home page argues why this exists; `WHY.md`
  argues it again with a comparison table; `USE-CASES.md` opens with a third
  version of the same argument before its examples start.
- **Evidence separated from the rule it proves.** `USE-CASES.md` shows what
  each check actually prints. `STANDARD.md` explains where each check comes
  from. They are two halves of one reference, on two pages, in different orders.

The failure this causes is not aesthetic. Duplicated prose is prose that drifts,
and this repository has now shipped four patch releases in one day fixing its
own documentation.

## What

Five pages, each with one job nothing else does:

| Page | Its job | Built from |
|---|---|---|
| Home | what it is, the demo, install, the nine checks, where to go next | `index.md` (generated from `README.md`) |
| Why this exists | the case: where it sits next to Kiro, Spec Kit, Agent OS; who it is for; when not to reach for it | `WHY.md` + the opening argument of `USE-CASES.md` |
| Guide | zero to green, turning checks on one at a time, a session, commit and CI, and adopting a repository that already has its own scripts | `GUIDE.md` + `ADOPTING.md` |
| Reference | every check: what it catches, what it prints, which config key turns it on, which lecture it comes from; then the five subsystems | `STANDARD.md` + the worked examples of `USE-CASES.md` |
| SDD | what was taken from OpenSpec, Agent OS, Spec Kit, BMAD, HDD, TDD | `SDD.md`, unchanged |

Both languages, as now.

## Acceptance criteria

Executable, or it does not count.

1. `test/translations.test.ts` passes — every page exists in every locale
   declared in `mkdocs.yml`.
2. `test/docs-structure.test.ts::the nav lists exactly the pages that exist`
   — the nav and `docs/*.md` agree in both directions; no orphan file, no
   entry pointing at a missing page.
3. `test/docs-structure.test.ts::every retired page redirects somewhere real`
   — each old URL is in `redirect_maps` and its target is a page that exists.
4. `test/counts.test.ts` passes unchanged in substance: the check count still
   comes from `EnabledChecks`, and the guide's table still offers all nine
   config keys — now on the merged page.
5. `node src/cli.ts check` passes: every proof marker that moved still resolves.
   (Writing the marker's syntax out here would make this sentence one, which is
   how this criterion first failed.)
6. `mkdocs build --strict` succeeds — a link that no longer resolves fails the
   deploy, which is how the retired pages get caught if a redirect is missed.
7. No page over 400 lines. A reference that has to be scrolled past four
   screens is the same failure in a different shape.

## Boundary

- **Not** a rewrite of the prose. Sections move; sentences change only where a
  merge makes them wrong (a cross-reference to a page that no longer exists, a
  duplicated paragraph where two pages met).
- **Not** a change to `README.md` or `index.md` beyond their links, since the
  home page is generated and its content is the package's front page on npm.
- **Not** a new language.
- URLs that were published keep working. `mkdocs-redirects` is added for this;
  a 404 on a link someone shared is a worse outcome than the chaos being fixed.

## Done means

Every criterion above runs green, and `npm run check`, `npm test` and
`mkdocs build --strict` are the three commands that say so. This repository has
no `specs/DoD.md` of its own — the consumers do; here the definition is the
criteria list, because a criterion that cannot run does not exist.
