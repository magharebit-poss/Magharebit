/**
 * Sector starter templates
 *
 * Pre-loaded product lists for common Moroccan business sectors.
 * Used by POST /api/portal/products/seed when a merchant selects their sector.
 * Prices are realistic MAD prices (2025 Moroccan market).
 */

import type { ProductDoc, ProductUnit } from '@/lib/repositories/products'

type ProductTemplate = Omit<ProductDoc, 'id' | 'merchantId' | 'createdAt' | 'updatedAt'>

const pce: ProductUnit  = 'pièce'
const kg:  ProductUnit  = 'kg'
const lit: ProductUnit  = 'litre'

// ── Café / Salon de thé ───────────────────────────────────────────────────────
const CAFE: ProductTemplate[] = [
  { plu: 'P-001', name: 'أتاي بالنعناع',       category: 'مشروبات ساخنة', price: 7,   costPrice: 1.5,  stock: 100, minStock: 20, unit: pce, emoji: '🫖', isActive: true },
  { plu: 'P-002', name: 'قهوة نص نص',           category: 'مشروبات ساخنة', price: 12,  costPrice: 2,    stock: 80,  minStock: 15, unit: pce, emoji: '☕', isActive: true },
  { plu: 'P-003', name: 'قهوة سادة',             category: 'مشروبات ساخنة', price: 8,   costPrice: 1.5,  stock: 80,  minStock: 15, unit: pce, emoji: '☕', isActive: true },
  { plu: 'P-004', name: 'كابيتشينو',             category: 'مشروبات ساخنة', price: 18,  costPrice: 4,    stock: 50,  minStock: 10, unit: pce, emoji: '☕', isActive: true },
  { plu: 'P-005', name: 'عصير برتقال طازج',       category: 'مشروبات باردة', price: 15,  costPrice: 5,    stock: 30,  minStock: 10, unit: pce, emoji: '🍊', isActive: true },
  { plu: 'P-006', name: 'عصير تفاح',              category: 'مشروبات باردة', price: 14,  costPrice: 4,    stock: 30,  minStock: 10, unit: pce, emoji: '🍎', isActive: true },
  { plu: 'P-007', name: 'كرواصان',                category: 'معجنات',       price: 6,   costPrice: 2.5,  stock: 40,  minStock: 8,  unit: pce, emoji: '🥐', isActive: true },
  { plu: 'P-008', name: 'سفنج',                  category: 'معجنات',       price: 2,   costPrice: 0.5,  stock: 60,  minStock: 10, unit: pce, emoji: '🍩', isActive: true },
  { plu: 'P-009', name: 'بيضة مسلوقة',            category: 'فطور',        price: 4,   costPrice: 1.5,  stock: 24,  minStock: 6,  unit: pce, emoji: '🥚', isActive: true },
  { plu: 'P-010', name: 'سندويتش جبن',            category: 'فطور',        price: 14,  costPrice: 5,    stock: 20,  minStock: 5,  unit: pce, emoji: '🥪', isActive: true },
  { plu: 'P-011', name: 'ماء معدني 50cl',          category: 'مشروبات باردة', price: 4,   costPrice: 1.5,  stock: 48,  minStock: 12, unit: pce, emoji: '💧', isActive: true },
  { plu: 'P-012', name: 'مياه غازية 33cl',         category: 'مشروبات باردة', price: 7,   costPrice: 3,    stock: 36,  minStock: 8,  unit: pce, emoji: '🥤', isActive: true },
]

