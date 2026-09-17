import { describe, expect, it } from "vitest";
import {
  composeVoicedMarks,
  detectScript,
  foldVariants,
  fullWidthKanaToHalfWidth,
  halfWidthKanaToFullWidth,
  hiraganaToKatakana,
  isKanjiNumeral,
  isKatakanaField,
  kanjiToNumber,
  katakanaToHiragana,
  needsNormalization,
  normalizeText,
  numberToKanji,
  stripVariationSelectors,
  toFullWidthAscii,
  toHalfWidthAscii,
} from "@japanready/core";

describe("width", () => {
  it("converts half-width katakana including voiced marks", () => {
    expect(halfWidthKanaToFullWidth("ﾀﾅｶ")).toBe("タナカ");
    expect(halfWidthKanaToFullWidth("ｶﾞｷﾞｸﾞ")).toBe("ガギグ");
    expect(halfWidthKanaToFullWidth("ﾊﾟﾋﾟﾌﾟ")).toBe("パピプ");
    expect(halfWidthKanaToFullWidth("ｳﾞｧｲｵﾘﾝ")).toBe("ヴァイオリン");
    expect(halfWidthKanaToFullWidth("ｱﾒﾘｶ･ｼﾞｮｰﾝｽﾞ")).toBe("アメリカ・ジョーンズ");
  });

  it("keeps a dangling voiced mark rather than dropping it", () => {
    // ア has no voiced form; the mark becomes the standalone full-width glyph.
    expect(halfWidthKanaToFullWidth("ｱﾞ")).toBe("ア゛");
  });

  it("round-trips full-width katakana back to half-width", () => {
    expect(fullWidthKanaToHalfWidth("ガギグ")).toBe("ｶﾞｷﾞｸﾞ");
    expect(fullWidthKanaToHalfWidth("パン")).toBe("ﾊﾟﾝ");
    expect(halfWidthKanaToFullWidth(fullWidthKanaToHalfWidth("ジョーンズ"))).toBe("ジョーンズ");
  });

  it("converts ASCII width in both directions", () => {
    expect(toHalfWidthAscii("１２３ＡＢＣ－＠")).toBe("123ABC-@");
    expect(toHalfWidthAscii("東京　都")).toBe("東京 都");
    expect(toFullWidthAscii("123-ABC")).toBe("１２３－ＡＢＣ");
  });

  it("composes combining voiced marks", () => {
    expect(composeVoicedMarks("ガ")).toBe("ガ");
    expect(composeVoicedMarks("ぱ")).toBe("ぱ");
  });
});

describe("kana", () => {
  it("converts between hiragana and katakana", () => {
    expect(hiraganaToKatakana("たなかたろう")).toBe("タナカタロウ");
    expect(katakanaToHiragana("タナカタロウ")).toBe("たなかたろう");
  });

  it("leaves the prolonged sound mark alone in both directions", () => {
    expect(katakanaToHiragana("ジョーンズ")).toBe("じょーんず");
    expect(hiraganaToKatakana("ラーメン")).toBe("ラーメン");
  });

  it("accepts ー and ・ in a katakana field", () => {
    // The bug this guards: /^[ァ-ン]+$/ rejects both of these real readings.
    expect(isKatakanaField("ジョーンズ")).toBe(true);
    expect(isKatakanaField("マリア・ガルシア")).toBe(true);
    expect(isKatakanaField("タナカ タロウ")).toBe(true);
    expect(isKatakanaField("たなか")).toBe(false);
    expect(isKatakanaField("田中")).toBe(false);
  });

  it("classifies mixed-script names as mixed rather than invalid", () => {
    expect(detectScript("田中")).toBe("kanji");
    expect(detectScript("タナカ")).toBe("katakana");
    expect(detectScript("田中マリア")).toBe("mixed");
    expect(detectScript("Tanaka")).toBe("latin");
  });
});

