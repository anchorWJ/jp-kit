import { describe, expect, it } from "vitest";
import { referenceAdapter, type JapanReadyAdapter } from "@japanready/core";
import {
  loadCorpus,
  matchesExpectation,
  renderJson,
  renderMarkdown,
  renderReport,
  runCase,
  runCompatibility,
  visualize,
  type TestCase,
} from "@japanready/testkit";

const baseCase: TestCase = {
  id: "unicode.test.0001",
  category: "unicode",
  op: "normalizeText",
  input: "ﾀﾅｶ",
  expectedOutput: "タナカ",
  severity: "high",
  reason: "A test fixture used by the runner's own unit tests.",
  tier: "free",
  group: "test",
};

describe("matchesExpectation", () => {
  it("compares primitives strictly", () => {
    expect(matchesExpectation("a", "a")).toBe(true);
    expect(matchesExpectation("a", "b")).toBe(false);
    expect(matchesExpectation(1, 1)).toBe(true);
    expect(matchesExpectation(1, "1")).toBe(false);
    expect(matchesExpectation(null, null)).toBe(true);
    expect(matchesExpectation(null, undefined)).toBe(false);
    expect(matchesExpectation(true, true)).toBe(true);
  });

  it("compares objects as a subset, so a richer result still passes", () => {
    expect(matchesExpectation({ city: "渋谷区" }, { city: "渋谷区", town: "渋谷" })).toBe(true);
    expect(matchesExpectation({ city: "渋谷区" }, { city: "港区" })).toBe(false);
    expect(matchesExpectation({ city: "渋谷区" }, {})).toBe(false);
  });

  it("treats an explicit undefined expectation as 'must be absent'", () => {
    expect(matchesExpectation({ ward: undefined }, { city: "渋谷区" })).toBe(true);
    expect(matchesExpectation({ ward: undefined }, { ward: "西区" })).toBe(false);
  });

  it("compares arrays by length and position", () => {
    expect(matchesExpectation([1, 2], [1, 2])).toBe(true);
    expect(matchesExpectation([1, 2], [1, 2, 3])).toBe(false);
  });

  it("rejects a non-object actual against an object expectation", () => {
    expect(matchesExpectation({ a: 1 }, "nope")).toBe(false);
    expect(matchesExpectation({ a: 1 }, null)).toBe(false);
    expect(matchesExpectation({ a: 1 }, [1])).toBe(false);
  });
});

describe("runCase", () => {
  it("passes a correct transform", () => {
    expect(runCase(referenceAdapter, baseCase).status).toBe("passed");
  });

  it("fails an incorrect transform and reports what came back", () => {
    const adapter: JapanReadyAdapter = { normalizeText: () => "wrong" };
    const result = runCase(adapter, baseCase);
    expect(result.status).toBe("failed");
    expect(result.actual).toBe("wrong");
  });

  it("skips an unimplemented operation rather than failing it", () => {
    const result = runCase({}, baseCase);
    expect(result.status).toBe("skipped");
    expect(result.message).toMatch(/normalizeText/);
  });

  it("reports a throwing adapter as errored, not as a crash", () => {
    const adapter: JapanReadyAdapter = {
      normalizeText: () => {
        throw new Error("boom");
      },
    };
    const result = runCase(adapter, baseCase);
    expect(result.status).toBe("errored");
    expect(result.message).toBe("boom");
  });

  it("errors when a validator returns a non-boolean", () => {
    const acceptCase: TestCase = {
      ...baseCase,
      id: "names.test.0001",
      category: "names",
      op: "validateName",
      expectedOutput: undefined,
      shouldAccept: true,
    };
    delete (acceptCase as { expectedOutput?: unknown }).expectedOutput;

    const adapter = { validateName: () => "yes" } as unknown as JapanReadyAdapter;
    const result = runCase(adapter, acceptCase);
    expect(result.status).toBe("errored");
    expect(result.message).toMatch(/must return a boolean/);
  });

  it("marks a case declaring neither expectation as invalid", () => {
    const broken = { ...baseCase } as { expectedOutput?: unknown };
    delete broken.expectedOutput;
    expect(runCase(referenceAdapter, broken as TestCase).status).toBe("invalid");
  });
});