// ── Épicerie / Mini-marché ────────────────────────────────────────────────────
const EPICERIE: ProductTemplate[] = [
  { plu: 'P-001', name: 'خبز عادي',               category: 'خبز ومعجنات',  price: 1.2, costPrice: 0.8,  stock: 50,  minStock: 10, unit: pce, emoji: '🍞', isActive: true },
  { plu: 'P-002', name: 'خبز شامي',                category: 'خبز ومعجنات',  price: 2,   costPrice: 1.2,  stock: 30,  minStock: 8,  unit: pce, emoji: '🫓', isActive: true },
  { plu: 'P-003', name: 'زيت الزيتون 1L',          category: 'زيوت',         price: 45,  costPrice: 32,   stock: 20,  minStock: 5,  unit: lit, emoji: '🫒', isActive: true },
  { plu: 'P-004', name: 'سكر 1kg',                 category: 'مواد غذائية',   price: 8,   costPrice: 5.5,  stock: 30,  minStock: 8,  unit: kg,  emoji: '🍬', isActive: true },
  { plu: 'P-005', name: 'دقيق 1kg',                category: 'مواد غذائية',   price: 6,   costPrice: 4,    stock: 25,  minStock: 6,  unit: kg,  emoji: '🌾', isActive: true },
  { plu: 'P-006', name: 'شاي أتاي 200g',           category: 'مشروبات',      price: 22,  costPrice: 15,   stock: 15,  minStock: 5,  unit: pce, emoji: '🫖', isActive: true },
  { plu: 'P-007', name: 'حليب 1L',                category: 'ألبان',         price: 7.5, costPrice: 5.5,  stock: 24,  minStock: 6,  unit: lit, emoji: '🥛', isActive: true },
  { plu: 'P-008', name: 'جبن مثلثات',              category: 'ألبان',         price: 18,  costPrice: 13,   stock: 15,  minStock: 5,  unit: pce, emoji: '🧀', isActive: true },
  { plu: 'P-009', name: 'بيض 6 حبات',             category: 'بيض',           price: 12,  costPrice: 9,    stock: 20,  minStock: 6,  unit: pce, emoji: '🥚', isActive: true },
  { plu: 'P-010', name: 'صابون الغسيل 500g',       category: 'تنظيف',         price: 14,  costPrice: 9,    stock: 12,  minStock: 4,  unit: pce, emoji: '🧼', isActive: true },
  { plu: 'P-011', name: 'ماء معدني 1.5L',          category: 'مشروبات',      price: 4.5, costPrice: 2.5,  stock: 36,  minStock: 10, unit: pce, emoji: '💧', isActive: true },
  { plu: 'P-012', name: 'معكرونة 500g',            category: 'مواد غذائية',   price: 6,   costPrice: 4,    stock: 20,  minStock: 6,  unit: pce, emoji: '🍝', isActive: true },
  { plu: 'P-013', name: 'معلبات طماطم 400g',       category: 'معلبات',        price: 5,   costPrice: 3,    stock: 18,  minStock: 6,  unit: pce, emoji: '🍅', isActive: true },
  { plu: 'P-014', name: 'بسكويت 200g',             category: 'حلويات',        price: 9,   costPrice: 6,    stock: 15,  minStock: 5,  unit: pce, emoji: '🍪', isActive: true },
  { plu: 'P-015', name: 'سجائر (علبة)',             category: 'تبغ',           price: 30,  costPrice: 24,   stock: 10,  minStock: 4,  unit: pce, emoji: '🚬', isActive: true },
]

// ── Restaurant ────────────────────────────────────────────────────────────────
const RESTAURANT: ProductTemplate[] = [
  { plu: 'P-001', name: 'طاجين دجاج',              category: 'أطباق رئيسية', price: 55,  costPrice: 22,   stock: 20,  minStock: 3,  unit: pce, emoji: '🍲', isActive: true },
  { plu: 'P-002', name: 'كسكس اللحم',              category: 'أطباق رئيسية', price: 65,  costPrice: 28,   stock: 15,  minStock: 3,  unit: pce, emoji: '🫕', isActive: true },
  { plu: 'P-003', name: 'برشة حريرة',              category: 'شوربات',       price: 12,  costPrice: 3,    stock: 30,  minStock: 5,  unit: pce, emoji: '🥣', isActive: true },
  { plu: 'P-004', name: 'مشاوي مخلطة',             category: 'مشاوي',        price: 85,  costPrice: 40,   stock: 10,  minStock: 2,  unit: pce, emoji: '🍖', isActive: true },
  { plu: 'P-005', name: 'سلطة مغربية',             category: 'مقبلات',       price: 18,  costPrice: 6,    stock: 25,  minStock: 5,  unit: pce, emoji: '🥗', isActive: true },
  { plu: 'P-006', name: 'خبز تيراج',              category: 'خبز',           price: 3,   costPrice: 1,    stock: 50,  minStock: 10, unit: pce, emoji: '🫓', isActive: true },
  { plu: 'P-007', name: 'أتاي بالنعناع',           category: 'مشروبات',      price: 8,   costPrice: 2,    stock: 60,  minStock: 10, unit: pce, emoji: '🫖', isActive: true },
  { plu: 'P-008', name: 'مياه معدنية',             category: 'مشروبات',      price: 5,   costPrice: 2,    stock: 48,  minStock: 12, unit: pce, emoji: '💧', isActive: true },
  { plu: 'P-009', name: 'بسطيلة دجاج',             category: 'أطباق رئيسية', price: 45,  costPrice: 18,   stock: 8,   minStock: 2,  unit: pce, emoji: '🥧', isActive: true },
  { plu: 'P-010', name: 'حلويات شرقية (طبق)',      category: 'حلويات',        price: 25,  costPrice: 10,   stock: 12,  minStock: 3,  unit: pce, emoji: '🧆', isActive: true },
]

