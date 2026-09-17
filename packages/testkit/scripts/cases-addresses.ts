import type { CaseSeed } from "./lib.ts";
import { PREFECTURES } from "@japanready/core";

const POSTAL_SOURCE = "日本郵便 郵便番号データ (KEN_ALL) format specification";

export const curatedAddresses: CaseSeed[] = [
  // --- postal codes ------------------------------------------------------
  ...(
    [
      ["〒150-0002", "With the 〒 mark."],
      ["150-0002", "The canonical form."],
      ["1500002", "Unseparated, as stored by many systems."],
      ["１５０－０００２", "Full-width digits and a full-width hyphen from a Japanese IME."],
      ["150ー0002", "U+30FC typed from the kana key instead of a hyphen."],
      ["150 0002", "Space-separated."],
      [" 150-0002 ", "Surrounded by whitespace."],
    ] as const
  ).map(
    ([input, reason]): CaseSeed => ({
      category: "addresses",
      group: "postal-normalize",
      op: "normalizePostalCode",
      input,
      expectedOutput: "150-0002",
      severity: "high",
      reason,
      fix: "Fold width, strip every separator, then re-insert one hyphen after three digits.",
      source: POSTAL_SOURCE,
    }),
  ),
  {
    category: "addresses",
    group: "postal-leading-zero",
    op: "normalizePostalCode",
    input: "0600001",
    expectedOutput: "060-0001",
    severity: "critical",
    reason:
      "060-0001 is central Sapporo. Stored as a number it becomes 600001 and the leading " +
      "zero is gone — silently, for the whole of Hokkaido and much of Tokyo.",
    fix: "Store postal codes as a string. Never as INT, and never as a JSON number.",
    source: POSTAL_SOURCE,
  },
  {
    category: "addresses",
    group: "postal-leading-zero",
    op: "validatePostalCode",
    input: "600001",
    shouldAccept: false,
    severity: "critical",
    reason: "The same code after numeric storage has destroyed it: six digits, not seven.",
    fix: "Reject, and check the storage path — the value was damaged before it got here.",
  },
  ...(
    [
      ["150-000", "Six digits — one short of a postal code."],
      ["150-00023", "Eight digits — one more than a postal code."],
      ["ABC-DEFG", "The right shape, but letters rather than digits."],
      ["", "Empty input in an address form that requires a postal code."],
    ] as const
  ).map(
    ([input, reason]): CaseSeed => ({
      category: "addresses",
      group: "postal-reject",
      op: "validatePostalCode",
      input,
      shouldAccept: false,
      severity: "medium",
      reason,
      fix: "A Japanese postal code is exactly seven digits.",
    }),
  ),

  // --- parsing -----------------------------------------------------------
  {
    category: "addresses",
    group: "parse-special-ward",
    op: "parseAddress",
    input: "〒150-0002 東京都渋谷区渋谷2丁目21番1号 渋谷ヒカリエ11F",
    expectedOutput: {
      postalCode: "150-0002",
      prefecture: "東京都",
      city: "渋谷区",
      town: "渋谷",
      chome: 2,
      ban: 21,
      go: 1,
      building: "渋谷ヒカリエ11F",
    },
    severity: "critical",
    reason: "The standard Tokyo business address, fully written out.",
    fix:
      "Parse prefecture, municipality, town, block, and building into separate fields. " +
      "A single address1/address2 pair cannot represent this.",
  },
  {
    category: "addresses",
    group: "parse-town-contains-cho",
    op: "parseAddress",
    input: "東京都千代田区神田小川町3-1",
    expectedOutput: { prefecture: "東京都", city: "千代田区", town: "神田小川町", chome: 3, ban: 1 },
    severity: "critical",
    reason:
      "The town name ends in 町. A parser that looks for [市区町村] left-to-right consumes " +
      "千代田区神田小川町 as the municipality.",
    fix:
      "When both a 区 match and a 市/町/村 match are possible, take the shorter one. " +
      "町 in a town name is far more common than a municipality with 区 inside it.",
  },
  {
    category: "addresses",
    group: "parse-designated-city",
    op: "parseAddress",
    input: "神奈川県横浜市西区みなとみらい2-3-1",
    expectedOutput: {
      prefecture: "神奈川県",
      city: "横浜市",
      ward: "西区",
      town: "みなとみらい",
      chome: 2,
      ban: 3,
      go: 1,
    },
    severity: "critical",
    reason:
      "A 政令指定都市 has a 行政区 below the municipality. Here the 市 match is the shorter " +
      "one and correct — the opposite of the previous case.",
    fix: "Extract the ward as a separate level below the city, not as the city.",
  },
  {
    category: "addresses",
    group: "parse-county",
    op: "parseAddress",
    input: "北海道河東郡音更町大通1丁目1番地",
    expectedOutput: { prefecture: "北海道", city: "音更町", town: "大通", chome: 1, ban: 1 },
    severity: "high",
    reason:
      "A town under a 郡. Schemas with only prefecture/city/town have nowhere to put the 郡 " +
      "and drop it, which breaks delivery.",
    fix: "Give the county its own field; it is part of the postal address.",
  },
  {
    category: "addresses",
    group: "parse-county",
    op: "parseAddress",
    input: "佐賀県杵島郡大町町大字大町5017",
    expectedOutput: { prefecture: "佐賀県", county: "杵島郡", city: "大町町" },
    severity: "high",
    reason:
      "大町町 — a municipality whose own name ends in 町 before the suffix 町. Suffix " +
      "matching alone yields 大町.",
    fix: "Keep an exception table for municipalities whose stem contains 市/区/町/村.",
  },
  ...(
    [
      ["三重県四日市市諏訪町1-5", "四日市市", "四日市市 — 市 inside the stem."],
      ["広島県廿日市市下平良1-11-1", "廿日市市", "廿日市市 — 市 inside the stem."],
      ["石川県野々市市三納1-1", "野々市市", "野々市市 — 市 inside the stem."],
      ["新潟県十日町市千歳町3-3", "十日町市", "十日町市 — 町 inside the stem."],
      ["長野県大町市大町3887", "大町市", "大町市 — 町 inside the stem."],
      ["東京都武蔵村山市本町1-1-1", "武蔵村山市", "武蔵村山市 — 村 inside the stem."],
      ["東京都東村山市本町1-2-3", "東村山市", "東村山市 — 村 inside the stem."],
      ["東京都羽村市緑ヶ丘5-2-1", "羽村市", "羽村市 — 村 inside the stem."],
      ["福島県田村市船引町船引1-1", "田村市", "田村市 — 村 inside the stem."],
      ["長崎県大村市玖島1-25", "大村市", "大村市 — 村 inside the stem."],
      ["群馬県佐波郡玉村町下新田201", "玉村町", "玉村町 — 村 inside the stem, under a 郡."],
      ["福島県郡山市朝日1-23-7", "郡山市", "郡山市 — 郡 inside the stem, not a county."],
      ["奈良県大和郡山市北郡山町248-4", "大和郡山市", "大和郡山市 — 郡 inside the stem."],
      ["岐阜県郡上市八幡町島谷228", "郡上市", "郡上市 — 郡 inside the stem."],
      ["千葉県市川市市川1-1-1", "市川市", "市川市 — 市 at the start of the stem."],
      ["千葉県市原市国分寺台中央1-1-1", "市原市", "市原市 — 市 at the start of the stem."],
      ["東京都町田市森野2-2-22", "町田市", "町田市 — 町 at the start of the stem."],
      ["山形県村山市中央1-3-6", "村山市", "村山市 — 村 at the start of the stem."],
      ["新潟県村上市三之町1-1", "村上市", "村上市 — 村 at the start of the stem."],
    ] as const
  ).map(
    ([input, city, reason]): CaseSeed => ({
      category: "addresses",
      group: "parse-municipality-exception",
      op: "parseAddress",
      input,
      expectedOutput: { city },
      severity: "high",
      reason,
      fix:
        "Suffix matching alone is not enough. Either keep an exception table or segment " +
        "against the official municipality list (総務省 全国地方公共団体コード).",
      tier: "pro",
    }),
  ),
  {
    category: "addresses",
    group: "parse-grid-town",
    op: "parseAddress",
    input: "北海道札幌市中央区北1条西2丁目",
    expectedOutput: { city: "札幌市", ward: "中央区", town: "北1条西", chome: 2 },
    severity: "high",
    reason:
      "Sapporo addresses are a grid: 北1条西 is the town name and contains a digit. " +
      "Splitting at the first digit yields a town of 北.",
    fix: "Skip digits followed by 条 when locating the start of the block number.",
  },
  {
    category: "addresses",
    group: "parse-kanji-numerals",
    op: "parseAddress",
    input: "東京都港区六本木六丁目十番一号",
    expectedOutput: { city: "港区", town: "六本木", chome: 6, ban: 10, go: 1 },
    severity: "high",
    reason:
      "六本木 is a place name; 六丁目 is a number. Converting every kanji numeral produces " +
      "6本木.",
    fix: "Convert a kanji numeral only when the following unit (丁目/番地/号) proves it is one.",
  },
  {
    category: "addresses",
    group: "parse-no-prefecture",
    op: "parseAddress",
    input: "渋谷区渋谷2-21-1",
    expectedOutput: { city: "渋谷区", town: "渋谷", chome: 2, ban: 21, go: 1 },
    severity: "high",
    reason:
      "Japanese customers routinely omit the prefecture for well-known wards and " +
      "designated cities. A required prefecture field blocks the signup.",
    fix: "Parse what is present and infer or ask for the prefecture; do not reject the input.",
  },
  {
    category: "addresses",
    group: "parse-fullwidth",
    op: "parseAddress",
    input: "東京都新宿区西新宿２ー８ー１",
    expectedOutput: { city: "新宿区", town: "西新宿", chome: 2, ban: 8, go: 1 },
    severity: "high",
    reason: "Full-width digits with U+30FC separators, straight from a Japanese IME.",
    fix: "Fold width and treat ー between two digits as a hyphen.",
  },
  {
    category: "addresses",
    group: "parse-postal-inline",
    op: "parseAddress",
    input: "1500002 東京都渋谷区渋谷2-21-1",
    expectedOutput: { postalCode: "150-0002", city: "渋谷区" },
    severity: "medium",
    reason: "A postal code written without the 〒 mark or a hyphen.",
    fix: "Recognise a leading 3+4 digit group as the postal code.",
  },
  {
    category: "addresses",
    group: "format",
    op: "formatAddress",
    input: "〒150-0002 東京都渋谷区渋谷2丁目21番1号",
    expectedOutput: "〒150-0002 東京都渋谷区渋谷2丁目21番1号",
    severity: "medium",
    reason: "Parsing and re-formatting a canonical address must be lossless.",
    fix: "parse → format must be the identity on already-canonical input.",
  },
];

