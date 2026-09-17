/**
 * Build the corpus JSON files from the case definitions.
 *
 * Run with `npm run corpus`. The output is committed: the corpus is the
 * product's asset, and it must be reviewable in a diff rather than rebuilt at
 * install time.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCases, type BuiltCase, type CaseSeed, type Category } from "./lib.ts";
import { curatedUnicode, generatedUnicode } from "./cases-unicode.ts";
import { curatedNames, generatedNames } from "./cases-names.ts";
import { curatedAddresses, generatedAddresses } from "./cases-addresses.ts";
import { curatedPhone, generatedPhone } from "./cases-phone.ts";
import { curatedBusiness, generatedBusiness } from "./cases-business.ts";

const VERSION = "0.1.0";
const here = dirname(fileURLToPath(import.meta.url));
const corpusDir = join(here, "..", "corpus");

interface Section {
  category: Category;
  curated: CaseSeed[];
  generated: CaseSeed[];
}

const sections: Section[] = [
  { category: "unicode", curated: curatedUnicode, generated: generatedUnicode() },
  { category: "names", curated: curatedNames, generated: generatedNames() },
  { category: "addresses", curated: curatedAddresses, generated: generatedAddresses() },
  { category: "phone", curated: curatedPhone, generated: generatedPhone() },
  { category: "business", curated: curatedBusiness, generated: generatedBusiness() },
];

function validate(cases: readonly BuiltCase[]): void {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const c of cases) {
    if (ids.has(c.id)) problems.push(`duplicate id ${c.id}`);
    ids.add(c.id);

    const hasExpected = Object.prototype.hasOwnProperty.call(c, "expectedOutput");
    const hasAccept = c.shouldAccept !== undefined;
    if (hasExpected === hasAccept) {
      problems.push(`${c.id}: must declare exactly one of expectedOutput / shouldAccept`);
    }
    if (!c.reason.trim()) problems.push(`${c.id}: empty reason`);
    if (c.reason.length < 15) problems.push(`${c.id}: reason is too short to be useful`);
  }
  if (problems.length > 0) {
    throw new Error(`Corpus validation failed:\n  ${problems.join("\n  ")}`);
  }
}

rmSync(corpusDir, { recursive: true, force: true });
mkdirSync(join(corpusDir, "curated"), { recursive: true });
mkdirSync(join(corpusDir, "generated"), { recursive: true });

let total = 0;
const perCategory: Array<[string, number, number]> = [];

for (const section of sections) {
  // Curated and generated cases are numbered together so that an id is unique
  // across the category regardless of which file it lives in.
  const built = buildCases([...section.curated, ...section.generated]);
  validate(built);

  const curatedIds = new Set(buildCases(section.curated).map((c) => c.id));
  const curated = built.filter((c) => curatedIds.has(c.id));
  const generated = built.filter((c) => !curatedIds.has(c.id));

  for (const [kind, cases] of [
    ["curated", curated],
    ["generated", generated],
  ] as const) {
    if (cases.length === 0) continue;
    const file = join(corpusDir, kind, `${section.category}.json`);
    const payload = {
      version: VERSION,
      category: section.category,
      generated: kind === "generated",
      cases: cases.map((c) => ({ ...c, category: section.category })),
    };
    writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  perCategory.push([section.category, curated.length, generated.length]);
  total += built.length;
}

const width = Math.max(...perCategory.map(([name]) => name.length));
process.stdout.write("\nJapanReady corpus\n\n");
process.stdout.write(
  `  ${"category".padEnd(width)}  ${"curated".padStart(8)}  ${"generated".padStart(9)}  ${"total".padStart(6)}\n`,
);
for (const [name, curated, generated] of perCategory) {
  process.stdout.write(
    `  ${name.padEnd(width)}  ${String(curated).padStart(8)}  ${String(generated).padStart(9)}  ${String(curated + generated).padStart(6)}\n`,
  );
}
process.stdout.write(`\n  ${total} cases written to ${corpusDir}\n\n`);
