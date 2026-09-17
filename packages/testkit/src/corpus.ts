/** Loading and filtering the edge-case corpus. */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Category, CorpusFile, Severity, TestCase, Tier } from "./types.js";
import { SEVERITY_ORDER } from "./types.js";

/**
 * Locate the shipped `corpus/` directory.
 *
 * Resolved relative to this module so it works from `dist/`, from `src/` under
 * a bundler alias, and from a linked workspace.
 */
function corpusRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../corpus"), // dist/ → package root
    resolve(here, "../../corpus"), // src/  → package root
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Could not locate the JapanReady corpus directory. Looked in:\n  ${candidates.join("\n  ")}`,
  );
}

let cache: TestCase[] | null = null;

/** Every case in the corpus, curated and generated, sorted by id. */
export function loadCorpus(): readonly TestCase[] {
  if (cache) return cache;

  const root = corpusRoot();
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const sub = join(root, entry.name);
      for (const f of readdirSync(sub)) {
        if (f.endsWith(".json")) files.push(join(sub, f));
      }
    } else if (entry.name.endsWith(".json")) {
      files.push(join(root, entry.name));
    }
  }

  const all: TestCase[] = [];
  const seen = new Set<string>();
  for (const file of files.sort()) {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as CorpusFile;
    for (const testCase of parsed.cases) {
      if (seen.has(testCase.id)) {
        throw new Error(`Duplicate corpus case id "${testCase.id}" in ${file}`);
      }
      seen.add(testCase.id);
      all.push(testCase);
    }
  }

  all.sort((a, b) => a.id.localeCompare(b.id));
  cache = all;
  return cache;
}

/** Clear the in-process cache. Used by the corpus generator's self-check. */
export function resetCorpusCache(): void {
  cache = null;
}

export interface CorpusFilter {
  readonly categories?: readonly Category[];
  /** Include only cases at this severity or worse. */
  readonly minSeverity?: Severity;
  readonly tiers?: readonly Tier[];
  /** Substring match against id, group, or reason. */
  readonly grep?: string;
}

export function filterCorpus(
  cases: readonly TestCase[],
  filter: CorpusFilter = {},
): readonly TestCase[] {
  const { categories, minSeverity, tiers, grep } = filter;
  const maxRank = minSeverity === undefined ? Infinity : SEVERITY_ORDER[minSeverity];
  const needle = grep?.toLowerCase();

  return cases.filter((c) => {
    if (categories && !categories.includes(c.category)) return false;
    if (tiers && !tiers.includes(c.tier)) return false;
    if (SEVERITY_ORDER[c.severity] > maxRank) return false;
    if (needle !== undefined) {
      const haystack = `${c.id} ${c.group} ${c.reason} ${c.input}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

/** Counts by category, for `japanready corpus --stats`. */
export function corpusStats(cases: readonly TestCase[]): {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byTier: Record<string, number>;
  byOperation: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  const byOperation: Record<string, number> = {};
  for (const c of cases) {
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
    bySeverity[c.severity] = (bySeverity[c.severity] ?? 0) + 1;
    byTier[c.tier] = (byTier[c.tier] ?? 0) + 1;
    byOperation[c.op] = (byOperation[c.op] ?? 0) + 1;
  }
  return { total: cases.length, byCategory, bySeverity, byTier, byOperation };
}
