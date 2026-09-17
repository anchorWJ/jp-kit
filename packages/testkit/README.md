# @japanready/testkit

The Japan compatibility corpus, a runner that replays it through your own code,
and the `japanready` CLI.

```bash
npm install --save-dev @japanready/testkit
npx japanready init
npx japanready test
```

## The adapter

You do not rewrite anything. You point each operation at a function your product
already has.

```ts
// japanready.config.ts
import type { JapanReadyAdapter } from "@japanready/testkit";

const adapter: JapanReadyAdapter = {
  name: "acme-crm",
  normalizeText: (input) => myNormalize(input),
  validateName: (input) => myNameSchema.safeParse(input).success,
  normalizePhone: (input) => myPhone.toE164(input),
  normalizePostalCode: (input) => myPostal.normalize(input),
  validateCorporateNumber: (input) => myTax.isCorporateNumber(input),
};

export default adapter;
```

Every member is optional. An operation you omit is reported as **uncovered**,
not failed — a product that never stores a Corporate Number should not be marked
down for not validating one. Start with the two or three fields you actually
hold.

The full list: `normalizeText`, `foldVariants`, `normalizeName`, `splitName`,
`formatName`, `nameKey`, `validateName`, `validateKanaReading`,
`normalizePostalCode`, `validatePostalCode`, `parseAddress`, `formatAddress`,
`normalizePhone`, `formatPhoneNational`, `validatePhone`,
`validateCorporateNumber`, `validateInvoiceNumber`, `normalizeCompanyName`,
`companyNameKey`.

A config may also export `{ adapter }`, or a function returning either — useful
when you need to boot something first.

## In your test suite

```ts
// japanready.test.ts
import { testJapanCompatibility } from "@japanready/testkit/vitest";
import adapter from "./japanready.config.js";

testJapanCompatibility(adapter);
```

`@japanready/testkit/jest` is identical, for Jest. Options:

```ts
testJapanCompatibility(adapter, {
  categories: ["phone", "business"],
  minSeverity: "high",
  unimplemented: "fail",   // "skip" (default) | "ignore" | "fail"
  groupBy: "group",        // "category" (default) | "group"
});
```

Each case becomes one test. A failure carries the input with invisible
characters revealed, the expected value, why the case exists, the fix, and a
source where there is an authority to cite.

## In CI

```yaml
- run: npx japanready test --fail-on critical
```

Exit codes: `0` clean, `1` failures at the threshold, `2` a configuration error.

```bash
npx japanready test --format markdown >> "$GITHUB_STEP_SUMMARY"
npx japanready test --format json --out japanready.json   # track a score over releases
```

## Programmatic use

```ts
import { runCompatibility, renderReport, loadCorpus } from "@japanready/testkit";

const summary = runCompatibility(adapter, { categories: ["addresses"] });
console.log(renderReport(summary));

if (summary.totals.criticalIssues > 0) process.exit(1);
```

`loadCorpus`, `filterCorpus`, and `corpusStats` expose the corpus directly if
you want to drive it yourself. `visualize` renders a string with zero-width
characters, ideographic spaces, variation selectors, and combining marks made
visible — most of this corpus is about characters you cannot see, so
`expected "田中太郎", got "田中太郎"` helps nobody.

## Expectation matching

A case declares either `expectedOutput` (a transform) or `shouldAccept` (a
validator), never both.

Objects are compared as a **subset**: only the keys the corpus specifies are
checked, so an adapter returning a richer parse result still passes. An explicit
`undefined` in an expectation means the key must be absent.

## The corpus

1,187 cases. `corpus/curated/` is hand-written with hand-derived expectations.
`corpus/generated/` is systematic coverage whose expectations come from an
independent source — the engine's Unicode tables, the published variant table, a
second implementation of the National Tax Agency check-digit formula — never
from the code under test.

Regenerate with `npm run corpus`. The output is committed on purpose: the corpus
is the asset, and it should be reviewable in a diff rather than rebuilt at
install time. CI fails if regenerating produces a diff, and fails if the bundled
reference implementation drops below 100%.

Case ids are `category.group.NNNN`, scoped per group so that adding a case never
renumbers another. Ids appear in CI output and in suppression lists, so they do
not churn.

## Licence

MIT.
