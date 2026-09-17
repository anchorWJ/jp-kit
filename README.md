# JapanReady Test Kit

**Your software says it supports Japan. JapanReady proves it.**

A compatibility test suite for Japanese customer data. It replays a curated
corpus of edge cases — names, addresses, Unicode, phone numbers, and the two
national business identifiers — through *your* product's own normalization and
validation code, and reports what a Japanese customer would actually hit.

This is the Phase 1 MVP: TypeScript only, no dashboard, no API server.

```text
JapanReady Compatibility Report
  adapter: naive-app (a typical Western implementation)

  Names            80% ████████████████░░░░  110/138 (+11 skipped)
  Addresses        35% ███████░░░░░░░░░░░░░  57/161
  Unicode          96% ███████████████████░  192/200 (+210 skipped)
  Phone Numbers    37% ███████░░░░░░░░░░░░░  56/153
  Business IDs     65% █████████████░░░░░░░  203/314

  Critical Issues:    203
  Warnings:           145
  Passed Tests:       618
  Failed Tests:       348
  Skipped Tests:      221
```

That report is real output, from `npm run demo:naive`, against a deliberately
ordinary Western implementation: a `trim()`, an `NFKC`, a `[\p{L}\s'-]` name
rule, a 3-3-4 phone regex, a postal code that passes through `Number()`, and a
length check standing in for a checksum. None of it is strawman code.

---

## Quick start

```bash
npm install
npm run build
npm run demo          # score the reference implementation — 100%
npm run demo:naive    # score a typical Western implementation
npm test              # 165 unit tests across both packages
```

To point it at your own product:

```bash
npx japanready init      # writes japanready.config.ts
npx japanready test
```

---

## Packages

| Package | What it is |
| --- | --- |
| [`@japanready/core`](packages/core) | The primitives: Unicode and kana folding, kanji variant folding, name handling, address parsing, phone numbers, Corporate Number, Invoice Registration Number, and the canonical customer schema. Also the reference adapter. |
| [`@japanready/testkit`](packages/testkit) | The edge-case corpus, the runner, Jest/Vitest bindings, and the `japanready` CLI. |

The split follows the open-source-as-distribution model: `core` is a useful
library on its own, and the corpus is the asset.

---

## How a test run works

You write an adapter that points each operation at code you already have.
Nothing is rewritten, and nothing is instrumented.

```ts
// japanready.config.ts
import type { JapanReadyAdapter } from "@japanready/testkit";
import { normalizeCustomerText, phoneToE164, nameSchema } from "./src/lib";

const adapter: JapanReadyAdapter = {
  name: "acme-crm",
  normalizeText: (input) => normalizeCustomerText(input),
  normalizePhone: (input) => phoneToE164(input),
  validateName: (input) => nameSchema.safeParse(input).success,
};

export default adapter;
```

Every operation is optional. One you leave out is reported as **uncovered**, not
as failed — a product that never stores a Corporate Number should not be marked
down for not validating one.

### In CI

```yaml
- run: npx japanready test --fail-on critical
```

Exit codes: `0` clean, `1` failures at the chosen threshold, `2` a configuration
error. `--format markdown` produces a job summary; `--format json` produces a
score you can track over releases.

### In your existing test suite

```ts
// japanready.test.ts
import { testJapanCompatibility } from "@japanready/testkit/vitest";
import adapter from "./japanready.config.js";

testJapanCompatibility(adapter);
```

`@japanready/testkit/jest` is the same, for Jest. Each corpus case becomes one
test, and a failure message carries the input with invisible characters made
visible, the expected value, why the case exists, and what to do about it:

```text
CRITICAL  addresses.postal-leading-zero.0001  normalizePostalCode()

  input:    "0600001"
  expected: "060-0001"
  actual:   "600-001"

  why:      060-0001 is central Sapporo. Stored as a number it becomes 600001
            and the leading zero is gone — silently, for the whole of Hokkaido
            and much of Tokyo.
  fix:      Store postal codes as a string. Never as INT, and never as a JSON
            number.
  source:   日本郵便 郵便番号データ (KEN_ALL) format specification
```

---

## The corpus

1,187 cases. Every case carries a severity, the reason it exists, the fix, and a
source where there is an authority to cite.

| Category | Curated | Generated | Total |
| --- | --: | --: | --: |
| Unicode | 21 | 389 | 410 |
| Names | 44 | 105 | 149 |
| Addresses | 43 | 118 | 161 |
| Phone | 39 | 114 | 153 |
| Business IDs | 32 | 282 | 314 |
| **Total** | **179** | **1,008** | **1,187** |

**Curated** cases are hand-written with hand-derived expectations. They are the
real assertions.

**Generated** cases are systematic coverage, and their expectations never come
from the code under test — that would prove nothing. They are derived from an
independent source:

- Width and kana folding: from the JavaScript engine's own Unicode tables
  (`String.prototype.normalize("NFKC")`), for the subset where correct width
  folding and NFKC agree. Where they must *diverge* — ㈱, ①, ㌔ — the case is
  curated instead.
- Kanji variants: from the published 旧字体/異体字 table.
- Corporate Numbers: from a second implementation of the National Tax Agency's
  check-digit formula, written from the specification. Two implementations
  disagreeing is a real signal. Mutation cases add a genuine property — exactly
  one check digit is correct for a given base, so every other digit must be
  rejected.
- Phone numbers: constructed from the numbering plan, where a fixed line is nine
  digits after the trunk `0` and the last four are always the subscriber number.

The corpus is committed as JSON and regenerated with `npm run corpus`. CI fails
if regenerating produces a diff, and fails if the reference implementation drops
below 100%.

