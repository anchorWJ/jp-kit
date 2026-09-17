import type { CaseSeed } from "./lib.ts";
import { independentCheckDigit, seededRandom } from "./lib.ts";

const NTA_SOURCE = "国税庁 法人番号公表サイト — 法人番号の指定について (check-digit specification)";
const INVOICE_SOURCE = "国税庁 適格請求書発行事業者公表サイト (インボイス制度)";

/** The National Tax Agency's own Corporate Number — published and verifiable. */
const NTA = "7000012050002";

export const curatedBusiness: CaseSeed[] = [
  {
    category: "business",
    group: "corporate-number-accept",
    op: "validateCorporateNumber",
    input: NTA,
    shouldAccept: true,
    severity: "critical",
    reason: "The National Tax Agency's own Corporate Number, published on its site.",
    fix: "Validate the check digit; length alone is not validation.",
    source: NTA_SOURCE,
  },
  ...(
    [
      ["7-0000-1205-0002", "Hyphenated for display."],
      ["７００００１２０５０００２", "Full-width digits from a Japanese IME."],
      [" 7000012050002 ", "Surrounded by whitespace."],
      ["7000 0120 5000 2", "Space-grouped, as printed on some documents."],
    ] as const
  ).map(
    ([input, reason]): CaseSeed => ({
      category: "business",
      group: "corporate-number-normalize",
      op: "validateCorporateNumber",
      input,
      shouldAccept: true,
      severity: "high",
      reason,
      fix: "Strip separators and fold width before validating.",
      source: NTA_SOURCE,
    }),
  ),
  {
    category: "business",
    group: "corporate-number-check-digit",
    op: "validateCorporateNumber",
    input: "1000012050002",
    shouldAccept: false,
    severity: "critical",
    reason:
      "A valid Corporate Number with only its check digit changed. Any validator that " +
      "checks length alone accepts this.",
    fix:
      "The check digit is the FIRST digit, not the last: 9 − (Σ Pn×Qn) mod 9 over the " +
      "remaining twelve, where Pn counts from the right and Qn alternates 1, 2.",
    source: NTA_SOURCE,
  },
  {
    category: "business",
    group: "corporate-number-check-digit",
    op: "validateCorporateNumber",
    input: "7000012050003",
    shouldAccept: false,
    severity: "critical",
    reason: "A transcription error in the last digit, which the check digit exists to catch.",
    fix: "Validate the check digit on entry, not at month end.",
    source: NTA_SOURCE,
  },
  ...(
    [
      ["700001205000", "Twelve digits — too short."],
      ["70000120500020", "Fourteen digits — too long."],
      ["0000000000000", "All zeros — a placeholder value that passes a length check."],
      ["ABCDEFGHIJKLM", "Thirteen characters, but not digits."],
      ["", "Empty input where a Corporate Number was expected."],
    ] as const
  ).map(
    ([input, reason]): CaseSeed => ({
      category: "business",
      group: "corporate-number-reject",
      op: "validateCorporateNumber",
      input,
      shouldAccept: false,
      severity: "high",
      reason,
      fix: "A Corporate Number is exactly thirteen digits with a valid leading check digit.",
      source: NTA_SOURCE,
    }),
  ),
  {
    category: "business",
    group: "corporate-number-leading-zero",
    op: "validateCorporateNumber",
    input: "0700001205000",
    shouldAccept: false,
    severity: "high",
    reason:
      "The check digit is always 1–9, because 9 − (sum mod 9) cannot be 0. A Corporate " +
      "Number beginning with 0 has been shifted or re-padded by numeric storage.",
    fix: "Store as a string. A leading zero is proof the value was damaged.",
    source: NTA_SOURCE,
  },

  // --- invoice registration numbers ---------------------------------------
  ...(
    [
      [`T${NTA}`, "The canonical form."],
      [`t${NTA}`, "A lower-case t, as typed by hand rather than copied."],
      [`Ｔ${NTA}`, "Full-width T from a Japanese IME."],
      [`T-${NTA}`, "Hyphenated after the T."],
      [NTA, "Bare digits — the T is implied and should be added, not rejected."],
    ] as const
  ).map(
    ([input, reason]): CaseSeed => ({
      category: "business",
      group: "invoice-number-accept",
      op: "validateInvoiceNumber",
      input,
      shouldAccept: true,
      severity: "critical",
      reason,
      fix:
        "Normalize the prefix, then validate the thirteen digits with the Corporate Number " +
        "check digit — the rule is the same for corporations and sole proprietors.",
      source: INVOICE_SOURCE,
    }),
  ),
  ...(
    [
      ["T1234567890123", "Thirteen digits with a wrong check digit."],
      ["T700001205000", "Twelve digits after the T."],
      ["X7000012050002", "Wrong prefix letter."],
      ["T", "The prefix with no digits following it."],
      ["", "Empty input where a registration number was expected."],
    ] as const
  ).map(
    ([input, reason]): CaseSeed => ({
      category: "business",
      group: "invoice-number-reject",
      op: "validateInvoiceNumber",
      input,
      shouldAccept: false,
      severity: "high",
      reason,
      fix:
        "An invalid registration number means the buyer loses the input-tax credit, so " +
        "this must be caught at entry.",
      source: INVOICE_SOURCE,
    }),
  ),

  // --- company names -------------------------------------------------------
  ...(
    [
      ["㈱日本商事", "株式会社日本商事", "㈱ (U+3231) is one code point, not three."],
      ["㍿日本商事", "株式会社日本商事", "㍿ (U+337F) is the square-form abbreviation."],
      ["(株)日本商事", "株式会社日本商事", "The ASCII-parenthesised abbreviation."],
      ["（株）日本商事", "株式会社日本商事", "The full-width-parenthesised abbreviation."],
      ["㈲日本商事", "有限会社日本商事", "㈲ (U+3232) — 有限会社."],
    ] as const
  ).map(
    ([input, expected, reason]): CaseSeed => ({
      category: "business",
      group: "company-abbreviation",
      op: "normalizeCompanyName",
      input,
      expectedOutput: expected,
      severity: "high",
      reason,
      fix:
        "Expand the abbreviations explicitly. Width folding alone does not touch them, and " +
        "NFKC expands ㈱ to (株) rather than to 株式会社.",
    }),
  ),
  {
    category: "business",
    group: "company-key",
    op: "companyNameKey",
    input: "㈱日本商事",
    expectedOutput: "日本商事",
    severity: "high",
    reason:
      "㈱日本商事 and 日本商事株式会社 are the same company written 前株 and 後株. " +
      "Deduplication must see through the legal form.",
    fix: "Strip the legal form when building a comparison key; keep it in the stored value.",
  },
  {
    category: "business",
    group: "company-key",
    op: "companyNameKey",
    input: "日本商事株式会社",
    expectedOutput: "日本商事",
    severity: "high",
    reason: "The 後株 spelling of the same company.",
    fix: "Same key function.",
  },
  {
    category: "business",
    group: "company-key",
    op: "companyNameKey",
    input: "株式会社髙島屋",
    expectedOutput: "高島屋",
    severity: "medium",
    reason: "A company name containing a variant glyph must fold like a personal name.",
    fix: "Apply variant folding inside the company key as well.",
  },
  {
    category: "business",
    group: "company-legal-form",
    op: "normalizeCompanyName",
    input: "特定非営利活動法人さくら",
    expectedOutput: "特定非営利活動法人さくら",
    severity: "low",
    reason:
      "Legal forms must be matched longest-first, or 特定非営利活動法人 is truncated to " +
      "法人 and the trade name becomes 特定非営利活動さくら.",
    fix: "Sort the legal-form table by length descending before matching.",
  },
];

