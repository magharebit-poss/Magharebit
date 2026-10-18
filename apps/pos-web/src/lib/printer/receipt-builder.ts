import { EscPos } from './escpos';
import type { CartLine, Discount, ShiftSummary } from '../cart';
import { pickName } from '../names';
import { TRANSLATIONS } from '../i18n';

export type PaymentMethod = 'cash' | 'card' | 'lana';

export interface ReceiptData {
  receiptNumber: string;
  shiftId: string;
  cashierName: string;
  cartLines: CartLine[];
  cartDiscount?: Discount;
  totalPiastres: number;
  taxPiastres: number;
  paymentMethod: PaymentMethod;
  paidPiastres?: number;       // cash paid
  changePiastres?: number;     // cash change
  storeName?: string;
  storeAddress?: string;
  taxId?: string;
}

function fmt(piastres: number): string {
  return `${(piastres / 100).toFixed(2)} MAD`;
}

function padLeft(str: string, width: number): string {
  const len = [...str].length;
  return len >= width ? str : ' '.repeat(width - len) + str;
}

function nowAr(): string {
  return new Date().toLocaleString('ar-MA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

const PRINT_WIDTH = 48;

export function buildReceipt(data: ReceiptData): Uint8Array {
  const ep = new EscPos();
  ep.init().selectArabicCodePage().rtlMode(true);

  // Header
  ep.align('center');
  ep.bold(true).doubleSize(true);
  ep.line(data.storeName ?? 'GreenGo');
  ep.bold(false).doubleSize(false);
  if (data.storeAddress) ep.line(data.storeAddress);
  if (data.taxId) ep.line(`ICE: ${data.taxId}`);
  ep.separator('=');

  // Meta
  ep.align('right');
  ep.line(`رقم الإيصال: ${data.receiptNumber}`);
  ep.line(`التاريخ: ${nowAr()}`);
  ep.line(`الكاشير: ${data.cashierName}`);
  ep.separator('-');

  // Line items
  ep.align('right');
  for (const line of data.cartLines) {
    const name = line.product.name_ar || line.product.name_fr;
    const unitStr = fmt(line.unitPricePiastres);
    const qty = line.product.is_weighted
      ? `${(line.quantity).toFixed(3)} كغ`
      : `x${line.quantity}`;
    // Name line
    ep.bold(true).line(name).bold(false);
    // Quantity × unit = total
    const qtyLine = `${qty}  ${unitStr} = ${fmt(line.lineTotalPiastres)}`;
    ep.line(padLeft(qtyLine, PRINT_WIDTH));
    // Per-line discount
    if (line.discount) {
      const label = line.discount.type === 'percentage'
        ? `تخفيض ${line.discount.value}%`
        : `تخفيض ثابت`;
      ep.line(padLeft(label, PRINT_WIDTH));
    }
  }

  ep.separator('-');

  // Cart-level discount
  if (data.cartDiscount) {
    const label = data.cartDiscount.type === 'percentage'
      ? `تخفيض السلة: ${data.cartDiscount.value}%`
      : `تخفيض السلة: ${fmt(data.cartDiscount.value)}`;
    ep.align('right').line(label);
  }

  // Totals
  const htPiastres = data.totalPiastres - data.taxPiastres;
  ep.align('right');
  ep.twoCol('المجموع HT', fmt(htPiastres), PRINT_WIDTH);
  ep.twoCol('TVA 20%', fmt(data.taxPiastres), PRINT_WIDTH);
  ep.bold(true);
  ep.twoCol('الإجمالي TTC', fmt(data.totalPiastres), PRINT_WIDTH);
  ep.bold(false);

  // Payment
  ep.separator('-');
  const methodLabel: Record<PaymentMethod, string> = {
    cash: 'نقدي',
    card: 'بطاقة بنكية',
    lana: 'Lana Cash',
  };
  ep.twoCol('طريقة الدفع', methodLabel[data.paymentMethod], PRINT_WIDTH);
  if (data.paymentMethod === 'cash' && data.paidPiastres !== undefined) {
    ep.twoCol('المبلغ المقدم', fmt(data.paidPiastres), PRINT_WIDTH);
    ep.twoCol('الباقي', fmt(data.changePiastres ?? 0), PRINT_WIDTH);
  }

  // Footer
  ep.separator('=');
  ep.align('center');
  ep.line('شكراً لزيارتكم');
  ep.line('GreenGo — مدعوم من MAGHAREBIT');

  ep.feedAndCut(4);
  return ep.build();
}

export interface KitchenTicketData {
  orderNumber: string;
  tableName:   string | null;
  courseName:  string;
  lines: Array<{
    name_ar:        string;
    name_fr:        string;
    quantity:       number;
    modifiers:      Array<{ label_ar: string; label_fr: string }>;
    allergy_flags:  string[];
    allergyLabels:  string[];
    // CP1256 cannot encode emoji, so icons are carried for callers but never printed.
    allergyIcons:   string[];
  }>;
  firedAt: string;
  lang:    'ar' | 'fr' | 'en';
}

export function buildKitchenTicket(data: KitchenTicketData): Uint8Array {
  const ep = new EscPos();
  const isAr = data.lang === 'ar';
  const locale = data.lang === 'ar' ? 'ar-MA' : data.lang === 'fr' ? 'fr-MA' : 'en-GB';
  ep.init().selectArabicCodePage().rtlMode(isAr);

  // Header: table (or take away) and the course, both large
  ep.align('center');
  ep.bold(true).doubleSize(true);
  ep.line(data.tableName ?? TRANSLATIONS[data.lang].course.takeaway);
  ep.line(data.courseName);
  ep.bold(false).doubleSize(false);
  ep.line(`#${data.orderNumber}`);
  ep.separator('=');

  ep.align(isAr ? 'right' : 'left');
  for (const line of data.lines) {
    ep.bold(true).line(`${line.quantity} x ${pickName(data.lang, line.name_ar, line.name_fr)}`).bold(false);
    for (const m of line.modifiers) {
      ep.line(`   - ${pickName(data.lang, m.label_ar, m.label_fr)}`);
    }
    // Allergies must never be missed: bold, double size and reverse video
    line.allergy_flags.forEach((code, i) => {
      ep.reverse(true).bold(true).doubleSize(true);
      ep.line(`!! ${line.allergyLabels[i] ?? code}`);
      ep.doubleSize(false).bold(false).reverse(false);
    });
    ep.separator('-');
  }

  ep.align('center');
  ep.line(new Date(data.firedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }));
  ep.feedAndCut(4);
  return ep.build();
}

export function buildZReport(summary: ShiftSummary, cashierName: string): Uint8Array {
  const ep = new EscPos();
  ep.init().selectArabicCodePage().rtlMode(true);

  ep.align('center');
  ep.bold(true).doubleSize(true);
  ep.line('تقرير إغلاق الوردية');
  ep.bold(false).doubleSize(false);
  ep.line(`GreenGo — Z-Report`);
  ep.separator('=');

  ep.align('right');
  ep.line(`الكاشير: ${cashierName}`);
  ep.line(`وقت الطباعة: ${nowAr()}`);
  if (summary.openedAt) {
    ep.line(`فتح الوردية: ${new Date(summary.openedAt).toLocaleString('ar-MA')}`);
  }
  ep.separator('-');

  ep.twoCol('عدد المعاملات', String(summary.txCount), PRINT_WIDTH);
  ep.separator('-');
  ep.bold(true);
  ep.twoCol('إجمالي المبيعات', fmt(summary.totalSalesPiastres), PRINT_WIDTH);
  ep.bold(false);
  ep.twoCol('  نقدي', fmt(summary.cashTotalPiastres), PRINT_WIDTH);
  ep.twoCol('  بطاقة', fmt(summary.cardTotalPiastres), PRINT_WIDTH);
  ep.twoCol('  TVA', fmt(summary.totalTaxPiastres), PRINT_WIDTH);
  ep.separator('-');
  ep.twoCol('الصندوق الافتتاحي', fmt(summary.openingFloatPiastres), PRINT_WIDTH);
  if (summary.closingCashCounted !== null) {
    ep.twoCol('الصندوق الختامي', fmt(summary.closingCashCounted), PRINT_WIDTH);
    if (summary.cashVariance !== null) {
      const sign = summary.cashVariance >= 0 ? '+' : '';
      ep.twoCol('الفارق', `${sign}${fmt(summary.cashVariance)}`, PRINT_WIDTH);
    }
  }

  if (summary.topProducts.length > 0) {
    ep.separator('-');
    ep.align('center').bold(true).line('أكثر المنتجات مبيعاً').bold(false);
    ep.align('right');
    for (const p of summary.topProducts.slice(0, 5)) {
      ep.twoCol(p.nameAr, `${p.qty} × ${fmt(p.total)}`, PRINT_WIDTH);
    }
  }

  ep.separator('=');
  ep.align('center').line('نهاية التقرير');
  ep.feedAndCut(4);
  return ep.build();
}
