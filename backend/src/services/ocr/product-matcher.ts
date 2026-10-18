// product-matcher.ts — resolve an OCR product name to a catalog productId.
//
// No external fuzzy library: normalize → exact → contains → word-overlap.
// Runs on every extracted line, so it stays simple and fast. Below the 0.5
// threshold the line is returned unmatched (productId=null) and the form leaves
// the dropdown empty for the manager to pick.

export interface MatchResult {
  productId: string | null;
  productNameAr: string;
  productNameFr: string;
  score: number; // 0–1 match confidence
  matched: boolean;
}

interface CatalogProduct {
  product_id: string;
  name_ar: string;
  name_fr: string;
}

const MATCH_THRESHOLD = 0.5;

/** Lowercase, strip Arabic diacritics + punctuation, collapse whitespace. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ٟ]/g, '') // Arabic diacritics (tashkeel)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // punctuation → space
    .replace(/\s+/g, ' ')
    .trim();
}

function words(s: string): string[] {
  return s.split(' ').filter((w) => w.length > 0);
}

/** Shared-word / total-unique-word ratio between two normalized strings. */
function wordOverlap(a: string, b: string): number {
  const aw = new Set(words(a));
  const bw = new Set(words(b));
  if (aw.size === 0 || bw.size === 0) return 0;
  let shared = 0;
  for (const w of aw) if (bw.has(w)) shared += 1;
  const union = new Set([...aw, ...bw]).size;
  return union === 0 ? 0 : shared / union;
}

function scoreAgainst(extracted: string, candidate: string): number {
  if (candidate.length === 0) return 0;
  if (extracted === candidate) return 1.0;
  if (extracted.includes(candidate) || candidate.includes(extracted)) return 0.75;
  const overlap = wordOverlap(extracted, candidate);
  return overlap > 0.5 ? overlap * 0.7 : 0;
}

export function matchProductName(
  extractedName: string,
  products: CatalogProduct[],
): MatchResult {
  const extracted = normalize(extractedName);

  let best: CatalogProduct | null = null;
  let bestScore = 0;

  for (const p of products) {
    // A product matches on either its Arabic or French name.
    const score = Math.max(
      scoreAgainst(extracted, normalize(p.name_ar)),
      scoreAgainst(extracted, normalize(p.name_fr)),
    );
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  if (best && bestScore >= MATCH_THRESHOLD) {
    return {
      productId: best.product_id,
      productNameAr: best.name_ar,
      productNameFr: best.name_fr,
      score: bestScore,
      matched: true,
    };
  }
  return {
    productId: null,
    productNameAr: '',
    productNameFr: '',
    score: bestScore,
    matched: false,
  };
}
