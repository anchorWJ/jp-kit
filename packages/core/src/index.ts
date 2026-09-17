/**
 * @japanready/core — Japanese customer-data primitives.
 *
 * Normalization and validation for the data an international product actually
 * has to hold: names, kana readings, addresses, phone numbers, and the two
 * national business identifiers.
 *
 * Nothing here calls the network, and nothing here embeds a government dataset.
 * See the README for what that means for address parsing accuracy.
 */

// Unicode
export {
  IDEOGRAPHIC_SPACE,
  composeVoicedMarks,
  fullWidthKanaToHalfWidth,
  halfWidthKanaToFullWidth,
  hasFullWidthAscii,
  hasHalfWidthKana,
  toFullWidthAscii,
  toHalfWidthAscii,
  toHalfWidthDigits,
} from "./unicode/width.js";

export {
  HYPHEN_LIKE,
  SPACE_LIKE,
  ZERO_WIDTH,
  needsNormalization,
  normalizeHyphens,
  normalizeText,
  normalizeWaveDash,
  normalizeWhitespace,
  stripZeroWidth,
  toIdeographicSpacing,
  type NormalizeTextOptions,
} from "./unicode/text.js";

export {
  containsHiragana,
  containsKanji,
  containsKatakana,
  containsLatin,
  detectScript,
  hiraganaToKatakana,
  isHiraganaField,
  isKatakanaField,
  katakanaToHiragana,
  type Script,
} from "./unicode/kana.js";

export {
  foldVariants,
  isVariantEquivalent,
  knownVariants,
  stripVariationSelectors,
  type FoldVariantsOptions,
  type VariantTier,
} from "./unicode/variants.js";

export {
  KANJI_NUMERAL_CLASS,
  isKanjiNumeral,
  kanjiToNumber,
  numberToKanji,
} from "./unicode/numbers.js";

// Names
export {
  formatName,
  formatNameFullWidth,
  isAcceptableName,
  isValidKanaReading,
  nameKey,
  namesMatch,
  normalizeKanaReading,
  normalizeName,
  requiresKanaReading,
  splitName,
  validateName,
  type FormatNameOptions,
  type KanaFieldKind,
  type NameIssue,
  type NameIssueCode,
  type NameOrder,
  type NameValidation,
  type PersonName,
} from "./names/index.js";

// Addresses
export {
  PREFECTURES,
  PREFECTURE_SUFFIX_NOTES,
  findPrefecture,
  matchPrefecturePrefix,
  prefectureByCode,
  type Prefecture,
} from "./address/prefectures.js";

export {
  formatPostalCode,
  isValidPostalCode,
  postalPrefixIsPlausibleFor,
  toPostalDigits,
  type FormatPostalCodeOptions,
} from "./address/postal.js";

export {
  formatBlockNumber,
  normalizeAddressNumerals,
  normalizeBlockSeparators,
  parseBlockNumber,
  type BlockNumber,
  type FormatBlockNumberOptions,
} from "./address/numerals.js";

export {
  formatAddress,
  formatAddressLatin,
  normalizeAddress,
  parseAddress,
  type AddressConfidence,
  type FormatAddressOptions,
  type JapaneseAddress,
  type LatinAddressParts,
  type ParsedAddress,
} from "./address/parse.js";

// Phone
export {
  JP_COUNTRY_CODE,
  formatPhone,
  isMobilePhone,
  isValidPhone,
  looksLikeLostLeadingZero,
  parsePhone,
  type ParsedPhone,
  type PhoneFormat,
  type PhoneType,
} from "./phone/index.js";

// Business identity
export {
  buildCorporateNumber,
  corporateNumberCheckDigit,
  formatCorporateNumber,
  isValidCorporateNumber,
  toCorporateNumberDigits,
  validateCorporateNumber,
  type CorporateNumberValidation,
} from "./business/corporate-number.js";

export {
  invoiceNumberFromCorporateNumber,
  isValidInvoiceNumber,
  toInvoiceNumber,
  validateInvoiceNumber,
  type InvoiceNumberValidation,
} from "./business/invoice-number.js";

export {
  LEGAL_FORMS,
  companyNameKey,
  companyNamesMatch,
  expandCompanyAbbreviations,
  normalizeCompanyName,
  parseCompanyName,
  type LegalForm,
  type LegalFormPosition,
  type ParsedCompanyName,
} from "./business/company-name.js";

// Schema
export {
  SCHEMA_CAPABILITY_NOTES,
  validateCustomer,
  type CustomerIssue,
  type CustomerIssueSeverity,
  type CustomerValidation,
  type JapaneseCompany,
  type JapaneseCustomer,
  type SchemaCapabilities,
} from "./schema/index.js";

// Adapter contract
export {
  OPERATIONS,
  referenceAdapter,
  type AddressFields,
  type JapanReadyAdapter,
  type Operation,
} from "./adapter.js";
