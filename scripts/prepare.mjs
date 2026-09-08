// `prepare` runs in two situations, and only one of them wants a build.
//
//   - a consumer installing this package from a git tag: there is no dist/ yet,
//     TypeScript is present because the package manager installed
//     devDependencies for exactly this, and without a build every import fails;
//   - a contributor running `npm install` in a clone: same thing, cheap.
//
// It must not fail when TypeScript is absent — a consumer who installed with
// --omit=dev and already has dist/ would otherwise be broken by a hook meant to
// help them. So: build when the compiler is there, say why when it is not.
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const compiler = "node_modules/.bin/tsc";
if (!existsSync(compiler)) {
  if (!existsSync("dist")) {
    console.error(
      "harnessimo: no TypeScript and no dist/ — install devDependencies, or install from a published tag",
    );
  }
  process.exit(0);
}
execFileSync(compiler, ["-p", "tsconfig.build.json"], { stdio: "inherit" });
