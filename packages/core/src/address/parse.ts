/**
 * Japanese address parsing.
 *
 * ## What this can and cannot do
 *
 * Exact municipality segmentation requires the official municipality list
 * (総務省 全国地方公共団体コード, ~1,900 entries) or Japan Post's KEN_ALL.
 * This module ships *logic*, not those datasets — see the licensing note in the
 * README. It therefore segments by suffix (市 / 区 / 町 / 村 / 郡) with an
 * explicit exception table for the municipalities whose names contain one of
 * those characters internally (四日市市, 東村山市, 大和郡山市, …).
 *
 * Every result carries a `confidence` and a list of `warnings`. Treat
 * `"low"` as "ask the user to confirm", not as "reject the customer".
 */

import { normalizeText } from "../unicode/text.js";
import { matchPrefecturePrefix, type Prefecture } from "./prefectures.js";
import { toPostalDigits, formatPostalCode } from "./postal.js";
import {
  normalizeAddressNumerals,
  normalizeBlockSeparators,
  parseBlockNumber,
} from "./numerals.js";

export interface JapaneseAddress {
  /** `123-4567`, or `undefined` when the input carried no postal code. */
  readonly postalCode?: string;
  readonly prefecture?: string;
  /** JIS X 0401 code for the prefecture. */
  readonly prefectureCode?: string;
  /** 郡, when the municipality sits under one. */
  readonly county?: string;
  /** Municipality: 市 / 町 / 村, or a Tokyo 特別区. */
  readonly city?: string;
  /** 行政区 of a 政令指定都市 (横浜市**西区**). Absent for Tokyo's 特別区, which are `city`. */
  readonly ward?: string;
  /** 町域 — the town/district name. */
  readonly town?: string;
  readonly chome?: number;
  readonly ban?: number;
  readonly go?: number;
  /** Building name, floor, room — everything after the block number. */
  readonly building?: string;
}

export type AddressConfidence = "high" | "medium" | "low";

export interface ParsedAddress extends JapaneseAddress {
  readonly confidence: AddressConfidence;
  readonly warnings: readonly string[];
  /** The normalized input the parse ran against. */
  readonly normalized: string;
}

/**
 * Municipalities whose names contain 市 / 町 / 村 / 郡 before the real suffix.
 * Matched whole, ahead of the generic suffix rules.
 */
const MUNICIPALITY_EXCEPTIONS = [
  // 市 inside the stem
  "四日市市",
  "廿日市市",
  "野々市市",
  // 郡 inside the stem — must beat the 郡+町/村 rule
  "大和郡山市",
  "郡山市",
  "郡上市",
  // 町 inside the stem
  "十日町市",
  "大町市",
  "大町町",
  "上市町",
  "下市町",
  // 村 inside the stem
  "武蔵村山市",
  "東村山市",
  "田村市",
  "羽村市",
  "大村市",
  "玉村町",
] as const;

const EXCEPTIONS_BY_LENGTH = [...MUNICIPALITY_EXCEPTIONS].sort((a, b) => b.length - a.length);

const RE_POSTAL_LEADING = /^〒?\s*(\d{3})\s*-?\s*(\d{4})\s*/u;
const RE_COUNTY = /^(.+?郡)/u;
const RE_COUNTY_TOWN = /^(.+?[町村])/u;
const RE_MUNICIPALITY = /^(.+?[市町村])/u;
const RE_WARD = /^(.+?区)/u;

interface MunicipalityMatch {
  county?: string;
  city: string;
  /** Number of characters consumed from the front of the input. */
  consumed: number;
}

/**
 * Resolve the municipality (and its 郡, if any) from the text following the
 * prefecture.
 *
 * Three rules compete, and picking naively gets common addresses wrong:
 *
 * - `東京都千代田区神田小川町…` — matching `[市町村]` first consumes
 *   `千代田区神田小川町`, because 町 appears in the *town* name. The 区 match
 *   is shorter and correct.
 * - `神奈川県横浜市西区…` — here the reverse holds: the 市 match is shorter
 *   than the 区 match and correct, with 西区 becoming the 行政区.
 * - `佐賀県杵島郡大町町` — a 郡 always precedes a 町/村 municipality, so the
 *   county rule wins even though `[市町村]` produces a shorter match.
 *   The exception is `奈良県大和郡山市`, where the shorter match ends in 市 —
 *   and no 市 ever sits under a 郡.
 */
