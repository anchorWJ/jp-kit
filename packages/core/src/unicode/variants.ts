/**
 * Kanji variant folding (異体字 / 旧字体).
 *
 * IMPORTANT: folding is for *matching*, never for display or storage.
 * A person named 髙橋 is not named 高橋. Fold to compare, dedupe, and search;
 * keep the original bytes for everything the customer will ever see.
 *
 * Three tiers are provided because they carry different risk:
 *
 * - `kyujitai`   — pre-1946 forms and their post-reform standard equivalents
 *                  (國/国). Folding these is near-universally safe.
 * - `compat`     — CJK Compatibility Ideographs (U+FA00–U+FA2D), the JIS X 0213
 *                  duplicates of ordinary kanji. Folding these is safe.
 * - `itaiji`     — variant glyphs that are separate code points but the same
 *                  name in practice (髙/高, 嶋/島). Safe for search, risky for
 *                  identity matching against a registry.
 */

/** 旧字体 → 新字体. Restricted to forms that actually occur in names and addresses. */
const KYUJITAI: Readonly<Record<string, string>> = {
  亞: "亜", 假: "仮", 價: "価", 傳: "伝", 佛: "仏", 來: "来", 儉: "倹", 內: "内",
  圓: "円", 剩: "剰", 劍: "剣", 勳: "勲", 區: "区", 卷: "巻", 參: "参", 雙: "双",
  國: "国", 圖: "図", 團: "団", 壽: "寿", 巖: "巌", 帶: "帯", 廣: "広", 廳: "庁",
  應: "応", 惠: "恵", 愼: "慎", 戰: "戦", 戶: "戸", 拜: "拝", 拂: "払", 據: "拠",
  擇: "択", 擴: "拡", 攝: "摂", 斷: "断", 曉: "暁", 條: "条", 榮: "栄", 樂: "楽",
  樣: "様", 橫: "横", 歐: "欧", 步: "歩", 歷: "歴", 歸: "帰", 每: "毎", 氣: "気",
  淺: "浅", 淚: "涙", 溫: "温", 濕: "湿", 瀧: "滝", 瀨: "瀬", 燈: "灯", 營: "営",
  狀: "状", 獨: "独", 獻: "献", 產: "産", 畫: "画", 發: "発", 眞: "真", 碎: "砕",
  禪: "禅", 稅: "税", 稻: "稲", 穩: "穏", 粹: "粋", 絲: "糸", 經: "経", 綠: "緑",
  縣: "県", 續: "続", 總: "総", 繩: "縄", 聰: "聡", 聲: "声", 聽: "聴", 臺: "台",
  藏: "蔵", 藝: "芸", 藥: "薬", 蟲: "虫", 螢: "蛍", 衞: "衛", 裝: "装", 覺: "覚",
  覽: "覧", 觀: "観", 觸: "触", 證: "証", 譯: "訳", 讀: "読", 豐: "豊", 賣: "売",
  贊: "賛", 轉: "転", 辭: "辞", 遲: "遅", 邊: "辺", 邉: "辺", 郞: "郎", 醫: "医",
  醬: "醤", 釀: "醸", 鐵: "鉄", 鑄: "鋳", 鎭: "鎮", 關: "関", 陷: "陥", 險: "険",
  隨: "随", 隱: "隠", 靈: "霊", 靑: "青", 靜: "静", 顏: "顔", 顯: "顕", 飮: "飲",
  餘: "余", 驛: "駅", 驗: "験", 髮: "髪", 鬪: "闘", 鷄: "鶏", 黃: "黄", 黑: "黒",
  默: "黙", 齊: "斉", 齋: "斎", 齒: "歯", 齡: "齢", 龍: "竜", 德: "徳", 學: "学",
  實: "実", 寫: "写", 寶: "宝", 專: "専", 將: "将", 對: "対", 屬: "属", 彌: "弥",
  徵: "徴", 拔: "抜", 搜: "捜", 晝: "昼", 會: "会", 殘: "残", 澤: "沢", 濱: "浜",
  燒: "焼", 盜: "盗", 臟: "臓", 舍: "舎", 虛: "虚", 號: "号", 錢: "銭", 鄕: "郷",
  醉: "酔", 雜: "雑", 頰: "頬", 飜: "翻", 髓: "髄", 惡: "悪", 櫻: "桜", 峯: "峰",
  桒: "桑", 檜: "桧", 禮: "礼", 萬: "万", 竝: "並", 舘: "館",
};

