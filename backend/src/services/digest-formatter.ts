import type { DigestData } from './digest-query.js';

export type DigestLanguage = 'ar' | 'fr' | 'en';

/** Soft cap for the WhatsApp message. The full detail goes to GET /digest/preview. */
export const COMPACT_LIMIT = 1500;

interface Labels {
  currency: string;
  title: (date: string) => string;
  sales: string;
  transactions: string;
  margin: string;
  marginCoverage: (pct: number) => string;
  /** Separator between a label and its value on the voids/refunds/discounts line. */
  colon: string;
  payments: string;
  voids: string;
  refunds: string;
  discounts: string;
  waste: string;
  topWaste: string;
  cash: string;
  noVariance: string;
  alerts: string;
  stock: string;
  topProducts: string;
  noSales: string;
  more: string;
  methods: Record<string, string>;
  alertTypes: Record<string, string>;
  severities: Record<string, string>;
}

const LABELS: Record<DigestLanguage, Labels> = {
  ar: {
    currency: 'درهم',
    title: (d) => `🟢 *تقرير يوم ${d}*`,
    sales: 'المبيعات',
    transactions: 'المعاملات',
    margin: 'الهامش الإجمالي',
    marginCoverage: (p) => `محسوب على ${p}% من المبيعات`,
    colon: ': ',
    payments: 'طرق الدفع',
    voids: 'إلغاءات',
    refunds: 'مرتجعات',
    discounts: 'خصومات',
    waste: 'الهدر',
    topWaste: 'أكثر هدر',
    cash: 'الفرق في الصندوق',
    noVariance: 'بدون فارق',
    alerts: 'تنبيهات مفتوحة',
    stock: 'مخزون منخفض',
    topProducts: 'أكثر المنتجات مبيعاً',
    noSales: 'لا مبيعات',
    more: 'التفاصيل في التطبيق',
    methods: {
      cash: 'نقداً', card: 'بطاقة', lana: 'لانا', card_cmi: 'بطاقة CMI', card_visa: 'فيزا',
      card_mastercard: 'ماستركارد', mobile_cih: 'CIH موبايل', mobile_cih_pay: 'CIH Pay',
      mobile_orange_money: 'أورانج موني', mobile_inwi_money: 'إنوي موني', credit: 'آجل',
      voucher: 'قسيمة', other: 'أخرى',
    },
    alertTypes: {
      void_spike: 'ارتفاع الإلغاءات', discount_over_limit: 'خصم فوق الحد',
      cash_discrepancy: 'فارق في الصندوق', unusual_refund: 'مرتجع غير معتاد',
      price_override: 'تغيير السعر', rapid_voids: 'إلغاءات متتالية', no_sale: 'فتح الصندوق بدون بيع',
    },
    severities: { low: 'منخفض', medium: 'متوسط', high: 'مرتفع', critical: 'حرج' },
  },
  fr: {
    currency: 'MAD',
    title: (d) => `🟢 *Rapport du ${d}*`,
    sales: 'Ventes',
    transactions: 'Transactions',
    margin: 'Marge brute',
    marginCoverage: (p) => `calculé sur ${p}% du CA`,
    colon: ' : ',
    payments: 'Paiements',
    voids: 'Annulations',
    refunds: 'Retours',
    discounts: 'Remises',
    waste: 'Gaspillage',
    topWaste: 'Top déchet',
    cash: 'Écart de caisse',
    noVariance: 'aucun écart',
    alerts: 'Alertes ouvertes',
    stock: 'Stock bas',
    topProducts: 'Top produits',
    noSales: 'Aucune vente',
    more: 'Détail dans l\'application',
    methods: {
      cash: 'Espèces', card: 'Carte', lana: 'Lana', card_cmi: 'Carte CMI', card_visa: 'Visa',
      card_mastercard: 'Mastercard', mobile_cih: 'CIH Mobile', mobile_cih_pay: 'CIH Pay',
      mobile_orange_money: 'Orange Money', mobile_inwi_money: 'inwi money', credit: 'Crédit',
      voucher: 'Bon', other: 'Autre',
    },
    alertTypes: {
      void_spike: 'Pic d\'annulations', discount_over_limit: 'Remise au-dessus du seuil',
      cash_discrepancy: 'Écart de caisse', unusual_refund: 'Retour inhabituel',
      price_override: 'Prix modifié', rapid_voids: 'Annulations rapprochées', no_sale: 'Tiroir ouvert sans vente',
    },
    severities: { low: 'faible', medium: 'moyenne', high: 'élevée', critical: 'critique' },
  },
  en: {
    currency: 'MAD',
    title: (d) => `🟢 *Report for ${d}*`,
    sales: 'Sales',
    transactions: 'Transactions',
    margin: 'Gross margin',
    marginCoverage: (p) => `based on ${p}% of sales`,
    colon: ': ',
    payments: 'Payments',
    voids: 'Voids',
    refunds: 'Refunds',
    discounts: 'Discounts',
    waste: 'Waste',
    topWaste: 'Top waste',
    cash: 'Cash variance',
    noVariance: 'no variance',
    alerts: 'Open alerts',
    stock: 'Low stock',
    topProducts: 'Top products',
    noSales: 'No sales',
    more: 'Full detail in the app',
    methods: {
      cash: 'Cash', card: 'Card', lana: 'Lana', card_cmi: 'CMI card', card_visa: 'Visa',
      card_mastercard: 'Mastercard', mobile_cih: 'CIH Mobile', mobile_cih_pay: 'CIH Pay',
      mobile_orange_money: 'Orange Money', mobile_inwi_money: 'inwi money', credit: 'Credit',
      voucher: 'Voucher', other: 'Other',
    },
    alertTypes: {
      void_spike: 'Void spike', discount_over_limit: 'Discount over limit',
      cash_discrepancy: 'Cash discrepancy', unusual_refund: 'Unusual refund',
      price_override: 'Price override', rapid_voids: 'Rapid voids', no_sale: 'No-sale drawer open',
    },
    severities: { low: 'low', medium: 'medium', high: 'high', critical: 'critical' },
  },
};

