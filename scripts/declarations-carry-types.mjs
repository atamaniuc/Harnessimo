// A public export typed `any` is a declaration that promises nothing.
//
// The package ships .mjs plus a hand-written types/index.d.ts, which means two
// files describe the same functions. They had already drifted: half the queue
// exports were `any` in the JSDoc while the declarations named real types, and
// progressProblems disagreed with itself about whether progressFile may be null.
// Nothing caught that, because tests check behaviour and tsc --checkJs is happy
// to infer `any`.
//
// So this asks TypeScript what the JSDoc actually declares — by emitting
// declarations from it — and fails when a public signature says `any`. It runs
// as part of `npm run typecheck`, which is the one command that may install
// devDependencies.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const out = mkdtempSync(join(tmpdir(), "harnessimo-decl-"));
execFileSync(
  join("node_modules", ".bin", "tsc"),
  ["--allowJs", "--declaration", "--emitDeclarationOnly", "--outDir", out,
   "--target", "es2023", "--module", "nodenext", "--moduleResolution", "nodenext",
   ...readdirSync("src").filter((f) => f.endsWith(".mjs")).map((f) => join("src", f))],
  { stdio: "inherit" },
);

const offenders = [];
for (const file of readdirSync(out).filter((f) => f.endsWith(".d.mts"))) {
  readFileSync(join(out, file), "utf8")
    .split("\n")
    .filter((line) => /^export (declare )?function/.test(line) && /:\s*any\b/.test(line))
    .forEach((line) => offenders.push(`  ${file.replace(".d.mts", ".mjs")}  ${line.trim()}`));
}

if (offenders.length > 0) {
  console.error("public exports whose declared type is `any`:\n" + offenders.join("\n"));
  console.error("\n  fix:  annotate the parameter in its JSDoc, so consumers compile against a real type");
  process.exit(1);
}
console.log(`declarations: every public export in ${readdirSync("src").length} module(s) carries a real type`);
