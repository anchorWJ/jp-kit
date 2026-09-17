import { describe, expect, it } from "vitest";
import {
  buildCorporateNumber,
  companyNameKey,
  companyNamesMatch,
  corporateNumberCheckDigit,
  expandCompanyAbbreviations,
  formatCorporateNumber,
  invoiceNumberFromCorporateNumber,
  isValidCorporateNumber,
  isValidInvoiceNumber,
  normalizeCompanyName,
  parseCompanyName,
  validateCorporateNumber,
  validateInvoiceNumber,
} from "@japanready/core";

/** 国税庁 (National Tax Agency) — a published, verifiable Corporate Number. */
const NTA = "7000012050002";

describe("corporate number", () => {
  it("computes the check digit as the leading digit", () => {
    expect(corporateNumberCheckDigit(NTA.slice(1))).toBe(7);
    expect(isValidCorporateNumber(NTA)).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    for (let d = 0; d <= 9; d++) {
      if (d === 7) continue;
      expect(isValidCorporateNumber(`${d}${NTA.slice(1)}`), String(d)).toBe(false);
    }
    expect(validateCorporateNumber(`1${NTA.slice(1)}`)).toMatchObject({
      valid: false,
      reason: "check-digit-mismatch",
      expectedCheckDigit: 7,
    });
  });

  it("never produces a check digit of 0", () => {
    // sum mod 9 ∈ [0,8] ⇒ check ∈ [1,9]. A Corporate Number cannot start with 0.
    for (let i = 0; i < 500; i++) {
      const base = String(Math.floor(Math.random() * 1e12)).padStart(12, "0");
      const digit = corporateNumberCheckDigit(base);
      expect(digit).toBeGreaterThanOrEqual(1);
      expect(digit).toBeLessThanOrEqual(9);
    }
  });

  it("round-trips through buildCorporateNumber", () => {
    for (const base of ["000012050002", "123456789012", "000000000001"]) {
      expect(isValidCorporateNumber(buildCorporateNumber(base))).toBe(true);
    }
  });

  it("normalizes decorated input", () => {
    expect(isValidCorporateNumber("7-0000-1205-0002")).toBe(true);
    expect(isValidCorporateNumber("７００００１２０５０００２")).toBe(true);
    expect(isValidCorporateNumber(" 7000012050002 ")).toBe(true);
  });

  it("rejects wrong lengths and all zeros", () => {
    expect(validateCorporateNumber("700001205000").reason).toBe("not-thirteen-digits");
    expect(validateCorporateNumber("0000000000000").reason).toBe("all-zeros");
  });

  it("formats with and without grouping", () => {
    expect(formatCorporateNumber(NTA)).toBe(NTA);
    expect(formatCorporateNumber(NTA, true)).toBe("7-0000-1205-0002");
  });
});

describe("invoice registration number", () => {
  it("accepts T + a valid corporate number", () => {
    expect(isValidInvoiceNumber(`T${NTA}`)).toBe(true);
    expect(validateInvoiceNumber(`T${NTA}`).matchesCorporateNumber).toBe(true);
  });

  it("accepts a lower-case and a full-width T", () => {
    expect(isValidInvoiceNumber(`t${NTA}`)).toBe(true);
    expect(isValidInvoiceNumber(`Ｔ${NTA}`)).toBe(true);
  });

  it("adds a missing T rather than rejecting", () => {
    expect(validateInvoiceNumber(NTA).normalized).toBe(`T${NTA}`);
  });

  it("rejects a bad check digit and a bad format", () => {
    expect(validateInvoiceNumber("T1234567890123").reason).toBe("check-digit-mismatch");
    expect(validateInvoiceNumber("X7000012050002").reason).toBe("bad-format");
    expect(validateInvoiceNumber("T700001205000").reason).toBe("bad-format");
  });

  it("derives the invoice number from a corporate number", () => {
    expect(invoiceNumberFromCorporateNumber(NTA)).toBe(`T${NTA}`);
    expect(invoiceNumberFromCorporateNumber("1234567890123")).toBeNull();
  });
});

describe("company names", () => {
  it("expands single-code-point abbreviations", () => {
    expect(expandCompanyAbbreviations("㈱日本商事")).toBe("株式会社日本商事");
    expect(expandCompanyAbbreviations("㍿日本商事")).toBe("株式会社日本商事");
    expect(expandCompanyAbbreviations("(株)日本商事")).toBe("株式会社日本商事");
    expect(expandCompanyAbbreviations("（有）日本商事")).toBe("有限会社日本商事");
  });

  it("distinguishes 前株 from 後株", () => {
    expect(parseCompanyName("株式会社日本商事")).toMatchObject({
      name: "日本商事",
      legalForm: "株式会社",
      position: "prefix",
    });
    expect(parseCompanyName("日本商事株式会社")).toMatchObject({
      name: "日本商事",
      legalForm: "株式会社",
      position: "suffix",
    });
  });

  it("matches the longest legal form first", () => {
    expect(parseCompanyName("特定非営利活動法人さくら").legalForm).toBe("特定非営利活動法人");
    expect(parseCompanyName("一般社団法人さくら").legalForm).toBe("一般社団法人");
  });

  it("normalizes to a single stored form", () => {
    expect(normalizeCompanyName("㈱　日本商事")).toBe("株式会社 日本商事");
    expect(normalizeCompanyName("ﾆﾎﾝ商事株式会社")).toBe("ニホン商事株式会社");
  });

  it("matches the same company written differently", () => {
    expect(companyNamesMatch("㈱日本商事", "日本商事株式会社")).toBe(true);
    expect(companyNamesMatch("株式会社　日本商事", "(株)日本商事")).toBe(true);
    expect(companyNameKey("株式会社髙島屋")).toBe(companyNameKey("高島屋株式会社"));
  });

  it("does not match different companies", () => {
    expect(companyNamesMatch("株式会社日本商事", "株式会社日本物産")).toBe(false);
  });
});
