#!/usr/bin/env node
/** The `japanready` command. */

import { writeFileSync } from "node:fs";
import { referenceAdapter } from "@japanready/core";
import { corpusStats, filterCorpus, loadCorpus } from "./corpus.js";
import { runCompatibility } from "./runner.js";
import { renderJson, renderMarkdown, renderReport } from "./report.js";
import { STARTER_CONFIG, findConfig, loadAdapter } from "./config.js";
import { CATEGORIES, SEVERITY_ORDER, type Category, type Severity, type Tier } from "./types.js";

const USAGE = `
japanready — Japan compatibility testing

Usage
  japanready test [options]      Run the corpus against your adapter
  japanready corpus [options]    Show what is in the corpus
  japanready init                Write a starter japanready.config.ts

Options
  -c, --config <path>    Path to the config exporting your adapter
      --reference        Score the bundled reference implementation instead
      --category <list>  Comma-separated: ${CATEGORIES.join(",")}
      --severity <level> Only cases at this severity or worse: critical,high,medium,low
      --tier <list>      Comma-separated: free,pro
  -g, --grep <text>      Only cases whose id, group, reason, or input matches
      --max-failures <n> How many failures to detail (default 10, 0 for none)
      --format <fmt>     text (default), json, or markdown
  -o, --out <path>       Write the report to a file instead of stdout
      --fail-on <level>  Exit non-zero on: critical (default), any, never
      --no-color         Disable ANSI colour
  -h, --help             Show this message

Examples
  japanready test
  japanready test --reference
  japanready test --category phone,business --severity high
  japanready test --format markdown --out japanready-report.md
  japanready corpus --category unicode
`;

interface Args {
  command: string;
  config?: string;
  reference: boolean;
  categories?: Category[];
  severity?: Severity;
  tiers?: Tier[];
  grep?: string;
  maxFailures: number;
  format: "text" | "json" | "markdown";
  out?: string;
  failOn: "critical" | "any" | "never";
  color?: boolean;
  help: boolean;
}

function fail(message: string): never {
  process.stderr.write(`\njapanready: ${message}\n`);
  process.exit(2);
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    command: "test",
    reference: false,
    maxFailures: 10,
    format: "text",
    failOn: "critical",
    help: false,
  };

  const rest = [...argv];
  if (rest[0] !== undefined && !rest[0].startsWith("-")) {
    args.command = rest.shift()!;
  }

  const next = (flag: string): string => {
    const value = rest.shift();
    if (value === undefined) fail(`${flag} requires a value`);
    return value;
  };

  while (rest.length > 0) {
    const flag = rest.shift()!;
    switch (flag) {
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "-c":
      case "--config":
        args.config = next(flag);
        break;
      case "--reference":
        args.reference = true;
        break;
      case "--category": {
        const values = next(flag).split(",").map((s) => s.trim());
        for (const value of values) {
          if (!CATEGORIES.includes(value as Category)) {
            fail(`unknown category "${value}". Expected one of ${CATEGORIES.join(", ")}`);
          }
        }
        args.categories = values as Category[];
        break;
      }
      case "--severity": {
        const value = next(flag).trim();
        if (!(value in SEVERITY_ORDER)) {
          fail(`unknown severity "${value}". Expected critical, high, medium, or low`);
        }
        args.severity = value as Severity;
        break;
      }
      case "--tier": {
        const values = next(flag).split(",").map((s) => s.trim());
        for (const value of values) {
          if (value !== "free" && value !== "pro") fail(`unknown tier "${value}"`);
        }
        args.tiers = values as Tier[];
        break;
      }
      case "-g":
      case "--grep":
        args.grep = next(flag);
        break;
      case "--max-failures": {
        const value = Number(next(flag));
        if (!Number.isInteger(value) || value < 0) fail("--max-failures expects a non-negative integer");
        args.maxFailures = value;
        break;
      }
      case "--format": {
        const value = next(flag);
        if (value !== "text" && value !== "json" && value !== "markdown") {
          fail(`unknown format "${value}". Expected text, json, or markdown`);
        }
        args.format = value;
        break;
      }
      case "--json":
        args.format = "json";
        break;
      case "-o":
      case "--out":
        args.out = next(flag);
        break;
      case "--fail-on": {
        const value = next(flag);
        if (value !== "critical" && value !== "any" && value !== "never") {
          fail(`unknown --fail-on "${value}". Expected critical, any, or never`);
        }
        args.failOn = value;
        break;
      }
      case "--no-color":
        args.color = false;
        break;
      case "--color":
        args.color = true;
        break;
      default:
        fail(`unknown option "${flag}". Run japanready --help`);
    }
  }

  return args;
}

