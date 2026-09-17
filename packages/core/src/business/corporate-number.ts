/**
 * 法人番号 — Corporate Number.
 *
 * Thirteen digits assigned by the National Tax Agency to every registered
 * corporation and government body. The **first** digit is a check digit over
 * the remaining twelve — a detail most implementations miss, because every
 * other identifier they have met puts the check digit last.
 */

import { toHalfWidthAscii } from "../unicode/width.js";
import { stripZeroWidth } from "../unicode/text.js";

const RE_THIRTEEN_DIGITS = /^\d{13}$/;

/** Strip decoration and fold width: `１２３４-５６７８-９０１２-３` → `1234567890123`. */
export function toCorporateNumberDigits(input: string): string | null {
  const text = stripZeroWidth(toHalfWidthAscii(String(input)))
    .trim()
    .replace(/[-\sー‐-―−－]/gu, "");
  return RE_THIRTEEN_DIGITS.test(text) ? text : null;
}

/**
 * Compute the check digit for a twelve-digit base number.
 *
 * ```text
 * check = 9 − ( Σ(n=1..12) Pn × Qn ) mod 9
 *   Pn = the n-th digit counting from the right of the 12-digit base
 *   Qn = 1 when n is odd, 2 when n is even
 * ```
 *
 * The result is always 1–9: `sum mod 9` lands in 0–8, so a Corporate Number
 * never begins with `0`. Any storage layer that treats the value as a number
 * and re-pads to thirteen characters is therefore not immediately caught —
 * but a leading-zero value is always wrong.
 *
 * Throws if `base` is not exactly twelve digits.
 */
export function corporateNumberCheckDigit(base: string): number {
  if (!/^\d{12}$/.test(base)) {
    throw new TypeError(`Corporate number base must be 12 digits, received "${base}"`);
  }
  let sum = 0;
  for (let n = 1; n <= 12; n++) {
    const digit = Number(base[12 - n]);
    sum += digit * (n % 2 === 1 ? 1 : 2);
  }
  return 9 - (sum % 9);
}

export interface CorporateNumberValidation {
  readonly valid: boolean;
  /** `undefined` when the input was not thirteen digits. */
  readonly normalized?: string;
  readonly reason?:
    | "not-thirteen-digits"
    | "check-digit-mismatch"
    | "all-zeros";
  /** The digit the checksum says it should have been. */
  readonly expectedCheckDigit?: number;
}

/**
 * Validate a Corporate Number, including its check digit.
 *
 * ```ts
 * validateCorporateNumber("7000012050002") // { valid: true, … }  国税庁
 * validateCorporateNumber("1000012050002") // { valid: false, expectedCheckDigit: 7 }
 * ```
 */
export function validateCorporateNumber(input: string): CorporateNumberValidation {
  const digits = toCorporateNumberDigits(input);
  if (digits === null) return { valid: false, reason: "not-thirteen-digits" };
  if (/^0{13}$/.test(digits)) {
    return { valid: false, normalized: digits, reason: "all-zeros" };
  }

  const expected = corporateNumberCheckDigit(digits.slice(1));
  if (Number(digits[0]) !== expected) {
    return {
      valid: false,
      normalized: digits,
      reason: "check-digit-mismatch",
      expectedCheckDigit: expected,
    };
  }
  return { valid: true, normalized: digits };
}

/** Boolean wrapper around {@link validateCorporateNumber}. */
export function isValidCorporateNumber(input: string): boolean {
  return validateCorporateNumber(input).valid;
}

/**
 * Build a valid Corporate Number from a twelve-digit base by prepending the
 * correct check digit. Intended for generating test fixtures — the result is
 * structurally valid but almost certainly not an assigned number.
 */
export function buildCorporateNumber(base: string): string {
  const padded = base.padStart(12, "0");
  return `${corporateNumberCheckDigit(padded)}${padded}`;
}

/**
 * Format for display. The National Tax Agency publishes these unseparated;
 * `groups` inserts hyphens for readability only — never store the hyphenated
 * form.
 */
export function formatCorporateNumber(input: string, groups = false): string | null {
  const digits = toCorporateNumberDigits(input);
  if (digits === null) return null;
  if (!groups) return digits;
  return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`;
}
