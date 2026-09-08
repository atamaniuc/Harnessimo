// The demo on the front page is recorded, not written.
//
// A hand-drawn terminal screenshot is a claim about what the tool prints, and
// this project's whole argument is that claims should be checked. So this runs
// the commands in a throwaway repository, captures what they actually print,
// and renders that twice: an asciinema cast the documentation site plays, and
// an SVG that GitHub and npm can show — neither of which can run a player.
//
// Regenerate with `npm run demo`. If the output changes the recording changes
// with it, because there is nothing here to keep in sync by hand.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "src", "cli.ts");
/** The terminal escape, spelled rather than typed: a raw one in source is invisible. */
const ESC = String.fromCharCode(27);

interface Frame {
  /** What a viewer sees typed at the prompt. */
  command: string;
  /** What running it actually printed. */
  output: string;
}

function run(cwd: string, ...argv: string[]): string {
  try {
    return execFileSync(process.execPath, [CLI, ...argv], { cwd, encoding: "utf8" });
  } catch (caught) {
    const error = caught as { stdout?: string; stderr?: string };
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
}

/** A small repository, realistic enough for the checks to say something. */
function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "harnessimo-demo-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "checkout", scripts: { test: "node --test" } }, null, 2) + "\n",
  );
  writeFileSync(join(dir, "src", "totals.ts"), "export function orderTotal() {}\n");
  writeFileSync(
    join(dir, "README.md"),
    "# checkout\n\n" +
      "Totals round per currency, not per line. <!-- proof: src/totals.ts:orderTotal -->\n" +
      "Check it with `npm run test`. <!-- proof: npm run test -->\n",
  );
  return dir;
}

const dir = fixture();
const frames: Frame[] = [];
try {
  frames.push({ command: "harnessimo init", output: run(dir, "init") });
  frames.push({ command: "harnessimo check", output: run(dir, "check") });
  // The point of the tool in one frame: a claim outliving its evidence.
  writeFileSync(join(dir, "src", "totals.ts"), "export function total() {}\n");
  frames.push({ command: "# someone renames the function the README points at", output: "" });
  frames.push({ command: "harnessimo check", output: run(dir, "check") });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------- asciinema

function cast(frames: Frame[]): string {
  const header = {
    version: 2,
    width: 92,
    height: 26,
    title: "harnessimo",
    env: { SHELL: "/bin/sh", TERM: "xterm-256color" },
  };
  const events: string[] = [];
  let t = 0.4;
  const emit = (text: string): void => {
    events.push(JSON.stringify([Number(t.toFixed(3)), "o", text]));
  };
  const prompt = ESC + "[38;5;42m$" + ESC + "[0m ";
  for (const frame of frames) {
    emit(prompt);
    // Typed a character at a time: a demo that pastes reads as a slide.
    for (const ch of frame.command) {
      t += 0.045;
      emit(ch);
    }
    t += 0.35;
    emit("\r\n");
    if (frame.output) {
      t += 0.25;
      emit(frame.output.replace(/\n/g, "\r\n"));
    }
    t += 1.1;
  }
  emit(prompt);
  return [JSON.stringify(header), ...events].join("\n") + "\n";
}

// ---------------------------------------------------------------- svg

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const escape = (s: string): string => s.replace(/[&<>]/g, (c) => ESCAPES[c]!);

/**
 * The still frame keeps every command and trims long output, rather than
 * dropping lines from the middle — a screenshot that loses the command it was
 * showing the answer to explains nothing.
 */
function still(frames: Frame[]): { text: string; kind: string }[] {
  const KEEP = 4;
  const lines: { text: string; kind: string }[] = [];
  for (const frame of frames) {
    lines.push({ text: frame.command, kind: frame.command.startsWith("#") ? "comment" : "prompt" });
    const output = frame.output.split("\n").filter((line) => line.trim() !== "");
    // A frame that failed is trimmed from the front: the failure is the point,
    // and a screenshot that cuts it off is showing the wrong half.
    const failed = output.some((line) => line.includes("FAIL"));
    // Trimming a single line saves nothing and costs a line saying so.
    const long = output.length > KEEP + 2;
    const shown = !long ? output : failed ? output.slice(-(KEEP + 3)) : output.slice(0, KEEP);
    const hiddenBefore = long && failed ? output.length - shown.length : 0;
    if (hiddenBefore > 1) {
      lines.push({ text: `  … ${hiddenBefore} earlier lines`, kind: "comment" });
    }
    for (const line of shown) {
      const kind = /^\s*(FAIL|harnessimo: \d)/.test(line)
        ? "bad"
        : /(^|\s)ok\s|passes\.$/.test(line)
          ? "good"
          : "out";
      lines.push({ text: line, kind });
    }
    const hiddenAfter = shown.length < output.length && !failed ? output.length - shown.length : 0;
    if (hiddenAfter > 1) {
      lines.push({ text: `  … ${hiddenAfter} more lines`, kind: "comment" });
    }
    lines.push({ text: "", kind: "out" });
  }
  return lines;
}

function svg(frames: Frame[]): string {
  const lines = still(frames);
  const pad = 22;
  const lineHeight = 19;
  const width = 860;
  const height = pad * 2 + 26 + lines.length * lineHeight;
  const body = lines
    .map((line, i) => {
      const y = pad + 44 + i * lineHeight;
      const prefix = line.kind === "prompt" ? '<tspan class="sigil">$ </tspan>' : "";
      return `    <text x="${pad}" y="${y}" class="${line.kind}">${prefix}${escape(line.text)}</text>`;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="A terminal running harnessimo init, then check, then check again after a rename breaks a documented claim">
  <style>
    text { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; white-space: pre; }
    .prompt { fill: #e6e9ef; }
    .sigil { fill: #4ade80; }
    .out { fill: #9aa4b2; }
    .good { fill: #4ade80; }
    .bad { fill: #f87171; }
    .comment { fill: #6b7484; font-style: italic; }
  </style>
  <rect width="${width}" height="${height}" rx="10" fill="#14171c"/>
  <circle cx="24" cy="22" r="5" fill="#f87171"/>
  <circle cx="42" cy="22" r="5" fill="#fbbf24"/>
  <circle cx="60" cy="22" r="5" fill="#4ade80"/>
  <text x="${width / 2}" y="26" text-anchor="middle" class="comment">harnessimo</text>
${body}
</svg>
`;
}

const assets = join(ROOT, "docs", "assets");
mkdirSync(assets, { recursive: true });
writeFileSync(join(assets, "demo.cast"), cast(frames));
const image = svg(frames);
writeFileSync(join(assets, "demo.svg"), image);

// npmjs.com does not render SVG in a README, and npm is where a stranger meets
// this project. So the same frame is rasterised — by a browser, because there
// is no image library here and there is not going to be one.
const height = Number(/height="(\d+)"/.exec(image)?.[1] ?? 600);
const chromium = [
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  process.env.CHROMIUM_PATH ?? "",
].find((candidate) => candidate && existsSync(candidate));
if (chromium) {
  execFileSync(chromium, [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    `--window-size=860,${height}`,
    `--screenshot=${join(assets, "demo.png")}`,
    `file://${join(assets, "demo.svg")}`,
  ], { stdio: "ignore" });
} else {
  console.warn("no chromium found: demo.png was left as it was (set CHROMIUM_PATH to refresh it)");
}

console.log(
  `recorded ${frames.length} frames of real output -> ${["demo.cast", "demo.svg", "demo.png"].join(", ")}`,
);
