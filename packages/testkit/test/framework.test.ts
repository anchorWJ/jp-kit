import { describe, expect, it } from "vitest";
import { referenceAdapter } from "@japanready/core";
import { registerCompatibilityTests, type TestGlobals } from "@japanready/testkit";

/**
 * The binding used for real, against the real Vitest globals. These nested
 * tests are collected and run by the outer Vitest process, which is the only
 * way to prove the integration actually works.
 */
registerCompatibilityTests({ describe, it }, referenceAdapter, {
  categories: ["business"],
  grep: "corporate-number-check-digit",
});

/** A recorder standing in for a test framework, to inspect what gets registered. */
function recorder(): { globals: TestGlobals; tests: string[]; skipped: string[]; run: () => void } {
  const tests: string[] = [];
  const skipped: string[] = [];
  const bodies: Array<() => void> = [];

  const it = ((name: string, fn: () => void) => {
    tests.push(name);
    bodies.push(fn);
  }) as TestGlobals["it"];
  it.skip = (name: string) => {
    skipped.push(name);
  };

  return {
    globals: { describe: (_name, fn) => fn(), it },
    tests,
    skipped,
    run: () => {
      for (const body of bodies) body();
    },
  };
}

describe("registerCompatibilityTests", () => {
  const filter = { categories: ["phone"] as const, grep: "area-code-length" };

  it("registers one test per case", () => {
    const r = recorder();
    registerCompatibilityTests(r.globals, referenceAdapter, filter);
    expect(r.tests.length).toBeGreaterThan(0);
    expect(r.skipped).toHaveLength(0);
    expect(() => r.run()).not.toThrow();
  });

  it("skips unimplemented operations by default", () => {
    const r = recorder();
    registerCompatibilityTests(r.globals, {}, filter);
    expect(r.tests).toHaveLength(0);
    expect(r.skipped.length).toBeGreaterThan(0);
  });

  it("omits unimplemented operations when asked to ignore them", () => {
    const r = recorder();
    registerCompatibilityTests(r.globals, {}, { ...filter, unimplemented: "ignore" });
    expect(r.tests).toHaveLength(0);
    expect(r.skipped).toHaveLength(0);
  });

  it("fails unimplemented operations when asked to", () => {
    const r = recorder();
    registerCompatibilityTests(r.globals, {}, { ...filter, unimplemented: "fail" });
    expect(r.tests.length).toBeGreaterThan(0);
    expect(() => r.run()).toThrow(/does not implement/);
  });

  it("throws a message carrying the input, the fix, and the source", () => {
    const r = recorder();
    registerCompatibilityTests(r.globals, { formatPhoneNational: () => "nope" }, filter);
    let message = "";
    try {
      r.run();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("input:");
    expect(message).toContain("expected:");
    expect(message).toContain("actual:");
    expect(message).toContain("why:");
    expect(message).toContain("fix:");
  });

  it("can group by corpus group instead of category", () => {
    const byGroup = recorder();
    registerCompatibilityTests(byGroup.globals, referenceAdapter, {
      ...filter,
      groupBy: "group",
    });
    expect(byGroup.tests.length).toBeGreaterThan(0);
  });
});
