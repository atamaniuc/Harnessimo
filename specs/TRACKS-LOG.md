# Closed tracks

Newest first. One or two sentences per track: what came out of it. Lasting decisions go to
[`.harness/4-state/DECISIONS.md`](../.harness/4-state/DECISIONS.md), not here; git carries
the rest.

- **Adoption in the two source repositories (spec 0001)** — both now depend on this package
  and have deleted their copies: `code-knowledge-base` removed its queue tool, locked-surface
  and cold-start scripts; `ledger-lens` kept its TypeScript entry points and delegated the
  rules, with all 38 of its own unit tests passing untouched. Both CIs run the shared CLI.
- **Published version tag** — `v0.1.0` and `v0.2.0` are tagged and released through
  `release.yml`, after tag pushes turned out to be impossible from the environment this was
  built in. Both consumers pin a version.
- **Building the tool** — the six checks, their tests, the templates and the self-hosting
  configuration. Closed when this repository started passing its own `npm run check`.
