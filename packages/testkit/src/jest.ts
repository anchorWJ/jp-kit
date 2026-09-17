/**
 * Jest binding.
 *
 * ```ts
 * // japanready.test.ts
 * const { testJapanCompatibility } = require("@japanready/testkit/jest");
 * const adapter = require("./japanready.config.js");
 *
 * testJapanCompatibility(adapter);
 * ```
 *
 * Jest injects `describe` and `it` as globals rather than exporting them, so
 * they are read off `globalThis` at call time. Calling this outside a Jest run
 * throws with an explanation rather than a `describe is not defined`.
 */

import type { JapanReadyAdapter } from "@japanready/core";
import { registerCompatibilityTests, type CompatibilityTestOptions } from "./framework.js";
import type { TestGlobals } from "./framework.js";

function jestGlobals(): TestGlobals {
  const scope = globalThis as unknown as Partial<TestGlobals>;
  if (typeof scope.describe !== "function" || typeof scope.it !== "function") {
    throw new Error(
      "@japanready/testkit/jest must be called from inside a Jest test file, where " +
        "`describe` and `it` are defined as globals. For Vitest, import " +
        "@japanready/testkit/vitest instead.",
    );
  }
  return { describe: scope.describe, it: scope.it };
}

export function testJapanCompatibility(
  adapter: JapanReadyAdapter,
  options?: CompatibilityTestOptions,
): void {
  registerCompatibilityTests(jestGlobals(), adapter, options);
}

export type { CompatibilityTestOptions };
