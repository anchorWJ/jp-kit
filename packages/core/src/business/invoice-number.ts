/**
 * 適格請求書発行事業者登録番号 — Invoice Registration Number.
 *
 * Introduced with the qualified-invoice system (インボイス制度) in October 2023.
 * Format: the letter `T` followed by thirteen digits.
 *
 * - For a registered corporation, the thirteen digits **are** its Corporate
 *   Number, so the same check digit applies.
 * - For a sole proprietor (個人事業主) or an unincorporated association, a
 *   separate thirteen-digit number is issued that does not collide with any
 *   Corporate Number. It uses the same check-digit rule.
 *
 * A buyer who cannot present a valid number loses the input-tax credit on the
 * purchase, which is why invoicing products must validate this at entry rather
 * than at month end.
 */

import { toHalfWidthAscii } from "../unicode/width.js";
import { stripZeroWidth } from "../unicode/text.js";
import {
  corporateNumberCheckDigit,
  isValidCorporateNumber,
} from "./corporate-number.js";

const RE_INVOICE = /^T(\d{13})$/;

/**
 * Normalize to the canonical `T` + 13 digits.
 *
 * Accepts a lower-case `t`, the full-width `Ｔ`, hyphens, spaces, and a bare
 * thirteen-digit number (to which the `T` is added).
 */
export function toInvoiceNumber(input: string): string | null {
  let text = stripZeroWidth(toHalfWidthAscii(String(input)))
    .trim()
    .replace(/[-\sー‐-―−－]/gu, "")
    .toUpperCase();
  if (/^\d{13}$/.test(text)) text = `T${text}`;
  return RE_INVOICE.test(text) ? text : null;
}

export interface InvoiceNumberValidation {
  readonly valid: boolean;
  readonly normalized?: string;
  /** The thirteen digits without the `T`. */
  readonly digits?: string;
  /**
   * `true` when the digits are a structurally valid Corporate Number, meaning
   * the registrant is a corporation and the two identifiers can be
   * cross-checked. `false` is normal for a sole proprietor.
   */
  readonly matchesCorporateNumber?: boolean;
  readonly reason?: "bad-format" | "check-digit-mismatch";
  readonly expectedCheckDigit?: number;
}

/**
 * Validate an Invoice Registration Number.
 *
 * ```ts
 * validateInvoiceNumber("T7000012050002") // { valid: true, matchesCorporateNumber: true }
 * validateInvoiceNumber("7000012050002")  // same — a bare number is accepted and prefixed
 * validateInvoiceNumber("T1234567890123") // { valid: false, reason: "check-digit-mismatch" }
 * ```
 */
export function validateInvoiceNumber(input: string): InvoiceNumberValidation {
  const normalized = toInvoiceNumber(input);
  if (normalized === null) return { valid: false, reason: "bad-format" };

  const digits = normalized.slice(1);
  const expected = corporateNumberCheckDigit(digits.slice(1));
  if (Number(digits[0]) !== expected) {
    return {
      valid: false,
      normalized,
      digits,
      reason: "check-digit-mismatch",
      expectedCheckDigit: expected,
    };
  }

  return {
    valid: true,
    normalized,
    digits,
    matchesCorporateNumber: isValidCorporateNumber(digits),
  };
}

/** Boolean wrapper around {@link validateInvoiceNumber}. */
export function isValidInvoiceNumber(input: string): boolean {
  return validateInvoiceNumber(input).valid;
}

/** Derive the Invoice Registration Number a corporation will have been issued. */
export function invoiceNumberFromCorporateNumber(corporateNumber: string): string | null {
  if (!isValidCorporateNumber(corporateNumber)) return null;
  const digits = corporateNumber.replace(/\D/g, "");
  return `T${digits}`;
}
