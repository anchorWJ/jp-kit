/**
 * A deliberately typical Western SaaS implementation.
 *
 * Nothing here is strawman code. Every function is the shape you find in a real
 * codebase that has shipped to the US and Europe and is now "adding Japanese
 * support": a trim, an NFKC, a `[A-Za-z\p{L}]` name rule, a 3-3-4 phone regex,
 * a postal code stored as a number, and a length check standing in for a
 * checksum.
 *
 * Run `npm run demo:naive` from the repository root to see what it scores.
 */

import type { JapanReadyAdapter } from "@japanready/testkit";

const adapter: JapanReadyAdapter = {
  name: "naive-app (a typical Western implementation)",

  // Reaches for the standard library and gets more than it asked for: NFKC
  // folds width (wanted) but also rewrites ㈱ → (株) and ① → 1 (not wanted),
  // and leaves the ideographic space alone in the middle of a value.
  normalizeText: (input) => input.normalize("NFKC").trim(),

  // Assumes a name is one or more "words" of letters, and that 32 characters is
  // plenty. Rejects the middle dot, rejects anything long, and rejects the
  // iteration mark 々 because it is punctuation, not a letter.
  validateName: (input) => {
    const trimmed = input.trim();
    return trimmed.length > 0 && trimmed.length <= 32 && /^[\p{L}\s'-]+$/u.test(trimmed);
  },

  // The regex everyone writes for a kana field. Excludes ー, ・ and ヴ.
  validateKanaReading: (input) => /^[ァ-ン]+$/u.test(input.trim()),

  // Splits on whitespace and assumes two parts, Western order.
  splitName: (input) => {
    const parts = input.trim().split(/\s+/);
    return { given: parts[0], family: parts[1] };
  },

  formatName: (name, order) =>
    order === "western"
      ? [name.given, name.family].filter(Boolean).join(" ")
      : [name.family, name.given].filter(Boolean).join(" "),

  nameKey: (input) => input.trim().toLowerCase(),

  // Strips separators, then hands the value to Number() on the way into an
  // INTEGER column. Works for 150-0002 and destroys 060-0001.
  normalizePostalCode: (input) => {
    const digits = input.replace(/\D/g, "");
    if (digits.length !== 5 && digits.length !== 7) return null;
    const asNumber = Number(digits);
    const back = String(asNumber);
    return `${back.slice(0, 3)}-${back.slice(3)}`;
  },

  validatePostalCode: (input) => /^\d{5}(-\d{4})?$|^\d{3}-?\d{4}$/.test(input.trim()),

  // Two address lines and a city, which is the schema the product already has.
  parseAddress: (input) => {
    const [first, ...rest] = input.split(/[,\s]+/);
    return { town: first, building: rest.join(" ") };
  },

  formatAddress: (address) => [address.town, address.building].filter(Boolean).join(" "),

  // The North American shape, and a country code bolted on.
  normalizePhone: (input) => {
    const digits = input.replace(/\D/g, "");
    if (digits.length !== 10) return null;
    return `+1${digits}`;
  },

  formatPhoneNational: (input) => {
    const d = input.replace(/\D/g, "");
    if (d.length !== 10) return null;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  },

  validatePhone: (input) => /^\d{3}-\d{3}-\d{4}$/.test(input.trim()),

  // Length stands in for a checksum, which is the single most common way a
  // Corporate Number field ships.
  validateCorporateNumber: (input) => /^\d{13}$/.test(input.replace(/[\s-]/g, "")),

  validateInvoiceNumber: (input) => /^T\d{13}$/.test(input.trim()),

  normalizeCompanyName: (input) => input.normalize("NFKC").trim(),

  companyNameKey: (input) => input.normalize("NFKC").trim().toLowerCase(),

  // foldVariants is simply absent: the product has never heard of 異体字, so
  // JapanReady reports those cases as uncovered rather than failed.
};

export default adapter;
