/**
 * The canonical Japanese customer record.
 *
 * This is the shape the test kit asserts against. It exists because the usual
 * Western customer schema — `firstName`, `lastName`, `address1`, `address2`,
 * `city`, `state`, `zip` — cannot hold a Japanese record without lossy
 * guessing: there is no `state`, `city` is two or three separate levels, the
 * block number is structured rather than free text, and the kana reading has
 * nowhere to live at all.
 */

import type { PersonName } from "../names/index.js";
import type { JapaneseAddress } from "../address/parse.js";

export interface JapaneseCompany {
  /** Trade name including the legal form, as the customer wrote it. */
  readonly name: string;
  /** Kana reading of the company name, where collected. */
  readonly nameKana?: string;
  /** 法人番号, thirteen digits, unseparated. */
  readonly corporateNumber?: string;
  /** 適格請求書発行事業者登録番号, `T` + thirteen digits. */
  readonly invoiceNumber?: string;
  /** Department / division, which Japanese business forms collect separately. */
  readonly department?: string;
  /** 役職 — job title. */
  readonly title?: string;
}

export interface JapaneseCustomer {
  readonly name: PersonName;
  readonly company?: JapaneseCompany;
  readonly address?: JapaneseAddress;
  /** Stored in E.164 (`+819012345678`). */
  readonly phone?: string;
  readonly email?: string;
}

export type CustomerIssueSeverity = "critical" | "warning" | "info";

export interface CustomerIssue {
  readonly field: string;
  readonly code: string;
  readonly message: string;
  readonly severity: CustomerIssueSeverity;
}

export interface CustomerValidation {
  readonly valid: boolean;
  readonly issues: readonly CustomerIssue[];
}

/**
 * Field-level requirements that a Japan-capable schema must satisfy.
 * Used by the test kit to check a schema rather than a value.
 */
export interface SchemaCapabilities {
  /** A kana reading can be stored for personal names. */
  readonly personNameKana: boolean;
  /** Family and given names are stored separately *and* an unsplit name is allowed. */
  readonly personNameSplitOptional: boolean;
  /** Address holds prefecture, municipality, ward, town, and block separately. */
  readonly structuredAddress: boolean;
  /** Building / room line exists and is not folded into the town field. */
  readonly buildingLine: boolean;
  /** Postal code is stored as a string, not a number. */
  readonly postalCodeIsString: boolean;
  /** Phone is stored as a string in E.164. */
  readonly phoneIsE164String: boolean;
  /** Corporate Number and Invoice Registration Number have dedicated fields. */
  readonly businessIdentifiers: boolean;
  /** Text columns are `utf8mb4` / four-byte-safe. */
  readonly supplementaryPlaneSafe: boolean;
}

export const SCHEMA_CAPABILITY_NOTES: Readonly<Record<keyof SchemaCapabilities, string>> = {
  personNameKana:
    "Japanese forms collect フリガナ alongside the name. Without a field for it, " +
    "sorting, phone support, and bank transfers all degrade.",
  personNameSplitOptional:
    "A required two-part split rejects mononyms and many foreign residents; " +
    "a single free-text field alone prevents sorting by family name.",
  structuredAddress:
    "Prefecture, municipality, ward, town, and block must be separable for " +
    "shipping-rate calculation, tax jurisdiction, and carrier hand-off.",
  buildingLine:
    "Building and room routinely exceed any address line designed for a Western " +
    "street address, and carriers require them separated.",
  postalCodeIsString:
    "Numeric storage destroys the leading zero of every 0xx-xxxx code — the whole " +
    "of Hokkaido and much of Tokyo.",
  phoneIsE164String:
    "Numeric storage destroys the trunk 0, turning 090-1234-5678 into a plausible-" +
    "looking but undialable ten-digit number.",
  businessIdentifiers:
    "B2B invoicing in Japan requires the Invoice Registration Number on the " +
    "document; without a field it ends up in a notes column.",
  supplementaryPlaneSafe:
    "Names containing 𠮷 or 𣘺 are outside the Basic Multilingual Plane. MySQL " +
    "`utf8mb3` truncates them silently at write time.",
};

/** Validate a fully assembled customer record. */
export function validateCustomer(
  customer: JapaneseCustomer,
  validators: {
    name(input: string): boolean;
    phone(input: string): boolean;
    postalCode(input: string): boolean;
    corporateNumber(input: string): boolean;
    invoiceNumber(input: string): boolean;
  },
): CustomerValidation {
  const issues: CustomerIssue[] = [];
  const { name, company, address, phone } = customer;

  const written = name.full ?? [name.family, name.given].filter(Boolean).join(" ");
  if (!written) {
    issues.push({
      field: "name",
      code: "name-missing",
      message: "No name present.",
      severity: "critical",
    });
  } else if (!validators.name(written)) {
    issues.push({
      field: "name",
      code: "name-rejected",
      message: `Name "${written}" was rejected by the name validator.`,
      severity: "critical",
    });
  }

  if (phone !== undefined && !validators.phone(phone)) {
    issues.push({
      field: "phone",
      code: "phone-invalid",
      message: `Phone "${phone}" is not a valid Japanese number.`,
      severity: "critical",
    });
  }
  if (phone !== undefined && !phone.startsWith("+")) {
    issues.push({
      field: "phone",
      code: "phone-not-e164",
      message: "Phone is not stored in E.164; cross-border SMS and telephony will fail.",
      severity: "warning",
    });
  }

  if (address?.postalCode !== undefined && !validators.postalCode(address.postalCode)) {
    issues.push({
      field: "address.postalCode",
      code: "postal-invalid",
      message: `Postal code "${address.postalCode}" is not seven digits.`,
      severity: "critical",
    });
  }
  if (address && !address.prefecture) {
    issues.push({
      field: "address.prefecture",
      code: "prefecture-missing",
      message: "Address has no prefecture; most carriers and tax rules require one.",
      severity: "warning",
    });
  }

  if (company?.corporateNumber && !validators.corporateNumber(company.corporateNumber)) {
    issues.push({
      field: "company.corporateNumber",
      code: "corporate-number-invalid",
      message: `Corporate Number "${company.corporateNumber}" fails its check digit.`,
      severity: "critical",
    });
  }
  if (company?.invoiceNumber && !validators.invoiceNumber(company.invoiceNumber)) {
    issues.push({
      field: "company.invoiceNumber",
      code: "invoice-number-invalid",
      message: `Invoice Registration Number "${company.invoiceNumber}" is not valid.`,
      severity: "critical",
    });
  }

  return { valid: !issues.some((i) => i.severity === "critical"), issues };
}
