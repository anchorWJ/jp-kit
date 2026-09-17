/** Hiragana ⇄ katakana conversion and Japanese script detection. */

const HIRAGANA_START = 0x3041; // ぁ
const HIRAGANA_END = 0x3096; // ゖ
const KATAKANA_START = 0x30a1; // ァ
const KATAKANA_END = 0x30f6; // ヶ
const KANA_OFFSET = KATAKANA_START - HIRAGANA_START; // 0x60

/** Iteration marks: ゝゞ ⇄ ヽヾ. */
const ITERATION_HIRA_TO_KATA: Readonly<Record<string, string>> = {
  "ゝ": "ヽ",
  "ゞ": "ヾ",
};
const ITERATION_KATA_TO_HIRA: Readonly<Record<string, string>> = {
  "ヽ": "ゝ",
  "ヾ": "ゞ",
};

/**
 * Hiragana → katakana. `たなか` → `タナカ`.
 *
 * ヷヸヹヺ (U+30F7–U+30FA) have no hiragana counterpart and are left untouched
 * in the reverse direction; the prolonged sound mark ー (U+30FC) is shared by
 * both scripts and is never converted.
 */
export function hiraganaToKatakana(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= HIRAGANA_START && code <= HIRAGANA_END) {
      out += String.fromCodePoint(code + KANA_OFFSET);
    } else {
      out += ITERATION_HIRA_TO_KATA[ch] ?? ch;
    }
  }
  return out;
}

/** Katakana → hiragana. `タナカ` → `たなか`. */
export function katakanaToHiragana(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= KATAKANA_START && code <= KATAKANA_END) {
      out += String.fromCodePoint(code - KANA_OFFSET);
    } else {
      out += ITERATION_KATA_TO_HIRA[ch] ?? ch;
    }
  }
  return out;
}

const RE_HIRAGANA = /[ぁ-ゖゝゞ]/u;
const RE_KATAKANA = /[ァ-ヺヽヾｦ-ﾝ]/u;
const RE_KANJI = /[㐀-䶿一-鿿豈-﫿々]|[\u{20000}-\u{2FA1F}]/u;
const RE_LATIN = /[A-Za-zＡ-Ｚａ-ｚ]/u;

/**
 * Characters that legitimately appear inside kana-only fields (フリガナ) but are
 * not themselves kana: the prolonged sound mark, the middle dot used between
 * a foreign given and family name, and spaces.
 */
const RE_KANA_FIELD_EXTRAS = /[ー・･　\s]/u;

export function containsHiragana(input: string): boolean {
  return RE_HIRAGANA.test(input);
}

export function containsKatakana(input: string): boolean {
  return RE_KATAKANA.test(input);
}

export function containsKanji(input: string): boolean {
  return RE_KANJI.test(input);
}

export function containsLatin(input: string): boolean {
  return RE_LATIN.test(input);
}

/**
 * True if every character is katakana or an accepted separator.
 *
 * This is the check a `フリガナ` field should use. Note that it accepts ー and ・,
 * which naive `/^[ァ-ン]+$/` validators reject — breaking every katakana loanword
 * name (`ジョーンズ`) and every foreign resident (`マリア・ガルシア`).
 */
export function isKatakanaField(input: string): boolean {
  if (input.length === 0) return false;
  for (const ch of input) {
    if (!RE_KATAKANA.test(ch) && !RE_KANA_FIELD_EXTRAS.test(ch)) return false;
  }
  return true;
}

/** The `ふりがな` counterpart of {@link isKatakanaField}. */
export function isHiraganaField(input: string): boolean {
  if (input.length === 0) return false;
  for (const ch of input) {
    if (!RE_HIRAGANA.test(ch) && !RE_KANA_FIELD_EXTRAS.test(ch)) return false;
  }
  return true;
}

export type Script = "hiragana" | "katakana" | "kanji" | "latin" | "mixed" | "other";

/**
 * Best-effort script classification of a whole string.
 * Returns `"mixed"` when more than one Japanese script is meaningfully present
 * (`田中タロウ`), which is normal for Japanese names and must not be rejected.
 */
export function detectScript(input: string): Script {
  const found: Script[] = [];
  if (containsHiragana(input)) found.push("hiragana");
  if (containsKatakana(input)) found.push("katakana");
  if (containsKanji(input)) found.push("kanji");
  if (containsLatin(input)) found.push("latin");
  if (found.length === 0) return "other";
  if (found.length === 1) return found[0]!;
  return "mixed";
}
