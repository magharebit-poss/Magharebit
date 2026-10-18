// invoice-parser.ts — heuristic line extractor
// This is deliberately conservative.
// Unrecognized lines are skipped rather than guessed. The /suppliers form is
// always the final gate — the manager reviews before submit.

import type { OcrLine } from './provider.js';

// Lines containing any of these tokens are treated as headers/totals and skipped.
const SKIP_TOKENS = [
  'total', 'sous-total', 'sous total', 'tva', 'ht', 'ttc', 'net a payer',
  'net à payer', 'montant', 'facture', 'date', 'fournisseur', 'client',
  'ref', 'référence', 'reference', 'designation', 'désignation', 'quantité',
  'prix', 'المجموع', 'الإجمالي', 'فاتورة', 'التاريخ', 'المورد', 'الزبون',
  'الضريبة', 'البيان', 'الكمية', 'الثمن', 'السعر',
];

// Quantity: a number optionally followed by a unit token.
const QTY_RE = /(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|pcs|pc|u|unité|unite|قطعة|كغ|غ|علبة|لتر)?\b/i;
// Price: a number with two decimals, optionally followed by a currency token.
const PRICE_RE = /(\d{1,3}(?:[ .]\d{3})*[.,]\d{2})\s*(mad|dh|dhs|درهم)?/i;

function toNumber(s: string): number {
  // Normalize thousands/decimal separators to a JS-parseable float.
  const cleaned = s.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function looksLikeSkip(line: string): boolean {
  const lower = line.toLowerCase();
  return SKIP_TOKENS.some((tok) => lower.includes(tok));
}

/**
 * Parse raw OCR text into candidate product lines. Conservative: lines with
 * confidence < 0.30 are dropped. Order is preserved (top to bottom).
 */
export function parseInvoiceText(text: string): OcrLine[] {
  const out: OcrLine[] = [];
  const rawLines = text.split(/\r?\n/);

  for (const raw of rawLines) {
    const line = raw.trim();
    if (line.length < 3) continue;
    if (looksLikeSkip(line)) continue;

    // Extract price first (most specific), then quantity, then treat the
    // remaining text as the product name.
    const priceMatch = line.match(PRICE_RE);
    const unitCostGuess = priceMatch ? toNumber(priceMatch[1]!) : null;

    let remainder = priceMatch ? line.replace(priceMatch[0], ' ') : line;

    const qtyMatch = remainder.match(QTY_RE);
    const quantityGuess = qtyMatch ? Math.round(toNumber(qtyMatch[1]!)) : null;
    if (qtyMatch) remainder = remainder.replace(qtyMatch[0], ' ');

    // Product name = leftover text minus stray punctuation/number noise.
    const productNameGuess = remainder
      .replace(/[|_*·•]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s.,;:-]+|[\s.,;:-]+$/g, '')
      .trim();

    // Confidence from how many of the three fields we resolved.
    const hasName = productNameGuess.length >= 2 && /[\p{L}]/u.test(productNameGuess);
    const hasQty = quantityGuess != null && quantityGuess > 0;
    const hasPrice = unitCostGuess != null && unitCostGuess > 0;

    let confidence: number;
    if (hasName && hasQty && hasPrice) confidence = 0.85;
    else if (hasName && (hasQty || hasPrice)) confidence = 0.6;
    else if (hasName) confidence = 0.35;
    else confidence = 0.1;

    if (confidence < 0.3) continue;

    out.push({
      rawText: line,
      productNameGuess: hasName ? productNameGuess : '',
      quantityGuess: hasQty ? quantityGuess : null,
      unitCostGuess: hasPrice ? unitCostGuess : null,
      confidence,
    });
  }

  return out;
}
