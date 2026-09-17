/** Kanji numeral ⇄ Arabic numeral conversion. */

import { toHalfWidthDigits } from "./width.js";

const DIGITS: Readonly<Record<string, number>> = {
  〇: 0, 零: 0,
  一: 1, 壱: 1, 壹: 1,
  二: 2, 弐: 2, 貳: 2,
  三: 3, 参: 3, 參: 3,
  四: 4, 肆: 4,
  五: 5, 伍: 5,
  六: 6, 陸: 6,
  七: 7, 漆: 7,
  八: 8, 捌: 8,
  九: 9, 玖: 9,
};

/** Small myriad units, applied within a group of four digits. */
const SMALL_UNITS: Readonly<Record<string, number>> = {
  十: 10, 拾: 10,
  百: 100, 佰: 100,
  千: 1000, 仟: 1000, 阡: 1000,
};

/** Myriad group separators. */
const LARGE_UNITS: Readonly<Record<string, number>> = {
  万: 10_000, 萬: 10_000,
  億: 100_000_000,
  兆: 1_000_000_000_000,
};

const RE_KANJI_NUMERAL = /^[〇零一壱壹二弐貳三参參四肆五伍六陸七漆八捌九玖十拾百佰千仟阡万萬億兆]+$/u;

/** True if every character is a kanji numeral. */
export function isKanjiNumeral(input: string): boolean {
  return input.length > 0 && RE_KANJI_NUMERAL.test(input);
}

/**
 * Parse a kanji numeral into a number.
 *
 * Handles both positional notation (`二十三` → 23, `一千二百三十四` → 1234) and
 * bare digit strings (`〇一二` → 12, which is how some legacy address data
 * writes a zero-padded value). Returns `null` for anything unparseable.
 *
 * ```ts
 * kanjiToNumber("三")      // 3
 * kanjiToNumber("十")      // 10  — bare 十 means ten, not one
 * kanjiToNumber("二十三")  // 23
 * kanjiToNumber("千二百")  // 1200
 * ```
 */
export function kanjiToNumber(input: string): number | null {
  const text = input.trim();
  if (text.length === 0 || !isKanjiNumeral(text)) return null;

  // Digit-string form: no unit characters at all.
  const hasUnit = [...text].some((ch) => ch in SMALL_UNITS || ch in LARGE_UNITS);
  if (!hasUnit) {
    let value = 0;
    for (const ch of text) {
      const d = DIGITS[ch];
      if (d === undefined) return null;
      value = value * 10 + d;
    }
    return value;
  }

  let total = 0; // completed myriad groups
  let group = 0; // current group (< 10000)
  let current = 0; // digits seen since the last unit

  for (const ch of text) {
    const digit = DIGITS[ch];
    if (digit !== undefined) {
      current = current * 10 + digit;
      continue;
    }

    const small = SMALL_UNITS[ch];
    if (small !== undefined) {
      // 十 with no preceding digit means 1×10, not 0×10.
      group += (current === 0 ? 1 : current) * small;
      current = 0;
      continue;
    }

    const large = LARGE_UNITS[ch];
    if (large !== undefined) {
      total += (group + current) * large;
      group = 0;
      current = 0;
      continue;
    }

    return null;
  }

  return total + group + current;
}

const DIGIT_CHARS = "〇一二三四五六七八九";

/**
 * Render a non-negative integer as a positional kanji numeral.
 * `23` → `二十三`, `1200` → `千二百`.
 */
export function numberToKanji(value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`numberToKanji expects a non-negative integer, received ${value}`);
  }
  if (value === 0) return "〇";
  if (value >= 10_000) {
    const upper = Math.floor(value / 10_000);
    const lower = value % 10_000;
    return `${numberToKanji(upper)}万${lower === 0 ? "" : numberToKanji(lower)}`;
  }

  const units: Array<[number, string]> = [
    [1000, "千"],
    [100, "百"],
    [10, "十"],
  ];

  let out = "";
  let rest = value;
  for (const [unitValue, unitChar] of units) {
    const count = Math.floor(rest / unitValue);
    if (count > 0) {
      // 千/百/十 with a leading 一 is written bare: 十三, not 一十三.
      out += count === 1 ? unitChar : `${DIGIT_CHARS[count]}${unitChar}`;
      rest %= unitValue;
    }
  }
  if (rest > 0) out += DIGIT_CHARS[rest];
  return out;
}

/**
 * Character class matching one kanji-numeral run. Exported so the address layer
 * can build context-aware patterns on top of it.
 *
 * There is deliberately no "convert every kanji numeral in this string"
 * function here. Applying one to an address turns 六本木 into `6本木`, 四谷 into
 * `4谷`, and 十三 (the Osaka district) into `13`. Kanji numerals in Japanese
 * addresses can only be converted with knowledge of the following unit —
 * see `normalizeAddressNumerals` in the address module.
 */
export const KANJI_NUMERAL_CLASS = "〇零一壱壹二弐貳三参參四肆五伍六陸七漆八捌九玖十拾百佰千仟阡";

/** Fold full-width digits to ASCII. Re-exported here for numeral-handling code. */
export { toHalfWidthDigits };
