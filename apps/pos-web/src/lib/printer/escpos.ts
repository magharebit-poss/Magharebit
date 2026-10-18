// ESC/POS command builder — 80mm thermal printer, CP1256 Arabic support

// CP1256 (Windows Arabic) encoding table — maps unicode codepoints to byte values
// Only the extended range (128-255) needs mapping; 0-127 is standard ASCII.
const CP1256: Record<number, number> = {
  0x20AC: 0x80, // €
  0x067E: 0x81, // پ
  0x201A: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201E: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02C6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0679: 0x8A, // ٹ
  0x2039: 0x8B, // ‹
  0x0152: 0x8C, // Œ
  0x0686: 0x8D, // چ
  0x0698: 0x8E, // ژ
  0x0688: 0x8F, // ڈ
  0x06AF: 0x90, // گ
  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201C: 0x93, // "
  0x201D: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x06A9: 0x98, // ک
  0x2122: 0x99, // ™
  0x0691: 0x9A, // ڑ
  0x203A: 0x9B, // ›
  0x0153: 0x9C, // œ
  0x200C: 0x9D,
  0x200D: 0x9E,
  0x06BA: 0x9F, // ں
  0x00A0: 0xA0,
  0x060C: 0xA1, // ،
  0x00A2: 0xA2,
  0x00A3: 0xA3,
  0x00A4: 0xA4,
  0x00A5: 0xA5,
  0x00A6: 0xA6,
  0x00A7: 0xA7,
  0x00A8: 0xA8,
  0x00A9: 0xA9,
  0x06BE: 0xAA, // ھ
  0x00AB: 0xAB,
  0x00AC: 0xAC,
  0x00AD: 0xAD,
  0x00AE: 0xAE,
  0x00AF: 0xAF,
  0x00B0: 0xB0,
  0x00B1: 0xB1,
  0x00B2: 0xB2,
  0x00B3: 0xB3,
  0x00B4: 0xB4,
  0x00B5: 0xB5,
  0x00B6: 0xB6,
  0x00B7: 0xB7,
  0x00B8: 0xB8,
  0x00B9: 0xB9,
  0x061B: 0xBA, // ؛
  0x00BB: 0xBB,
  0x00BC: 0xBC,
  0x00BD: 0xBD,
  0x00BE: 0xBE,
  0x061F: 0xBF, // ؟
  0x06C1: 0xC0, // ہ
  0x0621: 0xC1, // ء
  0x0622: 0xC2, // آ
  0x0623: 0xC3, // أ
  0x0624: 0xC4, // ؤ
  0x0625: 0xC5, // إ
  0x0626: 0xC6, // ئ
  0x0627: 0xC7, // ا
  0x0628: 0xC8, // ب
  0x0629: 0xC9, // ة
  0x062A: 0xCA, // ت
  0x062B: 0xCB, // ث
  0x062C: 0xCC, // ج
  0x062D: 0xCD, // ح
  0x062E: 0xCE, // خ
  0x062F: 0xCF, // د
  0x0630: 0xD0, // ذ
  0x0631: 0xD1, // ر
  0x0632: 0xD2, // ز
  0x0633: 0xD3, // س
  0x0634: 0xD4, // ش
  0x0635: 0xD5, // ص
  0x0636: 0xD6, // ض
  0x00D7: 0xD7,
  0x0637: 0xD8, // ط
  0x0638: 0xD9, // ظ
  0x0639: 0xDA, // ع
  0x063A: 0xDB, // غ
  0x0640: 0xDC, // ـ
  0x0641: 0xDD, // ف
  0x0642: 0xDE, // ق
  0x0643: 0xDF, // ك
  0x00E0: 0xE0,
  0x0644: 0xE1, // ل
  0x00E2: 0xE2,
  0x0645: 0xE3, // م
  0x0646: 0xE4, // ن
  0x0647: 0xE5, // ه
  0x0648: 0xE6, // و
  0x00E7: 0xE7,
  0x00E8: 0xE8,
  0x00E9: 0xE9,
  0x00EA: 0xEA,
  0x00EB: 0xEB,
  0x0649: 0xEC, // ى
  0x064A: 0xED, // ي
  0x00EE: 0xEE,
  0x00EF: 0xEF,
  0x00F0: 0xF0,
  0x064B: 0xF1, // ً
  0x064C: 0xF2, // ٌ
  0x064D: 0xF3, // ٍ
  0x064E: 0xF4, // َ
  0x064F: 0xF5, // ُ
  0x0650: 0xF6, // ِ
  0x0651: 0xF7, // ّ
  0x00F8: 0xF8,
  0x0652: 0xF9, // ْ
  0x00FA: 0xFA,
  0x00FB: 0xFB,
  0x00FC: 0xFC,
  0x200E: 0xFD, // LRM
  0x200F: 0xFE, // RLM
  0x06D2: 0xFF, // ے
};

