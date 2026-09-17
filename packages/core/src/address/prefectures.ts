/** The 47 prefectures, with the JIS X 0401 code used by most Japanese datasets. */

export interface Prefecture {
  /** JIS X 0401 two-digit code, `"01"`–`"47"`. Zero-padded: it is a code, not a number. */
  readonly code: string;
  /** Full name including the 都/道/府/県 suffix, as it appears on official forms. */
  readonly kanji: string;
  /** Name without the suffix. `東京都` → `東京`. */
  readonly short: string;
  readonly kana: string;
  /** Plain-ASCII romanisation, the form used by nearly all address APIs. */
  readonly romaji: string;
  /** Hepburn romanisation with macrons, for correct display. */
  readonly romajiMacron: string;
}

export const PREFECTURES: readonly Prefecture[] = [
  { code: "01", kanji: "北海道", short: "北海道", kana: "ほっかいどう", romaji: "Hokkaido", romajiMacron: "Hokkaidō" },
  { code: "02", kanji: "青森県", short: "青森", kana: "あおもり", romaji: "Aomori", romajiMacron: "Aomori" },
  { code: "03", kanji: "岩手県", short: "岩手", kana: "いわて", romaji: "Iwate", romajiMacron: "Iwate" },
  { code: "04", kanji: "宮城県", short: "宮城", kana: "みやぎ", romaji: "Miyagi", romajiMacron: "Miyagi" },
  { code: "05", kanji: "秋田県", short: "秋田", kana: "あきた", romaji: "Akita", romajiMacron: "Akita" },
  { code: "06", kanji: "山形県", short: "山形", kana: "やまがた", romaji: "Yamagata", romajiMacron: "Yamagata" },
  { code: "07", kanji: "福島県", short: "福島", kana: "ふくしま", romaji: "Fukushima", romajiMacron: "Fukushima" },
  { code: "08", kanji: "茨城県", short: "茨城", kana: "いばらき", romaji: "Ibaraki", romajiMacron: "Ibaraki" },
  { code: "09", kanji: "栃木県", short: "栃木", kana: "とちぎ", romaji: "Tochigi", romajiMacron: "Tochigi" },
  { code: "10", kanji: "群馬県", short: "群馬", kana: "ぐんま", romaji: "Gunma", romajiMacron: "Gunma" },
  { code: "11", kanji: "埼玉県", short: "埼玉", kana: "さいたま", romaji: "Saitama", romajiMacron: "Saitama" },
  { code: "12", kanji: "千葉県", short: "千葉", kana: "ちば", romaji: "Chiba", romajiMacron: "Chiba" },
  { code: "13", kanji: "東京都", short: "東京", kana: "とうきょう", romaji: "Tokyo", romajiMacron: "Tōkyō" },
  { code: "14", kanji: "神奈川県", short: "神奈川", kana: "かながわ", romaji: "Kanagawa", romajiMacron: "Kanagawa" },
  { code: "15", kanji: "新潟県", short: "新潟", kana: "にいがた", romaji: "Niigata", romajiMacron: "Niigata" },
  { code: "16", kanji: "富山県", short: "富山", kana: "とやま", romaji: "Toyama", romajiMacron: "Toyama" },
  { code: "17", kanji: "石川県", short: "石川", kana: "いしかわ", romaji: "Ishikawa", romajiMacron: "Ishikawa" },
  { code: "18", kanji: "福井県", short: "福井", kana: "ふくい", romaji: "Fukui", romajiMacron: "Fukui" },
  { code: "19", kanji: "山梨県", short: "山梨", kana: "やまなし", romaji: "Yamanashi", romajiMacron: "Yamanashi" },
  { code: "20", kanji: "長野県", short: "長野", kana: "ながの", romaji: "Nagano", romajiMacron: "Nagano" },
  { code: "21", kanji: "岐阜県", short: "岐阜", kana: "ぎふ", romaji: "Gifu", romajiMacron: "Gifu" },
  { code: "22", kanji: "静岡県", short: "静岡", kana: "しずおか", romaji: "Shizuoka", romajiMacron: "Shizuoka" },
  { code: "23", kanji: "愛知県", short: "愛知", kana: "あいち", romaji: "Aichi", romajiMacron: "Aichi" },
  { code: "24", kanji: "三重県", short: "三重", kana: "みえ", romaji: "Mie", romajiMacron: "Mie" },
  { code: "25", kanji: "滋賀県", short: "滋賀", kana: "しが", romaji: "Shiga", romajiMacron: "Shiga" },
  { code: "26", kanji: "京都府", short: "京都", kana: "きょうと", romaji: "Kyoto", romajiMacron: "Kyōto" },
  { code: "27", kanji: "大阪府", short: "大阪", kana: "おおさか", romaji: "Osaka", romajiMacron: "Ōsaka" },
  { code: "28", kanji: "兵庫県", short: "兵庫", kana: "ひょうご", romaji: "Hyogo", romajiMacron: "Hyōgo" },
  { code: "29", kanji: "奈良県", short: "奈良", kana: "なら", romaji: "Nara", romajiMacron: "Nara" },
  { code: "30", kanji: "和歌山県", short: "和歌山", kana: "わかやま", romaji: "Wakayama", romajiMacron: "Wakayama" },
  { code: "31", kanji: "鳥取県", short: "鳥取", kana: "とっとり", romaji: "Tottori", romajiMacron: "Tottori" },
  { code: "32", kanji: "島根県", short: "島根", kana: "しまね", romaji: "Shimane", romajiMacron: "Shimane" },
  { code: "33", kanji: "岡山県", short: "岡山", kana: "おかやま", romaji: "Okayama", romajiMacron: "Okayama" },
  { code: "34", kanji: "広島県", short: "広島", kana: "ひろしま", romaji: "Hiroshima", romajiMacron: "Hiroshima" },
  { code: "35", kanji: "山口県", short: "山口", kana: "やまぐち", romaji: "Yamaguchi", romajiMacron: "Yamaguchi" },
  { code: "36", kanji: "徳島県", short: "徳島", kana: "とくしま", romaji: "Tokushima", romajiMacron: "Tokushima" },
  { code: "37", kanji: "香川県", short: "香川", kana: "かがわ", romaji: "Kagawa", romajiMacron: "Kagawa" },
  { code: "38", kanji: "愛媛県", short: "愛媛", kana: "えひめ", romaji: "Ehime", romajiMacron: "Ehime" },
  { code: "39", kanji: "高知県", short: "高知", kana: "こうち", romaji: "Kochi", romajiMacron: "Kōchi" },
  { code: "40", kanji: "福岡県", short: "福岡", kana: "ふくおか", romaji: "Fukuoka", romajiMacron: "Fukuoka" },
  { code: "41", kanji: "佐賀県", short: "佐賀", kana: "さが", romaji: "Saga", romajiMacron: "Saga" },
  { code: "42", kanji: "長崎県", short: "長崎", kana: "ながさき", romaji: "Nagasaki", romajiMacron: "Nagasaki" },
  { code: "43", kanji: "熊本県", short: "熊本", kana: "くまもと", romaji: "Kumamoto", romajiMacron: "Kumamoto" },
  { code: "44", kanji: "大分県", short: "大分", kana: "おおいた", romaji: "Oita", romajiMacron: "Ōita" },
  { code: "45", kanji: "宮崎県", short: "宮崎", kana: "みやざき", romaji: "Miyazaki", romajiMacron: "Miyazaki" },
  { code: "46", kanji: "鹿児島県", short: "鹿児島", kana: "かごしま", romaji: "Kagoshima", romajiMacron: "Kagoshima" },
  { code: "47", kanji: "沖縄県", short: "沖縄", kana: "おきなわ", romaji: "Okinawa", romajiMacron: "Okinawa" },
] as const;

