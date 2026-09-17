/**
 * Character-width conversion (全角 / 半角).
 *
 * These are deliberately *separate* from `NFKC`. `NFKC` folds width along with
 * a large amount of unrelated compatibility mapping (① → 1, ㈱ → (株), ㌔ → キロ,
 * ﬁ → fi). Japanese customer data usually needs width folding but *not* the rest,
 * so each transform here is independently callable.
 */

/** U+FF01 '！' … U+FF5E '～' map onto U+0021 '!' … U+007E '~' at a fixed offset. */
const FULLWIDTH_ASCII_OFFSET = 0xfee0;
const FULLWIDTH_ASCII_START = 0xff01;
const FULLWIDTH_ASCII_END = 0xff5e;

/** U+3000 IDEOGRAPHIC SPACE — the single most common invisible bug in Japanese input. */
export const IDEOGRAPHIC_SPACE = "　";

// ---------------------------------------------------------------------------
// Half-width katakana
// ---------------------------------------------------------------------------

// Order-matched pairs. Kept as parallel strings so the tables stay auditable.
const HALFWIDTH_KANA =
  "｡｢｣､･ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ";
const FULLWIDTH_KANA =
  "。「」、・ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン゛゜";

/** Base kana → voiced (濁点) form. */
const VOICED: Readonly<Record<string, string>> = {
  カ: "ガ", キ: "ギ", ク: "グ", ケ: "ゲ", コ: "ゴ",
  サ: "ザ", シ: "ジ", ス: "ズ", セ: "ゼ", ソ: "ゾ",
  タ: "ダ", チ: "ヂ", ツ: "ヅ", テ: "デ", ト: "ド",
  ハ: "バ", ヒ: "ビ", フ: "ブ", ヘ: "ベ", ホ: "ボ",
  ウ: "ヴ", ワ: "ヷ", ヲ: "ヺ",
};

/** Base kana → semi-voiced (半濁点) form. */
const SEMI_VOICED: Readonly<Record<string, string>> = {
  ハ: "パ", ヒ: "ピ", フ: "プ", ヘ: "ペ", ホ: "ポ",
};

const HALF_TO_FULL_KANA = new Map<string, string>();
const FULL_TO_HALF_KANA = new Map<string, string>();
for (let i = 0; i < HALFWIDTH_KANA.length; i++) {
  const half = HALFWIDTH_KANA[i]!;
  const full = FULLWIDTH_KANA[i]!;
  HALF_TO_FULL_KANA.set(half, full);
  FULL_TO_HALF_KANA.set(full, half);
}

/** Composed full-width kana → the two half-width code points that spell it. */
const FULL_TO_HALF_COMPOSED = new Map<string, string>();
for (const [base, voiced] of Object.entries(VOICED)) {
  const halfBase = FULL_TO_HALF_KANA.get(base);
  if (halfBase) FULL_TO_HALF_COMPOSED.set(voiced, `${halfBase}ﾞ`);
}
for (const [base, semi] of Object.entries(SEMI_VOICED)) {
  const halfBase = FULL_TO_HALF_KANA.get(base);
  if (halfBase) FULL_TO_HALF_COMPOSED.set(semi, `${halfBase}ﾟ`);
}

const HALFWIDTH_VOICED_MARK = "ﾞ"; // U+FF9E
const HALFWIDTH_SEMI_VOICED_MARK = "ﾟ"; // U+FF9F
const COMBINING_VOICED_MARK = "゙";
const COMBINING_SEMI_VOICED_MARK = "゚";
const FULLWIDTH_VOICED_MARK = "゛"; // ゛ standalone
const FULLWIDTH_SEMI_VOICED_MARK = "゜"; // ゜ standalone

/**
 * Half-width katakana → full-width katakana, combining voiced/semi-voiced marks
 * with the preceding base character.
 *
 * `ﾀﾅｶ` → `タナカ`, `ｶﾞ` → `ガ`, `ﾊﾟ` → `パ`, `ｳﾞ` → `ヴ`.
 *
 * A dangling mark with no combinable base (`ﾞ` after `ア`) is converted to the
 * standalone full-width mark rather than dropped — silently losing a character
 * is worse than keeping an odd one.
 */