function resolveMunicipality(input: string): MunicipalityMatch | null {
  const direct = EXCEPTIONS_BY_LENGTH.find((name) => input.startsWith(name));
  if (direct) return { city: direct, consumed: direct.length };

  let countyCandidate: MunicipalityMatch | null = null;
  const countyMatch = RE_COUNTY.exec(input);
  if (countyMatch) {
    const county = countyMatch[1]!;
    const after = input.slice(county.length);
    const townException = EXCEPTIONS_BY_LENGTH.find((name) => after.startsWith(name));
    const townMatch = townException ?? RE_COUNTY_TOWN.exec(after)?.[1];
    if (townMatch) {
      countyCandidate = {
        county,
        city: townMatch,
        consumed: county.length + townMatch.length,
      };
    }
  }

  const municipal = RE_MUNICIPALITY.exec(input)?.[1];
  const ward = RE_WARD.exec(input)?.[1];

  if (countyCandidate) {
    const shorterCity =
      municipal !== undefined &&
      municipal.endsWith("市") &&
      municipal.length < countyCandidate.consumed;
    if (!shorterCity) return countyCandidate;
  }

  if (municipal !== undefined && ward !== undefined) {
    return municipal.length <= ward.length
      ? { city: municipal, consumed: municipal.length }
      : { city: ward, consumed: ward.length };
  }
  if (municipal !== undefined) return { city: municipal, consumed: municipal.length };
  if (ward !== undefined) return { city: ward, consumed: ward.length };
  return null;
}

/**
 * Parse a single-line Japanese address.
 *
 * ```ts
 * parseAddress("〒150-0002 東京都渋谷区渋谷2丁目21番1号 ヒカリエ11F")
 * // { postalCode: "150-0002", prefecture: "東京都", city: "渋谷区",
 * //   town: "渋谷", chome: 2, ban: 21, go: 1, building: "ヒカリエ11F", … }
 * ```
 */
export function parseAddress(input: string): ParsedAddress {
  const warnings: string[] = [];
  const normalized = normalizeBlockSeparators(
    normalizeAddressNumerals(normalizeText(input)),
  );

  let rest = normalized;
  let postalCode: string | undefined;
  let prefecture: Prefecture | undefined;
  let county: string | undefined;
  let city: string | undefined;
  let ward: string | undefined;

  // --- postal code -------------------------------------------------------
  const postalMatch = RE_POSTAL_LEADING.exec(rest);
  if (postalMatch) {
    postalCode = `${postalMatch[1]}-${postalMatch[2]}`;
    rest = rest.slice(postalMatch[0].length).trim();
  }

  // --- prefecture --------------------------------------------------------
  prefecture = matchPrefecturePrefix(rest);
  if (prefecture) {
    rest = rest.slice(prefecture.kanji.length).trim();
  } else {
    warnings.push(
      "No prefecture found. Japanese addresses are routinely written without one " +
        "when the city is a 政令指定都市 or a well-known ward; the value is still required " +
        "by most shipping and invoicing systems.",
    );
  }

  // --- municipality ------------------------------------------------------
  const municipality = resolveMunicipality(rest);
  if (municipality) {
    county = municipality.county;
    city = municipality.city;
    rest = rest.slice(municipality.consumed).trim();
  }

  // --- 行政区 of a 政令指定都市 -------------------------------------------
  if (city?.endsWith("市")) {
    const wardMatch = RE_WARD.exec(rest);
    if (wardMatch) {
      ward = wardMatch[1]!;
      rest = rest.slice(wardMatch[0].length).trim();
    }
  }

  if (!city) {
    warnings.push("No municipality (市/区/町/村) found.");
  }

  // --- town + block number ----------------------------------------------
  const split = splitTownAndBlock(rest);
  const town = split.town || undefined;
  const block = split.block;

  if (!town && !block) {
    warnings.push("No town or block number found.");
  }

  const confidence: AddressConfidence =
    prefecture && city && town && block
      ? "high"
      : city && (town || block)
        ? "medium"
        : "low";

  if (postalCode === undefined && prefecture === undefined) {
    warnings.push("Neither a postal code nor a prefecture is present; the address is unverifiable.");
  }

  return {
    ...(postalCode !== undefined ? { postalCode } : {}),
    ...(prefecture ? { prefecture: prefecture.kanji, prefectureCode: prefecture.code } : {}),
    ...(county !== undefined ? { county } : {}),
    ...(city !== undefined ? { city } : {}),
    ...(ward !== undefined ? { ward } : {}),
    ...(town !== undefined ? { town } : {}),
    ...(block?.chome !== undefined ? { chome: block.chome } : {}),
    ...(block?.ban !== undefined ? { ban: block.ban } : {}),
    ...(block?.go !== undefined ? { go: block.go } : {}),
    ...(block?.rest ? { building: block.rest } : {}),
    confidence,
    warnings,
    normalized,
  };
}

