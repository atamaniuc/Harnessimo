# Configuration

**Who is this for?** Someone with the tool installed, writing or changing
`harnessimo.config.json`.
**When should I read it?** When you want a key you have not used before. To choose *which*
check to turn on, the [guide's table](GUIDE.md#turn-on) maps symptoms to sections.

---

Every section is optional, and a section that is absent is a check that does not run —
`harnessimo doctor` prints that list, and it is the honest answer to what a repository
enforces.

This page is generated from `schema/harnessimo.config.schema.json`. Editing it by hand is
pointless: `npm run docs:sync` regenerates it and a test fails when the two disagree.

## `docs`

*Turns on: `proof`*

Proof markers: every claim in prose names the evidence that makes it true.

| Key | Type | What it does |
|---|---|---|
| `roots` | array of string | Directories to scan for Markdown. "." means the repository root, non-recursively. |
| `skip` | array of string | Directory names never descended into. |
| `maxDepth` | integer | How deep to descend below each root. Keeps a scan from wandering into a vendored tree. |
| `mustCarryProof` | array of string | Documents that must carry at least one marker in strict mode. Put the ones that make promises here. |
| `commands` | object | Marker prefix to the file that declares those commands, e.g. { "make": "Makefile", "task": "Taskfile.yml", "pnpm run": "package.json" }. |
| `migrations` | string or null | Directory backing `migration:<prefix>` markers. |

## `tracks`

*Turns on: `tracks`*

Handoff-driven development: the index of live work tracks and the handoffs it points at.

| Key | Type | What it does |
|---|---|---|
| `file` | string | The index of live work tracks — one line per track, with a status and a next step. |
| `log` | string | Where a closed track's outcome is distilled. |
| `specsDir` | string | Where a lane's spec, tasks and handoff live, one directory per lane. |
| `taskFile` | string | The file inside a lane holding its task list, whose checked boxes the task gate reads. |
| `gateTasks` | boolean | Require a checked box in a live lane's task list to carry a proof marker. |

## `queue`

*Turns on: `queue`*

The work queue. State moves only through a passing verification, and CI re-runs every claim.

| Key | Type | What it does |
|---|---|---|
| `file` | string | The queue itself: every item, its state, and the command that verifies it. |
| `timeoutMinutes` | number | A verification that runs longer than this is a failure with a stated cause, not a hang. |
| `terminalByKind` | object | Where an item lands when its verification passes, per kind. |

## `locked`

*Turns on: `locked`*

The files that define or enforce the acceptance signal, which an agent commit may not touch.

| Key | Type | What it does |
|---|---|---|
| `paths` | array of string | Path prefixes. Empty means the check is off. |
| `baseline` | string | File naming the commit from which enforcement applies. |
| `agentTrailer` | string | The commit-message trailer that marks agent authorship. |

## `coldStart`

*Turns on: `cold-start`*

Can a fresh clone install and verify itself using nothing but the repository?

| Key | Type | What it does |
|---|---|---|
| `requiredFiles` | array of string | Files a fresh clone must contain before anything is run — the ones the first command assumes. |
| `entryDocs` | array of string | Documents checked for paths that only resolve on one machine. |
| `commands` | array of string | The documented commands, run inside the fresh clone. |

## `cleanExit`

*Turns on: `clean-exit`*

Clean state at session exit (lecture 12): no debris left behind, and progress written down.

| Key | Type | What it does |
|---|---|---|
| `scan` | array of string | Path prefixes whose changed files are read. Empty means the check is off. |
| `markers` | array or null | Strings that pass a build and mean the work is unfinished. Null uses the defaults. |
| `allow` | array of string | Path fragments exempted — typically the files that name the markers themselves. |
| `progressFile` | string | The file a session must update when it changed code. |
| `codePrefixes` | array of string | What counts as code for the progress rule. Empty means anything that is not Markdown. |
| `progressThreshold` | number | Changed lines below which the progress rule stays quiet, so a one-line fix is not told to write a progress note. Defaults to 50. |
| `requireCleanTree` | boolean | Also fail when the working tree has uncommitted changes. |

## `instructions`

*Turns on: `instructions`*

The instruction file kept a router rather than a manual (lecture 04).

| Key | Type | What it does |
|---|---|---|
| `limits` | object | Path to maximum line count. |

## `release`

*Turns on: `release`*

The version is a claim made on several surfaces: they must agree.

| Key | Type | What it does |
|---|---|---|
| `manifest` | string | Where the version being shipped is declared. Usually package.json. |
| `changelog` | string | The file describing each released version. |
| `tagPrefix` | string | What a tag for x.y.z looks like: "v" gives v1.2.3. |
