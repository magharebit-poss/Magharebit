// provider.ts — OCR provider abstraction for supplier-invoice scanning.
//
// One interface, swappable implementations (Google Cloud Vision primary,
// Tesseract local fallback), selected at runtime by INVOICE_OCR_PROVIDER.
// To add a provider: implement OcrProvider and register it in provider-factory.

/** One candidate line extracted from an invoice photo. */
export interface OcrLine {
  /** The full extracted line from the invoice. */
  rawText: string;
  /**
   * Best guess at the product name. May be empty when the line looks like a
   * header, total, or otherwise non-product row.
   */
  productNameGuess: string;
  /** Extracted quantity, or null when none was found. */
  quantityGuess: number | null;
  /**
   * Extracted unit cost in MAD (NOT piastres). The route converts to piastres
   * (× 100) before returning to the client.
   */
  unitCostGuess: number | null;
  /** 0–1 heuristic confidence for this line. */
  confidence: number;
}

export interface OcrResult {
  lines: OcrLine[];
  /** Full OCR output before line parsing. */
  rawText: string;
  provider: string;
  processingMs: number;
}

export interface OcrProvider {
  /**
   * Extract candidate product lines from an image buffer.
   * @param imageBuffer preprocessed image bytes
   * @param mimeType e.g. 'image/png'
   * @param language 'ar' | 'fr' | 'ar+fr' (default 'ar+fr')
   */
  extractLines(
    imageBuffer: Buffer,
    mimeType: string,
    language?: string,
  ): Promise<OcrResult>;
  /** Provider identifier, e.g. 'google' | 'tesseract'. */
  name: string;
  /** True when the provider is configured and usable. Never throws. */
  available(): Promise<boolean>;
}
