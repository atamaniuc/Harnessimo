# Work tracks

Index of live tracks (handoff-driven development). One line per track: essence — handoff —
status, date, next step. Statuses: `active` / `paused` (+ why) / `blocked` (+ on what).
Closed tracks are distilled into [TRACKS-LOG.md](TRACKS-LOG.md) and their handoffs deleted.

`npm run check` verifies this file: every link must resolve and every line must carry a
status. A line pointing at a handoff that no longer exists is a dead marker the next
session would trust.

- **Metric thresholds as a check** — [handoff](specs/0001-metric-thresholds/handoff.md) — paused (finding, not a design), 2026-09-08, next: write `spec.md` and answer whether this is a tenth check or a documented use of `queue`
- **How much was this run watched (spec 0007)** — [handoff](specs/0007-autonomy-levels/handoff.md) — active, 2026-09-08, next: write the acceptance criteria, then the first failing test
