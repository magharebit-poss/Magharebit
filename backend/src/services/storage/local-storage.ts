import path from 'node:path';
import { mkdir, unlink, stat } from 'node:fs/promises';
import sharp from 'sharp';
import type { StorageProvider, UploadResult } from './provider.js';

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const THUMB_SIZE = 200;
const DETAIL_SIZE = 400;
const THUMB_MAX_BYTES = 50 * 1024;   // 50 KB
const DETAIL_MAX_BYTES = 150 * 1024; // 150 KB
const QUALITY_STEP = 10;
const QUALITY_MIN = 30;
const QUALITY_INITIAL = 85;

function getImagesRoot(): string {
  return process.env['IMAGES_DIR']
    ? path.resolve(process.env['IMAGES_DIR'])
    : path.join(process.cwd(), 'data', 'images');
}

function getImagesBaseUrl(): string {
  return (process.env['IMAGES_BASE_URL'] ?? 'http://localhost:3001/images').replace(/\/$/, '');
}

async function encodeWithSizeLimit(
  buffer: Buffer,
  size: number,
  maxBytes: number,
): Promise<Buffer> {
  let quality = QUALITY_INITIAL;
  while (quality >= QUALITY_MIN) {
    const out = await sharp(buffer)
      .rotate()
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .webp({ quality })
      .toBuffer();
    if (out.length <= maxBytes || quality === QUALITY_MIN) {
      return out;
    }
    quality -= QUALITY_STEP;
  }
  // Unreachable, but TypeScript needs an explicit return.
  return sharp(buffer)
    .rotate()
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .webp({ quality: QUALITY_MIN })
    .toBuffer();
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;

  async saveProductImage(
    tenantId: string,
    productId: string,
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<UploadResult> {
    if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
      throw new Error(
        `Unsupported image type: ${mimeType}. Accepted: ${[...ACCEPTED_MIME_TYPES].join(', ')}`,
      );
    }

    const root = getImagesRoot();
    const dir = path.join(root, 'products', tenantId);
    await mkdir(dir, { recursive: true });

    const thumbFilename = `${productId}-thumb.webp`;
    const detailFilename = `${productId}-detail.webp`;
    const thumbAbsPath = path.join(dir, thumbFilename);
    const detailAbsPath = path.join(dir, detailFilename);

    // Server-side resize + size enforcement. Never trust client dimensions.
    const [thumbBuf, detailBuf] = await Promise.all([
      encodeWithSizeLimit(imageBuffer, THUMB_SIZE, THUMB_MAX_BYTES),
      encodeWithSizeLimit(imageBuffer, DETAIL_SIZE, DETAIL_MAX_BYTES),
    ]);

    await Promise.all([
      sharp(thumbBuf).toFile(thumbAbsPath),
      sharp(detailBuf).toFile(detailAbsPath),
    ]);

    // Paranoid size check after write.
    const [thumbStat, detailStat] = await Promise.all([
      stat(thumbAbsPath),
      stat(detailAbsPath),
    ]);
    if (thumbStat.size > THUMB_MAX_BYTES) {
      throw new Error(`Thumbnail exceeds ${THUMB_MAX_BYTES} bytes after encoding (${thumbStat.size} bytes)`);
    }
    if (detailStat.size > DETAIL_MAX_BYTES) {
      throw new Error(`Detail image exceeds ${DETAIL_MAX_BYTES} bytes after encoding (${detailStat.size} bytes)`);
    }

    const thumbPath = `products/${tenantId}/${thumbFilename}`;
    const detailPath = `products/${tenantId}/${detailFilename}`;
    const base = getImagesBaseUrl();

    return {
      thumbPath,
      detailPath,
      thumbUrl: `${base}/${thumbPath}`,
      detailUrl: `${base}/${detailPath}`,
    };
  }

  async deleteProductImage(thumbPath: string, detailPath: string): Promise<void> {
    const root = getImagesRoot();
    const del = async (relPath: string) => {
      try {
        await unlink(path.join(root, relPath));
      } catch (err: unknown) {
        // File already gone — not an error.
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    };
    await Promise.all([del(thumbPath), del(detailPath)]);
  }
}
