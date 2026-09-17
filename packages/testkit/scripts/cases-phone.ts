import type { CaseSeed } from "./lib.ts";

const PLAN_SOURCE = "総務省 電気通信番号制度 (Japanese national numbering plan)";

export const curatedPhone: CaseSeed[] = [
  // --- one number, every written form ------------------------------------
  ...(
    [
      ["090-1234-5678", "The canonical domestic form."],
      ["09012345678", "Unseparated digits, as stored by most databases."],
      ["090 1234 5678", "Space-separated."],
      ["+81 90 1234 5678", "International, spaced."],
      ["+819012345678", "E.164, the form telephony providers require."],
      ["+81-90-1234-5678", "International, hyphenated."],
      ["0081 90 1234 5678", "International prefix instead of +."],
      ["０９０－１２３４－５６７８", "Full-width digits and hyphens from a Japanese IME."],
      ["090ー1234ー5678", "U+30FC typed from the kana key."],
      ["(090)1234-5678", "Parenthesised area code."],
      ["090.1234.5678", "Dot-separated, a common European convention."],
      ["+81 (0)90 1234 5678", "The trunk 0 left in after +81 — extremely common on business cards."],
    ] as const
  ).map(
    ([input, reason]): CaseSeed => ({
      category: "phone",
      group: "normalize-mobile",
      op: "normalizePhone",
      input,
      expectedOutput: "+819012345678",
      severity: "high",
      reason,
      fix: "Normalize to E.164 on input. Store one form; render the rest.",
      source: PLAN_SOURCE,
    }),
  ),

  // --- variable-length area codes ----------------------------------------
  ...(
    [
      ["0312345678", "03-1234-5678", "Tokyo — a one-digit area code."],
      ["0612345678", "06-1234-5678", "Osaka — a one-digit area code."],
      ["0111234567", "011-123-4567", "Sapporo — a two-digit area code."],
      ["0451234567", "045-123-4567", "Yokohama — a two-digit area code."],
      ["0166123456", "0166-12-3456", "Asahikawa — a three-digit area code."],
      ["0499212345", "04992-1-2345", "Izu Ōshima — a four-digit area code."],
    ] as const
  ).map(
    ([input, expected, reason]): CaseSeed => ({
      category: "phone",
      group: "area-code-length",
      op: "formatPhoneNational",
      input,
      expectedOutput: expected,
      severity: "high",
      reason,
      fix:
        "Japanese area codes are one to four digits. The subscriber number is always the " +
        "last four, so hyphenation follows from the area code alone — a fixed 3-3-4 or " +
        "3-4-4 split is wrong for most of the country.",
      source: PLAN_SOURCE,
    }),
  ),

  // --- number types -------------------------------------------------------
  ...(
    [
      ["09012345678", "090-1234-5678", "A 090 mobile number, eleven digits."],
      ["08012345678", "080-1234-5678", "An 080 mobile number, eleven digits."],
      ["07012345678", "070-1234-5678", "A 070 mobile number, eleven digits."],
      ["05012345678", "050-1234-5678", "An 050 IP telephony number, eleven digits."],
      ["0120123456", "0120-123-456", "Toll-free — ten digits, unlike every other 0x20 number."],
      ["08001234567", "0800-123-4567", "Toll-free — eleven digits, and its prefix starts with 080."],
      ["0570000000", "0570-000-000", "A 0570 navi-dial number, ten digits."],
    ] as const
  ).map(
    ([input, expected, reason]): CaseSeed => ({
      category: "phone",
      group: "number-types",
      op: "formatPhoneNational",
      input,
      expectedOutput: expected,
      severity: "high",
      reason,
      fix:
        "Match the longest prefix first. 0800 is toll-free, not a 080 mobile; 0570 is " +
        "navi-dial, not a 050 IP number.",
      source: PLAN_SOURCE,
    }),
  ),

  // --- acceptance ---------------------------------------------------------
  ...(
    [
      ["03-1234-5678", "Ten digits, 2-4-4 — rejected by /^\\d{3}-\\d{3}-\\d{4}$/."],
      ["090-1234-5678", "Eleven digits — rejected by any ten-digit length limit."],
      ["0166-12-3456", "Ten digits, 4-2-4."],
      ["04992-1-2345", "Ten digits, 5-1-4."],
      ["0120-123-456", "Ten digits, 4-3-3."],
      ["+81 90 1234 5678", "International form — rejected by digits-only validators."],
      ["011-123-4567", "Ten digits, 3-3-4."],
    ] as const
  ).map(
    ([input, reason]): CaseSeed => ({
      category: "phone",
      group: "accept",
      op: "validatePhone",
      input,
      shouldAccept: true,
      severity: "critical",
      reason,
      fix:
        "Do not validate Japanese numbers with a fixed pattern. Strip formatting, then " +
        "check the digit count against the prefix's expected length.",
      source: PLAN_SOURCE,
    }),
  ),
  ...(
    [
      ["090-1234-567", "Ten digits where a mobile needs eleven."],
      ["090-1234-56789", "Twelve digits — one too many for a mobile."],
      ["03-1234-567", "Nine digits where a fixed line needs ten."],
      ["", "Empty input in a required phone field."],
      ["not a phone", "Not a number at all."],
    ] as const
  ).map(
    ([input, reason]): CaseSeed => ({
      category: "phone",
      group: "reject",
      op: "validatePhone",
      input,
      shouldAccept: false,
      severity: "medium",
      reason,
      fix: "Check the digit count against the prefix.",
    }),
  ),

  {
    category: "phone",
    group: "prefix-ambiguity",
    op: "formatPhoneNational",
    input: "08000000000",
    expectedOutput: "0800-000-0000",
    severity: "high",
    reason:
      "Eleven digits beginning 0800. This is a toll-free number, not an 080 mobile: the " +
      "fourth digit of a Japanese mobile number is always 1–9, which is why the 0800 " +
      "range could be carved out of the 080 space at all.",
    fix:
      "Test the 0800 prefix before the 080 one. A mobile whose body starts with 0 does " +
      "not exist, so there is no ambiguity to resolve — only an ordering bug to avoid.",
    source: PLAN_SOURCE,
  },
  {
    category: "phone",
    group: "lost-leading-zero",
    op: "validatePhone",
    input: "9012345678",
    shouldAccept: false,
    severity: "critical",
    reason:
      "090-1234-5678 stored in a numeric column, a JSON number, or an unformatted " +
      "spreadsheet cell becomes 9012345678. It is ten digits and still looks like a valid " +
      "number, so nothing downstream notices until the call fails.",
    fix:
      "Store phone numbers as strings in E.164. Treat a number with no trunk 0 and no " +
      "country code as damaged data, not as a valid fixed line.",
  },
];

