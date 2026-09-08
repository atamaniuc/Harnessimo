import { test } from "node:test";
import assert from "node:assert/strict";
import { changelogVersions, releaseProblems } from "../src/release.ts";

const CHANGELOG = `# Changelog

## [0.3.0] — 2026-09-08

### Added
- a thing

## [0.2.0] — 2026-09-07

### Fixed
- another thing
`;

test("versions are read newest first", () => {
  assert.deepEqual(changelogVersions(CHANGELOG), ["0.3.0", "0.2.0"]);
});

test("agreement is silence", () => {
  const problems = releaseProblems({
    version: "0.3.0",
    changelog: CHANGELOG,
    tags: ["v0.1.0", "v0.2.0"],
  });
  assert.deepEqual(problems, []);
});

test("a version nobody wrote down fails", () => {
  const problems = releaseProblems({ version: "0.4.0", changelog: CHANGELOG, tags: ["v0.2.0"] });
  assert.equal(problems.length, 2); // undocumented, and 0.3.0 documented without a tag
  assert.match(problems[0]!.reason, /does not mention it/);
});

test("an entry that is not at the top fails, because the top is what ships", () => {
  const problems = releaseProblems({ version: "0.2.0", changelog: CHANGELOG, tags: ["v0.2.0"] });
  assert.match(problems[0]!.reason, /newest changelog entry is 0\.3\.0/);
});

test("a released version with no tag fails — the drift this exists for", () => {
  const problems = releaseProblems({ version: "0.3.0", changelog: CHANGELOG, tags: ["v0.1.0"] });
  assert.equal(problems.length, 1);
  assert.match(problems[0]!.reason, /0\.2\.0 is described as released and has no v0\.2\.0 tag/);
});

test("a tag older than the changelog is not a failure", () => {
  // Changelogs start somewhere. A rule that fires on every repository's early
  // history is a rule people turn off, and a turned-off rule enforces nothing.
  const problems = releaseProblems({
    version: "0.3.0",
    changelog: CHANGELOG,
    tags: ["v0.0.9", "v0.1.0", "v0.2.0"],
  });
  assert.deepEqual(problems, []);
});

test("the tag prefix is configuration, not an assumption", () => {
  const problems = releaseProblems({
    version: "0.3.0",
    changelog: CHANGELOG,
    tags: ["release-0.2.0"],
    tagPrefix: "release-",
  });
  assert.deepEqual(problems, []);
});

test("a checkout with no tags says so once, instead of blaming every version", () => {
  // The failure this was written for: CI checks out shallow, the tags are not
  // there, and eight versions look unreleased. A check that misreports its own
  // blindness teaches people to ignore it.
  const problems = releaseProblems({ version: "0.3.0", changelog: CHANGELOG, tags: [] });
  assert.equal(problems.length, 1);
  assert.match(problems[0]!.reason, /has no tags/);
  assert.match(problems[0]!.reason, /fetch-depth: 0/);
});