describe("variants", () => {
  it("folds itaiji and kyujitai for matching", () => {
    expect(foldVariants("髙橋")).toBe("高橋");
    expect(foldVariants("﨑山")).toBe("崎山");
    expect(foldVariants("渡邊")).toBe("渡辺");
    expect(foldVariants("渡邉")).toBe("渡辺");
    expect(foldVariants("國分")).toBe("国分");
  });

  it("handles a surrogate-pair variant without corrupting it", () => {
    // 𠮷 is U+20BB7 — outside the BMP, two UTF-16 code units.
    expect("𠮷田".length).toBe(3); // the trap: .length is not the character count
    expect([..."𠮷田"].length).toBe(2);
    expect(foldVariants("𠮷田")).toBe("吉田");
  });

  it("strips ideographic variation selectors", () => {
    const withIvs = "辻\u{E0101}";
    expect(withIvs).not.toBe("辻");
    expect(stripVariationSelectors(withIvs)).toBe("辻");
    expect(foldVariants(withIvs)).toBe("辻");
  });

  it("does not fold 斎 and 斉, which are different names", () => {
    expect(foldVariants("斎藤")).not.toBe(foldVariants("斉藤"));
  });
});

describe("normalizeText", () => {
  it("handles the canonical mixed-width case from the PRD", () => {
    expect(normalizeText("ﾀﾅｶ　太郎")).toBe("タナカ 太郎");
  });

  it("collapses every hyphen-like code point", () => {
    expect(normalizeText("1‐2–3−4－5")).toBe("1-2-3-4-5");
  });

  it("leaves the prolonged sound mark alone", () => {
    // ー is a letter here, not a hyphen. Folding it would produce "コ-ヒ-".
    expect(normalizeText("コーヒー")).toBe("コーヒー");
  });

  it("removes zero-width characters that survive trim()", () => {
    // U+200B is not Unicode whitespace, so trim() leaves it — anywhere.
    const zwsp = "田中​太郎";
    expect(zwsp.trim()).toBe(zwsp);
    expect(zwsp).not.toBe("田中太郎");
    expect(normalizeText(zwsp)).toBe("田中太郎");

    // U+FEFF *is* trimmed at the edges, which is why a mid-string one is worse:
    // it looks like trim() handles the problem right up until it does not.
    expect("田中太郎﻿".trim()).toBe("田中太郎");
    expect("田中﻿太郎".trim()).toBe("田中﻿太郎");
    expect(normalizeText("田中﻿太郎")).toBe("田中太郎");
  });

  it("does not apply the destructive parts of NFKC", () => {
    // NFKC would turn these into "(株)" and "1".
    expect(normalizeText("㈱")).toBe("㈱");
    expect(normalizeText("①")).toBe("①");
    expect("㈱".normalize("NFKC")).toBe("(株)");
  });

  it("reports whether a stored value is already canonical", () => {
    expect(needsNormalization("タナカ 太郎")).toBe(false);
    expect(needsNormalization("ﾀﾅｶ　太郎")).toBe(true);
  });
});

describe("kanji numerals", () => {
  it("parses positional numerals", () => {
    expect(kanjiToNumber("三")).toBe(3);
    expect(kanjiToNumber("十")).toBe(10);
    expect(kanjiToNumber("十三")).toBe(13);
    expect(kanjiToNumber("二十三")).toBe(23);
    expect(kanjiToNumber("百")).toBe(100);
    expect(kanjiToNumber("千二百三十四")).toBe(1234);
    expect(kanjiToNumber("一万二千")).toBe(12000);
  });

  it("parses bare digit strings", () => {
    expect(kanjiToNumber("〇一二")).toBe(12);
  });

  it("rejects non-numerals", () => {
    expect(kanjiToNumber("六本木")).toBeNull();
    expect(isKanjiNumeral("六本木")).toBe(false);
    expect(isKanjiNumeral("六")).toBe(true);
  });

  it("renders numbers back to kanji", () => {
    expect(numberToKanji(3)).toBe("三");
    expect(numberToKanji(10)).toBe("十");
    expect(numberToKanji(23)).toBe("二十三");
    expect(numberToKanji(1234)).toBe("千二百三十四");
    expect(numberToKanji(0)).toBe("〇");
  });
});
