// invoice-ocr-routes.ts — POST /invoices/ocr
// Receives a supplier-invoice photo, runs it through the configured OCR
// provider, matches extracted names to the tenant's product catalog, and
// returns pre-fill lines for the /suppliers receiving form. The form remains
// the final gate: the manager reviews and corrects before submitting.

import type { FastifyInstance } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { getOcrProvider } from '../../services/ocr/provider-factory.js';
import { preprocessForOcr } from '../../services/ocr/preprocess.js';
import { matchProductName } from '../../services/ocr/product-matcher.js';

const MANAGER_ROLES = ['MANAGER', 'SUPERVISOR'] as const;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

interface OcrLineResult {
  rawText: string;
  productId: string | null;
  productNameAr: string;
  productNameFr: string;
  productNameExtracted: string;
  matched: boolean;
  matchScore: number;
  quantityGuess: number | null;
  unitCostPiastres: number | null; // MAD × 100, integer piastres
  confidence: number;
}

export async function invoiceOcrRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/invoices/ocr', { config: { allowedRoles: MANAGER_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });

    // ── 1. Parse multipart: image file (required) + optional language field ──
    let imageBuf: Buffer | null = null;
    let mimeType = '';
    let language = 'ar+fr';
    try {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const file = part as MultipartFile;
          if (!file.mimetype.startsWith('image/')) {
            return reply.status(400).send({ error: 'image file required (image/* only)' });
          }
          mimeType = file.mimetype;
          const chunks: Buffer[] = [];
          let total = 0;
          for await (const chunk of file.file) {
            total += chunk.length;
            if (total > MAX_IMAGE_BYTES) {
              return reply.status(413).send({ error: 'image exceeds 10MB limit' });
            }
            chunks.push(chunk);
          }
          imageBuf = Buffer.concat(chunks);
        } else if (part.fieldname === 'language') {
          const v = String(part.value);
          if (v === 'ar' || v === 'fr' || v === 'ar+fr') language = v;
        }
      }
    } catch (err) {
      fastify.log.error({ err }, '[ocr] multipart parse failed');
      return reply.status(400).send({ error: 'invalid multipart body' });
    }

    if (!imageBuf || imageBuf.length === 0) {
      return reply.status(400).send({ error: 'image file is required' });
    }

    // ── 2. Provider availability ──────────────────────────────────────────
    const provider = getOcrProvider();
    if (!(await provider.available())) {
      return reply.status(422).send({
        error: 'ocr_not_configured',
        message: 'Configure INVOICE_OCR_PROVIDER in .env',
      });
    }

    try {
      // ── 3. Preprocess then OCR ──────────────────────────────────────────
      const processed = await preprocessForOcr(imageBuf, mimeType);
      const ocrResult = await provider.extractLines(processed, 'image/png', language);

      // ── 4. Load catalog + match each extracted line ─────────────────────
      const { rows: products } = await fastify.pg.query<{
        product_id: string; name_ar: string; name_fr: string;
      }>(
        `SELECT product_id, name_ar, name_fr
         FROM products
         WHERE tenant_id = $1 AND is_active = true`,
        [tenantId],
      );

      const lines: OcrLineResult[] = ocrResult.lines.map((l) => {
        const match = l.productNameGuess
          ? matchProductName(l.productNameGuess, products)
          : { productId: null, productNameAr: '', productNameFr: '', score: 0, matched: false };
        return {
          rawText: l.rawText,
          productId: match.productId,
          productNameAr: match.productNameAr,
          productNameFr: match.productNameFr,
          productNameExtracted: l.productNameGuess,
          matched: match.matched,
          matchScore: match.score,
          quantityGuess: l.quantityGuess,
          // MAD → integer piastres (× 100, rounded). null stays null.
          unitCostPiastres: l.unitCostGuess != null ? Math.round(l.unitCostGuess * 100) : null,
          confidence: l.confidence,
        };
      });

      const matchedCount = lines.filter((l) => l.matched).length;

      // Log metadata only — never the image or extracted text (may contain PII).
      fastify.log.info(
        { tenant_id: tenantId, provider: ocrResult.provider, lineCount: lines.length, matchedCount, processingMs: ocrResult.processingMs },
        'OCR invoice processed',
      );

      return reply.send({
        lines,
        rawText: ocrResult.rawText,
        provider: ocrResult.provider,
        processingMs: ocrResult.processingMs,
        lineCount: lines.length,
        matchedCount,
      });
    } catch (err) {
      fastify.log.error({ err, tenant_id: tenantId }, '[ocr] processing failed');
      return reply.status(500).send({ error: 'ocr_failed', message: 'OCR processing failed' });
    }
  });
}
