import type { CaseSeed } from "./lib.ts";
import { knownVariants } from "@japanready/core";

const UNICODE_SOURCE = "Unicode Standard Annex #11 / Halfwidth and Fullwidth Forms (U+FF00–U+FFEF)";

export const curatedUnicode: CaseSeed[] = [
  {
    category: "unicode",
    group: "mixed-width",
    op: "normalizeText",
    input: "ﾀﾅｶ　太郎",
    expectedOutput: "タナカ 太郎",
    severity: "critical",
    reason:
      "Half-width katakana combined with an ideographic space — the single most common " +
      "shape of Japanese form input that a Western product stores unchanged.",
    fix: "Fold half-width katakana to full-width and U+3000 to U+0020 before storing or comparing.",
    source: UNICODE_SOURCE,
  },
  {
    category: "unicode",
    group: "prolonged-sound-mark",
    op: "normalizeText",
    input: "コーヒー",
    expectedOutput: "コーヒー",
    severity: "critical",
    reason:
      "U+30FC ー is a letter here, not a hyphen. Normalizers that fold every dash-like " +
      "code point turn コーヒー into コ-ヒ-.",
    fix:
      "Exclude U+30FC from the hyphen set. Convert it to '-' only when it sits between two " +
      "digits, which is the address and phone case.",
  },
  {
    category: "unicode",
    group: "prolonged-sound-mark",
    op: "normalizeText",
    input: "ジョーンズ",
    expectedOutput: "ジョーンズ",
    severity: "critical",
    reason: "Same failure in a family name: Jones written in katakana contains ー.",
    fix: "Exclude U+30FC from hyphen folding.",
  },
  {
    category: "unicode",
    group: "hyphens",
    op: "normalizeText",
    input: "1‐2‑3‒4–5—6―7−8－9",
    expectedOutput: "1-2-3-4-5-6-7-8-9",
    severity: "high",
    reason:
      "Nine distinct code points render as a hyphen. A field compared with === treats " +
      "each as a different address.",
    fix: "Collapse the hyphen-like set (U+2010–U+2015, U+2212, U+FF0D, U+FE63) to U+002D.",
  },
  {
    category: "unicode",
    group: "zero-width",
    op: "normalizeText",
    input: "田中​太郎",
    expectedOutput: "田中太郎",
    severity: "high",
    reason:
      "U+200B is not Unicode whitespace, so trim() leaves it. The value looks identical " +
      "to a clean one and compares unequal forever.",
    fix: "Strip U+200B, U+200C, U+200D, U+2060, and U+FEFF before comparison.",
  },
  {
    category: "unicode",
    group: "zero-width",
    op: "normalizeText",
    input: "田中﻿太郎",
    expectedOutput: "田中太郎",
    severity: "high",
    reason:
      "A BOM in the middle of a value. trim() removes it at the edges but not here, so " +
      "the problem appears to be handled and is not.",
    fix: "Strip U+FEFF everywhere, not only at the start of a file.",
  },
  {
    category: "unicode",
    group: "whitespace",
    op: "normalizeText",
    input: "　　田中　　太郎　",
    expectedOutput: "田中 太郎",
    severity: "medium",
    reason: "Leading, trailing, and repeated ideographic spaces from an IME.",
    fix: "Convert U+3000 to U+0020, collapse runs, then trim.",
  },
  {
    category: "unicode",
    group: "whitespace",
    op: "normalizeText",
    input: "田中 太郎",
    expectedOutput: "田中 太郎",
    severity: "medium",
    reason: "A non-breaking space pasted from a web page or a Word document.",
    fix: "Include U+00A0 in the whitespace set.",
  },
  {
    category: "unicode",
    group: "combining-marks",
    op: "normalizeText",
    input: "ガ",
    expectedOutput: "ガ",
    severity: "high",
    reason:
      "A decomposed voiced mark. Common in text extracted from PDFs and from macOS " +
      "filenames, which store NFD.",
    fix: "Compose U+3099 and U+309A onto the preceding kana, or apply NFC.",
  },
  {
    category: "unicode",
    group: "combining-marks",
    op: "normalizeText",
    input: "ぱ",
    expectedOutput: "ぱ",
    severity: "medium",
    reason: "The semi-voiced equivalent, in hiragana.",
    fix: "Compose U+309A onto the preceding kana.",
  },
  {
    category: "unicode",
    group: "nfkc-overreach",
    op: "normalizeText",
    input: "㈱",
    expectedOutput: "㈱",
    severity: "high",
    reason:
      "NFKC rewrites ㈱ to (株). That is correct for search and wrong for a stored " +
      "company name, so general text normalization must not do it.",
    fix:
      "Use targeted width and kana folding for storage; expand ㈱ only inside a " +
      "company-name–specific normalizer.",
    notes: "\"㈱\".normalize(\"NFKC\") === \"(株)\"",
  },
  {
    category: "unicode",
    group: "nfkc-overreach",
    op: "normalizeText",
    input: "①",
    expectedOutput: "①",
    severity: "medium",
    reason: "NFKC turns ① into the digit 1, silently changing product descriptions and notes.",
    fix: "Do not apply NFKC to free text you intend to display back to the customer.",
  },
  {
    category: "unicode",
    group: "nfkc-overreach",
    op: "normalizeText",
    input: "㌔",
    expectedOutput: "㌔",
    severity: "low",
    reason: "NFKC expands ㌔ to キロ, changing the length and the rendering of the field.",
    fix: "Same as above: keep compatibility decomposition out of the storage path.",
  },
  {
    category: "unicode",
    group: "wave-dash",
    op: "normalizeText",
    input: "10〜20",
    expectedOutput: "10~20",
    severity: "medium",
    reason:
      "The Shift_JIS 0x8160 round-trip produces U+301C on some platforms and U+FF5E on " +
      "others. NFKC folds U+FF5E to ASCII but leaves U+301C alone, so applying it makes " +
      "the two diverge rather than converge.",
    fix:
      "Unify U+301C and U+FF5E to one code point before folding width, so both spellings " +
      "of the same mark end up identical.",
  },
  {
    category: "unicode",
    group: "wave-dash",
    op: "normalizeText",
    input: "10～20",
    expectedOutput: "10~20",
    severity: "medium",
    reason: "The other half of the pair: the same range written on the other platform.",
    fix: "Both spellings must produce the same stored value.",
  },
  {
    category: "unicode",
    group: "middle-dot",
    op: "normalizeText",
    input: "ｱﾒﾘｶ･ｼﾞｮｰﾝｽﾞ",
    expectedOutput: "アメリカ・ジョーンズ",
    severity: "medium",
    reason: "Half-width middle dot and half-width voiced kana in a foreign name.",
    fix: "Fold U+FF65 to U+30FB along with the rest of the half-width block.",
    source: UNICODE_SOURCE,
  },
  {
    category: "unicode",
    group: "supplementary-plane",
    op: "normalizeText",
    input: "\u{20BB7}田",
    expectedOutput: "\u{20BB7}田",
    severity: "critical",
    reason:
      "𠮷 (U+20BB7) is outside the Basic Multilingual Plane. Normalization must leave it " +
      "intact; a MySQL utf8mb3 column truncates it and a UTF-16 loop splits it.",
    fix:
      "Use utf8mb4 (or an equivalent 4-byte-safe column), and iterate strings by code " +
      "point ([...str]) rather than by index.",
    notes: '"\\u{20BB7}".length === 2 — .length is not the character count.',
  },
  {
    category: "unicode",
    group: "variation-selector",
    op: "foldVariants",
    input: "辻\u{E0101}",
    expectedOutput: "辻",
    severity: "high",
    reason:
      "An Ideographic Variation Sequence on 辻 selects the two-dot shinnyou glyph. It " +
      "compares unequal to a bare 辻 and is invisible in most fonts.",
    fix: "Strip U+E0100–U+E01EF and U+FE00–U+FE0F before comparing names.",
  },
  {
    category: "unicode",
    group: "compat-ideograph",
    op: "foldVariants",
    input: "山﨑",
    expectedOutput: "山崎",
    severity: "critical",
    reason:
      "U+FA11 﨑 is one of the twelve CJK Compatibility Ideographs that NFC does NOT fold, " +
      "and it is one of the most common characters in Japanese family names. A team that " +
      "applied NFC will believe this case is handled.",
    fix: "Fold the twelve unfoldable compatibility ideographs explicitly; NFC will not do it.",
    notes: '"\\uFA11".normalize("NFC") === "\\uFA11"',
  },
  {
    category: "unicode",
    group: "compat-ideograph",
    op: "foldVariants",
    input: "神戸",
    expectedOutput: "神戸",
    severity: "medium",
    reason:
      "U+FA19 神 is a compatibility ideograph that NFC *does* fold — the inconsistency " +
      "with U+FA11 is the trap.",
    fix: "Fold the whole U+FA00–U+FA6D block rather than relying on NFC's partial coverage.",
  },
  {
    category: "unicode",
    group: "variants-not-folded",
    op: "foldVariants",
    input: "斉藤",
    expectedOutput: "斉藤",
    severity: "high",
    reason:
      "斉 and 斎 are different characters and different surnames. Folding them together " +
      "merges two real customers.",
    fix: "Fold 旧字体 and itaiji only. Never fold 斉/斎 or 崎/嵜 into each other's *names*.",
  },
];

