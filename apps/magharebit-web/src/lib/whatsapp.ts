const GREEN_API_BASE = process.env.GREEN_API_BASE_URL ?? 'https://api.green-api.com'
const INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID
const API_TOKEN = process.env.GREEN_API_API_TOKEN
const BUSINESS_NUMBER = process.env.WHATSAPP_BUSINESS_NUMBER ?? '212619522487'

interface SendMessageParams {
  to: string      // Moroccan phone number in any common format
  message: string
}

interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendWhatsAppMessage({ to, message }: SendMessageParams): Promise<SendResult> {
  if (!INSTANCE_ID || !API_TOKEN) {
    console.warn('[whatsapp] Green API not configured — INSTANCE_ID or API_TOKEN missing')
    return { success: false, error: 'Green API not configured' }
  }

  const chatId = toChatId(to)
  const url = `${GREEN_API_BASE}/waInstance${INSTANCE_ID}/sendMessage/${API_TOKEN}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { success: false, error: `HTTP ${res.status}: ${body}` }
    }

    const data = await res.json() as { idMessage?: string }
    return { success: true, messageId: data.idMessage }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// Convert any Moroccan phone format to Green API chatId format
function toChatId(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  let e164: string
  if (digits.startsWith('212')) {
    e164 = digits
  } else if (digits.startsWith('0') && digits.length === 10) {
    e164 = '212' + digits.slice(1)
  } else {
    e164 = digits
  }
  return `${e164}@c.us`
}

// Business WhatsApp number for admin notifications
export const ADMIN_CHAT_ID = toChatId(BUSINESS_NUMBER)

// ── Phase B: merchant-facing automated messages ───────────────────────────────

/**
 * Send a daily sales summary to a merchant's WhatsApp number.
 * Called by the /api/cron/daily-report route every evening.
 */
export async function sendDailyReport(opts: {
  to:            string   // merchant's WhatsApp number (any Moroccan format)
  storeName:     string
  date:          string   // 'YYYY-MM-DD'
  revenue:       number
  txCount:       number
  avgBasket:     number
  topProduct:    { name: string; qty: number } | null
  lowStockCount: number
}): Promise<SendResult> {
  const { to, storeName, date, revenue, txCount, avgBasket, topProduct, lowStockCount } = opts

  const dateLabel = (() => {
    try {
      return new Date(date + 'T12:00:00').toLocaleDateString('ar-MA', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    } catch {
      return date
    }
  })()

  const lines: string[] = [
    `📊 *تقرير ${dateLabel}*`,
    `🏪 *${storeName}*`,
    '',
    `💰 المبيعات: *${revenue.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD*`,
    `🛒 عدد العمليات: *${txCount}*`,
    `🧾 متوسط السلة: *${avgBasket.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} MAD*`,
  ]

  if (topProduct) {
    lines.push(`🏆 الأكثر مبيعاً: *${topProduct.name}* (${topProduct.qty} وحدة)`)
  }

  if (lowStockCount > 0) {
    lines.push(`⚠️ منتجات منخفضة المخزون: *${lowStockCount}*`)
  } else {
    lines.push(`✅ المخزون في الوضع الطبيعي`)
  }

  lines.push('', '_MAGHAREBIT POS_ 🚀')

  return sendWhatsAppMessage({ to, message: lines.join('\n') })
}

/**
 * Send a low-stock alert to a merchant's WhatsApp number.
 * Called fire-and-forget from the transactions POST route after each sale.
 * Deduplication (to avoid spam on every single sale) is the caller's responsibility.
 */
export async function sendLowStockAlert(opts: {
  to:        string
  storeName: string
  items:     Array<{ name: string; stock: number; minStock: number }>
}): Promise<SendResult> {
  const { to, storeName, items } = opts

  if (items.length === 0) return { success: true }

  const itemLines = items
    .slice(0, 10) // cap at 10 items to keep message readable
    .map(i => `• *${i.name}*: ${i.stock} / ${i.minStock} وحدة`)
    .join('\n')

  const more = items.length > 10 ? `\n_و ${items.length - 10} منتجات أخرى..._` : ''

  const message = [
    `⚠️ *تنبيه المخزون — ${storeName}*`,
    '',
    'وصلت المنتجات التالية للحد الأدنى:',
    itemLines + more,
    '',
    'يُنصح بإعادة الطلب قريباً.',
    '',
    '_MAGHAREBIT POS_ 🚀',
  ].join('\n')

  return sendWhatsAppMessage({ to, message })
}

// ── Sprint 3 W4: Customer receipt ────────────────────────────────────────────

/**
 * Build an Arabic WhatsApp receipt message from a completed transaction.
 * Exported so the logiciel can also render a receipt preview without hitting
 * the API (pure function — no network calls).
 */
export function buildReceiptMessage(opts: {
  storeName:      string
  receiptNo:      string
  createdAt:      Date
  items:          Array<{ name: string; qty: number; unitPrice: number; total: number }>
  subtotal:       number
  discount:       number
  totalHT:        number
  taxRate:        number
  taxAmount:      number
  total:          number
  receiptFooter?: string
  loyaltyPoints?: number  // customer's updated points balance after this sale
}): string {
  const {
    storeName, receiptNo, createdAt,
    items, subtotal, discount, totalHT, taxRate, taxAmount, total,
    receiptFooter, loyaltyPoints,
  } = opts

  const dateStr = (() => {
    try {
      return createdAt.toLocaleDateString('ar-MA', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch {
      return createdAt.toISOString()
    }
  })()

  const fmt = (n: number) =>
    n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const lines: string[] = [
    `🧾 *إيصال شراء — ${storeName}*`,
    '',
    `📅 ${dateStr}`,
    `رقم الفاتورة: *${receiptNo}*`,
    '─────────────────',
  ]

  for (const item of items) {
    lines.push(`• *${item.name}*\n  ${item.qty} × ${fmt(item.unitPrice)} = ${fmt(item.total)} د.م`)
  }

  lines.push('─────────────────')

  if (discount > 0) {
    lines.push(`المجموع الفرعي: ${fmt(subtotal)} د.م`)
    lines.push(`الخصم: -${fmt(discount)} د.م`)
  }

  if (taxRate > 0) {
    lines.push(`المجموع قبل الضريبة (HT): ${fmt(totalHT)} د.م`)
    lines.push(`الضريبة TVA ${taxRate}%: ${fmt(taxAmount)} د.م`)
  }

  lines.push(`*الإجمالي: ${fmt(total)} د.م*`)

  if (loyaltyPoints !== undefined && loyaltyPoints > 0) {
    lines.push('')
    lines.push(`⭐ نقاط ولائك: *${loyaltyPoints.toLocaleString()}* نقطة`)
  }

  if (receiptFooter?.trim()) {
    lines.push('')
    lines.push(`_${receiptFooter.trim()}_`)
  }

  lines.push('', '_MAGHAREBIT POS_ 🚀')

  return lines.join('\n')
}

/**
 * Send a WhatsApp receipt to a customer.
 * Called fire-and-forget from POST /api/portal/transactions.
 * Never throws — returns SendResult so the caller can log if needed.
 */
export async function sendCustomerReceipt(opts: {
  customerPhone:  string
  storeName:      string
  receiptNo:      string
  createdAt:      Date
  items:          Array<{ name: string; qty: number; unitPrice: number; total: number }>
  subtotal:       number
  discount:       number
  totalHT:        number
  taxRate:        number
  taxAmount:      number
  total:          number
  receiptFooter?: string
  loyaltyPoints?: number
}): Promise<SendResult> {
  const { customerPhone, ...rest } = opts
  const message = buildReceiptMessage(rest)
  return sendWhatsAppMessage({ to: customerPhone, message })
}

// ── Message templates — all 3 locales ────────────────────────────────────────
export const whatsappTemplates = {
  newLead: (storeName: string, phone: string, city: string, appUrl: string) =>
    `🔔 *Nouveau lead MAGHAREBIT*\n\n` +
    `📛 Magasin: ${storeName}\n` +
    `📱 Tél: ${phone}\n` +
    `📍 Ville: ${city}\n\n` +
    `👉 ${appUrl}/admin/leads`,

  leadConfirmation: (storeName: string, locale: string) => {
    const msgs: Record<string, string> = {
      ar:
        `مرحباً *${storeName}*! 👋\n\n` +
        `شكراً على اهتمامك بـ MAGHAREBIT.\n` +
        `سيتواصل معك فريقنا خلال *24 ساعة*.\n\n` +
        `فريق MAGHAREBIT 🚀`,
      fr:
        `Bonjour *${storeName}*! 👋\n\n` +
        `Merci de votre intérêt pour MAGHAREBIT.\n` +
        `Notre équipe vous contactera dans les *24h*.\n\n` +
        `L'équipe MAGHAREBIT 🚀`,
      en:
        `Hello *${storeName}*! 👋\n\n` +
        `Thank you for your interest in MAGHAREBIT.\n` +
        `Our team will contact you within *24 hours*.\n\n` +
        `The MAGHAREBIT team 🚀`,
    }
    return msgs[locale] ?? msgs.fr
  },

  /**
   * Sent to a merchant after admin approves their subscription.
   * Contains the license key they must enter into the desktop activation screen.
   */
  licenseDelivery: (
    storeName: string,
    key: string,
    plan: string,
    expiresAt: Date,
    locale: string
  ) => {
    const expStr = expiresAt.toLocaleDateString('fr-MA', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
    const msgs: Record<string, string> = {
      ar:
        `🎉 *مرحباً ${storeName}!*\n\n` +
        `تم تفعيل اشتراكك في *MAGHAREBIT POS*.\n\n` +
        `🔑 *مفتاح الترخيص الخاص بك:*\n` +
        `\`${key}\`\n\n` +
        `📋 *الخطة:* ${plan}\n` +
        `📅 *صالح حتى:* ${expStr}\n\n` +
        `*كيفية التفعيل:*\n` +
        `1️⃣ حمّل البرنامج من الرابط الذي أرسلناه\n` +
        `2️⃣ افتح البرنامج وانتقل إلى شاشة التفعيل\n` +
        `3️⃣ أدخل المفتاح أعلاه بالضبط\n` +
        `4️⃣ انقر تفعيل — البرنامج سيفتح مباشرةً\n\n` +
        `للمساعدة تواصل معنا على نفس الرقم 📞\n` +
        `فريق *MAGHAREBIT* 🚀`,
      fr:
        `🎉 *Bonjour ${storeName}!*\n\n` +
        `Votre abonnement *MAGHAREBIT POS* est activé.\n\n` +
        `🔑 *Votre clé de licence:*\n` +
        `\`${key}\`\n\n` +
        `📋 *Plan:* ${plan}\n` +
        `📅 *Valable jusqu'au:* ${expStr}\n\n` +
        `*Comment activer:*\n` +
        `1️⃣ Téléchargez le logiciel via le lien envoyé\n` +
        `2️⃣ Ouvrez le logiciel → écran d'activation\n` +
        `3️⃣ Saisissez la clé ci-dessus exactement\n` +
        `4️⃣ Cliquez Activer — le logiciel s'ouvre\n\n` +
        `Support: répondez sur ce numéro 📞\n` +
        `L'équipe *MAGHAREBIT* 🚀`,
      en:
        `🎉 *Hello ${storeName}!*\n\n` +
        `Your *MAGHAREBIT POS* subscription is now active.\n\n` +
        `🔑 *Your license key:*\n` +
        `\`${key}\`\n\n` +
        `📋 *Plan:* ${plan}\n` +
        `📅 *Valid until:* ${expStr}\n\n` +
        `*How to activate:*\n` +
        `1️⃣ Download the software via the link sent\n` +
        `2️⃣ Open software → go to the activation screen\n` +
        `3️⃣ Enter the key above exactly as shown\n` +
        `4️⃣ Click Activate — the software will unlock\n\n` +
        `Support: reply on this number 📞\n` +
        `The *MAGHAREBIT* team 🚀`,
    }
    return msgs[locale] ?? msgs.fr
  },

  /**
   * Sent to a merchant when their subscription is revoked/suspended.
   */
  licenseRevoked: (storeName: string, locale: string) => {
    const msgs: Record<string, string> = {
      ar:
        `⚠️ *${storeName}*\n\n` +
        `تم إيقاف اشتراكك في *MAGHAREBIT POS* مؤقتاً.\n` +
        `للاستفسار أو التجديد تواصل معنا على هذا الرقم.\n\n` +
        `فريق *MAGHAREBIT*`,
      fr:
        `⚠️ *${storeName}*\n\n` +
        `Votre abonnement *MAGHAREBIT POS* a été suspendu.\n` +
        `Contactez-nous sur ce numéro pour toute question.\n\n` +
        `L'équipe *MAGHAREBIT*`,
      en:
        `⚠️ *${storeName}*\n\n` +
        `Your *MAGHAREBIT POS* subscription has been suspended.\n` +
        `Contact us on this number for any questions.\n\n` +
        `The *MAGHAREBIT* team`,
    }
    return msgs[locale] ?? msgs.fr
  },

  newsletterWelcome: (locale: string) => {
    const msgs: Record<string, string> = {
      ar:
        `مرحباً بك في تحديثات *MAGHAREBIT*! 🎉\n\n` +
        `ستتلقى آخر الأخبار والتحديثات عن منتجاتنا.\n\n` +
        `أرسل *STOP* للإلغاء في أي وقت.`,
      fr:
        `Bienvenue dans les mises à jour *MAGHAREBIT*! 🎉\n\n` +
        `Vous recevrez nos dernières actualités produit.\n\n` +
        `Envoyez *STOP* pour vous désabonner.`,
      en:
        `Welcome to *MAGHAREBIT* updates! 🎉\n\n` +
        `You will receive our latest product news.\n\n` +
        `Reply *STOP* to unsubscribe.`,
    }
    return msgs[locale] ?? msgs.fr
  },
}
