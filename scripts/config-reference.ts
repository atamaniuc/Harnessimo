#!/usr/bin/env node
/**
 * Generates docs/CONFIGURATION.md (and its translation) from the JSON schema.
 *
 * The schema already describes every key — it has to, or editors could not
 * complete them. A hand-written reference beside it is a second source of truth
 * that starts drifting the day a key is added, which is the failure this
 * repository keeps shipping patches for. So the page is generated, and
 * `--check` fails when the two have parted company, exactly as the home page
 * does.
 *
 * Translations live in docs/config-reference.<locale>.json: the schema stays
 * one language, and a locale supplies its own wording per key path.
 *
 *   node scripts/config-reference.ts          write the pages
 *   node scripts/config-reference.ts --check  fail if they have drifted
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface SchemaNode {
  /** JSON Schema allows a list — a nullable string is ["string", "null"]. */
  type?: string | string[];
  description?: string;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  enum?: unknown[];
  default?: unknown;
}

const schema = JSON.parse(
  readFileSync(join(ROOT, "schema", "harnessimo.config.schema.json"), "utf8"),
) as SchemaNode;

/** Keys that are JSON plumbing rather than configuration a reader chooses. */
const PLUMBING = new Set(["$schema", "$comment"]);

/** The check a section turns on, so the page answers "and what does it do?". */
const TURNS_ON: Record<string, string> = {
  docs: "proof",
  tracks: "tracks",
  queue: "queue",
  locked: "locked",
  coldStart: "cold-start",
  cleanExit: "clean-exit",
  instructions: "instructions",
  release: "release",
};

interface Locale {
  page: string;
  strings?: string;
  title: string;
  header: string;
  lede: string;
  columns: [string, string, string];
  turnsOn: (check: string) => string;
  optional: string;
}

export const LOCALES: Locale[] = [
  {
    page: "docs/CONFIGURATION.md",
    title: "Configuration",
    header:
      "**Who is this for?** Someone with the tool installed, writing or changing\n" +
      "`harnessimo.config.json`.\n" +
      "**When should I read it?** When you want a key you have not used before. To choose *which*\n" +
      "check to turn on, the [guide's table](GUIDE.md#turn-on) maps symptoms to sections.",
    lede:
      "Every section is optional, and a section that is absent is a check that does not run —\n" +
      "`harnessimo doctor` prints that list, and it is the honest answer to what a repository\n" +
      "enforces.\n\n" +
      "This page is generated from `schema/harnessimo.config.schema.json`. Editing it by hand is\n" +
      "pointless: `npm run docs:sync` regenerates it and a test fails when the two disagree.",
    columns: ["Key", "Type", "What it does"],
    turnsOn: (check) => `Turns on: \`${check}\``,
    optional: "optional",
  },
  {
    page: "docs/CONFIGURATION.ru.md",
    strings: "docs/config-reference.ru.json",
    title: "Конфигурация",
    header:
      "**Кому это?** Тому, у кого инструмент уже стоит и кто пишет или правит\n" +
      "`harnessimo.config.json`.\n" +
      "**Когда читать?** Когда нужен ключ, которым вы ещё не пользовались. Чтобы выбрать, *какую*\n" +
      "проверку включить, есть [таблица в гайде](GUIDE.ru.md#turn-on): симптом → секция.",
    lede:
      "Каждая секция необязательна, а отсутствие секции — это проверка, которая не работает.\n" +
      "`harnessimo doctor` печатает этот список, и он и есть честный ответ на вопрос, что\n" +
      "репозиторий гарантирует.\n\n" +
      "Страница генерируется из `schema/harnessimo.config.schema.json`. Править её руками\n" +
      "бессмысленно: `npm run docs:sync` перезапишет, а тест упадёт на расхождении.",
    columns: ["Ключ", "Тип", "Что делает"],
    turnsOn: (check) => `Включает: \`${check}\``,
    optional: "необязательно",
  },
];

/** A schema type as a reader reads it, not as JSON Schema spells it. */
function typeOf(node: SchemaNode): string {
  if (node.enum) return node.enum.map((v) => `\`${JSON.stringify(v)}\``).join(" \\| ");
  if (node.type === "array") return `array of ${String(node.items?.type ?? "value")}`;
  // A schema spells a nullable string as a list; a reader reads "string or null".
  return (Array.isArray(node.type) ? node.type : [node.type ?? "any"]).join(" or ");
}

export function configReference(locale: Locale, strings: Record<string, string> = {}): string {
  const say = (path: string, fallback = ""): string => strings[path] ?? fallback;
  const out: string[] = [
    `# ${locale.title}`,
    "",
    locale.header,
    "",
    "---",
    "",
    locale.lede,
    "",
  ];

  for (const [section, node] of Object.entries(schema.properties ?? {})) {
    if (PLUMBING.has(section)) continue;
    out.push(`## \`${section}\``, "");
    const check = TURNS_ON[section];
    if (check) out.push(`*${locale.turnsOn(check)}*`, "");
    out.push(say(section, node.description ?? ""), "");

    const keys = Object.entries(node.properties ?? {}).filter(([key]) => !PLUMBING.has(key));
    if (keys.length === 0) continue;
    out.push(`| ${locale.columns.join(" | ")} |`, "|---|---|---|");
    for (const [key, child] of keys) {
      const described = say(`${section}.${key}`, child.description ?? "").replace(/\n/g, " ");
      out.push(`| \`${key}\` | ${typeOf(child)} | ${described} |`);
    }
    out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Every key path the pages must describe, so a translation cannot fall behind. */
export function keyPaths(): string[] {
  const paths: string[] = [];
  for (const [section, node] of Object.entries(schema.properties ?? {})) {
    if (PLUMBING.has(section)) continue;
    paths.push(section);
    for (const key of Object.keys(node.properties ?? {})) {
      if (!PLUMBING.has(key)) paths.push(`${section}.${key}`);
    }
  }
  return paths;
}

export function render(locale: Locale): string {
  const strings = locale.strings
    ? (JSON.parse(readFileSync(join(ROOT, locale.strings), "utf8")) as Record<string, string>)
    : {};
  return configReference(locale, strings);
}

function main(): void {
  const check = process.argv.includes("--check");
  let drifted = false;
  for (const locale of LOCALES) {
    const wanted = render(locale);
    const path = join(ROOT, locale.page);
    if (check) {
      const current = readFileSync(path, "utf8");
      if (current === wanted) {
        console.log(`${locale.page} matches the schema`);
      } else {
        console.error(`${locale.page} has drifted from the schema — run \`npm run docs:sync\``);
        drifted = true;
      }
    } else {
      writeFileSync(path, wanted);
      console.log(`wrote ${locale.page} from the schema`);
    }
  }
  if (drifted) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
