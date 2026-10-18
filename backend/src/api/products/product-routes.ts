import type { FastifyInstance } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { getStorageProvider } from '../../services/storage/provider-factory.js';

const MGMT_ROLES = ['MANAGER', 'SUPERVISOR'] as const;

// Product image uploads may be larger than the 5 MB global multipart limit
// (phone photos); the image route overrides it. Other multipart routes keep 5 MB.
const IMAGE_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

const IMAGES_BASE_URL = (): string =>
  (process.env['IMAGES_BASE_URL'] ?? 'http://localhost:3001/images').replace(/\/$/, '');

function imageUrl(relPath: string | null): string | null {
  if (!relPath) return null;
  return `${IMAGES_BASE_URL()}/${relPath}`;
}

function parseBool(val: unknown): boolean | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0') return false;
  return undefined;
}

function parseIntField(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = parseInt(String(val), 10);
  return isNaN(n) ? undefined : n;
}

interface ProductRow {
  product_id: string;
  tenant_id: string;
  plu_code: string | null;
  barcode: string | null;
  name_ar: string;
  name_fr: string;
  category: string;
  price_cents: number;
  is_bom: boolean;
  is_weighted: boolean;
  uom: string;
  is_active: boolean;
  is_perishable: boolean;
  track_stock: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  current_markdown_percent: number | null;
  image_thumb_path: string | null;
  image_detail_path: string | null;
  description_ar: string | null;
  description_fr: string | null;
  sort_order: number;
  business_fields: unknown;
  created_at: string;
  updated_at: string;
}