export function halfWidthKanaToFullWidth(input: string): string {
  let out = "";
  const chars = [...input];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const mapped = HALF_TO_FULL_KANA.get(ch);
    if (mapped === undefined) {
      out += ch;
      continue;
    }
    const next = chars[i + 1];
    if (next === HALFWIDTH_VOICED_MARK) {
      const voiced = VOICED[mapped];
      if (voiced) {
        out += voiced;
        i++;
        continue;
      }
    } else if (next === HALFWIDTH_SEMI_VOICED_MARK) {
      const semi = SEMI_VOICED[mapped];
      if (semi) {
        out += semi;
        i++;
        continue;
      }
    }
    out += mapped;
  }
  return out;
}

/**
 * Full-width katakana → half-width katakana, decomposing voiced kana into
 * base + mark. Needed by systems that still mandate half-width kana
 * (bank transfer files, EDI, some legacy billing feeds).
 */
export function fullWidthKanaToHalfWidth(input: string): string {
  let out = "";
  for (const ch of input) {
    const composed = FULL_TO_HALF_COMPOSED.get(ch);
    if (composed !== undefined) {
      out += composed;
      continue;
    }
    out += FULL_TO_HALF_KANA.get(ch) ?? ch;
  }
  return out;
}

/**
 * Compose standalone / combining voiced marks onto the preceding kana.
 * `カ` + U+3099 → `ガ`. Text pasted from PDFs and some IMEs arrives this way.
 */
export function composeVoicedMarks(input: string): string {
  let out = "";
  const chars = [...input];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const next = chars[i + 1];
    if (next === COMBINING_VOICED_MARK || next === FULLWIDTH_VOICED_MARK) {
      const voiced = VOICED[ch] ?? HIRAGANA_VOICED[ch];
      if (voiced) {
        out += voiced;
        i++;
        continue;
      }
    }
    if (next === COMBINING_SEMI_VOICED_MARK || next === FULLWIDTH_SEMI_VOICED_MARK) {
      const semi = SEMI_VOICED[ch] ?? HIRAGANA_SEMI_VOICED[ch];
      if (semi) {
        out += semi;
        i++;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

const HIRAGANA_VOICED: Readonly<Record<string, string>> = {
  か: "が", き: "ぎ", く: "ぐ", け: "げ", こ: "ご",
  さ: "ざ", し: "じ", す: "ず", せ: "ぜ", そ: "ぞ",
  た: "だ", ち: "ぢ", つ: "づ", て: "で", と: "ど",
  は: "ば", ひ: "び", ふ: "ぶ", へ: "べ", ほ: "ぼ",
  う: "ゔ",
};

const HIRAGANA_SEMI_VOICED: Readonly<Record<string, string>> = {
  は: "ぱ", ひ: "ぴ", ふ: "ぷ", へ: "ぺ", ほ: "ぽ",
};

// ---------------------------------------------------------------------------
// ASCII width
// ---------------------------------------------------------------------------

/** Full-width ASCII → half-width ASCII. `１２３ＡＢＣ－` → `123ABC-`. */
export function toHalfWidthAscii(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= FULLWIDTH_ASCII_START && code <= FULLWIDTH_ASCII_END) {
      out += String.fromCodePoint(code - FULLWIDTH_ASCII_OFFSET);
    } else if (ch === IDEOGRAPHIC_SPACE) {
      out += " ";
    } else {
      out += ch;
    }
  }
  return out;
}

/** Half-width ASCII → full-width ASCII. Used when a downstream form demands 全角. */
export function toFullWidthAscii(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x21 && code <= 0x7e) {
      out += String.fromCodePoint(code + FULLWIDTH_ASCII_OFFSET);
    } else if (ch === " ") {
      out += IDEOGRAPHIC_SPACE;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Full-width digits only (`１２３` → `123`), leaving letters and symbols alone. */
export function toHalfWidthDigits(input: string): string {
  return input.replace(/[０-９]/g, (d) =>
    String.fromCodePoint(d.codePointAt(0)! - FULLWIDTH_ASCII_OFFSET),
  );
}

/** True if the string contains any half-width katakana. */
export function hasHalfWidthKana(input: string): boolean {
  return /[｡-ﾟ]/.test(input);
}

/** True if the string contains any full-width ASCII or an ideographic space. */
export function hasFullWidthAscii(input: string): boolean {
  return /[！-～　]/.test(input);
}
