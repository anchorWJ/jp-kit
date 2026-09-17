/**
 * Japanese company names.
 *
 * Two things trip up foreign systems. First, the legal form (株式会社) can sit
 * before or after the trade name, and the two are different companies in the
 * registry — 前株 and 後株 are not interchangeable. Second, the abbreviations
 * ㈱ and ㍿ are single code points that `NFKC` expands and plain width folding
 * does not, so the same company arrives as three different strings.
 */

import { normalizeText } from "../unicode/text.js";
import { foldVariants } from "../unicode/variants.js";

/** Legal forms, longest first so that 一般社団法人 beats 社団法人. */
export const LEGAL_FORMS = [
  "特定非営利活動法人",
  "一般社団法人",
  "一般財団法人",
  "公益社団法人",
  "公益財団法人",
  "独立行政法人",
  "国立大学法人",
  "社会福祉法人",
  "学校法人",
  "医療法人社団",
  "医療法人財団",
  "医療法人",
  "宗教法人",
  "相互会社",
  "株式会社",
  "有限会社",
  "合同会社",
  "合名会社",
  "合資会社",
] as const;

export type LegalForm = (typeof LEGAL_FORMS)[number];

/** Single-code-point and parenthesised abbreviations → their full form. */
const ABBREVIATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/㍿/gu, "株式会社"], // ㍿
  [/㈱|\(株\)|（株）/gu, "株式会社"], // ㈱
  [/㈲|\(有\)|（有）/gu, "有限会社"], // ㈲
  [/\(合\)|（合）/gu, "合同会社"],
  [/\(財\)|（財）/gu, "財団法人"],
  [/\(社\)|（社）/gu, "社団法人"],
  [/㈳|\(労\)|（労）/gu, "労働組合"], // ㈳ / ㈸ family
];

/** Expand ㈱ / ㍿ / (株) to 株式会社 and friends. */
export function expandCompanyAbbreviations(input: string): string {
  let out = input;
  for (const [pattern, replacement] of ABBREVIATIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export type LegalFormPosition = "prefix" | "suffix" | "none";

export interface ParsedCompanyName {
  /** The trade name with the legal form removed. */
  readonly name: string;
  readonly legalForm?: LegalForm | string;
  /** 前株 (`"prefix"`) or 後株 (`"suffix"`). These are different companies. */
  readonly position: LegalFormPosition;
  /** Fully normalized name with the abbreviation expanded and spacing cleaned. */
  readonly normalized: string;
}

/**
 * Split a company name into its trade name and legal form.
 *
 * ```ts
 * parseCompanyName("㈱ 日本商事")   // { name: "日本商事", legalForm: "株式会社", position: "prefix" }
 * parseCompanyName("日本商事株式会社") // { …, position: "suffix" }
 * ```
 */
export function parseCompanyName(input: string): ParsedCompanyName {
  const normalized = normalizeText(expandCompanyAbbreviations(input));

  for (const form of LEGAL_FORMS) {
    if (normalized.startsWith(form)) {
      return {
        name: normalized.slice(form.length).trim(),
        legalForm: form,
        position: "prefix",
        normalized,
      };
    }
    if (normalized.endsWith(form)) {
      return {
        name: normalized.slice(0, -form.length).trim(),
        legalForm: form,
        position: "suffix",
        normalized,
      };
    }
  }

  return { name: normalized, position: "none", normalized };
}

/** Canonical stored form: abbreviation expanded, width and spacing normalized. */
export function normalizeCompanyName(input: string): string {
  return parseCompanyName(input).normalized;
}

/**
 * A comparison key for company deduplication.
 *
 * Drops the legal form, folds kanji variants, removes all spacing and middle
 * dots, and lower-cases Latin. `㈱日本商事` and `日本商事株式会社` produce the
 * same key — which is what you want for "is this the same customer", and
 * emphatically not what you want for a registry lookup, where 前株 and 後株 are
 * distinct entities.
 */
export function companyNameKey(input: string): string {
  const parsed = parseCompanyName(input);
  return foldVariants(parsed.name)
    .replace(/[\s　・･·.,()（）「」『』]/gu, "")
    .toLowerCase();
}

/** True if two written company names refer to the same trade name. */
export function companyNamesMatch(a: string, b: string): boolean {
  return companyNameKey(a) === companyNameKey(b);
}
