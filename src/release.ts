// A version is a claim, and it is made on more surfaces than any other claim a
// project makes: the manifest, the changelog, the git tags, the registry, a
// badge in the README. They agree right up until one of them is updated by a
// path that skips the others — and then the repository says one thing and the
// place people install from says another.
//
// This repository produced that failure while writing the tool that exists to
// prevent it: three versions were published to npm through a manual workflow
// run, so the tags stopped at v0.4.1 while the registry served 0.4.4. Nothing
// was checking, because nothing here checked versions.
//
// So: the surfaces the repository controls must agree. The registry is not one
// of them — it is checked by the release flow being the only way to publish.
import type { Problem } from "./types.ts";

/** Versions a changelog documents, newest first, as `## [x.y.z]` headings. */
export function changelogVersions(text: string): string[] {
  return [...text.matchAll(/^##\s+\[(\d+\.\d+\.\d+[^\]]*)\]/gm)].map((m) => m[1]!);
}

/**
 * Do the version claims agree? Pure: the caller reads the manifest, the
 * changelog and the tag list, which is what makes this testable without a
 * repository.
 */
export function releaseProblems(
  {
    version,
    changelog,
    tags,
    manifestPath = "package.json",
    changelogPath = "CHANGELOG.md",
    tagPrefix = "v",
  }: {
    version: string;
    changelog: string;
    tags: string[];
    manifestPath?: string;
    changelogPath?: string;
    tagPrefix?: string;
  },
): Problem[] {
  const problems: Problem[] = [];
  const documented = changelogVersions(changelog);

  // No tags at all is almost never a repository with no releases: it is a
  // shallow checkout that did not fetch them, which is the default in CI. One
  // problem naming that beats one per version blaming the changelog — a check
  // that misreports its own blindness is worse than one that stays quiet.
  if (tags.length === 0 && documented.length > 1) {
    return [
      {
        file: changelogPath,
        line: 1,
        target: "(no tags)",
        reason:
          "this checkout has no tags, so whether the released versions are tagged cannot be checked\n" +
          "  fix:  fetch tags — actions/checkout needs fetch-depth: 0",
      },
    ];
  }
  const tagged = new Set(
    tags.filter((tag) => tag.startsWith(tagPrefix)).map((tag) => tag.slice(tagPrefix.length)),
  );

  if (!documented.includes(version)) {
    problems.push({
      file: changelogPath,
      line: 1,
      target: version,
      reason:
        `${manifestPath} says ${version} and the changelog does not mention it\n` +
        `  fix:  write down what changed before shipping it`,
    });
  } else if (documented[0] !== version) {
    problems.push({
      file: changelogPath,
      line: 1,
      target: documented[0] ?? "(none)",
      reason:
        `the newest changelog entry is ${documented[0]}, but ${manifestPath} says ${version}\n` +
        `  fix:  the entry being worked on belongs at the top`,
    });
  }

  // The failure this was written for: a version that exists somewhere people
  // can install from, and nowhere in the repository's own history.
  for (const documentedVersion of documented) {
    if (documentedVersion === version) continue; // not released yet — that is what releasing is for
    if (!tagged.has(documentedVersion)) {
      problems.push({
        file: changelogPath,
        line: 1,
        target: `${tagPrefix}${documentedVersion}`,
        reason:
          `${documentedVersion} is described as released and has no ${tagPrefix}${documentedVersion} tag\n` +
          `  why:  a version published outside the release flow leaves the repository behind\n` +
          `  fix:  cut the release, or remove the entry if it never shipped`,
      });
    }
  }

  // The other direction — a tag the changelog does not describe — is
  // deliberately not a failure. Changelogs start somewhere, older tags predate
  // them, and a rule that fires on every repository's early history is a rule
  // people turn off.

  return problems;
}
