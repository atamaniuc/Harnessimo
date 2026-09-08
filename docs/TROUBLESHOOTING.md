# Troubleshooting

**Who is this for?** Someone whose run just went red, or whose check is not running at all.
**When should I read it?** Now — start with the message you got. For a question that is not
a breakage, see the [FAQ](FAQ.md); to learn the tool, the [guide](GUIDE.md).

---

Every entry below is a failure this repository or one of its two consumers actually hit.
The fix is what worked, not what should have.

## `release` says the checkout has no tags

```
FAIL  release
  CHANGELOG.md:1  (no tags)
      this checkout has no tags, so whether the released versions are tagged cannot be checked
    fix:  fetch tags — actions/checkout needs fetch-depth: 0
```

Nothing is wrong with your repository. `actions/checkout` clones one commit and no tags by
default, so the check cannot see what it is meant to compare. Give the job its input:

```yaml
- uses: actions/checkout@v5
  with:
    fetch-depth: 0
```

Every job that runs `harnessimo check` needs this, not just the one you noticed.

## A proof marker fails and the file is obviously there

Three causes, in the order they are usually true:

1. **The path is relative to the repository root, not the document.** A marker in
   `docs/GUIDE.md` naming `src/cli.ts` is right; naming `../src/cli.ts` is not.
2. **The symbol moved or was renamed.** `<!-- proof: src/<module>.ts:<aSymbol> -->` fails the moment
   `<aSymbol>` is renamed. This is the check working: the claim outlived
   the thing it pointed at.
3. **The command has no runner.** `<!-- proof: make <target> -->` needs `docs.commands` to
   say what `make` is — `{ "make": "Makefile" }`. Without it the marker cannot be resolved,
   and it says so rather than passing.

## `clean-exit` says progress was not written down

```
.harness/4-state/PROGRESS.md:1  (not updated)
    21 file(s) changed and this was not one of them
```

The session changed code and left the file the next session reads first describing the old
state. Either update it, or — if this repository keeps "where I stopped" somewhere else,
such as a per-track handoff — set `cleanExit.progressFile` to `null` and say why in the
config's `$comment`. Turning a rule off deliberately, in writing, is not the same as
ignoring it.

## `locked` refuses a commit that only touched CI

That is the check doing its job: `.github/workflows/` is in `locked.paths`, and an agent
commit may not change the files that decide whether its work passed.

The intended path is not to weaken the rule. Land the change, then move the baseline in a
separate commit that records *why*:

```
# The fourteenth corrects the constraint count that file states about itself.
4a2726ae71df13b215b061744f084f9e08df959a
```

The baseline file's history becomes the audit trail for every time a locked surface moved.

## The pre-commit hook rejects something that `check` accepts

The hook and your terminal are running different builds. The generated hook looks for
`node_modules/.bin/harnessimo`, then `src/cli.ts`, then `dist/cli.js`, then `PATH` — so a
stale `dist/` shadows the sources it was built from. Rebuild, or delete `dist/`.

If you need to land a commit while the hook is wrong, fix the hook. `--no-verify` turns the
gate off for everyone who copies the command out of your shell history.

## `cold-start` fails but the repository works fine here

It is meant to. The check clones into an empty directory and runs the documented commands
with nothing from your machine — no `.env`, no global install, no cached `node_modules`.
A failure means a new contributor or a fresh CI runner cannot start, which was true before
the check was added and merely invisible.

Read what it printed: a missing file is a missing file, and a failing command is a command
your README promises and the repository cannot honour.

## `queue verify` passes locally and fails in CI

CI runs `check --reverify`, which re-runs the verification of every item claiming to pass
rather than trusting the recorded state. An item that went green once and was edited by
hand fails here. That gap between "the file says passing" and "it passes" is the entire
reason the queue exists.

## Nothing runs: "no harnessimo.config.json here"

The tool reads the config from the current working directory. Run it from the repository
root, or run `harnessimo init` if this repository has not been set up.

## `doctor` says a check is "not set" and you expected it on

A check turns on when its configuration section exists — no section, no check. `doctor`
prints the honest list, and that list is the answer to "what does this repository actually
enforce". Add the section named in the [guide's table](GUIDE.md#turn-on) and
run `doctor` again.

## Still stuck

Open an issue with the command you ran and its full output:
<https://github.com/atamaniuc/Harnessimo/issues>. The output names a file, a line and a fix;
if it did not, that is a bug in the message and worth reporting on its own.
