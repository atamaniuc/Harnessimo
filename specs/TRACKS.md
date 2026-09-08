# Work tracks

Index of live tracks (handoff-driven development). One line per track: essence — handoff —
status, date, next step. Statuses: `active` / `paused` (+ why) / `blocked` (+ on what).
Closed tracks are distilled into [TRACKS-LOG.md](TRACKS-LOG.md) and their handoffs deleted.

`npm run check` verifies this file: every link must resolve and every line must carry a
status. A line pointing at a handoff that no longer exists is a dead marker the next
session would trust.

- **Metric thresholds as a check** — [handoff](specs/0001-metric-thresholds/handoff.md) — paused (finding, not a design), 2026-09-08, next: write `spec.md` and answer whether this is a tenth check or a documented use of `queue`
- **Docs consolidation (spec 0002)** — [handoff](specs/0002-docs-consolidation/handoff.md) — active, 2026-09-08, next: decide whether STANDARD and USE-CASES merge into one reference, given that a straight merge is ~600 lines and breaks the page-size criterion in the spec
- **Doc contracts (spec 0003)** — [handoff](specs/0003-docs-contracts/handoff.md) — active, 2026-09-08, next: phase 3 — CONFIGURATION.md and the generated llms.txt
