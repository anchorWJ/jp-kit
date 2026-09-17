/**
 * Framework-agnostic test generation.
 *
 * Jest and Vitest expose the same `describe` / `it` / `expect` shape, so the
 * binding takes them as arguments rather than importing either. The
 * `./vitest` and `./jest` entry points wrap this with the globals.
 */

import type { JapanReadyAdapter } from "@japanready/core";
import { CATEGORY_LABELS, type Category, type TestCase } from "./types.js";
import { filterCorpus, loadCorpus, type CorpusFilter } from "./corpus.js";
import { runCase } from "./runner.js";
import { visualize } from "./report.js";

export interface TestGlobals {
  describe: (name: string, fn: () => void) => void;
  it: ((name: string, fn: () => void) => void) & {
    skip?: (name: string, fn: () => void) => void;
  };
}

export interface CompatibilityTestOptions extends CorpusFilter {
  /**
   * How to handle an operation the adapter does not implement.
   *
   * `"skip"` (default) emits a skipped test so the gap stays visible in the
   * report. `"ignore"` omits it entirely. `"fail"` treats it as a failure,
   * which is what you want once you have committed to covering an operation.
   */
  readonly unimplemented?: "skip" | "ignore" | "fail";
  /** Group tests by category (default) or by the corpus group. */
  readonly groupBy?: "category" | "group";
}

function label(testCase: TestCase): string {
  const target =
    testCase.shouldAccept !== undefined
      ? testCase.shouldAccept
        ? "accepts"
        : "rejects"
      : `${visualize(testCase.input)} → ${visualize(testCase.expectedOutput)}`;
  return `${testCase.id} ${testCase.op}() ${target}`;
}

function failureMessage(testCase: TestCase, actual: unknown, extra?: string): string {
  const expected =
    testCase.shouldAccept !== undefined
      ? testCase.shouldAccept
        ? "accepted"
        : "rejected"
      : visualize(testCase.expectedOutput);
  const got =
    testCase.shouldAccept !== undefined
      ? actual === true
        ? "accepted"
        : actual === false
          ? "rejected"
          : visualize(actual)
      : visualize(actual);

  return [
    "",
    `${testCase.severity.toUpperCase()}  ${testCase.id}  ${testCase.op}()`,
    "",
    `  input:    ${visualize(testCase.input)}`,
    `  expected: ${expected}`,
    `  actual:   ${got}`,
    "",
    `  why:      ${testCase.reason}`,
    ...(testCase.fix ? [`  fix:      ${testCase.fix}`] : []),
    ...(testCase.source ? [`  source:   ${testCase.source}`] : []),
    ...(extra ? ["", `  ${extra}`] : []),
    "",
  ].join("\n");
}

/**
 * Generate one test per corpus case.
 *
 * ```ts
 * import { describe, it } from "vitest";
 * import { registerCompatibilityTests } from "@japanready/testkit";
 * import adapter from "./japanready.config.js";
 *
 * registerCompatibilityTests({ describe, it }, adapter);
 * ```
 *
 * Most users want the `@japanready/testkit/vitest` or `/jest` wrapper instead,
 * which supplies the globals.
 */
export function registerCompatibilityTests(
  globals: TestGlobals,
  adapter: JapanReadyAdapter,
  options: CompatibilityTestOptions = {},
): void {
  const { unimplemented = "skip", groupBy = "category", ...filter } = options;
  const cases = filterCorpus(loadCorpus(), filter);

  const buckets = new Map<string, TestCase[]>();
  for (const testCase of cases) {
    const key =
      groupBy === "category"
        ? CATEGORY_LABELS[testCase.category as Category]
        : `${testCase.category}/${testCase.group}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(testCase);
    else buckets.set(key, [testCase]);
  }

  globals.describe("JapanReady compatibility", () => {
    for (const [name, bucket] of buckets) {
      globals.describe(name, () => {
        for (const testCase of bucket) {
          const implemented = typeof adapter[testCase.op] === "function";

          if (!implemented) {
            if (unimplemented === "ignore") continue;
            if (unimplemented === "skip") {
              const skip = globals.it.skip;
              if (skip) skip(label(testCase), () => undefined);
              else
                globals.it(`${label(testCase)} [not implemented]`, () => undefined);
              continue;
            }
            globals.it(label(testCase), () => {
              throw new Error(
                failureMessage(
                  testCase,
                  undefined,
                  `Adapter does not implement ${testCase.op}().`,
                ),
              );
            });
            continue;
          }

          globals.it(label(testCase), () => {
            const result = runCase(adapter, testCase);
            if (result.status === "passed") return;
            throw new Error(failureMessage(testCase, result.actual, result.message));
          });
        }
      });
    }
  });
}
