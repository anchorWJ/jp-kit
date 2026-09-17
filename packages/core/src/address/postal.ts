/** Japanese postal codes (郵便番号): seven digits, conventionally `123-4567`. */

import { toHalfWidthAscii } from "../unicode/width.js";
import { normalizeHyphens, stripZeroWidth } from "../unicode/text.js";

const RE_SEVEN_DIGITS = /^\d{7}$/;

/**
 * Reduce any written form to seven bare digits, or `null` if it is not a
 * postal code.
 *
 * Accepts `〒123-4567`, `１２３－４５６７`, `123 4567`, `1234567`, and the
 * ideographic-space and prolonged-sound-mark variants that Japanese IMEs emit.
 */
export function toPostalDigits(input: string): string | null {
  let text = stripZeroWidth(input).trim();
  text = text.replace(/^〒/, "").trim();
  text = toHalfWidthAscii(text);
  text = normalizeHyphens(text);
  // ー (U+30FC) between digits is a hyphen typed with the kana key.
  text = text.replace(/(?<=\d)ー(?=\d)/gu, "-");
  const digits = text.replace(/[-\s]/g, "");
  return RE_SEVEN_DIGITS.test(digits) ? digits : null;
}

export interface FormatPostalCodeOptions {
  /** Include the 〒 mark. Default `false`. */
  mark?: boolean;
  /** Insert the hyphen after three digits. Default `true`. */
  hyphen?: boolean;
}

/**
 * Canonical postal code, `123-4567`.
 * Returns `null` for input that is not a valid seven-digit code.
 */
export function formatPostalCode(
  input: string,
  options: FormatPostalCodeOptions = {},
): string | null {
  const { mark = false, hyphen = true } = options;
  const digits = toPostalDigits(input);
  if (digits === null) return null;
  const body = hyphen ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
  return mark ? `〒${body}` : body;
}

/**
 * Structural validity only: seven digits.
 *
 * This deliberately does **not** check that the code has been assigned.
 * Assignment changes monthly as municipalities merge; a hard-coded allow-list
 * goes stale and starts rejecting real customers. Check existence against a
 * refreshed dataset (Japan Post KEN_ALL) if you need it, and treat a miss as a
 * warning rather than a rejection.
 */
export function isValidPostalCode(input: string): boolean {
  return toPostalDigits(input) !== null;
}

/**
 * The first two digits identify the prefecture-level delivery area, but the
 * mapping is many-to-one and not contiguous, so this returns a *candidate*
 * check only: `false` means the pairing is certainly wrong, `true` means it is
 * plausible.
 */
export function postalPrefixIsPlausibleFor(postal: string, prefectureCode: string): boolean {
  const digits = toPostalDigits(postal);
  if (digits === null) return false;
  const prefix = Number(digits.slice(0, 3));
  const ranges = POSTAL_PREFIX_RANGES[prefectureCode];
  if (!ranges) return true; // unknown prefecture code — do not claim a contradiction
  return ranges.some(([lo, hi]) => prefix >= lo && prefix <= hi);
}

/**
 * Approximate first-three-digit ranges per prefecture (JIS code → ranges).
 *
 * Source: the published 郵便番号 area allocation. Ranges overlap at boundaries
 * and a handful of codes fall outside their nominal range, which is exactly why
 * this is exposed as "plausible", never as "valid".
 */
const POSTAL_PREFIX_RANGES: Readonly<Record<string, ReadonlyArray<readonly [number, number]>>> = {
  "01": [[1, 99]],
  "02": [[30, 39]],
  "03": [[20, 29]],
  "04": [[980, 989]],
  "05": [[10, 19]],
  "06": [[990, 999]],
  "07": [[960, 979]],
  "08": [[300, 319]],
  "09": [[320, 329]],
  "10": [[370, 379]],
  "11": [[330, 369]],
  "12": [[260, 299]],
  "13": [[100, 208]],
  "14": [[210, 259]],
  "15": [[940, 959]],
  "16": [[930, 939]],
  "17": [[920, 929]],
  "18": [[910, 919]],
  "19": [[400, 409]],
  "20": [[380, 399]],
  "21": [[500, 509]],
  "22": [[410, 439]],
  "23": [[440, 498]],
  "24": [[510, 519]],
  "25": [[520, 529]],
  "26": [[600, 629]],
  "27": [[530, 599]],
  "28": [[650, 679]],
  "29": [[630, 639]],
  "30": [[640, 649]],
  "31": [[680, 689]],
  "32": [[690, 699]],
  "33": [[700, 719]],
  "34": [[720, 739]],
  "35": [[740, 759]],
  "36": [[770, 779]],
  "37": [[760, 769]],
  "38": [[790, 799]],
  "39": [[780, 789]],
  "40": [[800, 839]],
  "41": [[840, 849]],
  "42": [[850, 859]],
  "43": [[860, 869]],
  "44": [[870, 879]],
  "45": [[880, 889]],
  "46": [[890, 899]],
  "47": [[900, 909]],
};
