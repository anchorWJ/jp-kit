/** Whitespace, dash, and general text normalization for Japanese input. */

import {
  IDEOGRAPHIC_SPACE,
  composeVoicedMarks,
  halfWidthKanaToFullWidth,
  toHalfWidthAscii,
} from "./width.js";

/**
 * Every code point a Japanese keyboard, a PDF, or a copy-paste can produce where
 * an ASCII hyphen was meant.
 *
 * U+30FC (ー KATAKANA-HIRAGANA PROLONGED SOUND MARK) is deliberately **absent**.
 * It is a letter in `ジョーンズ` and a hyphen in `1ー2ー3`, and only the field's
 * context can tell them apart — see `normalizeSeparators` in the address and
 * phone modules.
 */
export const HYPHEN_LIKE = [
  "-", // - HYPHEN-MINUS
  "‐", // ‐ HYPHEN
  "‑", // ‑ NON-BREAKING HYPHEN
  "‒", // ‒ FIGURE DASH
  "–", // – EN DASH
  "—", // — EM DASH
  "―", // ― HORIZONTAL BAR
  "−", // − MINUS SIGN
  "﹘", // ﹘ SMALL EM DASH
  "﹣", // ﹣ SMALL HYPHEN-MINUS
  "－", // － FULLWIDTH HYPHEN-MINUS
] as const;

const RE_HYPHEN_LIKE = new RegExp(`[${HYPHEN_LIKE.join("")}]`, "gu");

/**
 * Whitespace beyond ASCII space. U+200B and U+FEFF are invisible and routinely
 * survive a `trim()` — they are the reason a field "looks identical" but fails
 * an equality check.
 */
export const SPACE_LIKE = [
  "	", // tab
  "",
  "",
  " ", // NO-BREAK SPACE
  " ",
  " ", " ", " ", " ", " ", " ",
  " ", " ", " ", " ", " ",
  " ",
  " ",
  "　", // IDEOGRAPHIC SPACE
] as const;

/** Zero-width characters that must be removed, not converted to a space. */
export const ZERO_WIDTH = [
  "​", // ZERO WIDTH SPACE
  "‌", // ZERO WIDTH NON-JOINER
  "‍", // ZERO WIDTH JOINER
  "⁠", // WORD JOINER
  "﻿", // ZERO WIDTH NO-BREAK SPACE / BOM
] as const;

const RE_SPACE_LIKE = new RegExp(`[${SPACE_LIKE.join("")}]`, "gu");
const RE_ZERO_WIDTH = new RegExp(`[${ZERO_WIDTH.join("")}]`, "gu");

/** Collapse every hyphen-like code point to an ASCII `-`. */
export function normalizeHyphens(input: string): string {
  return input.replace(RE_HYPHEN_LIKE, "-");
}

/** Remove zero-width and BOM characters. */
export function stripZeroWidth(input: string): string {
  return input.replace(RE_ZERO_WIDTH, "");
}

/**
 * Convert exotic spaces to U+0020, drop zero-width characters, collapse runs,
 * and trim. `　田中　　太郎　` → `田中 太郎`.
 */
export function normalizeWhitespace(input: string): string {
  return stripZeroWidth(input).replace(RE_SPACE_LIKE, " ").replace(/ {2,}/g, " ").trim();
}

/**
 * Wave dash / fullwidth tilde. Shift_JIS 0x8160 round-trips to U+301C on some
 * platforms and U+FF5E on others; a value written by one system and read by the
 * other compares unequal. Pick one — this picks U+FF5E, which is what Windows,
 * and therefore most Japanese business input, produces.
 */
export function normalizeWaveDash(input: string, to: "〜" | "～" = "～"): string {
  const from = to === "～" ? /〜/g : /～/g;
  return input.replace(from, to);
}

export interface NormalizeTextOptions {
  /** Full-width ASCII → half-width ASCII, ideographic space → space. Default `true`. */
  width?: boolean;
  /** Half-width katakana → full-width katakana, combining marks. Default `true`. */
  kana?: boolean;
  /** Collapse exotic whitespace, drop zero-width, trim. Default `true`. */
  whitespace?: boolean;
  /** Collapse hyphen-like code points to `-`. Default `true`. */
  hyphens?: boolean;
  /** Unify U+301C / U+FF5E. Default `true`. */
  waveDash?: boolean;
  /** Apply Unicode NFC at the end. Default `true`. */
  nfc?: boolean;
}

/**
 * The default text normalization for any Japanese free-text field.
 *
 * Deliberately **not** `NFKC`. NFKC would additionally rewrite ㈱ → (株),
 * ① → 1, ㌔ → キロ, and ½ → 1⁄2 — changes that damage company names and
 * product descriptions. Width folding is wanted; the rest is not.
 *
 * ```ts
 * normalizeText("ﾀﾅｶ　太郎") // "タナカ 太郎"
 * ```
 */
export function normalizeText(input: string, options: NormalizeTextOptions = {}): string {
  const {
    width = true,
    kana = true,
    whitespace = true,
    hyphens = true,
    waveDash = true,
    nfc = true,
  } = options;

  let out = input;
  if (kana) out = halfWidthKanaToFullWidth(out);
  if (kana) out = composeVoicedMarks(out);
  // Wave dash before width folding, so that U+301C and U+FF5E converge on the
  // same result. Folding width first would leave U+FF5E as "~" and U+301C as
  // "～" — two spellings of the same mark, which is the bug being fixed.
  if (waveDash) out = normalizeWaveDash(out);
  if (width) out = toHalfWidthAscii(out);
  if (hyphens) out = normalizeHyphens(out);
  if (whitespace) out = normalizeWhitespace(out);
  if (nfc) out = out.normalize("NFC");
  return out;
}

/**
 * True if `normalizeText` would change the input — i.e. the value as stored is
 * not in canonical form. Useful as a CI assertion over an existing database.
 */
export function needsNormalization(input: string, options?: NormalizeTextOptions): boolean {
  return normalizeText(input, options) !== input;
}

/** Restore an ideographic space between a family and given name, for 全角 display. */
export function toIdeographicSpacing(input: string): string {
  return input.replace(/ /g, IDEOGRAPHIC_SPACE);
}