function encodeCP1256(text: string): Uint8Array {
  const out: number[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0x3F;
    if (cp < 0x80) {
      out.push(cp);
    } else {
      out.push(CP1256[cp] ?? 0x3F); // '?' for unknown chars
    }
  }
  return new Uint8Array(out);
}

// ESC/POS constants
const ESC = 0x1B;
const GS  = 0x1D;
const FS  = 0x1C;
const LF  = 0x0A;

export class EscPos {
  private buf: number[] = [];

  private push(...bytes: number[]): this {
    this.buf.push(...bytes);
    return this;
  }

  private pushBytes(arr: Uint8Array): this {
    this.buf.push(...arr);
    return this;
  }

  /** ESC @ — initialize printer */
  init(): this {
    return this.push(ESC, 0x40);
  }

  /** Select CP1256 (Arabic Windows) code page */
  selectArabicCodePage(): this {
    // ESC t n — select character code table; n=16 for CP1256
    return this.push(ESC, 0x74, 0x16);
  }

  /** GS a n — enable/disable automatic status back (ASB) */
  lineBreak(n = 1): this {
    for (let i = 0; i < n; i++) this.push(LF);
    return this;
  }

  /** ESC a n — justification: 0=left, 1=center, 2=right */
  align(a: 'left' | 'center' | 'right'): this {
    const n = a === 'left' ? 0 : a === 'center' ? 1 : 2;
    return this.push(ESC, 0x61, n);
  }

  /** ESC E n — bold on/off */
  bold(on: boolean): this {
    return this.push(ESC, 0x45, on ? 1 : 0);
  }

  /** GS ! n — text size: 0=normal, 0x11=double */
  doubleSize(on: boolean): this {
    return this.push(GS, 0x21, on ? 0x11 : 0x00);
  }

  /** GS B n — white-on-black (reverse) printing on/off */
  reverse(on: boolean): this {
    return this.push(GS, 0x42, on ? 1 : 0);
  }

  /** FS & — set bi-directional print mode (RTL) for Arabic printers that support it */
  rtlMode(on: boolean): this {
    // FS & = Arabic mode on some Epson clones; ignore silently on others
    return this.push(FS, 0x26, on ? 1 : 0);
  }

  /** Write text, encoding to CP1256 */
  text(str: string): this {
    return this.pushBytes(encodeCP1256(str));
  }

  /** Write a line of text followed by LF */
  line(str: string): this {
    return this.text(str).lineBreak();
  }

  /** Print a separator line of dashes */
  separator(char = '-', width = 48): this {
    return this.line(char.repeat(width));
  }

  /** Print two columns: left-aligned label, right-aligned value */
  twoCol(label: string, value: string, width = 48): this {
    const lLen = [...label].length;
    const vLen = [...value].length;
    const gap  = Math.max(1, width - lLen - vLen);
    return this.line(label + ' '.repeat(gap) + value);
  }

  /** GS V m — cut paper: m=0 full, m=1 partial */
  cut(partial = true): this {
    return this.push(GS, 0x56, partial ? 1 : 0);
  }

  /** Feed n lines before cutting */
  feedAndCut(lines = 4, partial = true): this {
    return this.lineBreak(lines).cut(partial);
  }

  build(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}
