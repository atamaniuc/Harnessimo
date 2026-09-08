// Not a test with assertions: a file that must compile. It imports the package
// the way a consumer does — through the entry point, values and types together —
// so `npm run typecheck` fails if the published surface loses a type again.
import { checkTarget, verifyProofs, type Problem, type Resolver, type SourceFile } from "../src/index.ts";

const resolver: Resolver = {
  fileExists: () => true,
  readFile: () => "export function searchChunks() {}",
  commandNames: () => ["check"],
  migrationNames: () => null,
};

const files: SourceFile[] = [{ path: "README.md", text: "<!-- proof: src/a.ts -->" }];
const reason: string | null = checkTarget("src/a.ts", resolver);
const problems: Problem[] = verifyProofs(files, resolver);

export const surface = { reason, problems };
