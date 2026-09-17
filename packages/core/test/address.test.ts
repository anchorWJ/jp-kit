import { describe, expect, it } from "vitest";
import {
  findPrefecture,
  formatAddress,
  formatAddressLatin,
  formatPostalCode,
  isValidPostalCode,
  normalizeAddressNumerals,
  normalizeBlockSeparators,
  parseAddress,
  parseBlockNumber,
  postalPrefixIsPlausibleFor,
  PREFECTURES,
  prefectureByCode,
} from "@japanready/core";

describe("prefectures", () => {
  it("has all 47", () => {
    expect(PREFECTURES).toHaveLength(47);
    expect(new Set(PREFECTURES.map((p) => p.code)).size).toBe(47);
  });

  it("resolves from every spelling a form receives", () => {
    for (const input of ["東京都", "東京", "とうきょう", "Tokyo", "TOKYO", "Tōkyō", "Tokyo Prefecture"]) {
      expect(findPrefecture(input)?.code, input).toBe("13");
    }
  });

  it("keeps the code as a zero-padded string", () => {
    expect(prefectureByCode("01")?.kanji).toBe("北海道");
    expect(prefectureByCode(1)?.kanji).toBe("北海道");
    expect(prefectureByCode("13")?.kanji).toBe("東京都");
  });
});

describe("postal codes", () => {
  it("normalizes every written form", () => {
    for (const input of ["〒150-0002", "150-0002", "1500002", "１５００００２", "〒１５０－０００２", "150 0002"]) {
      expect(formatPostalCode(input), input).toBe("150-0002");
    }
  });

  it("handles the kana-mode hyphen", () => {
    expect(formatPostalCode("150ー0002")).toBe("150-0002");
  });

  it("preserves leading zeros", () => {
    // 060-0001 is central Sapporo. Numeric storage makes it 600001.
    expect(formatPostalCode("0600001")).toBe("060-0001");
    expect(formatPostalCode(String(600001))).toBeNull();
  });

  it("rejects wrong lengths", () => {
    expect(isValidPostalCode("150-000")).toBe(false);
    expect(isValidPostalCode("150-00023")).toBe(false);
    expect(isValidPostalCode("ABC-DEFG")).toBe(false);
  });

  it("flags an impossible postal/prefecture pairing", () => {
    expect(postalPrefixIsPlausibleFor("150-0002", "13")).toBe(true); // Tokyo
    expect(postalPrefixIsPlausibleFor("150-0002", "01")).toBe(false); // Hokkaido
    expect(postalPrefixIsPlausibleFor("060-0001", "01")).toBe(true);
  });
});

describe("block numbers", () => {
  it("parses the unit form", () => {
    expect(parseBlockNumber("2丁目21番1号")).toMatchObject({ chome: 2, ban: 21, go: 1 });
    expect(parseBlockNumber("1丁目1番地")).toMatchObject({ chome: 1, ban: 1 });
  });

  it("parses the dash form", () => {
    expect(parseBlockNumber("2-21-1")).toMatchObject({ chome: 2, ban: 21, go: 1 });
    expect(parseBlockNumber("2-21")).toMatchObject({ chome: 2, ban: 21 });
  });

  it("accepts every separator a Japanese keyboard produces", () => {
    for (const input of ["1-2-3", "1ー2ー3", "1－2－3", "1の2の3", "1−2−3", "１−２−３"]) {
      expect(parseBlockNumber(input), input).toMatchObject({ chome: 1, ban: 2, go: 3 });
    }
  });

  it("converts kanji numerals only where a unit proves they are numbers", () => {
    expect(normalizeAddressNumerals("六本木六丁目十番一号")).toBe("六本木6丁目10番1号");
    expect(normalizeAddressNumerals("四谷")).toBe("四谷");
    expect(normalizeAddressNumerals("一番町")).toBe("一番町");
    expect(normalizeAddressNumerals("北十二条西三丁目")).toBe("北12条西3丁目");
  });

  it("separates the building from the block", () => {
    const parsed = parseBlockNumber("1-2-3 サンプルマンション101号室");
    expect(parsed).toMatchObject({ chome: 1, ban: 2, go: 3 });
    expect(parsed?.rest).toBe("サンプルマンション101号室");
  });

  it("normalizes separators without touching a prolonged sound mark", () => {
    expect(normalizeBlockSeparators("コーヒー1ー2")).toBe("コーヒー1-2");
  });
});

