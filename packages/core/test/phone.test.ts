import { describe, expect, it } from "vitest";
import {
  formatPhone,
  isMobilePhone,
  isValidPhone,
  looksLikeLostLeadingZero,
  parsePhone,
} from "@japanready/core";

describe("parsePhone", () => {
  it("accepts every written form of the same number", () => {
    const forms = [
      "090-1234-5678",
      "09012345678",
      "090 1234 5678",
      "+81 90 1234 5678",
      "+819012345678",
      "+81-90-1234-5678",
      "0081 90 1234 5678",
      "０９０－１２３４－５６７８",
      "090ー1234ー5678",
      "(090)1234-5678",
    ];
    for (const form of forms) {
      expect(formatPhone(form, "e164"), form).toBe("+819012345678");
    }
  });

  it("tolerates the trunk 0 left in after +81", () => {
    const parsed = parsePhone("+81-0-90-1234-5678");
    expect(parsed?.national).toBe("09012345678");
    expect(parsed?.warnings.join(" ")).toMatch(/trunk 0/);
  });

  it("classifies number types", () => {
    expect(parsePhone("090-1234-5678")?.type).toBe("mobile");
    expect(parsePhone("080-1234-5678")?.type).toBe("mobile");
    expect(parsePhone("070-1234-5678")?.type).toBe("mobile");
    expect(parsePhone("050-1234-5678")?.type).toBe("ip");
    expect(parsePhone("03-1234-5678")?.type).toBe("fixed-line");
    expect(parsePhone("0120-123-456")?.type).toBe("toll-free");
    expect(parsePhone("0800-123-4567")?.type).toBe("toll-free");
    expect(parsePhone("0570-000-000")?.type).toBe("navi-dial");
    expect(parsePhone("110")?.type).toBe("special");
  });

  it("returns null only for input with no digits", () => {
    expect(parsePhone("not a phone")).toBeNull();
    expect(parsePhone("")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("hyphenates by area-code length, not by a fixed pattern", () => {
    // 1-digit area code (Tokyo)
    expect(formatPhone("0312345678")).toBe("03-1234-5678");
    // 2-digit (Sapporo)
    expect(formatPhone("0111234567")).toBe("011-123-4567");
    // 3-digit (default)
    expect(formatPhone("0166123456")).toBe("0166-12-3456");
    // 4-digit (Izu Ōshima)
    expect(formatPhone("0499212345")).toBe("04992-1-2345");
  });

  it("formats mobile, IP, and toll-free numbers", () => {
    expect(formatPhone("09012345678")).toBe("090-1234-5678");
    expect(formatPhone("05012345678")).toBe("050-1234-5678");
    expect(formatPhone("0120123456")).toBe("0120-123-456");
    expect(formatPhone("08001234567")).toBe("0800-123-4567");
  });

  it("produces E.164 and international forms", () => {
    expect(formatPhone("03-1234-5678", "e164")).toBe("+81312345678");
    expect(formatPhone("03-1234-5678", "international")).toBe("+81 3-1234-5678");
    expect(formatPhone("03-1234-5678", "compact")).toBe("0312345678");
  });
});

describe("validation", () => {
  it("accepts valid numbers of every length", () => {
    // The bug this guards: /^\d{3}-\d{3}-\d{4}$/ — the North American shape —
    // rejects all of these.
    for (const n of ["03-1234-5678", "090-1234-5678", "0166-12-3456", "0120-123-456"]) {
      expect(isValidPhone(n), n).toBe(true);
    }
  });

  it("rejects wrong lengths", () => {
    expect(isValidPhone("090-1234-567")).toBe(false);
    expect(isValidPhone("090-1234-56789")).toBe(false);
    expect(isValidPhone("03-1234-567")).toBe(false);
  });

  it("identifies mobiles", () => {
    expect(isMobilePhone("090-1234-5678")).toBe(true);
    expect(isMobilePhone("03-1234-5678")).toBe(false);
  });
});

describe("lost leading zero", () => {
  it("detects a mobile number that went through numeric storage", () => {
    // 09012345678 → parseInt → 9012345678, which still looks like a phone number.
    expect(String(Number("09012345678"))).toBe("9012345678");
    expect(looksLikeLostLeadingZero("9012345678")).toBe(true);
    expect(looksLikeLostLeadingZero("09012345678")).toBe(false);
  });

  it("detects a fixed line that went through numeric storage", () => {
    expect(looksLikeLostLeadingZero("312345678")).toBe(true);
    expect(looksLikeLostLeadingZero("0312345678")).toBe(false);
  });
});
