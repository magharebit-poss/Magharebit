// google-vision.ts — Google Cloud Vision OCR
// To swap provider: set INVOICE_OCR_PROVIDER=tesseract in .env
// No other files change.
//
// Credentials come from env only (never hardcoded):
//   GOOGLE_VISION_CREDENTIALS_JSON — service-account JSON as a single-line string
//   GOOGLE_APPLICATION_CREDENTIALS — path to the service-account JSON file
//     (standard Google auth env var; used automatically by the client)

import { ImageAnnotatorClient } from '@google-cloud/vision';
import type { OcrProvider, OcrResult } from './provider.js';
import { parseInvoiceText } from './invoice-parser.js';

function readInlineCredentials(): Record<string, unknown> | null {
  const raw = process.env['GOOGLE_VISION_CREDENTIALS_JSON'];
  if (!raw || raw.trim() === '') return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isConfigured(): boolean {
  return (
    readInlineCredentials() !== null ||
    (process.env['GOOGLE_APPLICATION_CREDENTIALS'] ?? '').trim() !== ''
  );
}

export class GoogleVisionProvider implements OcrProvider {
  public readonly name = 'google';
  private client: ImageAnnotatorClient | null = null;

  private getClient(): ImageAnnotatorClient {
    if (this.client) return this.client;
    const inline = readInlineCredentials();
    // Inline JSON takes precedence; otherwise the client picks up
    // GOOGLE_APPLICATION_CREDENTIALS from the environment automatically.
    this.client = inline
      ? new ImageAnnotatorClient({ credentials: inline as never })
      : new ImageAnnotatorClient();
    return this.client;
  }

  async available(): Promise<boolean> {
    return isConfigured();
  }

  async extractLines(
    imageBuffer: Buffer,
    _mimeType: string,
    _language = 'ar+fr',
  ): Promise<OcrResult> {
    if (!isConfigured()) {
      throw new Error(
        'Google Vision not configured. Set GOOGLE_VISION_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS in .env',
      );
    }
    const started = Date.now();
    const [result] = await this.getClient().textDetection({
      image: { content: imageBuffer.toString('base64') },
    });
    const fullText = result.fullTextAnnotation?.text ?? '';
    return {
      lines: parseInvoiceText(fullText),
      rawText: fullText,
      provider: this.name,
      processingMs: Date.now() - started,
    };
  }
}
