/** Replaying the corpus through an adapter. */

import { OPERATIONS, type JapanReadyAdapter, type Operation } from "@japanready/core";
import { CATEGORIES, type CaseResult, type CategoryScore, type RunSummary, type TestCase } from "./types.js";
import { filterCorpus, loadCorpus, type CorpusFilter } from "./corpus.js";

export interface RunOptions extends CorpusFilter {
  /** Cases to run. Defaults to the whole corpus, filtered. */
  readonly cases?: readonly TestCase[];
}

/**
 * Compare an actual value against a case's expectation.
 *
 * Objects are compared as a *subset*: only the keys the corpus specifies are
 * checked, so an adapter that returns a richer parse result still passes.
 * `undefined` and a missing key are treated as equal, because they mean the
 * same thing in every JSON round-trip.
 */
export function matchesExpectation(expected: unknown, actual: unknown): boolean {
  if (expected === null) return actual === null;
  if (typeof expected !== "object") return Object.is(expected, actual);

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false;
    return expected.every((item, i) => matchesExpectation(item, actual[i]));
  }

  if (typeof actual !== "object" || actual === null || Array.isArray(actual)) return false;

  const actualRecord = actual as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected as Record<string, unknown>)) {
    if (value === undefined) {
      if (actualRecord[key] !== undefined) return false;
      continue;
    }
    if (!matchesExpectation(value, actualRecord[key])) return false;
  }
  return true;
}

function invokeOperation(
  adapter: JapanReadyAdapter,
  testCase: TestCase,
): { ok: true; value: unknown } | { ok: false; message: string } {
  const fn = adapter[testCase.op] as ((...args: unknown[]) => unknown) | undefined;
  if (typeof fn !== "function") {
    return { ok: false, message: `Adapter does not implement ${testCase.op}().` };
  }

  try {
    // formatName is the only operation taking two arguments; its corpus input
    // is the written name, and the order is carried on the case's group.
    if (testCase.op === "formatName") {
      const order = testCase.group.endsWith("western") ? "western" : "japanese";
      const split = adapter.splitName?.(testCase.input) ?? { full: testCase.input };
      return { ok: true, value: fn.call(adapter, split, order) };
    }
    if (testCase.op === "formatAddress") {
      const parsed = adapter.parseAddress?.(testCase.input);
      if (!parsed) {
        return { ok: false, message: "formatAddress requires parseAddress to be implemented." };
      }
      return { ok: true, value: fn.call(adapter, parsed) };
    }
    return { ok: true, value: fn.call(adapter, testCase.input) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Run one case. */
export function runCase(adapter: JapanReadyAdapter, testCase: TestCase): CaseResult {
  const hasExpected = Object.prototype.hasOwnProperty.call(testCase, "expectedOutput");
  const hasAccept = testCase.shouldAccept !== undefined;

  if (!hasExpected && !hasAccept) {
    return {
      case: testCase,
      status: "invalid",
      message: "Case declares neither expectedOutput nor shouldAccept.",
    };
  }

  const fn = adapter[testCase.op];
  if (typeof fn !== "function") {
    return {
      case: testCase,
      status: "skipped",
      message: `Not implemented: ${testCase.op}()`,
    };
  }

  const outcome = invokeOperation(adapter, testCase);
  if (!outcome.ok) {
    // A missing dependency (parseAddress for formatAddress) is a skip; a throw
    // from inside the adapter is a failure the product needs to see.
    const skip = outcome.message.includes("requires");
    return {
      case: testCase,
      status: skip ? "skipped" : "errored",
      message: outcome.message,
    };
  }

  if (hasAccept) {
    const accepted = outcome.value;
    if (typeof accepted !== "boolean") {
      return {
        case: testCase,
        status: "errored",
        actual: accepted,
        message: `${testCase.op}() must return a boolean for acceptance cases, got ${typeof accepted}.`,
      };
    }
    return {
      case: testCase,
      status: accepted === testCase.shouldAccept ? "passed" : "failed",
      actual: accepted,
    };
  }

  const passed = matchesExpectation(testCase.expectedOutput, outcome.value);
  return {
    case: testCase,
    status: passed ? "passed" : "failed",
    actual: outcome.value,
  };
}

function scoreCategory(results: readonly CaseResult[], category: string): CategoryScore {
  const scoped = results.filter((r) => r.case.category === category);
  const passed = scoped.filter((r) => r.status === "passed").length;
  const skipped = scoped.filter((r) => r.status === "skipped").length;
  const failed = scoped.length - passed - skipped;
  const evaluated = scoped.length - skipped;
  return {
    category: category as CategoryScore["category"],
    total: scoped.length,
    passed,
    failed,
    skipped,
    percentage: evaluated === 0 ? null : Math.round((passed / evaluated) * 100),
  };
}

/**
 * Run the corpus against an adapter.
 *
 * ```ts
 * const summary = runCompatibility(myAdapter);
 * if (summary.totals.criticalIssues > 0) process.exit(1);
 * ```
 */
export function runCompatibility(
  adapter: JapanReadyAdapter,
  options: RunOptions = {},
): RunSummary {
  const started = Date.now();
  const { cases, ...filter } = options;
  const selected = cases ?? filterCorpus(loadCorpus(), filter);

  const results = selected.map((testCase) => runCase(adapter, testCase));

  const passed = results.filter((r) => r.status === "passed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failedResults = results.filter(
    (r) => r.status === "failed" || r.status === "errored" || r.status === "invalid",
  );
  const criticalIssues = failedResults.filter(
    (r) => r.case.severity === "critical" || r.case.severity === "high",
  ).length;
  const warnings = failedResults.length - criticalIssues;
  const evaluated = results.length - skipped;

  const uncoveredOperations = OPERATIONS.filter(
    (op: Operation) => typeof adapter[op] !== "function",
  );

  return {
    adapterName: adapter.name ?? "adapter",
    scores: CATEGORIES.map((category) => scoreCategory(results, category)),
    results,
    totals: {
      cases: results.length,
      passed,
      failed: failedResults.length,
      skipped,
      criticalIssues,
      warnings,
    },
    uncoveredOperations,
    percentage: evaluated === 0 ? null : Math.round((passed / evaluated) * 100),
    durationMs: Date.now() - started,
  };
}
