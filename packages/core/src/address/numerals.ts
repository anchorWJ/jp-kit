/**
 * Numeral handling inside Japanese addresses.
 *
 * Kanji numerals in an address are only sometimes numbers. 六本木, 四谷, 三鷹,
 * 十三 and 二子玉川 are place names; 二丁目 is a block number. The difference is
 * the *unit* that follows, so every conversion here is gated on that unit.
 */

import { KANJI_NUMERAL_CLASS, kanjiToNumber } from "../unicode/numbers.js";
import { toHalfWidthAscii } from "../unicode/width.js";
import { normalizeHyphens } from "../unicode/text.js";

const N = KANJI_NUMERAL_CLASS;

/**
 * Units after which a preceding kanji numeral is unambiguously a number.
 * `番` is absent — 一番町 and 二番街 are place names.
 */
const UNAMBIGUOUS_UNITS = ["丁目", "番地", "号室", "号"] as const;

const RE_UNAMBIGUOUS = new RegExp(`([${N}]+)(${UNAMBIGUOUS_UNITS.join("|")})`, "gu");

/** `N番` is numeric unless it heads a place name (一番町, 三番街, 二番丁). */
const RE_BAN = new RegExp(`([${N}]+)番(?![町街丁])`, "gu");

/** Sapporo-style grid: 北12条西3丁目. The direction prefix disambiguates 条. */
const RE_JO = new RegExp(`([北南東西])([${N}]+)条`, "gu");

/**
 * Convert kanji numerals to Arabic **only** where a following unit proves they
 * are numbers, and fold full-width digits.
 *
 * ```ts
 * normalizeAddressNumerals("東京都港区六本木六丁目十番一号")
 * // "東京都港区六本木6丁目10番1号"   ← 六本木 is left alone
 * ```
 */
export function normalizeAddressNumerals(input: string): string {
  let out = toHalfWidthAscii(input);
  out = out.replace(RE_JO, (_m, dir: string, num: string) => {
    const n = kanjiToNumber(num);
    return n === null ? `${dir}${num}条` : `${dir}${n}条`;
  });
  out = out.replace(RE_UNAMBIGUOUS, (_m, num: string, unit: string) => {
    const n = kanjiToNumber(num);
    return n === null ? `${num}${unit}` : `${n}${unit}`;
  });
  out = out.replace(RE_BAN, (m, num: string) => {
    const n = kanjiToNumber(num);
    return n === null ? m : `${n}番`;
  });
  return out;
}

/**
 * Separators typed between block numbers. Includes ー (U+30FC), which is not a
 * hyphen in general text but is one when it sits between two digits — a
 * Japanese keyboard in kana mode produces it from the same physical key.
 */
const RE_DIGIT_SEPARATOR = /(?<=\d)\s*(?:[-ー‐-―−－・·]|の|ノ|之)\s*(?=\d)/gu;

/** Collapse every inter-digit separator to an ASCII hyphen: `1ー2の3` → `1-2-3`. */
export function normalizeBlockSeparators(input: string): string {
  return normalizeHyphens(input.replace(RE_DIGIT_SEPARATOR, "-"));
}

export interface BlockNumber {
  /** 丁目 */
  readonly chome?: number;
  /** 番 / 番地 */
  readonly ban?: number;
  /** 号 */
  readonly go?: number;
  /** Any trailing text that was not part of the block number (usually a building). */
  readonly rest: string;
  /** The substring that was consumed as the block number. */
  readonly matched: string;
}

const RE_UNIT_FORM =
  /^(?:(\d+)\s*丁目)?\s*(?:(\d+)\s*(?:番地|番))?\s*(?:(\d+)\s*号(?!室))?/u;
const RE_DASH_FORM = /^(\d+)(?:-(\d+))?(?:-(\d+))?/u;

/**
 * Pull a `丁目/番/号` block number off the front of a string, in either the
 * unit form (`1丁目2番3号`) or the dash form (`1-2-3`).
 *
 * Returns `null` when the string does not start with a block number.
 */
export function parseBlockNumber(input: string): BlockNumber | null {
  const text = normalizeBlockSeparators(normalizeAddressNumerals(input)).trim();

  const unit = RE_UNIT_FORM.exec(text);
  if (unit && unit[0].length > 0 && /[丁番号]/u.test(unit[0])) {
    const [matched, chome, ban, go] = unit;
    return {
      ...(chome !== undefined ? { chome: Number(chome) } : {}),
      ...(ban !== undefined ? { ban: Number(ban) } : {}),
      ...(go !== undefined ? { go: Number(go) } : {}),
      rest: text.slice(matched.length).trim(),
      matched: matched.trim(),
    };
  }

  const dash = RE_DASH_FORM.exec(text);
  if (dash) {
    const [matched, a, b, c] = dash;
    return {
      ...(a !== undefined ? { chome: Number(a) } : {}),
      ...(b !== undefined ? { ban: Number(b) } : {}),
      ...(c !== undefined ? { go: Number(c) } : {}),
      rest: text.slice(matched.length).trim(),
      matched,
    };
  }

  return null;
}

export interface FormatBlockNumberOptions {
  /** `"units"` → `1丁目2番3号`; `"dashes"` → `1-2-3`. Default `"units"`. */
  style?: "units" | "dashes";
}

/** Render a parsed block number back to text. */
export function formatBlockNumber(
  block: Pick<BlockNumber, "chome" | "ban" | "go">,
  options: FormatBlockNumberOptions = {},
): string {
  const { style = "units" } = options;
  const parts = [block.chome, block.ban, block.go].filter(
    (n): n is number => typeof n === "number",
  );
  if (parts.length === 0) return "";
  if (style === "dashes") return parts.join("-");

  let out = "";
  if (block.chome !== undefined) out += `${block.chome}丁目`;
  if (block.ban !== undefined) out += `${block.ban}番`;
  if (block.go !== undefined) out += `${block.go}号`;
  return out;
}