export function generatedAddresses(): CaseSeed[] {
  const cases: CaseSeed[] = [];

  // Every prefecture must be recognised at the head of an address.
  for (const prefecture of PREFECTURES) {
    cases.push({
      category: "addresses",
      group: "prefecture-parse",
      op: "parseAddress",
      input: `${prefecture.kanji}テスト市テスト町1-2-3`,
      expectedOutput: { prefecture: prefecture.kanji, chome: 1, ban: 2, go: 3 },
      severity: "medium",
      reason: `${prefecture.kanji} must be recognised as a prefecture.`,
      fix:
        "Match the longest prefecture name at the start of the string. Note 北海道 has no " +
        "removable suffix — stripping the last character gives 北海.",
    });
  }

  // Postal codes across the whole numeric range, in three written forms.
  const postalSeeds = [
    "0010010", "0600001", "1000001", "1500002", "2200005", "2310023",
    "3300854", "4600002", "5300001", "6008216", "7300011", "8100001",
    "9000015", "9800021", "9070003", "0790177", "4980000", "8900053",
  ];
  for (const digits of postalSeeds) {
    const canonical = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    const forms: Array<[string, string]> = [
      [digits, "unseparated"],
      [canonical, "hyphenated"],
      [`〒${canonical}`, "with the 〒 mark"],
    ];
    for (const [input, label] of forms) {
      cases.push({
        category: "addresses",
        group: "postal-forms",
        op: "normalizePostalCode",
        input,
        expectedOutput: canonical,
        severity: digits.startsWith("0") ? "high" : "low",
        reason: `Postal code ${canonical} written ${label}.`,
        fix: "All written forms must normalize to the same canonical value.",
        tier: "pro",
      });
    }
  }

  // Block-number separators.
  const separators = ["-", "ー", "－", "−", "–", "の", "・"];
  for (const sep of separators) {
    cases.push({
      category: "addresses",
      group: "block-separators",
      op: "parseAddress",
      input: `東京都渋谷区渋谷2${sep}21${sep}1`,
      expectedOutput: { chome: 2, ban: 21, go: 1 },
      severity: "high",
      reason: `Block numbers separated by U+${sep.codePointAt(0)!.toString(16).toUpperCase()}.`,
      fix: "Treat every dash-like code point, plus の and ・, as a block separator between digits.",
    });
  }

  // Unit-form and dash-form equivalence.
  for (const [chome, ban, go] of [
    [1, 1, 1], [2, 21, 1], [3, 15, 7], [10, 2, 30], [1, 2, 3],
  ] as const) {
    cases.push({
      category: "addresses",
      group: "block-unit-form",
      op: "parseAddress",
      input: `東京都渋谷区渋谷${chome}丁目${ban}番${go}号`,
      expectedOutput: { chome, ban, go },
      severity: "medium",
      reason: "The unit form of a block number must parse to the same structure as the dash form.",
      fix: "Support 丁目/番/番地/号 as well as hyphens.",
      tier: "pro",
    });
    cases.push({
      category: "addresses",
      group: "block-dash-form",
      op: "parseAddress",
      input: `東京都渋谷区渋谷${chome}-${ban}-${go}`,
      expectedOutput: { chome, ban, go },
      severity: "medium",
      reason: "The dash form of the same block number.",
      fix: "Both forms must produce the same structured result.",
      tier: "pro",
    });
  }

  return cases;
}