export function generatedPhone(): CaseSeed[] {
  const cases: CaseSeed[] = [];

  /** Area codes the plan defines with one or two digits after the trunk 0. */
  const oneDigit = ["3", "6"];
  const twoDigit = [
    "11", "17", "18", "19", "22", "23", "24", "25", "26", "27", "28", "29",
    "42", "43", "44", "45", "46", "47", "48", "49", "52", "53", "54", "55",
    "58", "59", "72", "73", "75", "76", "77", "78", "79", "82", "83", "84",
    "86", "87", "88", "89", "92", "93", "95", "96", "97", "98", "99",
  ];

  // A fixed line is nine digits after the trunk 0, ending in a four-digit
  // subscriber number. The local portion is therefore 5 − areaCodeLength.
  const build = (area: string) => {
    const localLength = 5 - area.length;
    const local = "1234567890".slice(0, localLength);
    const subscriber = "5678";
    return {
      digits: `0${area}${local}${subscriber}`,
      formatted: `0${area}-${local}-${subscriber}`,
    };
  };

  for (const area of [...oneDigit, ...twoDigit]) {
    const { digits, formatted } = build(area);
    cases.push({
      category: "phone",
      group: "area-codes",
      op: "formatPhoneNational",
      input: digits,
      expectedOutput: formatted,
      severity: "medium",
      reason: `Area code 0${area} is ${area.length} digit(s); the local part is therefore ${5 - area.length}.`,
      fix: "Derive the hyphen positions from the area-code length, not from a fixed pattern.",
      source: PLAN_SOURCE,
      tier: "pro",
    });
    cases.push({
      category: "phone",
      group: "area-codes-e164",
      op: "normalizePhone",
      input: formatted,
      expectedOutput: `+81${digits.slice(1)}`,
      severity: "medium",
      reason: `E.164 conversion for area code 0${area}: drop the trunk 0, prepend +81.`,
      fix: "The trunk 0 is domestic only and must not appear after the country code.",
      source: PLAN_SOURCE,
      tier: "pro",
    });
  }

  // Mobile prefixes across all three ranges.
  //
  // The body never starts with 0. The fourth digit of a Japanese mobile number
  // is 1–9, which is precisely why 0800 could be carved out of the 080 space
  // for toll-free numbers: 08000000000 is a toll-free number, not a mobile.
  for (const prefix of ["070", "080", "090"]) {
    for (const body of ["12345678", "19876543", "99999999", "10203040"]) {
      const digits = `${prefix}${body}`;
      cases.push({
        category: "phone",
        group: "mobile",
        op: "formatPhoneNational",
        input: digits,
        expectedOutput: `${prefix}-${body.slice(0, 4)}-${body.slice(4)}`,
        severity: "medium",
        reason: `Mobile numbers are always ${prefix}-XXXX-XXXX, eleven digits in total.`,
        fix: "Allow eleven digits; a ten-character limit truncates every mobile number.",
        source: PLAN_SOURCE,
        tier: "pro",
      });
    }
  }

  // Every mobile number must round-trip through E.164 unchanged.
  for (const prefix of ["070", "080", "090", "050"]) {
    const digits = `${prefix}12345678`;
    const e164 = `+81${digits.slice(1)}`;
    cases.push({
      category: "phone",
      group: "e164-roundtrip",
      op: "normalizePhone",
      input: e164,
      expectedOutput: e164,
      severity: "medium",
      reason: "A number already in E.164 must normalize to itself.",
      fix: "Normalization must be idempotent.",
    });
  }

  return cases;
}
