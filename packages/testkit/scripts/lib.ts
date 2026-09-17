/** Helpers shared by the corpus case definitions. */

import type { Operation } from "@japanready/core";

export type Category = "unicode" | "names" | "addresses" | "phone" | "business";
export type Severity = "critical" | "high" | "medium" | "low";
export type Tier = "free" | "pro";

/** A case before an id has been assigned. */
export interface CaseSeed {
  category: Category;
  group: string;
  op: Operation;
  input: string;
  expectedOutput?: unknown;
  shouldAccept?: boolean;
  severity: Severity;
  reason: string;
  fix?: string;
  source?: string;
  notes?: string;
  tier?: Tier;
}

export interface BuiltCase extends Omit<CaseSeed, "tier"> {
  id: string;
  tier: Tier;
}

/**
 * Assign stable ids.
 *
 * The id is `category.group.NNNN` with the index scoped to the group, so
 * adding a case to one group never renumbers another. Ids appear in CI output
 * and in customers' suppression lists, so they must not churn.
 */
export function buildCases(seeds: readonly CaseSeed[]): BuiltCase[] {
  const counters = new Map<string, number>();
  return seeds.map((seed) => {
    const key = `${seed.category}.${seed.group}`;
    const index = (counters.get(key) ?? 0) + 1;
    counters.set(key, index);
    const { tier, ...rest } = seed;
    return {
      ...rest,
      id: `${key}.${String(index).padStart(4, "0")}`,
      tier: tier ?? "free",
    };
  });
}

/** Cartesian helper for generating width/format permutations. */
export function permute<T, U>(a: readonly T[], b: readonly U[]): Array<[T, U]> {
  const out: Array<[T, U]> = [];
  for (const x of a) for (const y of b) out.push([x, y]);
  return out;
}

/**
 * A deterministic pseudo-random generator.
 *
 * The corpus must be byte-identical on every machine, so `Math.random` cannot
 * be used to build fixtures. This is a 32-bit xorshift seeded by hand.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
}

/**
 * An independent implementation of the 法人番号 check digit, written from the
 * published formula rather than by calling `@japanready/core`.
 *
 * Generating expectations with the code under test proves nothing. Two
 * implementations of the same specification disagreeing is a real signal.
 *
 * Source: 国税庁「法人番号の指定について」— check digit = 9 − (Σ Pn×Qn) mod 9,
 * where Pn is the n-th digit from the right of the 12-digit base and Qn is 1
 * for odd n, 2 for even n.
 */
export function independentCheckDigit(base12: string): number {
  const digits = base12.split("").reverse().map(Number);
  let sum = 0;
  digits.forEach((digit, i) => {
    const n = i + 1;
    sum += digit * (n % 2 === 1 ? 1 : 2);
  });
  return 9 - (sum % 9);
}