### A sample of what it catches

Each of these is a case in the corpus, and each is a bug a real product ships:

- `090-1234-5678` through numeric storage becomes `9012345678` — ten digits that
  still look like a valid fixed line. Nothing notices until the call fails.
- `060-0001`, central Sapporo, becomes `600001`.
- `コーヒー` becomes `コ-ヒ-` when U+30FC is folded with the other dash-like code
  points. It is a letter here, not a hyphen — and a hyphen in `1ー2ー3`.
- `NFC` folds 98 of the 110 CJK Compatibility Ideographs. One of the twelve it
  does not is **U+FA11 﨑**, among the most common characters in Japanese family
  names. A team that applied `NFC` believes this is handled.
- `東京都千代田区神田小川町` — matching `[市区町村]` left to right consumes
  `千代田区神田小川町` as the municipality, because 町 is in the *town* name.
  `神奈川県横浜市西区` needs the opposite rule.
- `六本木六丁目` — converting every kanji numeral yields `6本木`. So does `四谷`
  → `4谷` and 十三 → `13`.
- `0800-123-4567` is toll-free, not an `080` mobile. Mobile numbers never have
  `0` as their fourth digit, which is why the range could be carved out at all.
- `1000012050002` is a valid Corporate Number with one digit changed. Length
  checks accept it. The check digit is the **first** digit, not the last.
- `ジョーンズ` fails `/^[ァ-ン]+$/`, and so does every other katakana loanword
  name and every `マリア・ガルシア`.
- `𠮷田` is two code points and `.length === 3`. MySQL `utf8mb3` truncates it.

---

## What this does not do

Stated plainly, because the gaps matter more than the features:

- **It is not an address API.** Exact municipality segmentation needs the
  official municipality list (総務省 全国地方公共団体コード, ~1,900 entries) or
  Japan Post's KEN_ALL. This ships *logic*, not those datasets — see
  [Data and licensing](#data-and-licensing). Segmentation is by suffix with an
  explicit exception table for the municipalities whose names contain 市/区/町/村
  internally. Every parse result carries a `confidence` and `warnings`; treat
  `"low"` as "ask the user", never as "reject the customer".
- **Phone hyphenation is best-effort.** The one- and two-digit area codes are
  complete and stable. Beyond that, a four-digit table covers the remote-island
  codes and everything else assumes three digits, flagged as
  `areaCodeConfidence: "assumed"`. A wrong guess moves a hyphen; it never
  affects validity or E.164, which is what telephony actually needs.
- **Postal codes are validated structurally**, never against an assignment list.
  Assignment changes as municipalities merge, and a stale allow-list starts
  rejecting real customers. `postalPrefixIsPlausibleFor` is deliberately named
  "plausible".
- **No tax, accounting, payroll, banking, KYC, AML, or legal logic.** Out of
  scope by design.
- **Variant folding is for matching only.** A person named 髙橋 is not named
  高橋. `foldVariants` builds comparison keys; it must never be written back to
  a name field, and `normalizeName("髙橋") === "髙橋"` is a corpus case.

---

## Data and licensing

The corpus encodes *derived compatibility logic and hand-written fixtures*. It
does not redistribute any government or third-party dataset. Where a rule has an
authority, the case cites it (国税庁 check-digit specification, 日本郵便 KEN_ALL
format, 総務省 numbering plan, the Unicode Standard) so the claim can be checked
against the source rather than trusted.

If you need exact municipality or postal-assignment data, bring your own copy
under its own licence and feed it in. That boundary is deliberate: proxying a
dataset whose redistribution is restricted is a liability, and it is also the
part most likely to go stale.

---

## Layout

```text
jp-kit/
├── packages/
│   ├── core/                     @japanready/core
│   │   ├── src/
│   │   │   ├── unicode/          width, kana, variants, text, numerals
│   │   │   ├── names/            splitting, ordering, validation, matching
│   │   │   ├── address/          prefectures, postal, numerals, parse/format
│   │   │   ├── phone/            parse, classify, format, E.164
│   │   │   ├── business/         corporate number, invoice number, company name
│   │   │   ├── schema/           the canonical customer record
│   │   │   └── adapter.ts        the adapter contract + reference implementation
│   │   └── test/                 120 unit tests
│   └── testkit/                  @japanready/testkit
│       ├── corpus/
│       │   ├── curated/          hand-written cases
│       │   └── generated/        systematic coverage
│       ├── scripts/              the corpus generator
│       ├── src/                  corpus loader, runner, report, CLI, bindings
│       └── test/                 45 unit tests
└── examples/
    └── naive-app/                a typical Western implementation, for the demo
```

---

## CLI

```text
japanready test [options]      Run the corpus against your adapter
japanready corpus [options]    Show what is in the corpus
japanready init                Write a starter japanready.config.ts

  -c, --config <path>    Path to the config exporting your adapter
      --reference        Score the bundled reference implementation instead
      --category <list>  names,addresses,unicode,phone,business
      --severity <level> Only cases at this severity or worse
      --tier <list>      free,pro
  -g, --grep <text>      Only cases whose id, group, reason, or input matches
      --max-failures <n> How many failures to detail (default 10)
      --format <fmt>     text, json, or markdown
  -o, --out <path>       Write the report to a file
      --fail-on <level>  critical (default), any, never
      --no-color         Disable ANSI colour
```

```bash
npx japanready corpus --category unicode
npx japanready test --category phone,business --severity high
npx japanready test --format markdown --out japanready-report.md
```

---

## Licence

MIT. See [LICENSE](LICENSE).