const mad = (cents: number): string => (cents / 100).toFixed(2);
const signed = (cents: number): string => `${cents > 0 ? '+' : ''}${mad(cents)}`;

function productName(lang: DigestLanguage, p: { nameAr: string; nameFr: string }): string {
  return lang === 'ar' ? p.nameAr : p.nameFr;
}

/**
 * Build the digest text.
 *  - default (compact): the WhatsApp message, trimmed section by section to stay
 *    near COMPACT_LIMIT characters.
 *  - { detail: true }: every section, full lists, no length cap (preview endpoint).
 */
export function formatDigest(
  data: DigestData,
  language: DigestLanguage,
  opts: { detail?: boolean } = {},
): string {
  const L = LABELS[language];
  const detail = opts.detail === true;
  const cur = L.currency;

  // Each section is a block of lines, in priority order. In compact mode a section
  // that would push the message over the limit is skipped (later, smaller ones may
  // still fit).
  const sections: string[][] = [];

  // 1. Headline — always included.
  const head: string[] = [
    L.title(data.date),
    `💰 *${L.sales}:* ${mad(data.totalSalesPiastres)} ${cur}  ·  🧾 ${data.transactionCount}`,
  ];
  sections.push(head);

  // 2. Margin (only when some products have a cost).
  if (data.margin.marginPct !== null) {
    const lines = [
      `📈 *${L.margin}:* ${mad(data.margin.grossMarginPiastres)} ${cur} (${data.margin.marginPct}%)`,
    ];
    // The figure is partial when some sold products have no cost: say so, briefly,
    // on its own line (not in the headline).
    if (data.margin.costCoveragePct !== null && data.margin.costCoveragePct < 100) {
      lines.push(`ℹ️ ${L.marginCoverage(data.margin.costCoveragePct)}`);
    }
    sections.push(lines);
  }

  // 3. Payment split.
  if (data.payments.length > 0) {
    const shown = detail ? data.payments : data.payments.slice(0, 3);
    const parts = shown.map((p) => `${L.methods[p.method] ?? p.method} ${mad(p.amountPiastres)}`);
    sections.push([`💳 *${L.payments}:* ${parts.join(' · ')}`]);
  }

  // 4. Voids, refunds, discounts.
  if (data.voids.count > 0 || data.refunds.count > 0 || data.discounts.totalPiastres > 0) {
    const parts: string[] = [];
    const c = L.colon;
    if (data.voids.count > 0) parts.push(`${L.voids}${c}${data.voids.count} (${mad(data.voids.amountPiastres)} ${cur})`);
    if (data.refunds.count > 0) parts.push(`${L.refunds}${c}${data.refunds.count} (${mad(data.refunds.amountPiastres)} ${cur})`);
    if (data.discounts.totalPiastres > 0) parts.push(`${L.discounts}${c}${mad(data.discounts.totalPiastres)} ${cur}`);
    sections.push([`🔍 ${parts.join(' · ')}`]);
  }

  // 5. Cash variance for shifts closed that day.
  if (data.shifts.length > 0) {
    const withVar = data.shifts.filter((s) => (s.variancePiastres ?? 0) !== 0);
    if (detail) {
      const lines = [`🧮 *${L.cash}:* ${data.totalCashVariancePiastres === 0 ? L.noVariance : signed(data.totalCashVariancePiastres)} ${cur}`];
      for (const s of data.shifts) {
        // French name for fr/en; falls back to the Arabic name stored on the shift.
        const name = language === 'ar' ? s.cashierName : (s.cashierNameFr ?? s.cashierName);
        lines.push(`• ${name ?? '—'}: ${signed(s.variancePiastres ?? 0)}`);
      }
      sections.push(lines);
    } else {
      sections.push([
        `🧮 *${L.cash}:* ${withVar.length === 0 ? L.noVariance : signed(data.totalCashVariancePiastres)} ${withVar.length === 0 ? '' : cur}`.trimEnd(),
      ]);
    }
  }

  // 6. Unacknowledged anomaly alerts.
  if (data.alerts.unacknowledgedCount > 0) {
    const lines = [`🚨 *${L.alerts}:* ${data.alerts.unacknowledgedCount}`];
    const top = detail ? data.alerts.top : data.alerts.top.slice(0, 2);
    for (const a of top) {
      lines.push(`• ${L.alertTypes[a.alertType] ?? a.alertType} (${L.severities[a.severity] ?? a.severity})`);
    }
    sections.push(lines);
  }

  // 7. Low stock.
  if (data.lowStockCount > 0) {
    const lines = [`⚠️ *${L.stock}:* ${data.lowStockCount}`];
    const shown = detail ? data.lowStockProducts : data.lowStockProducts.slice(0, 3);
    for (const p of shown) {
      lines.push(`• ${productName(language, p)}: ${p.stockQuantity} / ${p.threshold}`);
    }
    sections.push(lines);
  }

  // 8. Top products.
  {
    const lines = [`📦 *${L.topProducts}:*`];
    if (data.topProducts.length === 0) {
      lines.push(L.noSales);
    } else {
      const shown = detail ? data.topProducts : data.topProducts.slice(0, 3);
      shown.forEach((p, i) => {
        lines.push(`${i + 1}. ${productName(language, p)} — ${mad(p.revenuePiastres)} ${cur}`);
      });
    }
    sections.push(lines);
  }

  // 9. Waste.
  if (data.totalWastePiastres > 0 || data.wasteLines.length > 0) {
    const top = data.wasteLines[0];
    const lines = [`🗑️ *${L.waste}:* ${mad(data.totalWastePiastres)} ${cur}${top && !detail ? `  ·  ${L.topWaste}: ${productName(language, top)}` : ''}`];
    if (detail) {
      for (const w of data.wasteLines) {
        lines.push(`• ${productName(language, w)}: ${(w.grams / 1000).toFixed(2)} kg — ${mad(w.costPiastres)} ${cur}`);
      }
    }
    sections.push(lines);
  }

  const footer = ['', 'MAGHAREBIT POS'];

  if (detail) {
    return [...sections.map((s) => s.join('\n')), 'MAGHAREBIT POS'].join('\n\n');
  }

  // Compact: keep the headline, then add sections while they fit.
  const budget = COMPACT_LIMIT - footer.join('\n').length - 2;
  const parts: string[] = [];
  let used = 0;
  sections.forEach((s, i) => {
    const text = s.join('\n');
    const cost = text.length + (parts.length > 0 ? 2 : 0);
    if (i === 0 || used + cost <= budget) {
      parts.push(text);
      used += cost;
    }
  });
  return `${parts.join('\n\n')}\n${footer.join('\n')}`;
}
