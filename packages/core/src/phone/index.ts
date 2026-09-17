/**
 * Japanese phone numbers.
 *
 * Japan's numbering plan has a *variable-length area code* (one to four digits
 * after the trunk `0`). The subscriber number is always the last four digits,
 * so hyphenation is decided by the area code alone. A fixed
 * `^\d{3}-\d{3}-\d{4}$` validator — the North American shape — rejects most of
 * the country.
 */

import { toHalfWidthAscii } from "../unicode/width.js";
import { normalizeHyphens, stripZeroWidth } from "../unicode/text.js";

export const JP_COUNTRY_CODE = "81";

export type PhoneType =
  | "fixed-line"
  | "mobile"
  | "ip"
  | "toll-free"
  | "navi-dial"
  | "m2m"
  | "special"
  | "unknown";

export interface ParsedPhone {
  /** All digits including the trunk `0`: `09012345678`. */
  readonly national: string;
  /** National significant number, trunk `0` removed: `9012345678`. */
  readonly nsn: string;
  readonly type: PhoneType;
  /** Area code without the trunk `0` (`3` for Tokyo), when one applies. */
  readonly areaCode?: string;
  /**
   * `"known"` when the area code came from the built-in table, `"assumed"`
   * when its length was guessed. Only affects hyphen placement.
   */
  readonly areaCodeConfidence?: "known" | "assumed";
  readonly warnings: readonly string[];
}

/**
 * Area codes of length 1 and 2 (digits after the trunk `0`).
 * These are stable and well-known; everything else defaults to three digits.
 */
const AREA_CODE_LENGTH_1 = new Set(["3", "6"]);

const AREA_CODE_LENGTH_2 = new Set([
  "11", "17", "18", "19",
  "22", "23", "24", "25", "26", "27", "28", "29",
  "42", "43", "44", "45", "46", "47", "48", "49",
  "52", "53", "54", "55", "58", "59",
  "72", "73", "75", "76", "77", "78", "79",
  "82", "83", "84", "86", "87", "88", "89",
  "92", "93", "95", "96", "97", "98", "99",
]);

/**
 * A small set of four-digit area codes (remote islands and sparse regions).
 * Not exhaustive — the authoritative list is the MIC 市外局番一覧, which changes.
 * An entry missing here only shifts a hyphen; validity and E.164 are unaffected.
 */
const AREA_CODE_LENGTH_4 = new Set([
  "4992", // 大島 (Izu Ōshima)
  "4994", // 三宅島
  "4996", // 八丈島
  "4998", // 小笠原
]);

const RE_DIGITS_ONLY = /^\d+$/;

/** Strip formatting and resolve `+81` / `0081` / `81` to the domestic trunk form. */
function toNationalDigits(input: string): { digits: string; warnings: string[] } | null {
  const warnings: string[] = [];
  let text = stripZeroWidth(toHalfWidthAscii(input)).trim();
  text = normalizeHyphens(text);
  // ー between digits is a hyphen typed in kana mode.
  text = text.replace(/(?<=\d)ー(?=\d)/gu, "-");
  // Common decorations: (03) 1234-5678, 03.1234.5678, 03 1234 5678
  text = text.replace(/[()\s.・]/gu, "");

  let intl = false;
  if (text.startsWith("+")) {
    text = text.slice(1);
    intl = true;
  } else if (text.startsWith("00" + JP_COUNTRY_CODE)) {
    text = text.slice(2);
    intl = true;
  }
  text = text.replace(/-/g, "");
  if (!RE_DIGITS_ONLY.test(text) || text.length === 0) return null;

  if (intl || (text.startsWith(JP_COUNTRY_CODE) && !text.startsWith("0"))) {
    if (!text.startsWith(JP_COUNTRY_CODE)) return null;
    let rest = text.slice(JP_COUNTRY_CODE.length);
    if (rest.startsWith("0")) {
      // +81 0 90 … — the trunk 0 must be dropped after the country code, but
      // customers paste it constantly. Accept and note it.
      warnings.push("International form included the trunk 0 after +81; it was removed.");
      rest = rest.replace(/^0+/, "");
    }
    return { digits: `0${rest}`, warnings };
  }

  return { digits: text, warnings };
}

function classify(national: string): PhoneType {
  // Order matters: 0800 is a toll-free prefix that starts with the 080 mobile
  // prefix, and 0570 starts with the same 05 as the 050 IP range. The longer
  // prefixes must be tested first.
  if (national.startsWith("0120") || national.startsWith("0800")) return "toll-free";
  if (national.startsWith("0570")) return "navi-dial";
  if (national.startsWith("050")) return "ip";
  if (national.startsWith("020")) return "m2m";
  if (/^0(70|80|90)/.test(national)) return "mobile";
  if (/^(110|118|119|117|171|177|104|113|115|188|189)$/.test(national)) return "special";
  if (national.startsWith("0")) return "fixed-line";
  return "unknown";
}

function expectedLength(type: PhoneType, national: string): number[] {
  switch (type) {
    case "mobile":
    case "ip":
      return [11];
    case "toll-free":
      return national.startsWith("0120") ? [10] : [11];
    case "navi-dial":
      return [10];
    case "m2m":
      return [11, 14];
    case "special":
      return [3];
    case "fixed-line":
      return [10];
    default:
      return [];
  }
}

