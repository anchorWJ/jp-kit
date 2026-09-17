# @japanready/core

Japanese customer-data primitives: Unicode and kana folding, kanji variant
folding, name handling, address parsing, phone numbers, and the two national
business identifiers.

No network calls. No embedded government datasets.

```bash
npm install @japanready/core
```

## Unicode

```ts
import { normalizeText, foldVariants } from "@japanready/core";

normalizeText("ﾀﾅｶ　太郎");  // "タナカ 太郎"
normalizeText("コーヒー");     // "コーヒー"  ー is a letter, not a hyphen
normalizeText("㈱");          // "㈱"        NFKC would give "(株)"

foldVariants("髙橋") === foldVariants("高橋");  // true
foldVariants("山﨑");                       // "山崎"  NFC does not fold U+FA11
```

`normalizeText` is deliberately **not** `NFKC`. NFKC folds width, which you
want, and also rewrites ㈱ → (株), ① → 1, and ㌔ → キロ, which damages company
names and product text. Each transform here is independently callable.

`foldVariants` is for **matching only**. A person named 髙橋 is not named 高橋 —
fold to compare and dedupe, never to store or display.

Also: `halfWidthKanaToFullWidth`, `fullWidthKanaToHalfWidth`, `composeVoicedMarks`,
`toHalfWidthAscii`, `toFullWidthAscii`, `hiraganaToKatakana`, `katakanaToHiragana`,
`isKatakanaField`, `detectScript`, `stripVariationSelectors`, `kanjiToNumber`,
`numberToKanji`, `needsNormalization`.

## Names

```ts
import { splitName, validateName, nameKey, isValidKanaReading } from "@japanready/core";

splitName("山田　太郎");   // { family: "山田", given: "太郎" }
splitName("田中太郎");     // { full: "田中太郎" }  no split is guessed

validateName("Prince").valid;          // true — mononyms are real names
validateName("マリア・ガルシア").valid;  // true
validateName("佐々木").valid;           // true — 々 is not punctuation to reject

isValidKanaReading("ジョーンズ", "katakana");  // true — /^[ァ-ン]+$/ says false

nameKey("髙橋　太郎") === nameKey("高橋太郎");  // true
```

`splitName` refuses to segment an unspaced kanji name. 田中太郎 could be 田中/太郎
or 田/中太郎, and guessing puts the wrong name on an invoice.

`validateName` rejects only empty input, control characters, markup, and absurd
length. Everything else — any script, any number of parts, apostrophes, middle
dots, diacritics, supplementary-plane characters — is a real name somewhere.

## Addresses

```ts
import { parseAddress, formatAddress, formatPostalCode } from "@japanready/core";

parseAddress("〒150-0002 東京都渋谷区渋谷2丁目21番1号 渋谷ヒカリエ11F");
// { postalCode: "150-0002", prefecture: "東京都", city: "渋谷区",
//   town: "渋谷", chome: 2, ban: 21, go: 1, building: "渋谷ヒカリエ11F",
//   confidence: "high", warnings: [] }

parseAddress("神奈川県横浜市西区みなとみらい2-3-1");
// city: "横浜市", ward: "西区"   ← 行政区 is its own level

formatPostalCode("０６００００１");  // "060-0001"  leading zero preserved
```

**Accuracy boundary.** Exact municipality segmentation needs the official
municipality list (総務省 全国地方公共団体コード) or Japan Post's KEN_ALL. This
package ships logic, not those datasets. Segmentation is by suffix with an
exception table for municipalities whose names contain 市/区/町/村 internally
(四日市市, 東村山市, 大和郡山市, 大町町, …). Every result carries `confidence`
and `warnings` — treat `"low"` as "ask the user to confirm", not as "reject".

Kanji numerals are converted only where a following unit proves they are numbers,
so 六本木 stays 六本木 while 六丁目 becomes 6丁目.

## Phone numbers

```ts
import { formatPhone, parsePhone, looksLikeLostLeadingZero } from "@japanready/core";

formatPhone("０９０－１２３４－５６７８", "e164");  // "+819012345678"
formatPhone("0312345678");                      // "03-1234-5678"
formatPhone("0166123456");                      // "0166-12-3456"
parsePhone("0800-123-4567")?.type;              // "toll-free", not "mobile"

looksLikeLostLeadingZero("9012345678");         // true
```

Japanese area codes are one to four digits. The subscriber number is always the
last four, so hyphenation follows from the area code alone — a fixed `3-3-4`
split is wrong for most of the country.

E.164 and compact output are always exact. Hyphenation beyond the one- and
two-digit area codes is best-effort and reports
`areaCodeConfidence: "assumed"`.

## Business identity

```ts
import {
  validateCorporateNumber,
  validateInvoiceNumber,
  parseCompanyName,
  companyNameKey,
} from "@japanready/core";

validateCorporateNumber("7000012050002").valid;  // true — 国税庁's own number
validateCorporateNumber("1000012050002");
// { valid: false, reason: "check-digit-mismatch", expectedCheckDigit: 7 }

validateInvoiceNumber("T7000012050002").valid;   // true

parseCompanyName("㈱日本商事");
// { name: "日本商事", legalForm: "株式会社", position: "prefix" }

companyNameKey("㈱日本商事") === companyNameKey("日本商事株式会社");  // true
```

The Corporate Number's check digit is the **first** digit, not the last:
`9 − (Σ Pn×Qn) mod 9` over the remaining twelve, where `Pn` counts from the
right and `Qn` alternates 1, 2. It is always 1–9, so a Corporate Number never
begins with `0`.

前株 and 後株 are different companies in the registry. `parseCompanyName` reports
which one you have; `companyNameKey` deliberately collapses them, which is right
for deduplication and wrong for a registry lookup.

## Schema and adapter

`JapaneseCustomer` is the canonical record shape, and `SchemaCapabilities`
enumerates what a Japan-capable schema must support, each with a note on what
breaks without it.

`referenceAdapter` implements the `JapanReadyAdapter` contract used by
[`@japanready/testkit`](../testkit). It scores 100% on the corpus, which is how
the corpus regression-tests itself.

## Licence

MIT.