describe("parseAddress", () => {
  it("parses a Tokyo special-ward address with a building", () => {
    const a = parseAddress("〒150-0002 東京都渋谷区渋谷2丁目21番1号 渋谷ヒカリエ11F");
    expect(a).toMatchObject({
      postalCode: "150-0002",
      prefecture: "東京都",
      city: "渋谷区",
      town: "渋谷",
      chome: 2,
      ban: 21,
      go: 1,
      building: "渋谷ヒカリエ11F",
      confidence: "high",
    });
    expect(a.ward).toBeUndefined();
  });

  it("does not let 町 in a town name swallow the ward", () => {
    const a = parseAddress("東京都千代田区神田小川町3-1");
    expect(a.city).toBe("千代田区");
    expect(a.town).toBe("神田小川町");
    expect(a).toMatchObject({ chome: 3, ban: 1 });
  });

  it("separates a 政令指定都市 into city and ward", () => {
    const a = parseAddress("神奈川県横浜市西区みなとみらい2-3-1");
    expect(a).toMatchObject({
      prefecture: "神奈川県",
      city: "横浜市",
      ward: "西区",
      town: "みなとみらい",
      chome: 2,
      ban: 3,
      go: 1,
    });
  });

  it("keeps a grid-style town name intact", () => {
    const a = parseAddress("北海道札幌市中央区北1条西2丁目");
    expect(a).toMatchObject({ city: "札幌市", ward: "中央区", town: "北1条西", chome: 2 });
  });

  it("handles a municipality under a 郡", () => {
    const a = parseAddress("北海道河東郡音更町大通1丁目1番地");
    expect(a).toMatchObject({
      county: "河東郡",
      city: "音更町",
      town: "大通",
      chome: 1,
      ban: 1,
    });
  });

  it("handles 郡 + a municipality whose own name contains 町", () => {
    const a = parseAddress("佐賀県杵島郡大町町大字大町5017");
    expect(a).toMatchObject({ county: "杵島郡", city: "大町町" });
  });

  it("handles municipalities whose stem contains 市/町/村", () => {
    expect(parseAddress("三重県四日市市諏訪町1-5").city).toBe("四日市市");
    expect(parseAddress("広島県廿日市市下平良1-11-1").city).toBe("廿日市市");
    expect(parseAddress("石川県野々市市三納1-1").city).toBe("野々市市");
    expect(parseAddress("東京都武蔵村山市本町1-1-1").city).toBe("武蔵村山市");
    expect(parseAddress("東京都羽村市緑ヶ丘5-2-1").city).toBe("羽村市");
    expect(parseAddress("新潟県十日町市千歳町3-3").city).toBe("十日町市");
  });

  it("does not mistake 郡 inside a city name for a county", () => {
    const koriyama = parseAddress("福島県郡山市朝日1-23-7");
    expect(koriyama.city).toBe("郡山市");
    expect(koriyama.county).toBeUndefined();

    const yamatokoriyama = parseAddress("奈良県大和郡山市北郡山町248-4");
    expect(yamatokoriyama.city).toBe("大和郡山市");
    expect(yamatokoriyama.county).toBeUndefined();
  });

  it("does not mistake 市 inside a city name for the suffix", () => {
    expect(parseAddress("千葉県市川市市川1-1-1")).toMatchObject({
      city: "市川市",
      town: "市川",
    });
  });

  it("parses an address written without a prefecture", () => {
    const a = parseAddress("渋谷区渋谷2-21-1");
    expect(a.city).toBe("渋谷区");
    expect(a.prefecture).toBeUndefined();
    expect(a.warnings.join(" ")).toMatch(/prefecture/i);
    expect(a.confidence).toBe("medium");
  });

  it("parses kanji numerals and preserves a numeral-shaped place name", () => {
    const a = parseAddress("東京都港区六本木六丁目十番一号");
    expect(a).toMatchObject({ city: "港区", town: "六本木", chome: 6, ban: 10, go: 1 });
  });

  it("parses full-width digits with a kana-mode separator", () => {
    const a = parseAddress("東京都新宿区西新宿２ー８ー１");
    expect(a).toMatchObject({ town: "西新宿", chome: 2, ban: 8, go: 1 });
  });

  it("parses a postal code written without the 〒 mark", () => {
    expect(parseAddress("1500002 東京都渋谷区渋谷2-21-1").postalCode).toBe("150-0002");
  });

  it("reports low confidence rather than throwing on junk", () => {
    const a = parseAddress("not an address");
    expect(a.confidence).toBe("low");
    expect(a.warnings.length).toBeGreaterThan(0);
  });
});

describe("formatting", () => {
  const address = {
    postalCode: "150-0002",
    prefecture: "東京都",
    prefectureCode: "13",
    city: "渋谷区",
    town: "渋谷",
    chome: 2,
    ban: 21,
    go: 1,
    building: "渋谷ヒカリエ11F",
  };

  it("renders the canonical Japanese form", () => {
    expect(formatAddress(address)).toBe("〒150-0002 東京都渋谷区渋谷2丁目21番1号 渋谷ヒカリエ11F");
  });

  it("renders the dash form", () => {
    expect(formatAddress(address, { blockStyle: "dashes", postalCode: false })).toBe(
      "東京都渋谷区渋谷2-21-1 渋谷ヒカリエ11F",
    );
  });

  it("renders Latin order, large-to-small reversed", () => {
    expect(formatAddressLatin(address, { town: "Shibuya", city: "Shibuya-ku" })).toBe(
      "渋谷ヒカリエ11F, 2-21-1 Shibuya, Shibuya-ku, Tokyo 150-0002, Japan",
    );
  });

  it("round-trips parse → format", () => {
    const text = "〒150-0002 東京都渋谷区渋谷2丁目21番1号";
    expect(formatAddress(parseAddress(text))).toBe(text);
  });
});
