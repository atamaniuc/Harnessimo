// dist/ is committed, because that is the only way a git install works in every
// package manager: npm runs `prepare`, pnpm 10 refuses to run a dependency's
// scripts at all, and yarn 1 does not build git dependencies. Both were tried;
// both left the consumer with a package that had no JavaScript in it.
//
// A committed build is a claim that it matches the source, so it gets a check
// like every other claim here: rebuild, and fail if anything moved.
import { execFileSync } from "node:child_process";

execFileSync("node_modules/.bin/tsc", ["-p", "tsconfig.build.json"], { stdio: "inherit" });
const changed = execFileSync("git", ["status", "--porcelain", "dist"], { encoding: "utf8" }).trim();
if (changed) {
  console.error(
    "dist/ does not match the source it was built from:\n" +
      changed +
      "\n  fix:  npm run build, and commit dist/ with the change that caused it",
  );
  process.exit(1);
}
console.log("dist: matches the source it was built from");