export function generatedBusiness(): CaseSeed[] {
  const cases: CaseSeed[] = [];
  const random = seededRandom(0x4a50_524e); // "JPRN" — fixed so the corpus is reproducible

  const bases: string[] = [];
  for (let i = 0; i < 90; i++) {
    let base = "";
    for (let d = 0; d < 12; d++) base += Math.floor(random() * 10);
    bases.push(base);
  }
  // A few structured bases alongside the random ones.
  bases.push("000000000001", "999999999999", "000012050002", "123456789012");

  for (const base of bases) {
    // Expectation computed from the published formula, independently of the
    // implementation under test.
    const check = independentCheckDigit(base);
    const valid = `${check}${base}`;
    cases.push({
      category: "business",
      group: "corporate-number-valid",
      op: "validateCorporateNumber",
      input: valid,
      shouldAccept: true,
      severity: "high",
      reason: "A structurally valid Corporate Number: check digit computed from the base.",
      fix: "Implement the published check-digit formula.",
      source: NTA_SOURCE,
      tier: "pro",
    });

    // Exactly one check digit is correct for a given base, so any other digit
    // in the valid 1–9 range must be rejected.
    const wrongCheck = check === 9 ? 1 : check + 1;
    {
      cases.push({
        category: "business",
        group: "corporate-number-mutated",
        op: "validateCorporateNumber",
        input: `${wrongCheck}${base}`,
        shouldAccept: false,
        severity: "high",
        reason: "The same number with a corrupted check digit must be rejected.",
        fix: "Verify the check digit, not just the length.",
        source: NTA_SOURCE,
        tier: "pro",
      });
    }

    // The matching Invoice Registration Number.
    cases.push({
      category: "business",
      group: "invoice-number-valid",
      op: "validateInvoiceNumber",
      input: `T${valid}`,
      shouldAccept: true,
      severity: "medium",
      reason: "A corporation's Invoice Registration Number is T + its Corporate Number.",
      fix: "Reuse the Corporate Number validator behind the T prefix.",
      source: INVOICE_SOURCE,
      tier: "pro",
    });
  }

  return cases;
}