const BY_CODE = new Map(PREFECTURES.map((p) => [p.code, p]));
const LOOKUP = new Map<string, Prefecture>();
for (const p of PREFECTURES) {
  LOOKUP.set(p.kanji, p);
  LOOKUP.set(p.short, p);
  LOOKUP.set(p.kana, p);
  LOOKUP.set(`${p.kana}${suffixKana(p.kanji)}`, p);
  LOOKUP.set(p.romaji.toLowerCase(), p);
  LOOKUP.set(p.romajiMacron.toLowerCase(), p);
  LOOKUP.set(`${p.romaji.toLowerCase()}-ken`, p);
  LOOKUP.set(`${p.romaji.toLowerCase()} prefecture`, p);
}

function suffixKana(kanji: string): string {
  if (kanji.endsWith("都")) return "と";
  if (kanji.endsWith("道")) return "";
  if (kanji.endsWith("府")) return "ふ";
  if (kanji.endsWith("県")) return "けん";
  return "";
}

/** Look up a prefecture by JIS code, `"13"` or `"13"`-equivalent numeric input. */
export function prefectureByCode(code: string | number): Prefecture | undefined {
  const key = typeof code === "number" ? String(code).padStart(2, "0") : code.padStart(2, "0");
  return BY_CODE.get(key);
}

/**
 * Resolve a prefecture from almost any spelling a form will receive:
 * `東京都`, `東京`, `とうきょう`, `Tokyo`, `TOKYO`, `Tōkyō`, `Tokyo Prefecture`.
 *
 * Returns `undefined` rather than guessing.
 */
export function findPrefecture(input: string): Prefecture | undefined {
  const key = input.trim();
  return LOOKUP.get(key) ?? LOOKUP.get(key.toLowerCase());
}

/** Longest prefecture name that the string starts with, if any. */
export function matchPrefecturePrefix(input: string): Prefecture | undefined {
  // 東京都 must win over a hypothetical shorter match; sort by length descending.
  for (const p of PREFECTURES_BY_LENGTH) {
    if (input.startsWith(p.kanji)) return p;
  }
  return undefined;
}

const PREFECTURES_BY_LENGTH = [...PREFECTURES].sort((a, b) => b.kanji.length - a.kanji.length);

/**
 * The four prefectures whose names are commonly written without their suffix,
 * and one written *only* with it.
 *
 * 北海道 has no removable suffix — `短縮` logic that strips the last character
 * of every prefecture name turns it into `北海`, which is not a place.
 */
export const PREFECTURE_SUFFIX_NOTES = {
  noRemovableSuffix: ["北海道"],
  metropolis: ["東京都"],
  urbanPrefectures: ["京都府", "大阪府"],
} as const;