/**
 * Split `南幸1-1-1 ○○ビル` into the town name and the block number.
 *
 * A digit does not always start the block: in Sapporo's grid, `北12条西3丁目`
 * is the town name. Digits immediately followed by 条 are therefore skipped.
 */
function splitTownAndBlock(input: string): {
  town: string;
  block: ReturnType<typeof parseBlockNumber>;
} {
  const re = /\d+/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    const after = input.slice(match.index + match[0].length);
    if (after.startsWith("条")) continue; // part of a grid-style town name
    const town = input.slice(0, match.index).trim();
    const block = parseBlockNumber(input.slice(match.index));
    if (block) return { town, block };
  }
  return { town: input.trim(), block: null };
}

/** Structured address → canonical single-line Japanese text. */
export interface FormatAddressOptions {
  /** Include the postal code with a 〒 mark. Default `true`. */
  postalCode?: boolean;
  /** `"units"` → `2丁目21番1号`; `"dashes"` → `2-21-1`. Default `"units"`. */
  blockStyle?: "units" | "dashes";
}

export function formatAddress(
  address: JapaneseAddress,
  options: FormatAddressOptions = {},
): string {
  const { postalCode = true, blockStyle = "units" } = options;
  const parts: string[] = [];

  if (postalCode && address.postalCode) {
    const formatted = formatPostalCode(address.postalCode, { mark: true });
    if (formatted) parts.push(formatted);
  }

  let line = "";
  line += address.prefecture ?? "";
  line += address.county ?? "";
  line += address.city ?? "";
  line += address.ward ?? "";
  line += address.town ?? "";

  const nums = [address.chome, address.ban, address.go].filter(
    (n): n is number => typeof n === "number",
  );
  if (nums.length > 0) {
    if (blockStyle === "dashes") {
      line += nums.join("-");
    } else {
      if (address.chome !== undefined) line += `${address.chome}丁目`;
      if (address.ban !== undefined) line += `${address.ban}番`;
      if (address.go !== undefined) line += `${address.go}号`;
    }
  }

  if (line) parts.push(line);
  if (address.building) parts.push(address.building);
  return parts.join(" ");
}

export interface LatinAddressParts {
  /** Romanized town name — this package cannot derive it; supply it if you have it. */
  town?: string;
  /** Romanized municipality name. */
  city?: string;
  /** Romanized ward name. */
  ward?: string;
}

/**
 * Render an address in Latin (postal, small-to-large) order.
 *
 * Only the prefecture can be romanized from built-in data. Town, city, and ward
 * romanization needs a reading dataset, so supply those via `latin` when you
 * have them; otherwise the original Japanese is kept in place, which is still
 * deliverable domestically.
 */
export function formatAddressLatin(
  address: JapaneseAddress,
  latin: LatinAddressParts = {},
): string {
  const segments: string[] = [];

  const block = [address.chome, address.ban, address.go]
    .filter((n): n is number => typeof n === "number")
    .join("-");

  const town = latin.town ?? address.town;
  const first = [block, town].filter(Boolean).join(" ");
  if (address.building) segments.push(address.building);
  if (first) segments.push(first);

  const ward = latin.ward ?? address.ward;
  if (ward) segments.push(ward);

  const city = latin.city ?? address.city;
  if (city) segments.push(city);
  if (address.county) segments.push(address.county);

  const pref = address.prefectureCode
    ? matchPrefecturePrefix(address.prefecture ?? "")
    : undefined;
  const prefName = pref?.romaji ?? address.prefecture;
  const tail = [prefName, address.postalCode].filter(Boolean).join(" ");
  if (tail) segments.push(tail);
  segments.push("Japan");

  return segments.join(", ");
}

/** Convenience: parse then re-emit in canonical Japanese form. */
export function normalizeAddress(input: string, options?: FormatAddressOptions): string {
  return formatAddress(parseAddress(input), options);
}

/** Re-exported so callers can normalize a postal code without a second import. */
export { toPostalDigits };
