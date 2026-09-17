/**
 * How you would wire JapanReady into an existing Vitest suite.
 *
 * This file is NOT part of the repository's own test run — the naive adapter is
 * meant to fail, and a red suite here would be noise. Run it deliberately:
 *
 *   npx vitest run --root examples/naive-app
 *
 * In a real project you would drop the filters and let it gate the build.
 */

import { testJapanCompatibility } from "@japanready/testkit/vitest";
import adapter from "./japanready.config.ts";

testJapanCompatibility(adapter, {
  // Start narrow: the highest-severity cases in the areas you actually store,
  // then widen as you fix them.
  categories: ["business"],
  minSeverity: "critical",
  unimplemented: "skip",
});
