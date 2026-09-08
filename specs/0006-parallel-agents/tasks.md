# Tasks — 0006 More than one agent

One list, ordered by priority. P0 is what makes the lane shippable.

## P0

- [x] T1 — A claim is parsed from a handoff, and a claim that is not a path is refused
      <!-- proof: test/claims.test.ts#a claim is a path, not a pattern -->
- [x] T2 — Overlap is prefix containment, and two live lanes cannot claim the same path
      <!-- proof: test/claims.test.ts#two live lanes cannot own the same path, and the failure names both -->
- [x] T3 — Two lane directories cannot share a four-digit number
      <!-- proof: test/claims.test.ts#two directories cannot share a number -->
- [x] T4 — The `tracks` check reports both, against a real repository on disk
      <!-- proof: test/cli.test.ts#two lanes claiming one path fail, naming the other lane -->
- [x] T5 — `hooks install --agent` installs Stop and SubagentStop without disturbing what is there
      <!-- proof: test/brief.test.ts#hooks for other events are added without disturbing the ones already there -->
- [x] T6 — A red check blocks the end of a turn; a turn already continuing from it does not
      <!-- proof: test/hooks.test.ts#a turn already continuing from this hook is not blocked again -->
- [x] T7 — `brief --track <slug>` prints one lane whole, plus every lane's fence
      <!-- proof: test/brief.test.ts#a scoped brief carries one lane, whole, and the fence around every other -->
- [x] T8 — The handoff template shows the `## Owns` section and declares nothing
      <!-- proof: test/claims.test.ts#a placeholder is not a claim -->

## P1

- [x] T9 — Documentation: a page of its own, routed to, in the nav, and in `llms.txt`
      <!-- proof: test/docs-structure.test.ts#the nav lists exactly the pages that exist -->
- [x] T10 — Both languages carry the same rules
      <!-- proof: test/translations.test.ts#every page exists in -->

## Notes

A ticked box carries its evidence inline: after the task text, a proof marker naming the
test that proves it.
