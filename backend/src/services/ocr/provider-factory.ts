// provider-factory.ts — selects the OCR provider from INVOICE_OCR_PROVIDER.
// Default: 'google'. To switch, set the env var — no code changes needed.

import type { OcrProvider } from './provider.js';
import { GoogleVisionProvider } from './google-vision.js';
import { TesseractProvider } from './tesseract-provider.js';

export function getOcrProvider(): OcrProvider {
  const p = process.env['INVOICE_OCR_PROVIDER'] ?? 'google';
  if (p === 'google') return new GoogleVisionProvider();
  if (p === 'tesseract') return new TesseractProvider();
  throw new Error(`Unknown INVOICE_OCR_PROVIDER: ${p}`);
}
