# 0003 — A contract per document, and the documents a reader actually asks for

## Why

Spec 0002 removed one duplicated table and stopped there, because the real
problem was not that two pages overlapped. It was that no page had a stated
job, so overlap was undetectable until a reader tripped over it. "Chaos" is the
symptom; the cause is that our documentation is organised by *topic* — why,
guide, use cases, standard — while a reader arrives with a *question*, at a
*moment*, in a *role*.

Three concrete gaps, all found by reading our own docs as a stranger:

1. **No route.** The landing page lists pages by name. A reader who wants to
   know "how do I turn off a check I do not want" has no way to guess which of
   six pages holds the answer, and it is in fact split across two.
2. **No configuration reference.** `harnessimo.config.json` has a JSON schema
   and nine sections, and not one page documents them. The schema is machine
   readable and the reader is not a machine.
3. **Nothing for the reader who is stuck.** No FAQ, no troubleshooting. The
   nearest thing is a "questions people ask" section buried at the end of a
   fifteen-minute guide, which is the wrong place: someone whose run just went
   red is not reading a guide from the top.

And one gap specific to what this tool is for: **nothing addressed to the agent.**
The whole premise is that an agent reads the repository. Our documentation is
seven pages of prose an agent has to crawl page by page.

## The rule this spec introduces

> **Each document answers one question, for one reader, at one moment.**
> A document that answers two questions makes every reader skim past half of it.

To make that enforceable rather than aspirational, every document carries a
contract, and the contract is a file — `docs/contracts.json` — not a habit.

## Reader profiles

Three, and every document serves exactly one as its primary reader.

| Profile | Who | Their path |
|---|---|---|
| **Evaluator** | deciding whether this is worth adopting, before touching a terminal | Home → Why → FAQ |
| **User** | has decided; installing, configuring, running it | Home → Quickstart → Configuration → Guide, with FAQ and Troubleshooting when stuck |
| **Agent** | a coding agent reading this repository to learn what the tool expects | Home → `llms.txt`, one dense machine-readable file |

A fourth profile — the contributor — is served by `CONTRIBUTING.md` and the
repository itself, and is deliberately not given site pages.

## Per-document contract

Each entry in `docs/contracts.json` carries:

- `answers` — the one question, phrased as the reader would ask it
- `profile` — evaluator, user, or agent
- `owns` — what lives here and nowhere else
- `excludes` — what belongs elsewhere, naming where. **This is the field that
  prevents overlap**, and the one a test can check: content matching an
  exclusion is a rule violation, not a style opinion.

## What ships

| Document | Answers | Profile | Status |
|---|---|---|---|
| Home (`index.md`) | "What is this, and where do I go?" | all — the front door | exists; gains a routing table |
| `WHY.md` | "Why this, rather than what I already have?" | evaluator | exists; gains a before/after and an honest "you may not need this" |
| `QUICKSTART.md` | "How do I get to a green check?" | user | new; lifted from `GUIDE.md` §3 |
| `CONFIGURATION.md` | "What can I put in the config, and what does each key do?" | user | **new** — the gap |
| `GUIDE.md` | "How do I work with this day to day?" | user | exists; loses §3 to Quickstart |
| `REFERENCE.md` | "What does each check catch, and what does it print?" | user | the 0002 decision, still open |
| `FAQ.md` | "A short question that is not a bug" | evaluator + user | **new** |
| `TROUBLESHOOTING.md` | "It is broken — what now?" | user | **new** |
| `SDD.md` | "Where did these ideas come from?" | evaluator | exists, unchanged |
| `llms.txt` | the whole thing, densely, for a machine | agent | **new**, generated |

## Acceptance criteria

1. `test/doc-contracts.test.ts::every page has a contract` — every file in
   `docs/` appears in `docs/contracts.json`, and every contract names a file
   that exists.
2. `test/doc-contracts.test.ts::every page states who it is for` — each page
   opens with its reader and its moment, and the words match its contract's
   `answers`.
3. `test/doc-contracts.test.ts::no page keeps what it excludes` — for each
   `excludes` entry, the page does not carry a heading matching it.
4. `test/doc-contracts.test.ts::the routing table covers every document` — the
   home page's "I want to… → read" table lists every page a reader can reach.
5. `scripts/llms-txt.ts --check` — `docs/llms.txt` matches the pages it is
   built from, failing on drift exactly as the home page does.
6. Existing gates stay green: `npm test`, `node src/cli.ts check`,
   `mkdocs build --strict`, and every retired URL still redirects.
7. Both languages, as always. `test/translations.test.ts` is unchanged and
   still passes.

## Boundary

- **Not** a rewrite of what the checks do. Prose moves and gets a header; the
  rules do not change.
- **Not** a new check. The contract is enforced by a test in this repository,
  because it is a rule about *this* documentation, not a rule this tool offers
  to others. Whether it later becomes one is a separate question.
- `llms.txt` is generated, never hand-edited — a hand-maintained copy of the
  documentation is a second source of truth, which is the failure this repo
  keeps shipping patches for.

## Phasing

The work lands in three commits, each green on its own:

1. The contract file, the tests, the reader headers, the routing table.
2. `FAQ.md`, `TROUBLESHOOTING.md`, `QUICKSTART.md` — the missing reader moments.
3. `CONFIGURATION.md` and `llms.txt` — the configuration gap and the agent.

`REFERENCE.md` stays open from spec 0002 and is not decided here.
