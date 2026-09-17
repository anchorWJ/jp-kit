/**
 * The adapter contract.
 *
 * A JapanReady test run drives *your* implementation, not this one. You supply
 * an adapter that points each operation at whatever function your product
 * already uses, and the test kit replays the edge-case corpus through it.
 *
 * Every member is optional. An operation you do not implement is reported as
 * uncovered rather than failed — a product that never stores a Corporate Number
 * should not be marked down for not validating one.
 */

import { normalizeText } from "./unicode/text.js";
import { foldVariants } from "./unicode/variants.js";
import {
  formatName,
  isValidKanaReading,
  nameKey,
  normalizeName,
  splitName,
  validateName,
  type PersonName,
} from "./names/index.js";
import { formatPostalCode, isValidPostalCode } from "./address/postal.js";
import { formatAddress, parseAddress, type JapaneseAddress } from "./address/parse.js";
import { formatPhone, isValidPhone } from "./phone/index.js";
import { isValidCorporateNumber } from "./business/corporate-number.js";
import { isValidInvoiceNumber } from "./business/invoice-number.js";
import { companyNameKey, normalizeCompanyName } from "./business/company-name.js";

/** Every operation the corpus can exercise. */
export const OPERATIONS = [
  "normalizeText",
  "foldVariants",
  "normalizeName",
  "splitName",
  "formatName",
  "nameKey",
  "validateName",
  "validateKanaReading",
  "normalizePostalCode",
  "validatePostalCode",
  "parseAddress",
  "formatAddress",
  "normalizePhone",
  "formatPhoneNational",
  "validatePhone",
  "validateCorporateNumber",
  "validateInvoiceNumber",
  "normalizeCompanyName",
  "companyNameKey",
] as const;

export type Operation = (typeof OPERATIONS)[number];

/** The subset of a parsed address the corpus asserts on. */
export type AddressFields = Pick<
  JapaneseAddress,
  | "postalCode"
  | "prefecture"
  | "county"
  | "city"
  | "ward"
  | "town"
  | "chome"
  | "ban"
  | "go"
  | "building"
>;

export interface JapanReadyAdapter {
  /** Optional label shown in the report header. */
  readonly name?: string;

  // --- text ---------------------------------------------------------------
  /** Canonical form of a free-text Japanese field. */
  normalizeText?(input: string): string;
  /** Comparison form with kanji variants folded. */
  foldVariants?(input: string): string;

  // --- names --------------------------------------------------------------
  normalizeName?(input: string): string;
  splitName?(input: string): PersonName;
  formatName?(name: PersonName, order: "japanese" | "western"): string;
  /** Deduplication key. */
  nameKey?(input: string): string;
  /** `true` to accept the value into a name field. */
  validateName?(input: string): boolean;
  /** `true` to accept the value into a フリガナ field. */
  validateKanaReading?(input: string): boolean;

  // --- addresses ----------------------------------------------------------
  /** Canonical `123-4567`, or `null` when not a postal code. */
  normalizePostalCode?(input: string): string | null;
  validatePostalCode?(input: string): boolean;
  parseAddress?(input: string): AddressFields;
  formatAddress?(address: AddressFields): string;

  // --- phone --------------------------------------------------------------
  /** E.164, e.g. `+819012345678`, or `null`. */
  normalizePhone?(input: string): string | null;
  /** Domestic display form, e.g. `090-1234-5678`. */
  formatPhoneNational?(input: string): string | null;
  validatePhone?(input: string): boolean;

  // --- business -----------------------------------------------------------
  validateCorporateNumber?(input: string): boolean;
  validateInvoiceNumber?(input: string): boolean;
  normalizeCompanyName?(input: string): string;
  companyNameKey?(input: string): string;
}

/**
 * The reference implementation, backed by `@japanready/core`.
 *
 * Two uses: as a baseline to diff your own behaviour against, and as the
 * fixture the corpus itself is regression-tested with (`japanready test
 * --reference` must stay at 100%, otherwise the corpus has a bad expectation
 * rather than your product having a bug).
 */
export const referenceAdapter: Required<Omit<JapanReadyAdapter, "name">> & { name: string } = {
  name: "@japanready/core reference",

  normalizeText: (input) => normalizeText(input),
  foldVariants: (input) => foldVariants(normalizeText(input)),

  normalizeName: (input) => normalizeName(input),
  splitName: (input) => splitName(input),
  formatName: (name, order) => formatName(name, { order }),
  nameKey: (input) => nameKey(input),
  validateName: (input) => validateName(input).valid,
  validateKanaReading: (input) => isValidKanaReading(input, "katakana"),

  normalizePostalCode: (input) => formatPostalCode(input),
  validatePostalCode: (input) => isValidPostalCode(input),
  parseAddress: (input) => {
    const parsed = parseAddress(input);
    return {
      ...(parsed.postalCode !== undefined ? { postalCode: parsed.postalCode } : {}),
      ...(parsed.prefecture !== undefined ? { prefecture: parsed.prefecture } : {}),
      ...(parsed.county !== undefined ? { county: parsed.county } : {}),
      ...(parsed.city !== undefined ? { city: parsed.city } : {}),
      ...(parsed.ward !== undefined ? { ward: parsed.ward } : {}),
      ...(parsed.town !== undefined ? { town: parsed.town } : {}),
      ...(parsed.chome !== undefined ? { chome: parsed.chome } : {}),
      ...(parsed.ban !== undefined ? { ban: parsed.ban } : {}),
      ...(parsed.go !== undefined ? { go: parsed.go } : {}),
      ...(parsed.building !== undefined ? { building: parsed.building } : {}),
    };
  },
  formatAddress: (address) => formatAddress(address),

  normalizePhone: (input) => formatPhone(input, "e164"),
  formatPhoneNational: (input) => formatPhone(input, "national"),
  validatePhone: (input) => isValidPhone(input),

  validateCorporateNumber: (input) => isValidCorporateNumber(input),
  validateInvoiceNumber: (input) => isValidInvoiceNumber(input),
  normalizeCompanyName: (input) => normalizeCompanyName(input),
  companyNameKey: (input) => companyNameKey(input),
};