/**
 * Systematic width coverage.
 *
 * Expectations come from the JavaScript engine's own Unicode tables
 * (`String.prototype.normalize("NFKC")`), not from `@japanready/core`. For
 * pure half-width-kana and full-width-ASCII input, correct width folding and
 * NFKC agree — the cases where they must diverge are curated above.
 */
export function generatedUnicode(): CaseSeed[] {
  const cases: CaseSeed[] = [];

  // Half-width katakana, base characters. U+FF9E and U+FF9F (the bare voiced
  // marks) are excluded: NFKC maps them to the *combining* U+3099/U+309A, while
  // a standalone mark with nothing to attach to should become the spacing
  // U+309B/U+309C. They are covered as pairs below instead.
  for (let code = 0xff61; code <= 0xff9d; code++) {
    const ch = String.fromCodePoint(code);
    const expected = ch.normalize("NFKC");
    if (expected === ch) continue;
    cases.push({
      category: "unicode",
      group: "halfwidth-kana",
      op: "normalizeText",
      input: ch,
      expectedOutput: expected,
      severity: "high",
      reason: `Half-width katakana U+${code.toString(16).toUpperCase()} must fold to its full-width form.`,
      fix: "Map the U+FF61–U+FF9F block to U+3000–U+30FF.",
      source: UNICODE_SOURCE,
    });
  }

  // Half-width katakana with voiced and semi-voiced marks.
  for (let code = 0xff66; code <= 0xff9d; code++) {
    for (const mark of ["ﾞ", "ﾟ"]) {
      const input = String.fromCodePoint(code) + mark;
      const expected = input.normalize("NFKC");
      // Only keep the pairs that actually compose into a single character.
      if ([...expected].length !== 1) continue;
      cases.push({
        category: "unicode",
        group: "halfwidth-kana-voiced",
        op: "normalizeText",
        input,
        expectedOutput: expected,
        severity: "high",
        reason:
          "A half-width kana followed by a half-width voiced mark is two code points that " +
          "must compose into one full-width character.",
        fix: "Combine U+FF9E / U+FF9F with the preceding base kana rather than mapping them separately.",
        source: UNICODE_SOURCE,
      });
    }
  }

  // Full-width ASCII.
  for (let code = 0xff01; code <= 0xff5e; code++) {
    const ch = String.fromCodePoint(code);
    const expected = ch.normalize("NFKC");
    cases.push({
      category: "unicode",
      group: "fullwidth-ascii",
      op: "normalizeText",
      input: ch,
      expectedOutput: expected,
      severity: "medium",
      reason: `Full-width U+${code.toString(16).toUpperCase()} must fold to its ASCII equivalent.`,
      fix: "Subtract 0xFEE0 from code points in U+FF01–U+FF5E.",
      source: UNICODE_SOURCE,
    });
  }

  // Kanji variant folding, driven by the published table.
  for (const variant of knownVariants()) {
    if (variant.from === variant.to) continue;
    cases.push({
      category: "unicode",
      group: `variants-${variant.tier}`,
      op: "foldVariants",
      input: variant.from,
      expectedOutput: variant.to,
      severity: variant.tier === "itaiji" ? "high" : "medium",
      reason:
        variant.tier === "kyujitai"
          ? "A pre-1946 character form must fold to its modern equivalent for matching."
          : variant.tier === "compat"
            ? "A CJK Compatibility Ideograph must fold to the unified ideograph it duplicates."
            : "An interchangeable name glyph must fold so that the same person matches themselves.",
      fix: "Apply a variant-folding table when building comparison keys; keep the original for display.",
      tier: variant.tier === "itaiji" ? "free" : "pro",
    });
  }

  return cases;
}
