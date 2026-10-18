// One-shot script to add new translation keys for the 6-fix iteration.
// Safe to run multiple times — it merges into existing keys.
const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.resolve(__dirname, '..', 'messages');

const ADDITIONS = {
  ar: {
    hero: {
      mockup: {
        url: 'app.magharebit.ma/pos',
        search: 'ابحث عن منتج...',
        categories: ['الكل', 'مشروبات', 'مخبزة', 'حلويات'],
        currency: 'د',
        basket_title: 'السلة',
        total_label: 'الإجمالي',
        checkout_btn: 'إتمام الدفع',
        products: [
          { name: 'أتاي بالنعناع', price: '12', emoji: '☕' },
          { name: 'كرواصان', price: '8', emoji: '🥐' },
          { name: 'قهوة نص نص', price: '14', emoji: '☕' },
          { name: 'سفنج', price: '5', emoji: '🍩' },
          { name: 'عصير برتقال', price: '15', emoji: '🍊' },
          { name: 'غريبة', price: '18', emoji: '🍪' },
        ],
        basket_items: [
          { name: 'أتاي بالنعناع', qty: '×2', price: '24.00' },
          { name: 'كرواصان', qty: '×3', price: '24.00' },
          { name: 'غريبة', qty: '×1', price: '18.00' },
        ],
      },
    },
    products: {
      cards: [
        {
          features: [
            'يعمل 100٪ بدون إنترنت — مزامنة تلقائية عند العودة',
            'واجهة عربية RTL أصيلة — ليست مترجمة، مصممة للعربية',
            'إدارة الوصفات والمكونات (BOM) — للمخابز والمطاعم',
            'تتبع الهدر والفاقد — تقرير يومي آلي',
            'طباعة الفواتير بالعربية — متوافق مع الطابعات الحرارية',
            'دعم الميزان والباركود — للمحلات التي تبيع بالوزن',
          ],
        },
        {
          features: [
            'رصيد حقيقي لحظي — يُخصم فور كل عملية بيع',
            'تنبيهات نفاد المخزون — قبل أن تنتهي البضاعة',
            'إدارة الموردين والمشتريات — تاريخ كامل للواردات',
            'مزامنة بين الفروع — رؤية موحدة من مكان واحد',
            'تقارير الديون والمدفوعات — للعملاء والموردين',
            'تصدير التقارير — Excel وPDF',
          ],
        },
        {
          features: [
            'تحليل المبيعات بالذكاء الاصطناعي — توقعات الطلب الأسبوعي',
            'لوحة تحكم مركزية — جميع الفروع في شاشة واحدة',
            'مقارنة أداء الفروع — اكتشف الفرع الأقوى',
            'إدارة الموظفين والصلاحيات — من يبيع ماذا ومتى',
            'تقارير الهدر — تعرف أين تخسر المال كل يوم',
            'تنبيهات WhatsApp — ملخص يومي على هاتفك مباشرة',
          ],
        },
      ],
    },
    why_not: {
      red_title: 'لماذا لا يكفي الكاشير العادي؟',
      red_items: [
        'المنافسون الآخرون يعملون فقط مع الإنترنت — عند انقطاع الشبكة يتوقف عملك',
        'معظم الحلول لا تدعم العربية حقاً — الترجمة ليست نفس التصميم للعربية',
        'بدون تحليلات ذكاء اصطناعي، تدير متجرك بالتخمين وليس بالبيانات',
      ],
      green_title: 'MAGHAREBIT مختلف — هذا هو الدليل',
      green_items: [
        'يعمل 100٪ بدون إنترنت — واصل البيع حتى لو انقطع الاتصال لأيام',
        'عربية RTL حقيقية — صُممت للعربية منذ اليوم الأول، ليست ترجمة',
        'ذكاء اصطناعي مدمج — يخبرك ماذا تطلب هذا الأسبوع بناءً على بيانات حقيقية',
      ],
    },
    roi_teaser: {
      badge: '💸 خسائر يومية يمكن تجنبها',
      title: 'كل يوم بدون MAGHAREBIT هو يوم تخسر فيه',
      sub: 'التاجر المغربي المتوسط يخسر بين 800 و3,000 درهم شهرياً بسبب:',
      loss1: 'الهدر غير المتتبع في المخبزة والمطعم — بدون تقارير لا ترى أين تذهب بضاعتك',
      loss2: 'أخطاء الكاشير وفروقات الصندوق — بدون رقابة لحظية لا تعرف حتى تتأكد',
      loss3: 'طلبات المخزون بالخمن — تشتري أكثر مما تحتاج أو تنقطع البضاعة في أسوأ وقت',
      result_intro: 'مع MAGHAREBIT:',
      result1: '-23٪ هدر في أول 3 أشهر (متوسط عملاؤنا)',
      result2: '+18٪ هامش تم اكتشافه بالتقارير',
      result3: '-2 ساعة عمل يدوي كل يوم',
    },
    tour_pos: {
      basket_title: 'السلة',
      total_label: 'الإجمالي',
      checkout_btn: 'إتمام الدفع',
    },
    tour_inventory: {
      title: 'المخزون الحي',
      col_product: 'المنتج',
      col_qty: 'الكمية',
      col_status: 'الحالة',
      col_updated: 'آخر تحديث',
      rows: [
        { product: 'قهوة نص نص', qty: '48 وحدة', status: 'نشط', dot: '🟢', updated: 'منذ 2 د' },
        { product: 'كرواصان', qty: '23 وحدة', status: 'نشط', dot: '🟢', updated: 'منذ 5 د' },
        { product: 'عصير برتقال', qty: '8 لتر', status: 'منخفض', dot: '🟡', updated: 'منذ 10 د' },
        { product: 'خس', qty: '2 كغ', status: 'ناقص', dot: '🔴', updated: 'منذ ساعة' },
      ],
      alert: '4 منتجات تحتاج إلى تجديد',
    },
    tour_analytics: {
      header: 'مبيعات هذا الأسبوع',
      total_value: 'MAD 8,307',
      top_product_label: 'المنتج الأكثر مبيعاً',
      top_product_value: 'كرواصان — 142 وحدة',
      peak_label: 'ساعة الذروة',
      peak_value: '10:00–12:00',
      growth_label: 'مقارنة بالأسبوع الماضي',
      growth_value: '+12٪',
      days: ['س', 'ج', 'خ', 'أر', 'ث', 'إث', 'أح'],
    },
    map: {
      hover_count_suffix: 'تاجر',
      hover_link: 'عرض التجار',
    },
  },

  fr: {
    hero: {
      mockup: {
        url: 'app.magharebit.ma/pos',
        search: 'Rechercher un produit...',
        categories: ['Tout', 'Boissons', 'Boulangerie', 'Pâtisserie'],
        currency: 'MAD',
        basket_title: 'Panier',
        total_label: 'Total',
        checkout_btn: 'Encaisser',
        products: [
          { name: 'Café au lait', price: '12', emoji: '☕' },
          { name: 'Croissant', price: '8', emoji: '🥐' },
          { name: 'Café express', price: '10', emoji: '☕' },
          { name: 'Pain au chocolat', price: '10', emoji: '🍫' },
          { name: "Jus d'orange", price: '15', emoji: '🍊' },
          { name: 'Millefeuille', price: '18', emoji: '🍰' },
        ],
        basket_items: [
          { name: 'Café au lait', qty: '×2', price: '24.00' },
          { name: 'Croissant', qty: '×3', price: '24.00' },
          { name: 'Millefeuille', qty: '×1', price: '18.00' },
        ],
      },
    },
    products: {
      cards: [
        {
          features: [
            'Fonctionne 100% hors-ligne — synchronisation automatique au retour',
            'Interface arabe RTL native — conçue pour l\'arabe, pas traduite',
            'Gestion des recettes et ingrédients (BOM) — boulangeries et restaurants',
            'Suivi des pertes et du gaspillage — rapport quotidien automatique',
            'Impression de factures en arabe — compatible imprimantes thermiques',
            'Support balance et code-barres — pour la vente au poids',
          ],
        },
        {
          features: [
            'Solde réel en temps réel — déduit dès chaque vente',
            'Alertes rupture de stock — avant d\'être à court',
            'Gestion fournisseurs et achats — historique complet des entrées',
            'Synchronisation multi-boutiques — vision unifiée depuis un seul endroit',
            'Rapports dettes et paiements — clients et fournisseurs',
            'Export des rapports — Excel et PDF',
          ],
        },
        {
          features: [
            'Analyse des ventes par IA — prévisions hebdomadaires de la demande',
            'Tableau de bord central — toutes vos boutiques sur un seul écran',
            'Comparaison performance des boutiques — repérez la plus performante',
            'Gestion employés et permissions — qui vend quoi et quand',
            'Rapports de pertes — sachez où vous perdez de l\'argent chaque jour',
            'Alertes WhatsApp — résumé quotidien direct sur votre téléphone',
          ],
        },
      ],
    },
    why_not: {
      red_title: 'Pourquoi les autres caisses ne suffisent pas?',
      red_items: [
        "Les autres solutions ne fonctionnent qu'avec internet — une coupure arrête votre activité",
        "La plupart ne supportent pas vraiment l'arabe — une traduction n'est pas la même chose qu'une interface conçue pour l'arabe",
        "Sans IA analytique, vous gérez votre commerce à l'intuition, pas aux données",
      ],
      green_title: 'MAGHAREBIT est différent — voici la preuve',
      green_items: [
        'Fonctionne 100% hors-ligne — continuez à vendre même si la connexion tombe pendant des jours',
        "Arabe RTL natif — conçu pour l'arabe depuis le premier jour, pas une traduction",
        'IA intégrée — vous dit quoi commander cette semaine sur la base de données réelles',
      ],
    },
    roi_teaser: {
      badge: '💸 Pertes quotidiennes évitables',
      title: 'Chaque jour sans MAGHAREBIT est un jour où vous perdez',
      sub: 'Le commerçant marocain moyen perd entre 800 et 3 000 MAD par mois à cause de :',
      loss1: 'Gaspillage non suivi en boulangerie et restaurant — sans rapports vous ne voyez pas où va votre marchandise',
      loss2: 'Erreurs de caisse et écarts de tiroir — sans contrôle temps réel vous ne savez pas avant de vérifier',
      loss3: 'Commandes de stock au pifomètre — vous achetez trop ou rupture au pire moment',
      result_intro: 'Avec MAGHAREBIT :',
      result1: '-23% de gaspillage en 3 mois (moyenne client)',
      result2: '+18% de marge identifiée par les rapports',
      result3: '-2h de travail manuel chaque jour',
    },
    tour_pos: {
      basket_title: 'Panier',
      total_label: 'Total',
      checkout_btn: 'Encaisser',
    },
    tour_inventory: {
      title: 'Stock en temps réel',
      col_product: 'Produit',
      col_qty: 'Quantité',
      col_status: 'Statut',
      col_updated: 'Dernière maj',
      rows: [
        { product: 'Café au lait', qty: '48 unités', status: 'Actif', dot: '🟢', updated: 'il y a 2 min' },
        { product: 'Croissant', qty: '23 unités', status: 'Actif', dot: '🟢', updated: 'il y a 5 min' },
        { product: "Jus d'orange", qty: '8 L', status: 'Faible', dot: '🟡', updated: 'il y a 10 min' },
        { product: 'Laitue', qty: '2 kg', status: 'Critique', dot: '🔴', updated: 'il y a 1h' },
      ],
      alert: '4 produits à renouveler',
    },
    tour_analytics: {
      header: 'Ventes cette semaine',
      total_value: 'MAD 8,307',
      top_product_label: 'Top produit',
      top_product_value: 'Croissant — 142 unités',
      peak_label: 'Heure de pointe',
      peak_value: '10:00–12:00',
      growth_label: 'vs semaine passée',
      growth_value: '+12%',
      days: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    },
    map: {
      hover_count_suffix: 'marchands',
      hover_link: 'Voir les marchands',
    },
  },

  en: {
    hero: {
      mockup: {
        url: 'app.magharebit.ma/pos',
        search: 'Search for a product...',
        categories: ['All', 'Drinks', 'Bakery', 'Pastry'],
        currency: 'MAD',
        basket_title: 'Basket',
        total_label: 'Total',
        checkout_btn: 'Checkout',
        products: [
          { name: 'Mint tea', price: '12', emoji: '🍵' },
          { name: 'Croissant', price: '8', emoji: '🥐' },
          { name: 'Espresso', price: '10', emoji: '☕' },
          { name: 'Donut', price: '5', emoji: '🍩' },
          { name: 'Orange juice', price: '15', emoji: '🍊' },
          { name: 'Cookie', price: '18', emoji: '🍪' },
        ],
        basket_items: [
          { name: 'Mint tea', qty: '×2', price: '24.00' },
          { name: 'Croissant', qty: '×3', price: '24.00' },
          { name: 'Cookie', qty: '×1', price: '18.00' },
        ],
      },
    },
    products: {
      cards: [
        {
          features: [
            'Works 100% offline — automatic sync when back online',
            'Native Arabic RTL interface — designed for Arabic, not translated',
            'Recipe & ingredient management (BOM) — bakeries and restaurants',
            'Waste and loss tracking — automatic daily report',
            'Arabic invoice printing — compatible with thermal printers',
            'Scale and barcode support — for stores selling by weight',
          ],
        },
        {
          features: [
            'Real-time balance — deducted at every sale',
            'Stock-out alerts — before you run out',
            'Supplier & purchasing management — full intake history',
            'Multi-branch sync — unified view from one place',
            'Debt and payment reports — customers and suppliers',
            'Export reports — Excel and PDF',
          ],
        },
        {
          features: [
            'AI-powered sales analysis — weekly demand forecasts',
            'Central dashboard — all branches on one screen',
            'Branch performance comparison — discover the strongest one',
            'Staff and permissions management — who sells what and when',
            'Waste reports — see where you lose money every day',
            'WhatsApp alerts — daily summary direct to your phone',
          ],
        },
      ],
    },
    why_not: {
      red_title: "Why a regular POS isn't enough",
      red_items: [
        'Other solutions need internet — a network drop stops your business',
        "Most don't truly support Arabic — a translation is not the same as an Arabic-designed interface",
        'Without AI analytics, you run your store on intuition, not data',
      ],
      green_title: "MAGHAREBIT is different — here's the proof",
      green_items: [
        'Works 100% offline — keep selling even if you lose connection for days',
        'True Arabic RTL — designed for Arabic from day one, not a translation',
        'Built-in AI — tells you what to order this week based on real data',
      ],
    },
    roi_teaser: {
      badge: '💸 Daily avoidable losses',
      title: 'Every day without MAGHAREBIT is a day you lose money',
      sub: 'The average Moroccan merchant loses between 800 and 3,000 MAD per month due to:',
      loss1: 'Untracked waste in bakery and restaurant — without reports you cannot see where your inventory goes',
      loss2: 'Cashier mistakes and till mismatches — without real-time oversight you only find out when you check',
      loss3: 'Stock orders by guesswork — you buy too much or run out at the worst time',
      result_intro: 'With MAGHAREBIT:',
      result1: '-23% waste in the first 3 months (customer average)',
      result2: '+18% margin uncovered by reports',
      result3: '-2 hours of manual work every day',
    },
    tour_pos: {
      basket_title: 'Basket',
      total_label: 'Total',
      checkout_btn: 'Checkout',
    },
    tour_inventory: {
      title: 'Live inventory',
      col_product: 'Product',
      col_qty: 'Quantity',
      col_status: 'Status',
      col_updated: 'Last update',
      rows: [
        { product: 'Mint tea', qty: '48 units', status: 'Active', dot: '🟢', updated: '2 min ago' },
        { product: 'Croissant', qty: '23 units', status: 'Active', dot: '🟢', updated: '5 min ago' },
        { product: 'Orange juice', qty: '8 L', status: 'Low', dot: '🟡', updated: '10 min ago' },
        { product: 'Lettuce', qty: '2 kg', status: 'Critical', dot: '🔴', updated: '1h ago' },
      ],
      alert: '4 products to reorder',
    },
    tour_analytics: {
      header: 'Sales this week',
      total_value: 'MAD 8,307',
      top_product_label: 'Top product',
      top_product_value: 'Croissant — 142 units',
      peak_label: 'Peak hour',
      peak_value: '10:00–12:00',
      growth_label: 'vs last week',
      growth_value: '+12%',
      days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    },
    map: {
      hover_count_suffix: 'merchants',
      hover_link: 'View merchants',
    },
  },
};

// Deep-merge helper — arrays are replaced wholesale; objects merged recursively
function mergeDeep(target, source) {
  if (Array.isArray(source)) {
    // Merge arrays element-by-element so we don't blow away other features
    const out = Array.isArray(target) ? [...target] : [];
    source.forEach((item, i) => {
      out[i] = item && typeof item === 'object' && !Array.isArray(item) && out[i] && typeof out[i] === 'object'
        ? mergeDeep(out[i], item)
        : item;
    });
    return out;
  }
  if (source && typeof source === 'object') {
    const out = { ...(target ?? {}) };
    for (const [k, v] of Object.entries(source)) {
      out[k] = mergeDeep(out[k], v);
    }
    return out;
  }
  return source;
}

for (const locale of ['ar', 'fr', 'en']) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const current = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const merged = mergeDeep(current, ADDITIONS[locale]);
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  console.log(`Updated ${locale}.json`);
}
