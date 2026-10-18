// preprocess.ts — sharpen phone-camera invoice photos before OCR.
//
// Runs on the backend before the image is sent to Google Vision or Tesseract.
// Grayscale + contrast normalization + sharpen + a sane resize significantly
// improve accuracy on real-world photos (glare, perspective, blur).

import sharp from 'sharp';

const MIN_WIDTH = 1000;   // below this, scale up for OCR resolution
const SCALE_UP_TO = 1500; // target width when scaling up
const MAX_WIDTH = 3000;   // above this, scale down to avoid slow OCR
const SCALE_DOWN_TO = 2500;

/**
 * Optimize an image buffer for OCR. Returns a lossless PNG buffer.
 * `mimeType` is accepted for interface symmetry; sharp detects the format.
 */
export async function preprocessForOcr(
  buffer: Buffer,
  _mimeType: string,
): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;

  let targetWidth: number | undefined;
  if (width > 0 && width < MIN_WIDTH) targetWidth = SCALE_UP_TO;
  else if (width > MAX_WIDTH) targetWidth = SCALE_DOWN_TO;

  let pipeline = sharp(buffer).grayscale().normalize().sharpen();
  if (targetWidth !== undefined) {
    pipeline = pipeline.resize({ width: targetWidth, withoutEnlargement: false });
  }
  return pipeline.png().toBuffer();
}
