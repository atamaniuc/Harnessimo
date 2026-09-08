# FAQ

**Who is this for?** Anyone evaluating or using this who has a short question that is not a
bug and not a setup problem.
**When should I read it?** Before opening an issue. For something broken, see
[troubleshooting](TROUBLESHOOTING.md); to learn the tool, the [guide](GUIDE.md).

---

## Deciding

**Do I have to adopt all of it?**

No. One check is a real improvement, and `doctor` keeps telling you the truth about the
other eight. A repository that enables two checks and knows it enables two is in better
shape than one that believes it enables nine.

**When is the answer "you do not need this"?**

When you are the only person in the repository, the agent's work is small enough to read in
full, and you already read all of it. The checks pay for themselves when *nobody is
reading the whole diff* — a second contributor, a long unattended run, work that spans
sessions. Below that line they are ceremony, and ceremony that costs more than the error it
prevents is not discipline.

**Does this replace my tests?**

No. It checks that your claims point at things that exist and still pass. A test that
asserts nothing satisfies every rule here.

**Does it work with my agent?**

Yes. The checks are commands: they read files, run your commands and walk git history.
Claude Code, Codex, Cursor, Copilot, DeepSeek, an agent you wrote yourself — none of them
are special-cased, because none of them are consulted. `harnessimo agent` prints a
three-line contract to paste into whatever instruction file your tool reads, and
`hooks install --agent` wires the one tool that has a startup hook API.

**My repository is not JavaScript.**

Fine. Point `docs.commands` at your `Makefile` or `Taskfile.yml` and carry on. Node runs
the tool; nothing about your project has to be JavaScript.

**Should I also run a code-graph or codebase-memory tool?**

Yes, and separately. Those index your repository and serve it to the agent — they answer
"what do I need to read". This answers "is it finished". They meet the same friction from
opposite ends, and bundling them would cost more than it gives.

## Running it

**Which check should I turn on first?**

The one matching a problem you have actually had this month. The
[guide's table](GUIDE.md#turn-on) maps symptoms to checks. Turning on all nine
at once produces one enormous red run that nobody reads.

**How do I turn a check off?**

Delete its section from `harnessimo.config.json`. A check runs when its configuration
exists, and `doctor` will then list it as "not set" — which is the honest state, not a
hidden one.

**Is it slow?**

The pre-commit hook runs only the second-scale gates; re-verification, the cold start and
your own commands belong in CI. A hook that makes every commit slow gets bypassed, and a
bypassed gate enforces nothing.

**What does it install into my repository?**

`.harness/` (five folders of starter documents you are meant to rewrite), `specs/` (a track
index and templates) and `harnessimo.config.json`. Nothing else, and no runtime
dependencies — the package has none, by a rule its own CI enforces.

**Can an agent edit the rules to make its own work pass?**

Not without it showing. That is what `locked` is for: the files that define success are
named in the config, and a commit carrying an agent trailer that touches them fails. Moving
the boundary is a separate, human-visible commit.

**Does it help with token cost?**

That is what `harnessimo budget` and the read guard are for. The guard refuses a second read
of a file that has not changed and reports what that saved; the budget prints what a session
cost and how much of it was repetition. Every figure is an estimate at four bytes per token
and says so — we cannot see the model's context, and a precise number nobody can verify is
worse than an approximate one that admits it.

## Trust

**Why should I believe the checks work?**

Every rule has a test proving it fires on bad input — a rule that has only ever passed is
an assumption wearing a rule's clothes. All nine run against this repository, including a
cold start that clones it into an empty directory, and every published version is built and
signed by a workflow with no stored credentials.

**What happens when a rule is wrong?**

Open an issue or a pull request. A rule that exists twice — once here and once forked into
your repository — is the problem this was built to remove.

**Who is behind it, and what happens if that stops?**

One author, two production repositories using it, MIT-licensed, no runtime
dependencies. If it were abandoned tomorrow the checks are a few thousand lines of pure
functions you could vendor in an afternoon. That is deliberate: a gate you cannot take over
is a gate you should not depend on.

## Still not answered

For a breakage, [troubleshooting](TROUBLESHOOTING.md). Otherwise open an issue:
<https://github.com/atamaniuc/Harnessimo/issues>.
