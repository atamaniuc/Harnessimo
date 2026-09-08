# Handoff — 0002 Docs consolidation

## Context

`spec.md` in this directory is the contract. The reader's complaint was that
the documentation felt chaotic; the measurements behind that are in the spec's
"Why", and they are real — the same job was on two pages, and the two had
already drifted apart.

## State

**Half done, and the done half is shipped green.**

Merged and live:

- `ADOPTING.md` is gone. Its content is `GUIDE.md` §8, in both languages, with
  the install-and-`init` block dropped where it repeated §3 — that repetition
  was the drift the spec names.
- Every link that pointed at the retired page now points at `#adopting`, an
  explicit heading id rather than a slug. A Cyrillic heading slugifies to bare
  `#8`, which breaks the moment a section is renumbered.
- Published URLs still answer. `mkdocs-redirects` covers `/ADOPTING/`;
  `hooks/i18n_redirects.py` covers `/ru/ADOPTING/`, which that plugin cannot
  see because it knows one page tree and `mkdocs-static-i18n` builds one per
  language.
- `test/docs-structure.test.ts` holds the shape: nav and `docs/*.md` agree both
  ways, every redirect target exists, no page over 400 lines. All three were
  mutation-tested.

Nav is six entries, down from seven.

## The open decision, and why it was not taken alone

The spec proposes one **Reference** page from `STANDARD.md` (290 lines) and the
worked examples of `USE-CASES.md` (316). A straight merge is ~600 lines and
breaks acceptance criterion 7 — the page-size rule in the same spec. Quietly
raising that limit to fit the merge would be exactly the move this tool exists
to catch, so it was left to the human.

Three ways out, none obviously right:

1. **Split by audience.** Reference = the nine checks, each with what it
   catches, what it prints, its config key and its lecture (~380 lines).
   `STANDARD.md` keeps the five subsystems, HDD and provenance (~200). Result:
   six entries still, but each with one job.
2. **Merge and accept a long page.** One reference at ~600 lines, criterion 7
   rewritten to say so and why. Honest if argued; dishonest if silent.
3. **Leave both.** They do differ: one is "what will this catch for me", the
   other "why does this rule exist". The overlap is the motivating preamble at
   the top of `USE-CASES.md`, which duplicates `WHY.md` and could simply be
   deleted — a ten-line fix rather than a restructuring.

Option 3 is the cheapest and may be enough; option 1 is the tidiest. The
measurement that would decide it — does anyone read `STANDARD.md` — is not
available.

## What to load

- `spec.md` here, then `mkdocs.yml` (nav, `redirect_maps`, `hooks:`).
- `docs/USE-CASES.md` §§1–8 and `docs/STANDARD.md` — the two halves in question.
- `test/docs-structure.test.ts`, which any restructuring has to keep green.
- **Do NOT load** `src/`. Nothing here touches the checks themselves.

## First step

Answer the open decision, in `spec.md`, before moving a line. Then, whichever
way it goes: retire the page, redirect both locales, update the nav and its
`nav_translations`, and run `npm test`, `node src/cli.ts check` and
`mkdocs build --strict`.
