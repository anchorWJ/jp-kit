/**
 * @japanready/testkit — Japan compatibility testing.
 *
 * The corpus is the product. This package loads it, replays it through an
 * adapter that points at *your* implementation, and reports what a Japanese
 * customer would hit.
 */

export {
  CATEGORIES,
  CATEGORY_LABELS,
  SEVERITY_ORDER,
  type CaseResult,
  type CaseStatus,
  type Category,
  type CategoryScore,
  type CorpusFile,
  type RunSummary,
  type Severity,
  type TestCase,
  type Tier,
} from "./types.js";

export {
  corpusStats,
  filterCorpus,
  loadCorpus,
  resetCorpusCache,
  type CorpusFilter,
} from "./corpus.js";

export {
  matchesExpectation,
  runCase,
  runCompatibility,
  type RunOptions,
} from "./runner.js";

export {
  renderJson,
  renderMarkdown,
  renderReport,
  visualize,
  type RenderOptions,
} from "./report.js";

export {
  registerCompatibilityTests,
  type CompatibilityTestOptions,
  type TestGlobals,
} from "./framework.js";

export { STARTER_CONFIG, findConfig, loadAdapter } from "./config.js";

/** Re-exported so a config file needs only one dependency. */
export {
  OPERATIONS,
  referenceAdapter,
  type AddressFields,
  type JapanReadyAdapter,
  type Operation,
} from "@japanready/core";
