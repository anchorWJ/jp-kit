/**
 * Vitest binding.
 *
 * ```ts
 * // japanready.test.ts
 * import { testJapanCompatibility } from "@japanready/testkit/vitest";
 * import adapter from "./japanready.config.js";
 *
 * testJapanCompatibility(adapter);
 * ```
 */

import { describe, it } from "vitest";
import type { JapanReadyAdapter } from "@japanready/core";
import { registerCompatibilityTests, type CompatibilityTestOptions } from "./framework.js";

export function testJapanCompatibility(
  adapter: JapanReadyAdapter,
  options?: CompatibilityTestOptions,
): void {
  registerCompatibilityTests({ describe, it }, adapter, options);
}

export type { CompatibilityTestOptions };