// ── Pharmacie ─────────────────────────────────────────────────────────────────
const PHARMACIE: ProductTemplate[] = [
  { plu: 'P-001', name: 'دولييبران 500mg',         category: 'مسكنات',       price: 18,  costPrice: 12,   stock: 30,  minStock: 10, unit: pce, emoji: '💊', isActive: true },
  { plu: 'P-002', name: 'أسبيرين 500mg',           category: 'مسكنات',       price: 12,  costPrice: 8,    stock: 25,  minStock: 8,  unit: pce, emoji: '💊', isActive: true },
  { plu: 'P-003', name: 'فيتامين C 1g',            category: 'فيتامينات',    price: 32,  costPrice: 22,   stock: 20,  minStock: 5,  unit: pce, emoji: '🍋', isActive: true },
  { plu: 'P-004', name: 'شراب السعال',             category: 'برد وأنفلونزا', price: 28,  costPrice: 18,   stock: 15,  minStock: 5,  unit: pce, emoji: '🍶', isActive: true },
  { plu: 'P-005', name: 'كريم ترطيب',              category: 'جلد وعناية',   price: 45,  costPrice: 30,   stock: 12,  minStock: 4,  unit: pce, emoji: '🧴', isActive: true },
  { plu: 'P-006', name: 'قياس الضغط (عبوة)',       category: 'أجهزة',        price: 350, costPrice: 250,  stock: 5,   minStock: 2,  unit: pce, emoji: '🩺', isActive: true },
  { plu: 'P-007', name: 'كمامة طبية (علبة 50)',    category: 'حماية',         price: 35,  costPrice: 20,   stock: 10,  minStock: 3,  unit: pce, emoji: '😷', isActive: true },
  { plu: 'P-008', name: 'مطهر الجروح',             category: 'إسعاف',         price: 22,  costPrice: 14,   stock: 18,  minStock: 5,  unit: pce, emoji: '🩹', isActive: true },
]

// ── Beauté / Coiffure ─────────────────────────────────────────────────────────
const BEAUTE: ProductTemplate[] = [
  { plu: 'P-001', name: 'قص الشعر للرجال',         category: 'خدمات',        price: 25,  costPrice: 5,    stock: 100, minStock: 1,  unit: pce, emoji: '✂️', isActive: true },
  { plu: 'P-002', name: 'قص وتسريح للنساء',        category: 'خدمات',        price: 60,  costPrice: 10,   stock: 100, minStock: 1,  unit: pce, emoji: '💇', isActive: true },
  { plu: 'P-003', name: 'صبغ الشعر',               category: 'خدمات',        price: 150, costPrice: 45,   stock: 50,  minStock: 1,  unit: pce, emoji: '🎨', isActive: true },
  { plu: 'P-004', name: 'كيراتين',                 category: 'خدمات',        price: 350, costPrice: 80,   stock: 20,  minStock: 1,  unit: pce, emoji: '✨', isActive: true },
  { plu: 'P-005', name: 'شامبو للبيع 250ml',       category: 'منتجات',       price: 35,  costPrice: 20,   stock: 10,  minStock: 3,  unit: pce, emoji: '🧴', isActive: true },
  { plu: 'P-006', name: 'ماسك الشعر 200ml',        category: 'منتجات',       price: 55,  costPrice: 32,   stock: 8,   minStock: 2,  unit: pce, emoji: '🧴', isActive: true },
  { plu: 'P-007', name: 'حلاقة الذقن',             category: 'خدمات',        price: 15,  costPrice: 2,    stock: 100, minStock: 1,  unit: pce, emoji: '🪒', isActive: true },
]

// ── Map ───────────────────────────────────────────────────────────────────────

export type SectorKey = 'cafe' | 'epicerie' | 'restaurant' | 'pharmacie' | 'beaute' | 'default'

const TEMPLATES: Record<SectorKey, ProductTemplate[]> = {
  cafe:       CAFE,
  epicerie:   EPICERIE,
  restaurant: RESTAURANT,
  pharmacie:  PHARMACIE,
  beaute:     BEAUTE,
  default:    CAFE, // fallback
}

export function getTemplate(sector: string): ProductTemplate[] {
  const key = sector.toLowerCase().replace(/[^a-z]/g, '') as SectorKey
  return TEMPLATES[key] ?? TEMPLATES.default
}

export function getSectorKeys(): SectorKey[] {
  return Object.keys(TEMPLATES) as SectorKey[]
}