describe("runCompatibility", () => {
  it("scores the reference implementation at 100% with no failures", () => {
    // This is the corpus's own regression test. A failure here means a corpus
    // expectation is wrong, not that a customer's product has a bug.
    const summary = runCompatibility(referenceAdapter);
    const failures = summary.results.filter(
      (r) => r.status !== "passed" && r.status !== "skipped",
    );
    expect(
      failures.map((f) => `${f.case.id}: expected ${JSON.stringify(f.case.expectedOutput ?? f.case.shouldAccept)}, got ${JSON.stringify(f.actual)}`),
    ).toEqual([]);
    expect(summary.totals.skipped).toBe(0);
    expect(summary.percentage).toBe(100);
    expect(summary.uncoveredOperations).toEqual([]);
  });

  it("counts critical and high failures as critical issues", () => {
    const adapter: JapanReadyAdapter = { normalizeText: () => "always wrong" };
    const summary = runCompatibility(adapter, { categories: ["unicode"] });
    expect(summary.totals.failed).toBeGreaterThan(0);
    expect(summary.totals.criticalIssues).toBeGreaterThan(0);
    expect(summary.totals.criticalIssues + summary.totals.warnings).toBe(summary.totals.failed);
  });

  it("reports uncovered operations for an empty adapter", () => {
    const summary = runCompatibility({}, { categories: ["phone"] });
    expect(summary.totals.skipped).toBe(summary.totals.cases);
    expect(summary.totals.failed).toBe(0);
    expect(summary.percentage).toBeNull();
    expect(summary.uncoveredOperations.length).toBeGreaterThan(0);
  });

  it("excludes skipped cases from the percentage", () => {
    const adapter: JapanReadyAdapter = {
      validateCorporateNumber: referenceAdapter.validateCorporateNumber,
    };
    const summary = runCompatibility(adapter, { categories: ["business"] });
    const businessScore = summary.scores.find((s) => s.category === "business")!;
    expect(businessScore.skipped).toBeGreaterThan(0);
    expect(businessScore.percentage).toBe(100);
  });

  it("accepts an explicit case list", () => {
    const summary = runCompatibility(referenceAdapter, { cases: [baseCase] });
    expect(summary.totals.cases).toBe(1);
  });
});

describe("visualize", () => {
  it("reveals invisible characters", () => {
    expect(visualize("田中​太郎")).toBe('"田中⟨U+200B⟩太郎"');
    expect(visualize("a﻿b")).toBe('"a⟨U+FEFF⟩b"');
    expect(visualize("辻\u{E0101}")).toBe('"辻⟨IVS18⟩"');
    expect(visualize("ガ")).toBe('"カ⟨U+3099⟩"');
  });

  it("quotes strings exactly once, including inside objects", () => {
    expect(visualize("東京都")).toBe('"東京都"');
    expect(visualize({ city: "渋谷区", chome: 2 })).toBe('{"city":"渋谷区","chome":2}');
  });

  it("renders undefined and null", () => {
    expect(visualize(undefined)).toBe("undefined");
    expect(visualize(null)).toBe("null");
  });
});

describe("reports", () => {
  const summary = runCompatibility({ normalizeText: () => "wrong" }, { categories: ["unicode"] });

  it("renders text without ANSI when colour is off", () => {
    const text = renderReport(summary, { color: false, maxFailures: 2 });
    expect(text).toContain("JapanReady Compatibility Report");
    expect(text).toContain("Critical Issues:");
    expect(text).not.toContain("[");
  });

  it("honours maxFailures", () => {
    const none = renderReport(summary, { color: false, maxFailures: 0 });
    expect(none).not.toContain("Failures (");
  });

  it("renders valid JSON", () => {
    const parsed = JSON.parse(renderJson(summary)) as {
      totals: { failed: number };
      failures: unknown[];
    };
    expect(parsed.totals.failed).toBeGreaterThan(0);
    expect(parsed.failures.length).toBeGreaterThan(0);
  });

  it("renders a Markdown table", () => {
    const md = renderMarkdown(summary);
    expect(md).toContain("| Category | Score |");
    expect(md).toContain("<details>");
  });
});

describe("corpus and runner agree on shape", () => {
  it("runs every case without throwing", () => {
    for (const testCase of loadCorpus()) {
      expect(() => runCase(referenceAdapter, testCase), testCase.id).not.toThrow();
    }
  });
});
