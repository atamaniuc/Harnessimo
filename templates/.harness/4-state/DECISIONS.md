# DECISIONS

What was decided, why, and what was rejected. Append; do not rewrite history.

It exists so a later session does not quietly undo a deliberate choice — and so a rejected
option stays rejected instead of being rediscovered every few weeks.

---

## YYYY-MM-DD — Adopted the harness as a dependency rather than a folder of scripts

`harnessimo` provides the gates; `harnessimo.config.json` says which of them apply
here.

**Why:** a copied script is a fork the day after it is copied. Two projects had drifting
copies of the same check, and the drift was invisible until one of them broke.

**Rejected:** vendoring the scripts. It removes the dependency and reintroduces the drift.

---

## Template for an entry

**What was decided.** One line, in the present tense.

**Why:** the reasoning, including the constraint that forced it.

**Rejected:** the option not taken, and what it would have cost.

**Corrected during implementation:** what turned out to be wrong once real code met it.
This line is the most valuable one in the file and the most often left out.