export async function productRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /products/manage ────────────────────────────────────────────────────
  fastify.get<{
    Querystring: { category?: string; search?: string; isActive?: string };
  }>(
    '/products/manage',
    { config: { allowedRoles: MGMT_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });

      const { category, search, isActive } = request.query;

      const params: unknown[] = [tenantId];
      const clauses: string[] = ['tenant_id = $1'];

      if (isActive !== undefined) {
        params.push(isActive !== 'false');
        clauses.push(`is_active = $${params.length}`);
      }
      if (category) {
        params.push(category);
        clauses.push(`category = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        const p = params.length;
        clauses.push(`(name_ar ILIKE $${p} OR name_fr ILIKE $${p} OR barcode ILIKE $${p})`);
      }

      try {
        const { rows } = await fastify.pg.query<ProductRow>(
          `SELECT product_id, tenant_id, plu_code, barcode, name_ar, name_fr,
                  category, price_cents, is_bom, is_weighted, uom, is_active,
                  COALESCE(is_perishable, false) AS is_perishable,
                  track_stock, stock_quantity, low_stock_threshold,
                  current_markdown_percent,
                  image_thumb_path, image_detail_path,
                  description_ar, description_fr, sort_order, business_fields,
                  created_at, updated_at
           FROM products
           WHERE ${clauses.join(' AND ')}
           ORDER BY sort_order ASC, name_fr ASC`,
          params,
        );

        const base = IMAGES_BASE_URL();
        const result = rows.map((r) => ({
          ...r,
          thumb_url: r.image_thumb_path ? `${base}/${r.image_thumb_path}` : null,
          detail_url: r.image_detail_path ? `${base}/${r.image_detail_path}` : null,
        }));
        return reply.send(result);
      } catch (err: unknown) {
        fastify.log.error({ err }, '[products] manage list failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── GET /products/:productId ────────────────────────────────────────────────
  fastify.get<{ Params: { productId: string } }>(
    '/products/:productId',
    { config: { allowedRoles: MGMT_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
      const { productId } = request.params;

      try {
        const { rows } = await fastify.pg.query<ProductRow>(
          `SELECT product_id, tenant_id, plu_code, barcode, name_ar, name_fr,
                  category, price_cents, is_bom, is_weighted, uom, is_active,
                  COALESCE(is_perishable, false) AS is_perishable,
                  track_stock, stock_quantity, low_stock_threshold,
                  current_markdown_percent,
                  image_thumb_path, image_detail_path,
                  description_ar, description_fr, sort_order, business_fields,
                  created_at, updated_at
           FROM products
           WHERE product_id = $1 AND tenant_id = $2`,
          [productId, tenantId],
        );
        if (rows.length === 0) return reply.status(404).send({ error: 'Product not found' });
        const r = rows[0]!;
        return reply.send({
          ...r,
          thumb_url: imageUrl(r.image_thumb_path),
          detail_url: imageUrl(r.image_detail_path),
        });
      } catch (err: unknown) {
        fastify.log.error({ err }, '[products] get failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  const PATCH_ROLES = ['INVENTORY', 'MANAGER', 'SUPERVISOR', 'OWNER'] as const;

  // ── GET /products/:productId/cost-history ───────────────────────────────────
  // Last 20 supplier-invoice cost records for one product (Cost Shield V1).
  fastify.get<{ Params: { productId: string } }>(
    '/products/:productId/cost-history',
    { config: { allowedRoles: PATCH_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
      const { productId } = request.params;
      try {
        const { rows } = await fastify.pg.query(
          `SELECT h.cost_id, h.product_id, h.supplier_id, s.name AS supplier_name,
                  h.invoice_id, h.unit_cost_cents, h.previous_cost_cents, h.recorded_at
           FROM product_cost_history h
           LEFT JOIN suppliers s ON s.supplier_id = h.supplier_id
           WHERE h.tenant_id = $1 AND h.product_id = $2
           ORDER BY h.recorded_at DESC
           LIMIT 20`,
          [tenantId, productId],
        );
        return reply.send(rows);
      } catch (err: unknown) {
        fastify.log.error({ err }, '[products] cost-history failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── PATCH /products/:productId ──────────────────────────────────────────────
  // Accepts both multipart/form-data (with optional image) and application/json.
  fastify.patch<{ Params: { productId: string } }>(
    '/products/:productId',
    { config: { allowedRoles: PATCH_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
      const { productId } = request.params;

      // Verify ownership.
      const { rows: existing } = await fastify.pg.query<{ image_thumb_path: string | null; image_detail_path: string | null }>(
        'SELECT image_thumb_path, image_detail_path FROM products WHERE product_id = $1 AND tenant_id = $2',
        [productId, tenantId],
      );
      if (existing.length === 0) return reply.status(404).send({ error: 'Product not found' });

      const contentType = request.headers['content-type'] ?? '';
      const isJson = contentType.includes('application/json');

      // JSON path: body is already parsed by Fastify's JSON parser.
      if (isJson) {
        const body = request.body as Record<string, unknown> ?? {};
        const setClauses: string[] = ['updated_at = NOW()'];
        const params: unknown[] = [productId, tenantId];
        const addSet = (col: string, val: unknown) => {
          if (val === undefined) return;
          params.push(val);
          setClauses.push(`${col} = $${params.length}`);
        };
        const str = (v: unknown) => (typeof v === 'string' ? v.trim() || null : v ?? undefined);
        addSet('name_ar',          str(body['name_ar']));
        addSet('name_fr',          str(body['name_fr']));
        addSet('category',         str(body['category']));
        addSet('barcode',          str(body['barcode']));
        addSet('plu_code',         str(body['plu_code']));
        if (body['price_cents']        !== undefined) addSet('price_cents',        Number(body['price_cents']));
        if (body['cost_price_cents']   !== undefined) {
          // null clears the cost (NULL = unknown); otherwise a non-negative number.
          const cost = body['cost_price_cents'] === null ? null : Number(body['cost_price_cents']);
          if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
            return reply.status(400).send({ error: 'cost_price_cents must be null or a non-negative number' });
          }
          addSet('cost_price_cents', cost);
        }
        if (body['stock_quantity']     !== undefined) addSet('stock_quantity',     Number(body['stock_quantity']));
        if (body['uom']                !== undefined) addSet('uom',                body['uom']);
        if (body['track_stock']        !== undefined) addSet('track_stock',        Boolean(body['track_stock']));
        if (body['is_weighted']        !== undefined) addSet('is_weighted',        Boolean(body['is_weighted']));
        if (body['is_bom']             !== undefined) addSet('is_bom',             Boolean(body['is_bom']));
        if (body['is_active']          !== undefined) addSet('is_active',          Boolean(body['is_active']));
        if (setClauses.length === 1) return reply.status(400).send({ error: 'nothing to update' });
        try {
          const { rows } = await fastify.pg.query<ProductRow>(
            `UPDATE products SET ${setClauses.join(', ')}
             WHERE product_id = $1 AND tenant_id = $2
             RETURNING *`,
            params,
          );
          if (rows.length === 0) return reply.status(404).send({ error: 'Product not found' });
          const r = rows[0]!;
          return reply.send({ ...r, thumb_url: imageUrl(r.image_thumb_path), detail_url: imageUrl(r.image_detail_path) });
        } catch (err: unknown) {
          fastify.log.error({ err }, '[products] update (json) failed');
          return reply.status(500).send({ error: 'Internal error' });
        }
      }

      // Multipart path (original — handles image upload).
      const parts = request.parts();
      const fields: Record<string, string> = {};
      let imageFile: MultipartFile | null = null;

      for await (const part of parts) {
        if (part.type === 'file') {
          imageFile = part;
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) chunks.push(chunk);
          (part as MultipartFile & { _buffer?: Buffer })._buffer = Buffer.concat(chunks);
        } else {
          fields[part.fieldname] = part.value as string;
        }
      }

      let newThumbPath: string | null | undefined = undefined;
      let newDetailPath: string | null | undefined = undefined;

      if (imageFile) {
        const buf = (imageFile as MultipartFile & { _buffer?: Buffer })._buffer;
        if (buf && buf.length > 0) {
          try {
            const storage = getStorageProvider();
            // Delete old images before saving new ones.
            const old = existing[0]!;
            if (old.image_thumb_path && old.image_detail_path) {
              await storage.deleteProductImage(old.image_thumb_path, old.image_detail_path);
            }
            const result = await storage.saveProductImage(tenantId, productId, buf, imageFile.mimetype);
            newThumbPath = result.thumbPath;
            newDetailPath = result.detailPath;
          } catch (err: unknown) {
            return reply.status(422).send({
              error: err instanceof Error ? err.message : 'Image processing failed',
            });
          }
        }
      }

      let businessFields: unknown = undefined;
      if (fields['business_fields'] !== undefined) {
        try {
          businessFields = JSON.parse(fields['business_fields']);
        } catch {
          return reply.status(400).send({ error: 'business_fields must be valid JSON' });
        }
      }

      // Build SET clause from provided fields only.
      const setClauses: string[] = ['updated_at = NOW()'];
      const params: unknown[] = [productId, tenantId];

      const addSet = (col: string, val: unknown) => {
        if (val === undefined) return;
        params.push(val);
        setClauses.push(`${col} = $${params.length}`);
      };

      addSet('name_ar', fields['name_ar'] || undefined);
      addSet('name_fr', fields['name_fr'] || undefined);
      addSet('category', fields['category'] || undefined);
      if (fields['price_cents'] !== undefined) {
        const pc = parseIntField(fields['price_cents']);
        if (pc === undefined || pc < 0) return reply.status(400).send({ error: 'price_cents must be a non-negative integer' });
        addSet('price_cents', pc);
      }
      addSet('plu_code', fields['plu_code'] !== undefined ? (fields['plu_code'] || null) : undefined);
      addSet('barcode', fields['barcode'] !== undefined ? (fields['barcode'] || null) : undefined);
      if (fields['is_weighted'] !== undefined) addSet('is_weighted', parseBool(fields['is_weighted']) ?? false);
      addSet('uom', fields['uom'] || undefined);
      if (fields['is_perishable'] !== undefined) addSet('is_perishable', parseBool(fields['is_perishable']) ?? false);
      if (fields['track_stock'] !== undefined) addSet('track_stock', parseBool(fields['track_stock']) ?? false);
      if (fields['stock_quantity'] !== undefined) addSet('stock_quantity', parseIntField(fields['stock_quantity']) ?? 0);
      if (fields['low_stock_threshold'] !== undefined) addSet('low_stock_threshold', parseIntField(fields['low_stock_threshold']) ?? 5);
      addSet('description_ar', fields['description_ar'] !== undefined ? (fields['description_ar'] || null) : undefined);
      addSet('description_fr', fields['description_fr'] !== undefined ? (fields['description_fr'] || null) : undefined);
      if (fields['sort_order'] !== undefined) addSet('sort_order', parseIntField(fields['sort_order']) ?? 0);
      if (businessFields !== undefined) addSet('business_fields', JSON.stringify(businessFields));
      if (newThumbPath !== undefined) addSet('image_thumb_path', newThumbPath);
      if (newDetailPath !== undefined) addSet('image_detail_path', newDetailPath);

      try {
        const { rows } = await fastify.pg.query<ProductRow>(
          `UPDATE products SET ${setClauses.join(', ')}
           WHERE product_id = $1 AND tenant_id = $2
           RETURNING *`,
          params,
        );
        if (rows.length === 0) return reply.status(404).send({ error: 'Product not found' });
        const r = rows[0]!;
        return reply.send({
          ...r,
          thumb_url: imageUrl(r.image_thumb_path),
          detail_url: imageUrl(r.image_detail_path),
        });
      } catch (err: unknown) {
        fastify.log.error({ err }, '[products] update failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── DELETE /products/:productId (soft) ──────────────────────────────────────
  fastify.delete<{ Params: { productId: string } }>(
    '/products/:productId',
    { config: { allowedRoles: MGMT_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
      const { productId } = request.params;

      try {
        const { rows } = await fastify.pg.query<{ image_thumb_path: string | null; image_detail_path: string | null }>(
          `UPDATE products SET is_active = false, updated_at = NOW()
           WHERE product_id = $1 AND tenant_id = $2
           RETURNING image_thumb_path, image_detail_path`,
          [productId, tenantId],
        );
        if (rows.length === 0) return reply.status(404).send({ error: 'Product not found' });

        // Best-effort: delete image files after soft-deleting the row.
        const { image_thumb_path, image_detail_path } = rows[0]!;
        if (image_thumb_path && image_detail_path) {
          try {
            await getStorageProvider().deleteProductImage(image_thumb_path, image_detail_path);
          } catch (imgErr: unknown) {
            fastify.log.warn({ imgErr, productId }, '[products] image delete failed after soft-delete');
          }
        }

        return reply.send({ deleted: true, productId });
      } catch (err: unknown) {
        fastify.log.error({ err }, '[products] delete failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── POST /products/:productId/image ─────────────────────────────────────────
  fastify.post<{ Params: { productId: string } }>(
    '/products/:productId/image',
    // bodyLimit leaves room for the multipart envelope around a 20 MB file.
    { bodyLimit: IMAGE_UPLOAD_MAX_BYTES + 1024 * 1024, config: { allowedRoles: PATCH_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
      const { productId } = request.params;

      const { rows: existing } = await fastify.pg.query<{ image_thumb_path: string | null; image_detail_path: string | null }>(
        'SELECT image_thumb_path, image_detail_path FROM products WHERE product_id = $1 AND tenant_id = $2',
        [productId, tenantId],
      );
      if (existing.length === 0) return reply.status(404).send({ error: 'Product not found' });

      const data = await request.file({ limits: { fileSize: IMAGE_UPLOAD_MAX_BYTES } });
      if (!data) return reply.status(400).send({ error: 'No image file provided' });

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const buf = Buffer.concat(chunks);
      if (buf.length === 0) return reply.status(400).send({ error: 'Empty file' });

      try {
        const storage = getStorageProvider();
        const old = existing[0]!;
        if (old.image_thumb_path && old.image_detail_path) {
          await storage.deleteProductImage(old.image_thumb_path, old.image_detail_path);
        }
        const result = await storage.saveProductImage(tenantId, productId, buf, data.mimetype);

        await fastify.pg.query(
          `UPDATE products SET image_thumb_path = $1, image_detail_path = $2, updated_at = NOW()
           WHERE product_id = $3 AND tenant_id = $4`,
          [result.thumbPath, result.detailPath, productId, tenantId],
        );

        return reply.send({
          thumbUrl: result.thumbUrl,
          detailUrl: result.detailUrl,
          thumbPath: result.thumbPath,
          detailPath: result.detailPath,
        });
      } catch (err: unknown) {
        fastify.log.error({ err }, '[products] image upload failed');
        return reply.status(err instanceof Error && err.message.startsWith('Unsupported') ? 422 : 500).send({
          error: err instanceof Error ? err.message : 'Image processing failed',
        });
      }
    },
  );

  // ── DELETE /products/:productId/image — remove the image, keep the product ──
  fastify.delete<{ Params: { productId: string } }>(
    '/products/:productId/image',
    { config: { allowedRoles: PATCH_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
      const { productId } = request.params;

      try {
        const { rows: existing } = await fastify.pg.query<{ image_thumb_path: string | null; image_detail_path: string | null }>(
          'SELECT image_thumb_path, image_detail_path FROM products WHERE product_id = $1 AND tenant_id = $2',
          [productId, tenantId],
        );
        if (existing.length === 0) return reply.status(404).send({ error: 'Product not found' });

        await fastify.pg.query(
          `UPDATE products SET image_thumb_path = NULL, image_detail_path = NULL, updated_at = NOW()
           WHERE product_id = $1 AND tenant_id = $2`,
          [productId, tenantId],
        );

        const old = existing[0]!;
        if (old.image_thumb_path && old.image_detail_path) {
          try {
            await getStorageProvider().deleteProductImage(old.image_thumb_path, old.image_detail_path);
          } catch (imgErr: unknown) {
            fastify.log.warn({ imgErr, productId }, '[products] image file delete failed after clearing row');
          }
        }
        return reply.send({ removed: true });
      } catch (err: unknown) {
        fastify.log.error({ err }, '[products] image remove failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );
}
