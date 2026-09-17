import type { Operation } from "@japanready/core";

export type Category = "unicode" | "names" | "addresses" | "phone" | "business";

export const CATEGORIES: readonly Category[] = [
  "names",
  "addresses",
  "unicode",
  "phone",
  "business",
];

/** Human-readable category labels, in report order. */
export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  names: "Names",
  addresses: "Addresses",
  unicode: "Unicode",
  phone: "Phone Numbers",
  business: "Business IDs",
};

export type Severity = "critical" | "high" | "medium" | "low";

export const SEVERITY_ORDER: Readonly<Record<Severity, number>> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Licence tier a case belongs to. */
export type Tier = "free" | "pro";

/**
 * One edge case.
 *
 * A case is either a *transform* case (`expectedOutput` is set) or an
 * *acceptance* case (`shouldAccept` is set). Setting neither is an error in
 * the corpus itself and is reported as such.
 */
export interface TestCase {
  /** Stable identifier, e.g. `unicode.halfwidth-kana.0007`. Never reused. */
  readonly id: string;
  readonly category: Category;
  /** Which adapter function this case exercises. */
  readonly op: Operation;
  /** What the product receives. */
  readonly input: string;
  /**
   * What a correct implementation returns. For object results, only the keys
   * present here are compared, so an adapter returning extra fields still
   * passes.
   */
  readonly expectedOutput?: unknown;
  /** For validators: `true` if the value must be accepted, `false` if rejected. */
  readonly shouldAccept?: boolean;
  readonly severity: Severity;
  /** Why this case exists — shown on failure. */
  readonly reason: string;
  /** What to do about it — shown on failure. */
  readonly fix?: string;
  /** Where the rule comes from, when there is an authority to cite. */
  readonly source?: string;
  readonly notes?: string;
  readonly tier: Tier;
  /** Free-form grouping used in reports, e.g. `halfwidth-kana`. */
  readonly group: string;
}

export interface CorpusFile {
  readonly version: string;
  readonly category: Category;
  readonly generated?: boolean;
  readonly cases: readonly TestCase[];
}

export type CaseStatus = "passed" | "failed" | "skipped" | "errored" | "invalid";

export interface CaseResult {
  readonly case: TestCase;
  readonly status: CaseStatus;
  /** What the adapter actually returned. */
  readonly actual?: unknown;
  /** Error message when the adapter threw, or why the case was skipped. */
  readonly message?: string;
}

export interface CategoryScore {
  readonly category: Category;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  /** Passed ÷ (total − skipped), as a whole percentage. `null` when all skipped. */
  readonly percentage: number | null;
}

export interface RunSummary {
  readonly adapterName: string;
  readonly scores: readonly CategoryScore[];
  readonly results: readonly CaseResult[];
  readonly totals: {
    readonly cases: number;
    readonly passed: number;
    readonly failed: number;
    readonly skipped: number;
    readonly criticalIssues: number;
    readonly warnings: number;
  };
  /** Operations the adapter does not implement. */
  readonly uncoveredOperations: readonly Operation[];
  /** Overall percentage across all non-skipped cases. */
  readonly percentage: number | null;
  readonly durationMs: number;
}
