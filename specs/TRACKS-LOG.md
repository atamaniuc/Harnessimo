# Closed tracks

Newest first. One or two sentences per track: what came out of it. Lasting decisions go to
[`.harness/4-state/DECISIONS.md`](../.harness/4-state/DECISIONS.md), not here; git carries
the rest.

- **How much was this run watched (spec 0007)** — A run declares how closely it was watched and the level decides how much is re-checked: watched runs the fast checks, reviewed adds re-verification and the locked-surface check, unattended adds clean exit and cold start. Declared rather than inferred, a floor a flag can raise and never lower, and a level the repository cannot back is refused.

- **More than one agent (spec 0006)** — A lane declares the paths it owns and `tracks` fails when two live lanes collide; two lane directories can no longer share a number; `hooks install --agent` installs Stop and SubagentStop so a turn cannot end while `check` is red; `brief --track` hands one lane to one agent. Declaration and detection only — no locking, and stale claims and lane dependencies stay specified and unbuilt.

- **Docs consolidation (spec 0002)** — seven nav entries became eight pages with distinct
  jobs and no duplicated tables: the adoption page merged into the guide, and the situations
  page merged with the standard's origin table into one `REFERENCE` (233 lines, under the
  spec's own page-size rule — the straight 600-line merge it was blocked on was avoided by
  moving the setup argument to `WHY` and the reasoning to `STANDARD`). Every retired URL
  redirects in both languages, including through a hook the redirect plugin cannot see.
- **A contract per document (spec 0003)** — every page now declares, in
  `docs/contracts.json`, the one question it answers, its reader, and what it must *not*
  carry; the last field turns overlap from a matter of taste into a failing test. Shipped
  with it: reader headers on every page, a routing table that navigates by question instead
  of by page name, `FAQ` and `TROUBLESHOOTING` for the two reader moments that had no page,
  and two generated pages — `CONFIGURATION` from the JSON schema (which turned out to have
  six keys with no description at all) and `llms.txt`, the whole documentation as one file
  for the reader that is not a person.
- **Adoption in the two source repositories (spec 0001)** — both now depend on this package
  and have deleted their copies: `code-knowledge-base` removed its queue tool, locked-surface
  and cold-start scripts; `ledger-lens` kept its TypeScript entry points and delegated the
  rules, with all 38 of its own unit tests passing untouched. Both CIs run the shared CLI.
- **Published version tag** — `v0.1.0` and `v0.2.0` are tagged and released through
  `release.yml`, after tag pushes turned out to be impossible from the environment this was
  built in. Both consumers pin a version.
- **Building the tool** — the six checks, their tests, the templates and the self-hosting
  configuration. Closed when this repository started passing its own `npm run check`.
