import { describe, expect, it } from "vitest";
import { OPERATIONS } from "@japanready/core";
import {
  CATEGORIES,
  SEVERITY_ORDER,
  corpusStats,
  filterCorpus,
  loadCorpus,
} from "@japanready/testkit";

const corpus = loadCorpus();

describe("corpus integrity", () => {
  it("is large enough to be worth shipping", () => {
    // The MVP target is 1,000–3,000 cases.
    expect(corpus.length).toBeGreaterThanOrEqual(1000);
  });

  it("has unique ids", () => {
    const ids = new Set(corpus.map((c) => c.id));
    expect(ids.size).toBe(corpus.length);
  });

  it("uses only known categories, severities, tiers, and operations", () => {
    for (const c of corpus) {
      expect(CATEGORIES, c.id).toContain(c.category);
      expect(Object.keys(SEVERITY_ORDER), c.id).toContain(c.severity);
      expect(["free", "pro"], c.id).toContain(c.tier);
      expect(OPERATIONS as readonly string[], c.id).toContain(c.op);
    }
  });

  it("declares exactly one of expectedOutput or shouldAccept", () => {
    for (const c of corpus) {
      const hasExpected = Object.prototype.hasOwnProperty.call(c, "expectedOutput");
      const hasAccept = c.shouldAccept !== undefined;
      expect(hasExpected !== hasAccept, `${c.id} must declare exactly one`).toBe(true);
    }
  });

  it("explains every case", () => {
    for (const c of corpus) {
      expect(c.reason.length, c.id).toBeGreaterThan(14);
    }
  });

  it("uses a boolean expectation only for validator operations", () => {
    for (const c of corpus) {
      if (c.shouldAccept === undefined) continue;
      expect(c.op, c.id).toMatch(/^validate/);
    }
  });

  it("covers every category", () => {
    const stats = corpusStats(corpus);
    for (const category of CATEGORIES) {
      expect(stats.byCategory[category] ?? 0, category).toBeGreaterThan(0);
    }
  });

  it("has ids that sort into a stable order", () => {
    const sorted = [...corpus].map((c) => c.id).sort((a, b) => a.localeCompare(b));
    expect(corpus.map((c) => c.id)).toEqual(sorted);
  });
});

describe("filterCorpus", () => {
  it("filters by category", () => {
    const phone = filterCorpus(corpus, { categories: ["phone"] });
    expect(phone.length).toBeGreaterThan(0);
    expect(phone.every((c) => c.category === "phone")).toBe(true);
  });

  it("filters by minimum severity, inclusive and downward-exclusive", () => {
    const high = filterCorpus(corpus, { minSeverity: "high" });
    expect(high.every((c) => c.severity === "critical" || c.severity === "high")).toBe(true);
    expect(high.length).toBeLessThan(corpus.length);

    const all = filterCorpus(corpus, { minSeverity: "low" });
    expect(all.length).toBe(corpus.length);
  });

  it("filters by tier", () => {
    const free = filterCorpus(corpus, { tiers: ["free"] });
    const pro = filterCorpus(corpus, { tiers: ["pro"] });
    expect(free.length).toBeGreaterThan(0);
    expect(pro.length).toBeGreaterThan(0);
    expect(free.length + pro.length).toBe(corpus.length);
  });

  it("greps id, group, reason, and input", () => {
    expect(filterCorpus(corpus, { grep: "halfwidth-kana" }).length).toBeGreaterThan(0);
    expect(filterCorpus(corpus, { grep: "check digit" }).length).toBeGreaterThan(0);
    expect(filterCorpus(corpus, { grep: "zzz-no-such-thing" })).toHaveLength(0);
  });

  it("combines filters", () => {
    const result = filterCorpus(corpus, {
      categories: ["business"],
      minSeverity: "critical",
    });
    expect(result.every((c) => c.category === "business" && c.severity === "critical")).toBe(true);
  });
});
