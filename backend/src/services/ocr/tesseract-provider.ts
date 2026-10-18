// tesseract-provider.ts — local OCR fallback via node-tesseract-ocr.
// To swap provider: set INVOICE_OCR_PROVIDER=google in .env.
//
// Requires the tesseract binary installed on the OS (plus ara + fra langdata).
// The npm package is only a Node wrapper. If the binary is missing, available()
// returns false gracefully and the route reports ocr_not_configured.

import { recognize } from 'node-tesseract-ocr';
import type { OcrProvider, OcrResult } from './provider.js';
import { parseInvoiceText } from './invoice-parser.js';

// Map the app's language hint to tesseract's langdata codes.
function tesseractLang(language: string): string {
  if (language === 'ar') return 'ara';
  if (language === 'fr') return 'fra';
  return 'ara+fra';
}

export class TesseractProvider implements OcrProvider {
  public readonly name = 'tesseract';

  async available(): Promise<boolean> {
    // A 1×1 white PNG — cheapest possible probe that the binary runs.
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
      'base64',
    );
    try {
      await recognize(pixel, { lang: 'eng', oem: 1, psm: 6 });
      return true;
    } catch {
      return false;
    }
  }

  async extractLines(
    imageBuffer: Buffer,
    _mimeType: string,
    language = 'ar+fr',
  ): Promise<OcrResult> {
    const started = Date.now();
    const text = await recognize(imageBuffer, {
      lang: tesseractLang(language),
      oem: 1,
      psm: 6,
    });
    return {
      lines: parseInvoiceText(text),
      rawText: text,
      provider: this.name,
      processingMs: Date.now() - started,
    };
  }
}
