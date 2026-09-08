// A workflow that runs a check but starves it of the evidence it reads is a
// red build with nothing wrong in the code. This happened twice: the release
// check reads git tags, and `actions/checkout` fetches none by default, so
// every job that runs `check` needs `fetch-depth: 0` — a requirement nobody
// remembers job by job. So it is a test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOWS = join(ROOT, ".github", "workflows");

/** The jobs in one workflow file, split on the two-space job key. */
function jobs(yaml: string): { name: string; body: string }[] {
  const found: { name: string; body: string }[] = [];
  const lines = yaml.split("\n");
  let start = -1;
  let name = "";
  const flush = (end: number) => {
    if (start >= 0) found.push({ name, body: lines.slice(start, end).join("\n") });
  };
  for (const [i, line] of lines.entries()) {
    const head = /^ {2}([\w-]+):\s*$/.exec(line!);
    if (head && lines.slice(i + 1, i + 12).some((l) => /^ {4}(runs-on|steps|uses):/.test(l))) {
      flush(i);
      start = i;
      name = head[1]!;
    }
  }
  flush(lines.length);
  return found;
}

const files = readdirSync(WORKFLOWS).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

test("there are workflows to check", () => {
  assert.ok(files.length > 0, "no workflow files found");
});

for (const file of files) {
  const yaml = readFileSync(join(WORKFLOWS, file), "utf8");
  for (const job of jobs(yaml)) {
    // `check` runs every enabled rule, release among them. `doctor`, `locked`
    // and the rest read their own inputs and are not this test's business.
    if (!/\bcli\.(ts|js) check\b/.test(job.body)) continue;
    test(`${file}: the ${job.name} job fetches the tags its checks read`, () => {
      assert.match(
        job.body,
        /fetch-depth:\s*0/,
        `${job.name} runs \`check\`, so its checkout needs fetch-depth: 0 — without tags the release check reports that it cannot see them`,
      );
    });
  }
}
