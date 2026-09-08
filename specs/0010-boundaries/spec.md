# 0010 — A line the code may not cross

## Why

An audit of the two repositories this package was extracted from asked which
generic rules they had written by hand because the tool could not say them. One
was metric thresholds (track 0001). The other is this, and it appears three
times in two repositories in three different spellings:

- the service-role key must not appear under `app/` — it bypasses row-level
  security, so a client-side use is a data leak wearing an ordinary import;
- a hard-coded colour must not appear in a component — design tokens live in
  one file;
- a placeholder marker must not appear in published content.

One shape underneath: **this pattern, not in these files, for this reason.**
Each was a script, or a review habit, or a sentence in an instruction file —
which is to say, a rule that holds until the reviewer is busy.

## What

```json
{
  "boundaries": {
    "scan": ["app", "components"],
    "rules": [
      {
        "pattern": "service_role",
        "paths": ["app/", "components/"],
        "allow": ["app/api/admin/"],
        "reason": "bypasses row-level security; it belongs on the server"
      }
    ]
  }
}
```

- `pattern` is a regular expression, matched per line. A pattern that does not
  compile is reported, not thrown, and says the boundary never ran.
- `paths` uses the same containment as a lane's claims: a file, a directory, or
  a prefix ending in `/**`.
- `reason` is **required**. A boundary that prints "matched /service_role/"
  says what happened; the person reading it needs to know what to do instead.
  This is the field that makes the difference between a linter and a rule.
- `allow` names the one legitimate place, so the boundary does not have to be
  dropped to accommodate it.

Beyond ten hits per rule the report says how many are left. A first run on an
existing codebase should not print a novel.

## What this repository does with it

CONSTRAINTS #1 says this package never takes a runtime dependency. That was
prose a reviewer had to remember. An import in `src/` that is neither a `node:`
builtin nor relative is exactly that dependency, and it is now a line that
fails.

## Acceptance criteria

1. `test/boundaries.test.ts::a pattern is caught where the boundary applies, and nowhere else`.
2. `test/boundaries.test.ts::one legitimate place can be allowed without dropping the rule`.
3. `test/boundaries.test.ts::a boundary with no reason is refused, because a hit would say nothing`.
4. `test/boundaries.test.ts::a pattern that is not a regular expression is reported, not thrown`.
5. `test/boundaries.test.ts::a first run does not print a novel`.
6. `test/cli.test.ts::a line that crosses a boundary fails, with the reason and not the pattern`.

## Out of scope

- A pattern that must be **present** (a correlation id on every log line). That
  is a different rule — per-line presence rather than absence — and it has one
  real case, not two.
- Language awareness. This reads lines, not syntax trees; a match inside a
  comment is a match. Narrow the paths, or narrow the pattern.
