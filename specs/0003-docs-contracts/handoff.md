# Handoff — 0003 A contract per document

## Context

`spec.md` here is the contract. The short version: our documentation was
organised by topic while readers arrive with a question, in a role, at a
moment — so overlap was invisible until someone tripped over it, and three
reader moments had no page at all.

## State

**Phases 1 and 2 are shipped and green. Phase 3 is not started.**

Landed:

- `docs/contracts.json` — one entry per page: the question it answers, its
  reader profile, what it owns, and `excludes`. The last field is the point:
  it names what a page must not carry and where that belongs, which turns "these
  pages feel like they overlap" into a failing test.
- `test/doc-contracts.test.ts` — five tests over that file: every page has a
  contract, every contract has a page, profiles exist, exclusions point
  somewhere real, no page keeps what it excludes, and the home page's routing
  table reaches every page.
- Every page now opens with **who it is for** and **when to read it**, in both
  languages. A reader landing from a search result could not previously tell
  whether the page was theirs.
- The README ends with a routing table — "I want to… → read" — instead of a list
  of page names. A reader does not know they want `STANDARD.md`; they know they
  want to understand why a rule exists.
- `FAQ.md` and `TROUBLESHOOTING.md`, both languages. Every troubleshooting entry
  is a failure this repository or a consumer actually hit, with the fix that
  worked. The guide's "questions people ask" section moved into the FAQ, because
  someone with a question is not reading a guide from the top.
- Two anchors are now explicit ids (`#adopting`, `#turn-on`). A Cyrillic heading
  slugifies to bare `#4-`, which breaks on any renumbering and is meaningless as
  a link.
- `scripts/site-home.ts` no longer keeps a hardcoded list of page names — it
  rewrites site URLs by shape. That list had already fallen behind twice.

## Phase 3, not started

1. **`CONFIGURATION.md`** — the real gap. `harnessimo.config.json` has nine
   sections and a JSON schema, and no page documents them for a human. The
   schema is the source; the page should be generated from it or checked
   against it, never hand-maintained beside it.
2. **`llms.txt`** — one dense machine-readable file for the agent profile,
   generated from the pages and drift-checked exactly as the home page is
   (`scripts/site-home.ts` is the working model to copy). This is the profile
   the tool exists to serve and the only one with nothing addressed to it.

## Watch out for

- **Proof markers in prose.** The checker scans whole documents, fences
  included, so a page that documents marker syntax must use `<angle>`
  placeholders — that is what marks a marker as an illustration. Two pages and
  one spec have already tripped on this.
- **Claims in the FAQ are claims.** The first draft said Apache; the licence is
  MIT. Anything asserted there about counts, licences or guarantees should be
  read against the repository before it ships.

## First step

Write `CONFIGURATION.md` from `schema/harnessimo.schema.json`, with a test that
fails when a config key exists in the schema and not on the page. Then
`llms.txt`.