async function commandTest(args: Args): Promise<number> {
  const { adapter, path } = args.reference
    ? { adapter: referenceAdapter, path: "(bundled reference)" }
    : await loadAdapter(args.config);

  const summary = runCompatibility(adapter, {
    ...(args.categories ? { categories: args.categories } : {}),
    ...(args.severity ? { minSeverity: args.severity } : {}),
    ...(args.tiers ? { tiers: args.tiers } : {}),
    ...(args.grep !== undefined ? { grep: args.grep } : {}),
  });

  if (summary.totals.cases === 0) {
    process.stderr.write("\njapanready: no cases matched the given filters.\n");
    return 2;
  }

  const output =
    args.format === "json"
      ? renderJson(summary)
      : args.format === "markdown"
        ? renderMarkdown(summary)
        : renderReport(summary, {
            ...(args.color !== undefined ? { color: args.color } : {}),
            maxFailures: args.maxFailures,
          });

  if (args.out) {
    writeFileSync(args.out, output.endsWith("\n") ? output : `${output}\n`, "utf8");
    process.stdout.write(`\nReport written to ${args.out}\n`);
  } else {
    process.stdout.write(`${output}\n`);
  }

  if (!args.reference && args.format === "text" && !args.out) {
    process.stdout.write(`  config: ${path}\n\n`);
  }

  if (args.failOn === "never") return 0;
  if (args.failOn === "any") return summary.totals.failed > 0 ? 1 : 0;
  return summary.totals.criticalIssues > 0 ? 1 : 0;
}

function commandCorpus(args: Args): number {
  const cases = filterCorpus(loadCorpus(), {
    ...(args.categories ? { categories: args.categories } : {}),
    ...(args.severity ? { minSeverity: args.severity } : {}),
    ...(args.tiers ? { tiers: args.tiers } : {}),
    ...(args.grep !== undefined ? { grep: args.grep } : {}),
  });
  const stats = corpusStats(cases);

  if (args.format === "json") {
    process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
    return 0;
  }

  const table = (title: string, record: Record<string, number>) => {
    const width = Math.max(...Object.keys(record).map((k) => k.length), title.length);
    const lines = [`  ${title}`];
    for (const [key, count] of Object.entries(record).sort((a, b) => b[1] - a[1])) {
      lines.push(`    ${key.padEnd(width)}  ${String(count).padStart(5)}`);
    }
    return lines.join("\n");
  };

  process.stdout.write(
    [
      "",
      `JapanReady corpus — ${stats.total} cases`,
      "",
      table("by category", stats.byCategory),
      "",
      table("by severity", stats.bySeverity),
      "",
      table("by tier", stats.byTier),
      "",
      table("by operation", stats.byOperation),
      "",
      "",
    ].join("\n"),
  );
  return 0;
}

function commandInit(): number {
  const existing = findConfig();
  if (existing) {
    process.stderr.write(`\njapanready: ${existing} already exists.\n\n`);
    return 1;
  }
  writeFileSync("japanready.config.ts", STARTER_CONFIG, "utf8");
  process.stdout.write(
    "\nWrote japanready.config.ts.\n\n" +
      "Fill in the operations your product implements, then run `npx japanready test`.\n\n",
  );
  return 0;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }

  let code: number;
  switch (args.command) {
    case "test":
      code = await commandTest(args);
      break;
    case "corpus":
      code = commandCorpus(args);
      break;
    case "init":
      code = commandInit();
      break;
    default:
      fail(`unknown command "${args.command}". Run japanready --help`);
  }
  process.exit(code);
}

main().catch((error: unknown) => {
  process.stderr.write(`\njapanready: ${error instanceof Error ? error.message : String(error)}\n\n`);
  process.exit(2);
});