function resolveAreaCode(national: string): { code: string; confidence: "known" | "assumed" } {
  const nsn = national.slice(1);
  const one = nsn.slice(0, 1);
  if (AREA_CODE_LENGTH_1.has(one)) return { code: one, confidence: "known" };
  // The four-digit table is checked before the two-digit one: 04992 (伊豆大島)
  // and 049 (川越) share a prefix, and only the longer match is correct.
  const four = nsn.slice(0, 4);
  if (AREA_CODE_LENGTH_4.has(four)) return { code: four, confidence: "known" };
  const two = nsn.slice(0, 2);
  if (AREA_CODE_LENGTH_2.has(two)) return { code: two, confidence: "known" };
  return { code: nsn.slice(0, 3), confidence: "assumed" };
}

/**
 * Parse any written Japanese phone number.
 *
 * Accepts `03-1234-5678`, `0312345678`, `+81 3 1234 5678`, `(03)1234-5678`,
 * `０９０－１２３４－５６７８`, and `+81-0-90-1234-5678`.
 * Returns `null` only when the input cannot be read as digits at all; a
 * well-formed but wrong-length number comes back with a warning so the caller
 * can decide whether to block the signup.
 */
export function parsePhone(input: string): ParsedPhone | null {
  const base = toNationalDigits(input);
  if (base === null) return null;

  const { digits: national, warnings } = base;
  const type = classify(national);
  const lengths = expectedLength(type, national);

  if (lengths.length > 0 && !lengths.includes(national.length)) {
    warnings.push(
      `Expected ${lengths.join(" or ")} digits for a ${type} number, found ${national.length}.`,
    );
  }
  if (!national.startsWith("0") && type !== "special") {
    warnings.push(
      "Number does not start with a trunk 0. A leading zero lost to numeric storage " +
        "(column type INT, JSON number, spreadsheet import) is the usual cause.",
    );
  }

  const nsn = national.startsWith("0") ? national.slice(1) : national;
  const useArea = type === "fixed-line";
  const area = useArea ? resolveAreaCode(national) : undefined;

  return {
    national,
    nsn,
    type,
    ...(area ? { areaCode: area.code, areaCodeConfidence: area.confidence } : {}),
    warnings,
  };
}

export type PhoneFormat = "national" | "international" | "e164" | "compact";

/**
 * Format a phone number.
 *
 * - `"e164"` → `+819012345678` — the only form worth storing.
 * - `"international"` → `+81 90-1234-5678`
 * - `"national"` → `090-1234-5678`
 * - `"compact"` → `09012345678`
 *
 * Returns `null` for unparseable input.
 */
export function formatPhone(input: string, format: PhoneFormat = "national"): string | null {
  const parsed = parsePhone(input);
  if (parsed === null) return null;

  if (format === "compact") return parsed.national;
  if (format === "e164") return `+${JP_COUNTRY_CODE}${parsed.nsn}`;

  const grouped = groupNational(parsed);
  if (format === "national") return grouped;
  return `+${JP_COUNTRY_CODE} ${grouped.replace(/^0/, "")}`;
}

function groupNational(parsed: ParsedPhone): string {
  const { national, type } = parsed;

  if (type === "special") return national;

  if (type === "mobile" || type === "ip") {
    if (national.length !== 11) return national;
    return `${national.slice(0, 3)}-${national.slice(3, 7)}-${national.slice(7)}`;
  }

  if (type === "toll-free" || type === "navi-dial") {
    if (national.length === 10) {
      return `${national.slice(0, 4)}-${national.slice(4, 7)}-${national.slice(7)}`;
    }
    if (national.length === 11) {
      return `${national.slice(0, 4)}-${national.slice(4, 7)}-${national.slice(7)}`;
    }
    return national;
  }

  if (type === "fixed-line" && national.length === 10 && parsed.areaCode) {
    const area = parsed.areaCode;
    const rest = national.slice(1 + area.length);
    const local = rest.slice(0, rest.length - 4);
    const subscriber = rest.slice(-4);
    return `0${area}-${local}-${subscriber}`;
  }

  return national;
}

/**
 * Structural validity: parseable, and of an expected length for its type.
 *
 * Does not check that the number is in service. For that you need an HLR
 * lookup or an SMS send — and you should not block a signup on either.
 */
export function isValidPhone(input: string): boolean {
  const parsed = parsePhone(input);
  if (parsed === null) return false;
  return parsed.warnings.length === 0;
}

export function isMobilePhone(input: string): boolean {
  return parsePhone(input)?.type === "mobile";
}

/**
 * Detect a number whose trunk `0` was destroyed by numeric storage.
 *
 * `090-1234-5678` put through `parseInt`, a JSON number, or an unformatted
 * spreadsheet cell becomes `9012345678` — ten digits that look like a valid
 * fixed line. This is one of the highest-severity silent failures in Japanese
 * customer data, because the number stays plausible.
 */
export function looksLikeLostLeadingZero(input: string): boolean {
  const text = toHalfWidthAscii(String(input)).replace(/\D/g, "");
  if (text.startsWith("0")) return false;
  // 10 digits starting 70/80/90 → an 11-digit mobile missing its zero.
  if (text.length === 10 && /^(70|80|90|50)/.test(text)) return true;
  // 9 digits starting with a valid area-code lead → a 10-digit fixed line missing its zero.
  if (text.length === 9 && /^[1-9]/.test(text)) return true;
  return false;
}
