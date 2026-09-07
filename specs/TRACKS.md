# Work tracks

Index of live tracks (handoff-driven development). One line per track: essence — handoff —
status, date, next step. Statuses: `active` / `paused` (+ why) / `blocked` (+ on what).
Closed tracks are distilled into [TRACKS-LOG.md](TRACKS-LOG.md) and their handoffs deleted.

`npm run check` verifies this file: every link must resolve and every line must carry a
status. A line pointing at a handoff that no longer exists is a dead marker the next
session would trust.

- **Adoption in the two source repositories (spec 0001)** — [handoff](specs/0001-adoption/handoff.md) — active, next: T3 — replace `code-knowledge-base`'s vendored `locked-surfaces.sh` and `cold-start.sh` with the shared CLI
- **Published version tag** — none — blocked (on the repository being public and a first tag being cut), next: tag `v0.1.0` so consumers pin a version instead of tracking `main`
