import type { DigestData } from './digest-query.js';

function mad(piastres: number): string {
  return (piastres / 100).toFixed(2);
}

export function formatDigest(data: DigestData, language: 'ar' | 'fr'): string {
  if (language === 'ar') {
    return formatAr(data);
  }
  return formatFr(data);
}

function formatAr(d: DigestData): string {
  const lines: string[] = [];

  lines.push('─────────────────────');
  lines.push(`🟢 *تقرير يوم ${d.date}*`);
  lines.push('─────────────────────');
  lines.push(`💰 *المبيعات:* ${mad(d.totalSalesPiastres)} درهم`);
  lines.push(`🧾 *عدد المعاملات:* ${d.transactionCount}`);
  lines.push('');

  lines.push('📦 *أكثر المنتجات مبيعاً:*');
  if (d.topProducts.length === 0) {
    lines.push('لا مبيعات');
  } else {
    d.topProducts.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.nameAr} — ${mad(p.revenuePiastres)} درهم`);
    });
  }
  lines.push('');

  lines.push(`🗑️ *الهدر:* ${mad(d.totalWastePiastres)} درهم`);
  if (d.topWasteItem) {
    lines.push(`أكثر هدر: ${d.topWasteItem}`);
  }
  lines.push('');

  if (d.lowStockProducts.length > 0) {
    lines.push(`⚠️ *تنبيهات المخزون:* ${d.lowStockProducts.length} منتج`);
    d.lowStockProducts.forEach((p) => {
      lines.push(`• ${p.nameAr}: ${p.stockQuantity} / ${p.threshold}`);
    });
    lines.push('');
  }

  const { largeDiscountCount, largeReturnCount, voidCount } = d.anomalyFlags;
  if (largeDiscountCount > 0 || largeReturnCount > 0 || voidCount > 0) {
    lines.push('🔍 *ملاحظات:*');
    lines.push(
      `خصومات كبيرة: ${largeDiscountCount} | مرتجعات كبيرة: ${largeReturnCount} | إلغاء: ${voidCount}`,
    );
    lines.push('');
  }

  lines.push('─────────────────────');
  lines.push('Magharebit POS');
  lines.push('─────────────────────');

  return lines.join('\n');
}

function formatFr(d: DigestData): string {
  const lines: string[] = [];

  lines.push('─────────────────────');
  lines.push(`🟢 *Rapport du ${d.date}*`);
  lines.push('─────────────────────');
  lines.push(`💰 *Ventes:* ${mad(d.totalSalesPiastres)} MAD`);
  lines.push(`🧾 *Transactions:* ${d.transactionCount}`);
  lines.push('');

  lines.push('📦 *Top produits:*');
  if (d.topProducts.length === 0) {
    lines.push('Aucune vente');
  } else {
    d.topProducts.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.nameFr} — ${mad(p.revenuePiastres)} MAD`);
    });
  }
  lines.push('');

  lines.push(`🗑️ *Gaspillage:* ${mad(d.totalWastePiastres)} MAD`);
  if (d.topWasteItem) {
    lines.push(`Top déchet: ${d.topWasteItem}`);
  }
  lines.push('');

  if (d.lowStockProducts.length > 0) {
    lines.push(`⚠️ *Alertes stock:* ${d.lowStockProducts.length} produit(s)`);
    d.lowStockProducts.forEach((p) => {
      lines.push(`• ${p.nameFr}: ${p.stockQuantity} / ${p.threshold}`);
    });
    lines.push('');
  }

  const { largeDiscountCount, largeReturnCount, voidCount } = d.anomalyFlags;
  if (largeDiscountCount > 0 || largeReturnCount > 0 || voidCount > 0) {
    lines.push('🔍 *Anomalies:*');
    lines.push(
      `Remises importantes: ${largeDiscountCount} | Retours importants: ${largeReturnCount} | Annulations: ${voidCount}`,
    );
    lines.push('');
  }

  lines.push('─────────────────────');
  lines.push('Magharebit POS');
  lines.push('─────────────────────');

  return lines.join('\n');
}