/**
 * CJK Compatibility Ideographs → the unified ideograph they duplicate.
 * Written as escapes because the two forms are visually identical in most fonts.
 *
 * A team that reaches for `NFC` will believe this block is handled, and will be
 * right 98 times out of 110: of U+FA00–U+FA6D, all but twelve have a canonical
 * decomposition and fold away. The twelve that do not are
 * `﨎﨏﨑﨓﨔﨟﨡﨣﨤﨧﨨﨩` — and one of them, U+FA11 﨑, is among the most common
 * characters in Japanese family names (山﨑, 﨑田). `"﨑".normalize("NFC")`
 * returns U+FA11 unchanged, so 山﨑 and 山崎 stay unequal after normalization.
 */
const COMPAT: Readonly<Record<string, string>> = {
  "塚": "塚",
  "﨑": "崎",
  "晴": "晴",
  "凞": "凞",
  "猪": "猪",
  "益": "益",
  "礼": "礼",
  "神": "神",
  "祥": "祥",
  "福": "福",
  "靖": "靖",
  "精": "精",
  "羽": "羽",
  "諸": "諸",
  "逸": "逸",
  "都": "都",
  "飯": "飯",
  "飼": "飼",
  "館": "館",
  "鶴": "鶴",
};

/**
 * 異体字 → representative form. These are *not* old/new pairs; they are separate
 * glyphs used interchangeably in family names and place names.
 *
 * 𠮷 (U+20BB7, "tsuchi-yoshi") is outside the BMP — any implementation that
 * iterates a JS string by UTF-16 code unit, or stores it in MySQL `utf8mb3`,
 * will corrupt it.
 */
const ITAIJI: Readonly<Record<string, string>> = {
  髙: "高", // U+9AD9 はしごだか
  嵜: "崎",
  濵: "浜",
  嶋: "島",
  嶌: "島",
  冨: "富",
  栁: "柳",
  桺: "柳",
  凉: "涼",
  籏: "旗",
  "\u{20BB7}": "吉", // 𠮷 つちよし
  "\u{211DD}": "土", // 𡈽
};

/** Combining variation selectors: VS1–VS16 and the Ideographic Variation Sequence range. */
const RE_VARIATION_SELECTOR = /[︀-️]|[\u{E0100}-\u{E01EF}]/gu;

/**
 * Remove Ideographic Variation Sequence selectors.
 *
 * `辻` + U+E0101 renders with the two-dot shinnyou but compares unequal to a bare
 * `辻`. Stripping the selector makes them equal. Databases with a `utf8mb3`
 * column silently truncate these instead, producing a third distinct value.
 */
export function stripVariationSelectors(input: string): string {
  return input.replace(RE_VARIATION_SELECTOR, "");
}

export interface FoldVariantsOptions {
  /** Fold 旧字体 → 新字体. Default `true`. */
  kyujitai?: boolean;
  /** Fold CJK Compatibility Ideographs. Default `true`. */
  compat?: boolean;
  /** Fold interchangeable name glyphs (髙→高). Default `true`. */
  itaiji?: boolean;
  /** Strip IVS selectors. Default `true`. */
  variationSelectors?: boolean;
}

/**
 * Fold kanji variants to a canonical comparison form.
 *
 * ```ts
 * foldVariants("髙橋") === foldVariants("高橋") // true
 * ```
 *
 * Use for dedupe, search, and "did the customer already sign up?" checks.
 * Never write the result back to a name field.
 */
export function foldVariants(input: string, options: FoldVariantsOptions = {}): string {
  const {
    kyujitai = true,
    compat = true,
    itaiji = true,
    variationSelectors = true,
  } = options;

  const text = variationSelectors ? stripVariationSelectors(input) : input;
  if (!kyujitai && !compat && !itaiji) return text;

  let out = "";
  for (const ch of text) {
    let mapped: string | undefined;
    if (kyujitai) mapped = KYUJITAI[ch];
    if (mapped === undefined && compat) mapped = COMPAT[ch];
    if (mapped === undefined && itaiji) mapped = ITAIJI[ch];
    out += mapped ?? ch;
  }
  return out;
}

/** True if the two strings are the same name once variants are folded. */
export function isVariantEquivalent(a: string, b: string, options?: FoldVariantsOptions): boolean {
  return foldVariants(a, options) === foldVariants(b, options);
}

export type VariantTier = "kyujitai" | "compat" | "itaiji";

/** Every variant character this build knows how to fold, for docs and corpus generation. */
export function knownVariants(): ReadonlyArray<{ from: string; to: string; tier: VariantTier }> {
  return [
    ...Object.entries(KYUJITAI).map(([from, to]) => ({ from, to, tier: "kyujitai" as const })),
    ...Object.entries(COMPAT).map(([from, to]) => ({ from, to, tier: "compat" as const })),
    ...Object.entries(ITAIJI).map(([from, to]) => ({ from, to, tier: "itaiji" as const })),
  ];
}
