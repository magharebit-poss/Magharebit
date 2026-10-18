export interface ComparisonRow {
  aspect: Record<string, string>;
  competitor: Record<string, string>;
  magharebit: Record<string, string>;
}

export interface SectorData {
  slug: string;
  emoji: string;
  gradient: string;
  name: Record<string, string>;
  tagline: Record<string, string>;
  painPoints: Record<string, string[]>;
  features: Record<string, string[]>;
  comparison: ComparisonRow[];
  testimonial: {
    quote: Record<string, string>;
    name: string;
    role: Record<string, string>;
    initials: string;
  };
  meta: {
    title: Record<string, string>;
    desc: Record<string, string>;
  };
  // Sector-specific pre-filled WhatsApp opener. Used by the sector page
  // bottom CTA to send a natural-sounding context-rich first message.
  whatsappMessage: Record<string, string>;
  // Optional Moroccan market context paragraph (Darija/FR/EN).
  // Used on sector pages to show hyper-local relevance to Moroccan merchants.
  moroccanContext?: Record<string, string>;
}

export const SECTORS: SectorData[] = [
  {
    slug: 'boulangerie',
    emoji: '🥖',
    gradient: 'linear-gradient(135deg, #7C3F00 0%, #C76B00 50%, #E8A020 100%)',
    name: {
      ar: 'المخابز والحلويات',
      fr: 'Boulangeries & pâtisseries',
      en: 'Bakeries & pastry shops',
    },
    tagline: {
      ar: 'إدارة الإنتاج اليومي، تتبع المكونات، ومواجهة ساعات الذروة بسهولة.',
      fr: 'Gérez la production quotidienne, suivez les ingrédients et affrontez les heures de pointe facilement.',
      en: 'Manage daily production, track ingredients and handle rush hours with ease.',
    },
    painPoints: {
      ar: [
        'المخزون اليدوي للطحين والسكر والزبدة يستغرق ساعات ويُفضي إلى أخطاء',
        'نفاد مادة أساسية في منتصف الإنتاج يوقف العمل بالكامل',
        'حساب الهدر اليومي يدوياً يُعيق قرارات الإنتاج الذكية',
      ],
      fr: [
        'Le suivi manuel de la farine, sucre et beurre prend des heures et génère des erreurs',
        'La rupture d\'une matière première en pleine production arrête tout le travail',
        'Calculer manuellement les invendus quotidiens empêche des décisions de production intelligentes',
      ],
      en: [
        'Manual tracking of flour, sugar and butter takes hours and leads to errors',
        'Running out of a key ingredient mid-production stops all operations',
        'Calculating daily waste manually prevents smart production decisions',
      ],
    },
    features: {
      ar: [
        '🔗 وصفات رقمية مرتبطة بالمخزون — خصم تلقائي لكل مكوّن عند البيع',
        '🔔 تنبيهات فورية عند نفاد الطحين أو السكر أو أي مادة أولية',
        '📊 تقارير الهدر اليومية مع توصيات لتحسين كميات الإنتاج',
        '⚡ كاشير سريع الاستجابة يدعم الميزان والباركود والعربية الكاملة',
        '📡 يعمل بالكامل بدون إنترنت — لا توقف حتى عند انقطاع الشبكة',
      ],
      fr: [
        '🔗 Recettes numériques liées au stock — déduction automatique de chaque ingrédient à la vente',
        '🔔 Alertes instantanées quand la farine, le sucre ou toute matière première manque',
        '📊 Rapports quotidiens sur les invendus avec recommandations pour optimiser la production',
        '⚡ Caisse ultra-rapide avec support balance, code-barres et interface arabe complète',
        '📡 Fonctionne entièrement hors ligne — aucune interruption même sans réseau',
      ],
      en: [
        '🔗 Digital recipes linked to stock — automatic ingredient deduction at every sale',
        '🔔 Instant alerts when flour, sugar or any raw material runs low',
        '📊 Daily waste reports with recommendations to optimise production quantities',
        '⚡ Lightning-fast POS with scale, barcode and full Arabic interface support',
        '📡 Works completely offline — no interruption even when the network is down',
      ],
    },
    comparison: [
      {
        aspect: { ar: 'تتبع المخزون', fr: 'Suivi des stocks', en: 'Stock tracking' },
        competitor: { ar: 'جداول Excel يدوية تستغرق ساعات', fr: 'Tableaux Excel manuels, des heures de travail', en: 'Manual Excel sheets taking hours' },
        magharebit: { ar: 'تلقائي مع كل عملية بيع — صفر خطأ', fr: 'Automatique à chaque vente — zéro erreur', en: 'Automatic at every sale — zero errors' },
      },
      {
        aspect: { ar: 'العمل بدون إنترنت', fr: 'Travail hors ligne', en: 'Offline work' },
        competitor: { ar: 'معظم الأنظمة تتوقف عند انقطاع الشبكة', fr: 'La plupart des systèmes s\'arrêtent sans réseau', en: 'Most systems stop without network' },
        magharebit: { ar: 'يعمل بالكامل بدون إنترنت في أي وقت', fr: 'Fonctionne entièrement hors ligne à tout moment', en: 'Works fully offline at any time' },
      },
      {
        aspect: { ar: 'دعم اللغة العربية', fr: 'Support de l\'arabe', en: 'Arabic language support' },
        competitor: { ar: 'واجهة فرنسية أو إنجليزية فقط', fr: 'Interface uniquement en français ou anglais', en: 'French or English interface only' },
        magharebit: { ar: 'واجهة عربية أصيلة من اليمين لليسار', fr: 'Interface arabe native de droite à gauche', en: 'Native RTL Arabic interface' },
      },
    ],
    testimonial: {
      quote: {
        ar: 'منذ استخدامنا لـ MAGHAREBIT، أصبح تتبع مخزون الطحين والزبدة تلقائياً. لم نعد نفاجأ بنفاد مادة في منتصف الإنتاج.',
        fr: 'Depuis MAGHAREBIT, le suivi de la farine et du beurre est automatique. On n\'est plus surpris par une rupture en pleine production.',
        en: 'Since MAGHAREBIT, flour and butter tracking is automatic. We are never caught off guard by a shortage mid-production.',
      },
      name: 'محمد العمراني',
      role: {
        ar: 'صاحب مخبزة الأمراني، الدار البيضاء',
        fr: 'Propriétaire de la Boulangerie Amrani, Casablanca',
        en: 'Owner of Amrani Bakery, Casablanca',
      },
      initials: 'MA',
    },
    meta: {
      title: {
        ar: 'MAGHAREBIT POS للمخابز والحلويات | إدارة الإنتاج والمكونات',
        fr: 'MAGHAREBIT POS pour Boulangeries | Gestion production et ingrédients',
        en: 'MAGHAREBIT POS for Bakeries | Production and ingredient management',
      },
      desc: {
        ar: 'نظام نقطة بيع مخصص للمخابز المغربية — وصفات رقمية، تتبع المكونات، تقارير الهدر، يعمل بدون إنترنت.',
        fr: 'Logiciel de caisse pour boulangeries marocaines — recettes numériques, suivi ingrédients, rapports invendus, hors ligne.',
        en: 'POS system for Moroccan bakeries — digital recipes, ingredient tracking, waste reports, offline-first.',
      },
    },
    whatsappMessage: {
      ar: 'السلام عليكم، عندي مخبزة وبغيت نعرف كيف MAGHAREBIT يساعدني في تتبع الهدر والمخزون',
      fr: 'Bonjour, je tiens une boulangerie et je voudrais comprendre comment MAGHAREBIT peut m\'aider à suivre le hedr et le stock',
      en: 'Hello, I run a bakery and would like to know how MAGHAREBIT can help me track waste and inventory',
    },
    moroccanContext: {
      ar: 'المخبزة المغربية عندها تحدي كبير: الهدر اليومي في الخبز والمعجنات يأكل الأرباح بشكل صامت. MAGHAREBIT يسجل كل خسارة — منتهي الصلاحية، تالف، هدر التحضير — حتى تعرف بالضبط أين يروح مالك.',
      fr: "La boulangerie marocaine a un défi majeur : le hedr quotidien en pain et pâtisseries grignote les marges en silence. MAGHAREBIT enregistre chaque perte — périmé, avarié, perte de préparation — pour que vous sachiez exactement où va votre argent.",
      en: 'The Moroccan bakery faces a silent challenge: daily waste in bread and pastries quietly eats into margins. MAGHAREBIT logs every loss — expired, spoiled, prep waste — so you know exactly where your money goes.',
    },
  },
  {
    slug: 'epicerie',
    emoji: '🛒',
    gradient: 'linear-gradient(135deg, #14532D 0%, #15803D 50%, #86EFAC 100%)',
    name: {
      ar: 'البقالة والسوبرماركت',
      fr: 'Épiceries & supermarchés',
      en: 'Groceries & supermarkets',
    },
    tagline: {
      ar: 'باركود فوري، مخزون دقيق، وتتبع ديون الموردين في مكان واحد.',
      fr: 'Code-barres instantané, stock précis et suivi des dettes fournisseurs en un seul endroit.',
      en: 'Instant barcode scanning, accurate stock and supplier debt tracking all in one place.',
    },
    painPoints: {
      ar: [
        'آلاف المنتجات تجعل الجرد اليدوي مستحيلاً وتخمين الطلب مكلفاً',
        'ديون الموردين المتراكمة بدون تتبع منظم تُعقّد التدفق النقدي',
        'تسعير يدوي لمئات المنتجات يستهلك وقتاً ويُدخل أخطاء',
      ],
      fr: [
        'Des milliers de produits rendent l\'inventaire manuel impossible et la prévision de la demande coûteuse',
        'Les dettes fournisseurs accumulées sans suivi organisé compliquent la trésorerie',
        'Saisir manuellement les prix de centaines de produits prend du temps et génère des erreurs',
      ],
      en: [
        'Thousands of products make manual inventory impossible and demand forecasting costly',
        'Accumulated supplier debts without organised tracking complicate cash flow',
        'Manually pricing hundreds of products wastes time and introduces errors',
      ],
    },
    features: {
      ar: [
        '📷 قراءة باركود فائقة السرعة لآلاف المنتجات بنقرة واحدة',
        '📦 تحديث المخزون الفوري — تنبيهات نفاد تلقائية لكل صنف',
        '🤝 إدارة ديون الموردين مع سجل تفصيلي لكل مورد',
        '🏷️ تحديث الأسعار الجماعي بثوانٍ بدلاً من ساعات',
        '📡 يعمل بدون إنترنت — المبيعات لا تتوقف أبداً',
      ],
      fr: [
        '📷 Scan de code-barres ultra-rapide pour des milliers de produits en un clic',
        '📦 Mise à jour instantanée du stock — alertes de rupture automatiques pour chaque article',
        '🤝 Gestion des dettes fournisseurs avec historique détaillé par fournisseur',
        '🏷️ Mise à jour des prix en masse en secondes, pas en heures',
        '📡 Fonctionne hors ligne — les ventes ne s\'arrêtent jamais',
      ],
      en: [
        '📷 Ultra-fast barcode scanning for thousands of products in one tap',
        '📦 Instant stock updates — automatic low-stock alerts for every item',
        '🤝 Supplier debt management with detailed history per supplier',
        '🏷️ Bulk price updates in seconds, not hours',
        '📡 Works offline — sales never stop',
      ],
    },
    comparison: [
      {
        aspect: { ar: 'قراءة الباركود', fr: 'Scan code-barres', en: 'Barcode scanning' },
        competitor: { ar: 'بطيء ومتقطع مع آلاف المنتجات', fr: 'Lent et intermittent avec des milliers de produits', en: 'Slow and intermittent with thousands of products' },
        magharebit: { ar: 'فوري وموثوق حتى مع 50,000 صنف', fr: 'Instantané et fiable jusqu\'à 50 000 références', en: 'Instant and reliable with up to 50,000 items' },
      },
      {
        aspect: { ar: 'إدارة الموردين', fr: 'Gestion fournisseurs', en: 'Supplier management' },
        competitor: { ar: 'لا يوجد — الديون تُسجَّل في دفاتر ورقية', fr: 'Absent — les dettes dans des carnets papier', en: 'None — debts tracked in paper notebooks' },
        magharebit: { ar: 'سجل كامل لكل مورد مع تاريخ الديون والمدفوعات', fr: 'Historique complet par fournisseur avec dettes et paiements', en: 'Full history per supplier with debts and payments' },
      },
      {
        aspect: { ar: 'تحديث الأسعار', fr: 'Mise à jour des prix', en: 'Price updates' },
        competitor: { ar: 'يدوي منتج بمنتج — يستهلك ساعات', fr: 'Manuel produit par produit — des heures perdues', en: 'Manual product by product — hours wasted' },
        magharebit: { ar: 'تحديث جماعي في ثوانٍ بضغطة واحدة', fr: 'Mise à jour en masse en quelques secondes', en: 'Bulk update in seconds with one click' },
      },
    ],
    testimonial: {
      quote: {
        ar: 'كان الجرد يأخذ منا يوماً كاملاً كل أسبوع. الآن مع MAGHAREBIT أعرف المخزون الحقيقي بضغطة زر.',
        fr: 'L\'inventaire nous prenait une journée entière chaque semaine. Avec MAGHAREBIT, je connais le stock réel en un clic.',
        en: 'Inventory used to take us a full day every week. With MAGHAREBIT I know the real stock in one tap.',
      },
      name: 'فاطمة بنعلي',
      role: {
        ar: 'صاحبة سوبرماركت، سلا',
        fr: 'Propriétaire d\'un supermarché, Salé',
        en: 'Supermarket owner, Salé',
      },
      initials: 'FB',
    },
    meta: {
      title: {
        ar: 'MAGHAREBIT POS للبقالة | مخزون، باركود، ديون الموردين',
        fr: 'MAGHAREBIT POS pour Épiceries | Stock, code-barres, dettes fournisseurs',
        en: 'MAGHAREBIT POS for Groceries | Stock, barcode, supplier debts',
      },
      desc: {
        ar: 'نظام نقطة بيع للبقالة المغربية — قراءة باركود، تتبع المخزون الفوري، إدارة الموردين، يعمل بدون إنترنت.',
        fr: 'Caisse pour épiceries marocaines — scan code-barres, stock temps réel, gestion fournisseurs, hors ligne.',
        en: 'POS for Moroccan groceries — barcode scanning, real-time stock, supplier management, offline-first.',
      },
    },
    whatsappMessage: {
      ar: 'السلام عليكم، عندي بقالة وبغيت نشوف كيف MAGHAREBIT يخدم مع الباركود وديون الموردين',
      fr: 'Bonjour, j\'ai une épicerie et je voudrais voir comment MAGHAREBIT fonctionne pour le scan code-barres et la gestion des dettes fournisseurs',
      en: 'Hello, I run a grocery store and want to see how MAGHAREBIT works for barcode scanning and supplier debt tracking',
    },
  },
  {
    slug: 'cafe-restaurant',
    emoji: '☕',
    gradient: 'linear-gradient(135deg, #1E1008 0%, #6B3A1F 50%, #C2692A 100%)',
    name: {
      ar: 'المقاهي والمطاعم',
      fr: 'Cafés & restaurants',
      en: 'Cafés & restaurants',
    },
    tagline: {
      ar: 'طلبات الطاولات، تتبع الوصفات، وتقارير المبيعات — كل شيء في نقطة بيع واحدة.',
      fr: 'Commandes de table, suivi des recettes et rapports de ventes — tout en un seul système de caisse.',
      en: 'Table orders, recipe tracking and sales reports — everything in one POS.',
    },
    painPoints: {
      ar: [
        'إدارة طلبات طاولات متعددة في آنٍ واحد يُشتت الموظفين ويُبطئ الخدمة',
        'تكلفة كل وصفة مجهولة — أسعار القائمة تُحدَّد بالحدس لا بالأرقام',
        'ساعات الذروة (الغداء والعشاء) تحتاج نظاماً سريعاً لا يحتمل أي تعطل',
      ],
      fr: [
        'Gérer simultanément plusieurs commandes de table distrait le personnel et ralentit le service',
        'Le coût de chaque recette est inconnu — les prix de la carte sont fixés à l\'intuition, pas aux chiffres',
        'Les heures de pointe (déjeuner et dîner) nécessitent un système rapide qui ne peut pas tomber en panne',
      ],
      en: [
        'Managing multiple table orders simultaneously distracts staff and slows service',
        'The cost of each recipe is unknown — menu prices are set by intuition, not numbers',
        'Peak hours (lunch and dinner) require a fast system that cannot afford any downtime',
      ],
    },
    features: {
      ar: [
        '🍽️ إدارة الطاولات والطلبات — عدة طاولات في وقت واحد بدون تشويش',
        '📋 وصفات رقمية تحسب تكلفة كل طبق تلقائياً مع تغيرات الأسعار',
        '⚡ كاشير سريع بواجهة عربية لضمان أقصى سرعة في ساعات الذروة',
        '📊 تقارير المبيعات اليومية: الأطباق الأكثر طلباً وأوقات الذروة',
        '📡 وضع عدم الاتصال الكامل — لا توقف أبداً حتى عند انقطاع الشبكة',
      ],
      fr: [
        '🍽️ Gestion des tables et commandes — plusieurs tables simultanément sans confusion',
        '📋 Recettes numériques calculant automatiquement le coût de chaque plat selon les prix du marché',
        '⚡ Caisse rapide en interface arabe pour une vitesse maximale aux heures de pointe',
        '📊 Rapports de ventes quotidiens : plats les plus demandés et créneaux horaires de pointe',
        '📡 Mode hors ligne complet — aucune interruption même sans réseau',
      ],
      en: [
        '🍽️ Table and order management — multiple tables simultaneously without confusion',
        '📋 Digital recipes automatically calculating each dish\'s cost as prices change',
        '⚡ Fast Arabic-interface POS for maximum speed during rush hours',
        '📊 Daily sales reports: most popular dishes and peak time slots',
        '📡 Full offline mode — no downtime even when the network is unavailable',
      ],
    },
    comparison: [
      {
        aspect: { ar: 'إدارة الطاولات', fr: 'Gestion des tables', en: 'Table management' },
        competitor: { ar: 'أوراق طلب يدوية وفرصة كبيرة للخطأ', fr: 'Bons de commande papier et risque élevé d\'erreur', en: 'Paper order slips with high error risk' },
        magharebit: { ar: 'طاولات رقمية في الوقت الفعلي — لا أخطاء', fr: 'Tables numériques en temps réel — zéro erreur', en: 'Real-time digital tables — zero errors' },
      },
      {
        aspect: { ar: 'تكلفة الوصفات', fr: 'Coût des recettes', en: 'Recipe costing' },
        competitor: { ar: 'يُحسب بالتخمين أو بجداول Excel منفصلة', fr: 'Calculé au pifomètre ou dans des Excel séparés', en: 'Guessed or calculated in separate Excel sheets' },
        magharebit: { ar: 'يُحسب تلقائياً مع كل بيع وتغيير سعر', fr: 'Calculé automatiquement à chaque vente et changement de prix', en: 'Calculated automatically at every sale and price change' },
      },
      {
        aspect: { ar: 'التشغيل بدون شبكة', fr: 'Fonctionnement sans réseau', en: 'Operation without network' },
        competitor: { ar: 'توقف كامل عند انقطاع الإنترنت', fr: 'Arrêt complet en cas de coupure Internet', en: 'Complete stop on internet outage' },
        magharebit: { ar: 'المبيعات تستمر دون أي انقطاع', fr: 'Les ventes continuent sans aucune interruption', en: 'Sales continue with no interruption' },
      },
    ],
    testimonial: {
      quote: {
        ar: 'في أوقات الغداء كنا نخطئ الطلبات بسبب الضغط. MAGHAREBIT جعل الموظفين أسرع وأدق. الزبائن لاحظوا الفرق.',
        fr: 'À l\'heure du déjeuner on faisait des erreurs de commandes à cause de la pression. MAGHAREBIT a rendu le personnel plus rapide et précis. Les clients ont remarqué la différence.',
        en: 'At lunchtime we made order mistakes under pressure. MAGHAREBIT made staff faster and more accurate. Customers noticed the difference.',
      },
      name: 'يوسف الحسيني',
      role: {
        ar: 'صاحب مطعم بالرباط',
        fr: 'Propriétaire d\'un restaurant à Rabat',
        en: 'Restaurant owner in Rabat',
      },
      initials: 'YH',
    },
    meta: {
      title: {
        ar: 'MAGHAREBIT POS للمقاهي والمطاعم | طلبات الطاولات والوصفات',
        fr: 'MAGHAREBIT POS pour Cafés et Restaurants | Commandes table et recettes',
        en: 'MAGHAREBIT POS for Cafés & Restaurants | Table orders and recipes',
      },
      desc: {
        ar: 'نظام كاشير للمطاعم المغربية — إدارة الطاولات، وصفات رقمية، تقارير مبيعات، يعمل بدون إنترنت.',
        fr: 'Caisse pour restaurants marocains — gestion des tables, recettes numériques, rapports ventes, hors ligne.',
        en: 'POS for Moroccan restaurants — table management, digital recipes, sales reports, offline-first.',
      },
    },
    whatsappMessage: {
      ar: 'السلام عليكم، عندي قهوة/مطعم وبغيت نشوف كيف يخدم MAGHAREBIT معي في الطاولات وتكلفة الوصفات',
      fr: 'Bonjour, j\'ai un café/restaurant et je voudrais voir comment MAGHAREBIT gère les tables et le coût des recettes',
      en: 'Hello, I have a café/restaurant and would like to see how MAGHAREBIT handles tables and recipe costing',
    },
    moroccanContext: {
      ar: 'القهوة والمطعم المغربي لهم ضغط حقيقي: الفطور والغداء في ساعة واحدة، وزبناء ينتظرون بدون صبر. الكاشير يلزمو يكون سريع بلا أخطاء، والبترون يشوف المبيعات من تيليفونه بدون ما يكون حاضر. MAGHAREBIT معمول لهاد النمط بالضبط.',
      fr: "Le café-restaurant marocain vit sous pression réelle: le ftour et le déjeuner à la même heure, des clients qui n'attendent pas. La caisse doit être rapide et sans erreur, et le patron doit voir ses ventes depuis son téléphone sans être sur place. MAGHAREBIT est conçu pour exactement ça.",
      en: 'The Moroccan café-restaurant operates under real pressure: ftour and lunch rush at the same hour, impatient customers. The POS must be fast and error-free, and the owner must see sales from their phone without being present. MAGHAREBIT is built exactly for this.',
    },
  },
  {
    slug: 'salon-beaute',
    emoji: '💄',
    gradient: 'linear-gradient(135deg, #4A0040 0%, #9B2F7A 50%, #E879B0 100%)',
    name: {
      ar: 'صالونات التجميل',
      fr: 'Salons de beauté',
      en: 'Beauty salons',
    },
    tagline: {
      ar: 'مخزون المنتجات، سجل المبيعات، وتتبع ولاء العملاء — كل ما يحتاجه صالونك.',
      fr: 'Stock produits, historique des ventes et fidélisation clients — tout ce dont votre salon a besoin.',
      en: 'Product stock, sales history and customer loyalty tracking — everything your salon needs.',
    },
    painPoints: {
      ar: [
        'مخزون منتجات التجميل (كريمات، أصباغ، ...)  يفوت الانتباه حتى ينفد في أسوأ الأوقات',
        'لا سجل منظم لمشتريات العملاء المتكررين يجعل الولاء برنامجاً مستحيلاً',
        'إدارة المبيعات يدوياً في صالون مزدحم تُشتت التركيز عن الخدمة الأساسية',
      ],
      fr: [
        'Le stock de produits de beauté (crèmes, colorants…) échappe à l\'attention jusqu\'à la rupture au pire moment',
        'Aucun historique organisé des achats des clients réguliers rend un programme de fidélité impossible',
        'Gérer les ventes manuellement dans un salon animé distrait du service principal',
      ],
      en: [
        'Beauty product stock (creams, dyes…) goes unnoticed until it runs out at the worst moment',
        'No organised record of regular customers\' purchases makes a loyalty programme impossible',
        'Managing sales manually in a busy salon distracts from the core service',
      ],
    },
    features: {
      ar: [
        '💅 مخزون منتجات التجميل مع تنبيهات نفاد تلقائية',
        '👤 سجل عملاء تفصيلي: تاريخ المشتريات، التفضيلات، ولاء مكتسب',
        '💳 مدفوعات مرنة: نقداً، بطاقة، أو حساب مفتوح',
        '📊 تقارير المبيعات اليومية: أكثر الخدمات والمنتجات طلباً',
        '⚡ كاشير سريع بعربية كاملة، يعمل بدون إنترنت',
      ],
      fr: [
        '💅 Stock de produits de beauté avec alertes de rupture automatiques',
        '👤 Fiche client détaillée : historique achats, préférences, points fidélité',
        '💳 Paiements flexibles : espèces, carte ou compte ouvert',
        '📊 Rapports de ventes quotidiens : services et produits les plus demandés',
        '⚡ Caisse rapide en arabe complet, fonctionne hors ligne',
      ],
      en: [
        '💅 Beauty product stock with automatic low-stock alerts',
        '👤 Detailed customer profiles: purchase history, preferences, loyalty points',
        '💳 Flexible payments: cash, card or open account',
        '📊 Daily sales reports: most in-demand services and products',
        '⚡ Fast full-Arabic POS, works offline',
      ],
    },
    comparison: [
      {
        aspect: { ar: 'مخزون المنتجات', fr: 'Stock produits', en: 'Product stock' },
        competitor: { ar: 'لا يوجد — يُكتشف النفاد عند الحاجة', fr: 'Absent — la rupture se découvre sur le moment', en: 'None — stock-out discovered when needed' },
        magharebit: { ar: 'تنبيهات فورية عند اقتراب النفاد', fr: 'Alertes instantanées avant la rupture', en: 'Instant alerts before stock runs out' },
      },
      {
        aspect: { ar: 'ملف العملاء', fr: 'Fiche client', en: 'Customer profile' },
        competitor: { ar: 'لا سجل — كل زيارة تبدأ من الصفر', fr: 'Pas d\'historique — chaque visite repart de zéro', en: 'No record — every visit starts from scratch' },
        magharebit: { ar: 'سجل مشتريات وتفضيلات لكل عميلة', fr: 'Historique achats et préférences pour chaque cliente', en: 'Purchase history and preferences for every client' },
      },
      {
        aspect: { ar: 'تقارير الأداء', fr: 'Rapports de performance', en: 'Performance reports' },
        competitor: { ar: 'غير متوفرة — لا معرفة بأكثر الخدمات مبيعاً', fr: 'Inexistants — aucune connaissance des meilleures ventes', en: 'Unavailable — no insight into top-selling services' },
        magharebit: { ar: 'تقارير يومية بأكثر الخدمات والمنتجات طلباً', fr: 'Rapports quotidiens des services et produits les plus demandés', en: 'Daily reports on top services and products' },
      },
    ],
    testimonial: {
      quote: {
        ar: 'أصبحت أعرف متى أطلب صباغة الشعر قبل نفادها، وعميلاتي الدائمات يشعرن أنني أتذكرهن. MAGHAREBIT فرق حقيقي.',
        fr: 'Je sais maintenant quand commander la teinture avant qu\'elle manque, et mes clientes régulières sentent que je les reconnais. MAGHAREBIT fait vraiment la différence.',
        en: 'I now know when to order hair dye before it runs out, and my regular clients feel remembered. MAGHAREBIT makes a real difference.',
      },
      name: 'سلمى المنصوري',
      role: {
        ar: 'صاحبة صالون تجميل، فاس',
        fr: 'Propriétaire d\'un salon de beauté, Fès',
        en: 'Beauty salon owner, Fez',
      },
      initials: 'SM',
    },
    meta: {
      title: {
        ar: 'MAGHAREBIT POS لصالونات التجميل | مخزون ولاء العملاء',
        fr: 'MAGHAREBIT POS pour Salons de Beauté | Stock et fidélisation',
        en: 'MAGHAREBIT POS for Beauty Salons | Stock and customer loyalty',
      },
      desc: {
        ar: 'نظام كاشير لصالونات التجميل المغربية — مخزون منتجات، ولاء عملاء، تقارير مبيعات، يعمل بدون إنترنت.',
        fr: 'Caisse pour salons de beauté marocains — stock produits, fidélité clients, rapports ventes, hors ligne.',
        en: 'POS for Moroccan beauty salons — product stock, customer loyalty, sales reports, offline-first.',
      },
    },
    whatsappMessage: {
      ar: 'السلام عليكم، عندي صالون تجميل وبغيت نعرف كيف MAGHAREBIT يساعدني في تتبع المنتجات وملفات العميلات',
      fr: 'Bonjour, j\'ai un salon de beauté et je voudrais comprendre comment MAGHAREBIT m\'aide à suivre les produits et les fiches clientes',
      en: 'Hello, I run a beauty salon and want to learn how MAGHAREBIT helps with product tracking and customer profiles',
    },
  },
  {
    slug: 'boutique-vetements',
    emoji: '👗',
    gradient: 'linear-gradient(135deg, #1A1035 0%, #4C1D95 50%, #7C3AED 100%)',
    name: {
      ar: 'محلات الملابس',
      fr: 'Boutiques de vêtements',
      en: 'Clothing boutiques',
    },
    tagline: {
      ar: 'إدارة الأحجام والألوان، تقارير موسمية، ومزامنة الفروع — للبوتيك الحديث.',
      fr: 'Gestion des tailles et couleurs, rapports saisonniers et synchronisation des succursales — pour la boutique moderne.',
      en: 'Size and colour management, seasonal reports and branch sync — for the modern boutique.',
    },
    painPoints: {
      ar: [
        'تتبع كل مقاس ولون لكل صنف يدوياً أمر مُرهِق ومصدر دائم للأخطاء',
        'الموسمية الحادة في الملابس تجعل التنبؤ بالمخزون تحدياً بدون بيانات تاريخية',
        'فروع متعددة بدون مزامنة تعني مخزوناً مشتتاً وعمليات نقل بطيئة',
      ],
      fr: [
        'Suivre manuellement chaque taille et couleur pour chaque article est épuisant et source d\'erreurs constantes',
        'La forte saisonnalité des vêtements rend la prévision de stock un défi sans données historiques',
        'Plusieurs succursales sans synchronisation signifient un stock dispersé et des transferts lents',
      ],
      en: [
        'Manually tracking every size and colour for each item is exhausting and a constant source of errors',
        'The strong seasonality of clothing makes stock forecasting a challenge without historical data',
        'Multiple branches without sync mean scattered inventory and slow transfers',
      ],
    },
    features: {
      ar: [
        '👗 إدارة الأحجام والألوان لكل صنف: S/M/L/XL × ألوان متعددة',
        '📈 تقارير موسمية: الأصناف الأكثر مبيعاً حسب الفصل والحدث',
        '🔄 مزامنة المخزون بين الفروع بنقرة واحدة',
        '🏷️ طباعة ملصقات الأسعار والباركود مباشرة من النظام',
        '📡 يعمل بدون إنترنت — المبيعات تستمر في أي ظرف',
      ],
      fr: [
        '👗 Gestion tailles et couleurs pour chaque article : S/M/L/XL × plusieurs coloris',
        '📈 Rapports saisonniers : articles les plus vendus par saison et événement',
        '🔄 Synchronisation du stock entre succursales en un clic',
        '🏷️ Impression d\'étiquettes prix et code-barres directement depuis le système',
        '📡 Fonctionne hors ligne — les ventes continuent en toutes circonstances',
      ],
      en: [
        '👗 Size and colour management per item: S/M/L/XL × multiple colours',
        '📈 Seasonal reports: top-selling items by season and event',
        '🔄 Stock synchronisation across branches in one click',
        '🏷️ Price tag and barcode label printing directly from the system',
        '📡 Works offline — sales continue in any circumstance',
      ],
    },
    comparison: [
      {
        aspect: { ar: 'إدارة المقاسات والألوان', fr: 'Gestion tailles et couleurs', en: 'Size & colour management' },
        competitor: { ar: 'مستحيل — الأنظمة العادية لا تدعمه', fr: 'Impossible — les systèmes classiques ne le gèrent pas', en: 'Impossible — standard systems don\'t support it' },
        magharebit: { ar: 'كل مقاس ولون بمخزون مستقل وتنبيهات', fr: 'Chaque taille et couleur avec stock indépendant et alertes', en: 'Each size and colour with independent stock and alerts' },
      },
      {
        aspect: { ar: 'التقارير الموسمية', fr: 'Rapports saisonniers', en: 'Seasonal reports' },
        competitor: { ar: 'لا تتبع للأداء الموسمي — قرارات بالحدس', fr: 'Pas de suivi saisonnier — décisions à l\'intuition', en: 'No seasonal tracking — decisions by gut feeling' },
        magharebit: { ar: 'تقارير تفصيلية حسب الموسم والفصل', fr: 'Rapports détaillés par saison et par période', en: 'Detailed reports by season and period' },
      },
      {
        aspect: { ar: 'مزامنة الفروع', fr: 'Synchronisation succursales', en: 'Branch synchronisation' },
        competitor: { ar: 'يدوية وبطيئة — خطر التضارب في المخزون', fr: 'Manuelle et lente — risque de conflits de stock', en: 'Manual and slow — risk of stock conflicts' },
        magharebit: { ar: 'آنية تلقائية عبر كل الفروع بنقرة واحدة', fr: 'Synchronisation automatique en temps réel sur toutes les succursales', en: 'Automatic real-time sync across all branches' },
      },
    ],
    testimonial: {
      quote: {
        ar: 'كنت أحتاج ساعتين لمعرفة ما تبقى من كل مقاس. الآن MAGHAREBIT يعطيني الجواب في ثوانٍ، وأنا أخطط للموسم القادم بثقة.',
        fr: 'Il me fallait deux heures pour savoir ce qu\'il restait dans chaque taille. Maintenant MAGHAREBIT me répond en secondes et je planifie la prochaine saison avec confiance.',
        en: 'It used to take two hours to know what was left in each size. Now MAGHAREBIT answers in seconds and I plan the next season with confidence.',
      },
      name: 'نور الحوات',
      role: {
        ar: 'صاحبة بوتيك ملابس، مراكش',
        fr: 'Propriétaire d\'une boutique de vêtements, Marrakech',
        en: 'Clothing boutique owner, Marrakech',
      },
      initials: 'NH',
    },
    meta: {
      title: {
        ar: 'MAGHAREBIT POS لمحلات الملابس | مقاسات، ألوان، فروع',
        fr: 'MAGHAREBIT POS pour Boutiques Vêtements | Tailles, couleurs, succursales',
        en: 'MAGHAREBIT POS for Clothing Boutiques | Sizes, colours, branches',
      },
      desc: {
        ar: 'نظام كاشير لمحلات الملابس المغربية — إدارة المقاسات والألوان، مزامنة الفروع، تقارير موسمية.',
        fr: 'Caisse pour boutiques de vêtements marocaines — gestion tailles-couleurs, sync succursales, rapports saisonniers.',
        en: 'POS for Moroccan clothing boutiques — size-colour management, branch sync, seasonal reports.',
      },
    },
    whatsappMessage: {
      ar: 'السلام عليكم، عندي بوتيك ملابس وبغيت نشوف كيف MAGHAREBIT يدبّر المقاسات والألوان والفروع',
      fr: 'Bonjour, j\'ai une boutique de vêtements et je voudrais voir comment MAGHAREBIT gère les tailles, couleurs et succursales',
      en: 'Hello, I have a clothing boutique and want to see how MAGHAREBIT handles sizes, colours and branches',
    },
  },
  {
    slug: 'pharmacie',
    emoji: '💊',
    gradient: 'linear-gradient(135deg, #0C2340 0%, #1A5276 50%, #2E86C1 100%)',
    name: {
      ar: 'الصيدليات والباراصيدلية',
      fr: 'Pharmacies & parapharmacies',
      en: 'Pharmacies & parapharmacies',
    },
    tagline: {
      ar: 'تتبع تواريخ الصلاحية، مراقبة المخزون، ومراجعات آمنة — لصيدلية لا تتسامح مع الأخطاء.',
      fr: 'Suivi des dates de péremption, contrôle du stock et audits sécurisés — pour une pharmacie qui ne tolère aucune erreur.',
      en: 'Expiry date tracking, stock control and secure audits — for a pharmacy that tolerates no errors.',
    },
    painPoints: {
      ar: [
        'دواء منتهي الصلاحية في الرف خطر قانوني وصحي يتطلب مراقبة يومية دقيقة',
        'مخزون يُعدّ بالمئات من الأصناف يجعل الجرد اليدوي مهمة أسبوعية مُرهِقة',
        'عدم وجود سجل واضح للمبيعات يُعيق اتخاذ قرارات الطلب الصحيحة',
      ],
      fr: [
        'Un médicament périmé en rayon est un risque légal et sanitaire nécessitant une surveillance quotidienne rigoureuse',
        'Un stock de centaines de références rend l\'inventaire manuel une tâche hebdomadaire épuisante',
        'L\'absence d\'un historique clair des ventes empêche de prendre les bonnes décisions de commande',
      ],
      en: [
        'An expired medicine on the shelf is a legal and health risk requiring rigorous daily monitoring',
        'A stock of hundreds of references makes manual inventory an exhausting weekly task',
        'No clear sales history prevents making the right ordering decisions',
      ],
    },
    features: {
      ar: [
        '⏰ تتبع تواريخ الصلاحية — تنبيهات تلقائية قبل انتهاء الصلاحية بـ 30 يوماً',
        '🔍 بحث فوري في آلاف الأصناف بالاسم أو الباركود',
        '📦 تحديث المخزون الفوري مع كل عملية بيع أو استلام شحنة',
        '🔐 مراجعات آمنة ودقيقة: سجل كامل لكل معاملة',
        '📡 يعمل بالكامل بدون إنترنت — لا توقف في أي وقت',
      ],
      fr: [
        '⏰ Suivi des dates de péremption — alertes automatiques 30 jours avant l\'expiration',
        '🔍 Recherche instantanée parmi des milliers de références par nom ou code-barres',
        '📦 Mise à jour instantanée du stock à chaque vente ou réception de livraison',
        '🔐 Audits sécurisés et précis : historique complet de chaque transaction',
        '📡 Fonctionne entièrement hors ligne — aucune interruption à aucun moment',
      ],
      en: [
        '⏰ Expiry date tracking — automatic alerts 30 days before expiration',
        '🔍 Instant search across thousands of references by name or barcode',
        '📦 Instant stock updates with every sale or delivery received',
        '🔐 Secure and accurate audits: complete history of every transaction',
        '📡 Works completely offline — no downtime at any time',
      ],
    },
    comparison: [
      {
        aspect: { ar: 'تتبع الصلاحية', fr: 'Suivi péremption', en: 'Expiry tracking' },
        competitor: { ar: 'فحص يدوي أسبوعي — خطر فوات التواريخ', fr: 'Vérification manuelle hebdomadaire — risque de dates manquées', en: 'Weekly manual check — risk of missed expiry dates' },
        magharebit: { ar: 'تنبيهات تلقائية قبل 30 يوماً لكل صنف', fr: 'Alertes automatiques 30 jours avant pour chaque article', en: 'Automatic alerts 30 days before for every item' },
      },
      {
        aspect: { ar: 'البحث في المنتجات', fr: 'Recherche produits', en: 'Product search' },
        competitor: { ar: 'بحث بطيء في قواعد بيانات غير محسّنة', fr: 'Recherche lente dans des bases non optimisées', en: 'Slow search in non-optimised databases' },
        magharebit: { ar: 'نتائج فورية بالاسم أو الباركود في آلاف الأصناف', fr: 'Résultats instantanés par nom ou code-barres sur des milliers de références', en: 'Instant results by name or barcode across thousands of items' },
      },
      {
        aspect: { ar: 'سجل المعاملات', fr: 'Historique transactions', en: 'Transaction history' },
        competitor: { ar: 'إيصالات ورقية — لا أرشيف رقمي موثوق', fr: 'Reçus papier — pas d\'archive numérique fiable', en: 'Paper receipts — no reliable digital archive' },
        magharebit: { ar: 'سجل كامل ودقيق لكل معاملة بيع أو استلام', fr: 'Historique complet et précis de chaque vente ou réception', en: 'Complete accurate record of every sale and delivery' },
      },
    ],
    testimonial: {
      quote: {
        ar: 'لأول مرة أشعر أن مخزون الصيدلية تحت سيطرتي. تنبيهات الصلاحية أنقذتنا من عدة مشاكل قانونية محتملة.',
        fr: 'Pour la première fois, j\'ai l\'impression de contrôler le stock de la pharmacie. Les alertes de péremption nous ont évité plusieurs problèmes légaux potentiels.',
        en: 'For the first time I feel in control of the pharmacy stock. The expiry alerts have saved us from several potential legal issues.',
      },
      name: 'الدكتورة أمينة الإدريسي',
      role: {
        ar: 'صيدلانية، طنجة',
        fr: 'Pharmacienne, Tanger',
        en: 'Pharmacist, Tangier',
      },
      initials: 'AI',
    },
    meta: {
      title: {
        ar: 'MAGHAREBIT POS للصيدليات | تواريخ الصلاحية والمخزون',
        fr: 'MAGHAREBIT POS pour Pharmacies | Dates de péremption et stock',
        en: 'MAGHAREBIT POS for Pharmacies | Expiry dates and stock control',
      },
      desc: {
        ar: 'نظام كاشير للصيدليات المغربية — تتبع الصلاحية، تحديث المخزون الفوري، مراجعات آمنة، يعمل بدون إنترنت.',
        fr: 'Caisse pour pharmacies marocaines — suivi péremption, stock temps réel, audits sécurisés, hors ligne.',
        en: 'POS for Moroccan pharmacies — expiry tracking, real-time stock, secure audits, offline-first.',
      },
    },
    whatsappMessage: {
      ar: 'السلام عليكم، عندي صيدلية وبغيت نعرف كيف MAGHAREBIT يتعامل مع تواريخ الصلاحية والسجل الكامل',
      fr: 'Bonjour, je suis pharmacien et je voudrais comprendre comment MAGHAREBIT suit les dates de péremption et l\'historique complet',
      en: 'Hello, I run a pharmacy and want to understand how MAGHAREBIT handles expiry tracking and full audit history',
    },
  },
  // ── New high-volume Moroccan sectors ──────────────────────────────────────
  {
    slug: 'boucherie',
    emoji: '🥩',
    gradient: 'linear-gradient(135deg, #4A0F0F 0%, #7F1D1D 50%, #B91C1C 100%)',
    name: {
      ar: 'الجزارة وبيع اللحوم',
      fr: 'Boucherie',
      en: 'Butcher shop',
    },
    tagline: {
      ar: 'بع بالوزن، تتبع المخزون، اربح أكثر',
      fr: 'Vendez au poids, suivez le stock, gagnez plus',
      en: 'Sell by weight, track stock, earn more',
    },
    painPoints: {
      ar: [
        'البيع بالوزن مع ميزان غير متصل يُسبّب أخطاء يومية في الفواتير وفروقات الصندوق',
        'إعادة التموين اليومي بلا سجل دقيق يُربك الطلبيات ويزيد ديون الموردين',
        'تتبع الزبائن الدائمين الذين يشترون بالحساب (الكريدي) بدون نظام يُعقّد المتابعة',
      ],
      fr: [
        'La vente au poids avec une balance non connectée crée des erreurs quotidiennes de facturation et des écarts de caisse',
        'Le réapprovisionnement quotidien sans historique précis désorganise les commandes et fait gonfler les dettes fournisseurs',
        'Suivre les clients réguliers qui achètent à crédit sans système complique le recouvrement',
      ],
      en: [
        'Selling by weight with a disconnected scale creates daily billing errors and till discrepancies',
        'Daily restocking without precise history disrupts orders and inflates supplier debts',
        'Tracking regular customers who buy on credit without a system makes collection harder',
      ],
    },
    features: {
      ar: [
        '⚖️ تكامل مع الميزان الإلكتروني — الوزن يتحوّل تلقائياً إلى سعر',
        '💰 حساب الهامش لحظياً لكل قطعة لحم حسب سعر الشراء',
        '📷 مسح فاتورة المورّد — استيراد آلي للأصناف والكميات',
        '🤝 حسابات العملاء بالكريدي — كل عميلة بسجلّها',
        '📊 تقرير إغلاق يومي على واتساب — صافي الربح والكميات المتبقية',
      ],
      fr: [
        '⚖️ Intégration balance électronique — le poids devient automatiquement un prix',
        '💰 Calcul de marge en temps réel sur chaque pièce selon le prix d\'achat',
        '📷 Scan de facture fournisseur — import automatique des articles et quantités',
        '🤝 Comptes clients à crédit — chaque client avec son historique',
        '📊 Rapport de clôture quotidien sur WhatsApp — bénéfice net et stocks restants',
      ],
      en: [
        '⚖️ Electronic scale integration — weight becomes price automatically',
        '💰 Real-time margin calculation per cut based on purchase price',
        '📷 Supplier invoice scan — automatic import of items and quantities',
        '🤝 Credit customer accounts — each client with their own history',
        '📊 Daily closing report via WhatsApp — net profit and remaining stock',
      ],
    },
    comparison: [
      {
        aspect: { ar: 'البيع بالوزن', fr: 'Vente au poids', en: 'Weight-based selling' },
        competitor: { ar: 'ميزان منفصل — أخطاء يومية', fr: 'Balance séparée — erreurs quotidiennes', en: 'Separate scale — daily errors' },
        magharebit: { ar: 'وزن → سعر تلقائي بدون لمس', fr: 'Poids → prix automatique, zéro saisie', en: 'Weight → automatic price, zero entry' },
      },
      {
        aspect: { ar: 'حساب الهامش', fr: 'Calcul de marge', en: 'Margin calculation' },
        competitor: { ar: 'تخمين — يصعب معرفة الربح الحقيقي', fr: 'Approximation — difficile de connaître la vraie marge', en: 'Guesswork — hard to know real margin' },
        magharebit: { ar: 'دقيق لكل قطعة، لحظياً', fr: 'Précis sur chaque pièce, en temps réel', en: 'Precise per cut, in real time' },
      },
      {
        aspect: { ar: 'كريدي العملاء', fr: 'Crédit clients', en: 'Customer credit' },
        competitor: { ar: 'دفتر ورقي — يضيع بسهولة', fr: 'Carnet papier — se perd facilement', en: 'Paper notebook — easily lost' },
        magharebit: { ar: 'سجل رقمي بكل عملية كريدي', fr: 'Historique numérique de chaque crédit', en: 'Digital record of every credit transaction' },
      },
    ],
    testimonial: {
      quote: {
        ar: 'كانت فروقات الصندوق توجعني الراس كل ليلة. مع MAGHAREBIT ولا عندي ولا درهم ضائع.',
        fr: 'Les écarts de caisse me prenaient la tête chaque soir. Avec MAGHAREBIT je n\'ai plus un dirham de perdu.',
        en: 'Till discrepancies used to drive me crazy every night. With MAGHAREBIT not a dirham goes missing.',
      },
      name: 'عبد الرحيم القاسمي',
      role: {
        ar: 'صاحب جزارة، الدار البيضاء',
        fr: 'Boucher, Casablanca',
        en: 'Butcher, Casablanca',
      },
      initials: 'AQ',
    },
    meta: {
      title: {
        ar: 'MAGHAREBIT POS للجزارة | بيع بالوزن وحساب الهامش',
        fr: 'MAGHAREBIT POS pour Boucheries | Vente au poids et calcul de marge',
        en: 'MAGHAREBIT POS for Butchers | Weight-based selling and margin calculation',
      },
      desc: {
        ar: 'نظام كاشير للجزارة المغربية — تكامل الميزان، حساب الهامش، حسابات الكريدي، تقرير يومي على واتساب.',
        fr: 'Caisse pour bouchers marocains — intégration balance, calcul de marge, comptes crédit, rapport WhatsApp quotidien.',
        en: 'POS for Moroccan butchers — scale integration, margin calc, credit accounts, daily WhatsApp report.',
      },
    },
    whatsappMessage: {
      ar: 'السلام عليكم، عندي جزارة وبغيت نعرف كيف MAGHAREBIT يخدم مع الميزان وحسابات الكريدي',
      fr: 'Bonjour, j\'ai une boucherie et je voudrais voir comment MAGHAREBIT fonctionne avec la balance et les comptes crédit',
      en: 'Hello, I run a butcher shop and want to see how MAGHAREBIT works with the scale and credit accounts',
    },
    moroccanContext: {
      ar: 'الجزارة المغربية تبيع بالميزان والكريدي، وكل خطأ في الحساب يعني خسارة حقيقية. MAGHAREBIT يسجل كل وزن وكل تالف — حتى لا يضيع درهم واحد بدون سبب واضح.',
      fr: "La boucherie marocaine vend au poids et à crédit — chaque erreur de calcul est une perte réelle. MAGHAREBIT enregistre chaque pesée et chaque perte, pour qu'aucun dirham ne disparaisse sans raison.",
      en: 'The Moroccan butcher sells by weight and on credit — every calculation error is a real loss. MAGHAREBIT logs every weighing and every waste event, so not a single dirham disappears without reason.',
    },
  },
  {
    slug: 'snack-shawarma',
    emoji: '🌯',
    gradient: 'linear-gradient(135deg, #7C2D12 0%, #C2410C 50%, #F97316 100%)',
    name: {
      ar: 'سناك وشاورما',
      fr: 'Snack & Shawarma',
      en: 'Snack & Shawarma',
    },
    tagline: {
      ar: 'سرعة البيع في الذروة + إدارة المكونات',
      fr: 'Vitesse d\'encaissement aux heures de pointe + gestion des ingrédients',
      en: 'Peak-hour speed + ingredient tracking',
    },
    painPoints: {
      ar: [
        'في الذروة (الغداء والعشاء) الطلبات تتراكم والكاشير البطيء يخسر الزبائن',
        'مكونات الشاورما (الخبز، اللحم، الخضرة، الصلصات) تنفد فجأة بدون تنبيه',
        'إدارة المناوبات والموظفين في وقت ضغط بدون نظام تُسبّب أخطاء وفوضى',
      ],
      fr: [
        'Aux heures de pointe (déjeuner et dîner), les commandes s\'accumulent et une caisse lente perd des clients',
        'Les ingrédients de shawarma (pain, viande, légumes, sauces) s\'épuisent brusquement sans alerte',
        'Gérer les équipes en heure de pointe sans système crée des erreurs et de la confusion',
      ],
      en: [
        'At peak hours (lunch and dinner) orders pile up and a slow POS loses customers',
        'Shawarma ingredients (bread, meat, vegetables, sauces) run out suddenly with no warning',
        'Managing shifts during rush hour without a system creates errors and chaos',
      ],
    },
    features: {
      ar: [
        '⚡ كاشير سريع (نقرتان لكل طلب) — مصمم لأكبر إنتاجية في الذروة',
        '🧆 وصفات BOM للشاورما — كل طلب يخصم خبزاً ولحماً وخضرة تلقائياً',
        '🔔 تنبيهات نفاد المكونات قبل الذروة بساعتين',
        '👥 إدارة المناوبات — من باع ماذا ومتى',
        '📊 تقرير ساعة الذروة — متى يجب توظيف عامل إضافي',
      ],
      fr: [
        '⚡ Caisse ultra-rapide (deux taps par commande) — conçue pour la productivité maximale',
        '🧆 Recettes BOM pour shawarma — chaque vente déduit pain, viande et légumes automatiquement',
        '🔔 Alertes rupture d\'ingrédients 2h avant le rush',
        '👥 Gestion des équipes — qui a vendu quoi et quand',
        '📊 Rapport d\'heure de pointe — quand recruter un employé supplémentaire',
      ],
      en: [
        '⚡ Ultra-fast POS (two taps per order) — designed for peak productivity',
        '🧆 BOM recipes for shawarma — each sale deducts bread, meat and vegetables automatically',
        '🔔 Ingredient stock-out alerts 2 hours before rush',
        '👥 Staff shift management — who sold what and when',
        '📊 Peak-hour report — when to hire additional staff',
      ],
    },
    comparison: [
      {
        aspect: { ar: 'سرعة الكاشير', fr: 'Vitesse caisse', en: 'POS speed' },
        competitor: { ar: '5-7 نقرات لكل طلب', fr: '5-7 taps par commande', en: '5-7 taps per order' },
        magharebit: { ar: 'نقرتان فقط — مصمم للذروة', fr: 'Seulement 2 taps — pensé pour le rush', en: 'Just 2 taps — built for peak hours' },
      },
      {
        aspect: { ar: 'تتبع المكونات', fr: 'Suivi ingrédients', en: 'Ingredient tracking' },
        competitor: { ar: 'لا يوجد — تُكتشف النفاد عند الذروة', fr: 'Absent — la rupture se découvre en plein rush', en: 'None — stock-out discovered during rush' },
        magharebit: { ar: 'تنبيهات قبل ساعتين من النفاد', fr: 'Alertes 2h avant la rupture', en: 'Alerts 2h before stock-out' },
      },
      {
        aspect: { ar: 'تقارير الذروة', fr: 'Rapports heures pointe', en: 'Peak-hour reports' },
        competitor: { ar: 'لا تحليل لساعات الذروة', fr: 'Aucune analyse des heures de pointe', en: 'No peak-hour analysis' },
        magharebit: { ar: 'تقارير ساعة بساعة لاتخاذ قرار التوظيف', fr: 'Rapports heure par heure pour décider du recrutement', en: 'Hour-by-hour reports for hiring decisions' },
      },
    ],
    testimonial: {
      quote: {
        ar: 'في الذروة كنا نخسر زبناء بسبب الانتظار. مع MAGHAREBIT كل طلب نقرتان وخلاص.',
        fr: 'En plein rush on perdait des clients à cause de l\'attente. Avec MAGHAREBIT chaque commande c\'est deux taps et c\'est fait.',
        en: 'During rush we lost customers because of the wait. With MAGHAREBIT each order is two taps and done.',
      },
      name: 'مهدي البقالي',
      role: {
        ar: 'صاحب سناك، الرباط',
        fr: 'Propriétaire de snack, Rabat',
        en: 'Snack shop owner, Rabat',
      },
      initials: 'MB',
    },
    meta: {
      title: {
        ar: 'MAGHAREBIT POS للسناك والشاورما | سرعة وذروة',
        fr: 'MAGHAREBIT POS pour Snack & Shawarma | Vitesse et rush',
        en: 'MAGHAREBIT POS for Snack & Shawarma | Speed and peak hours',
      },
      desc: {
        ar: 'نظام كاشير للسناك المغربي — سرعة فائقة، إدارة المكونات، تقارير الذروة، يعمل بدون إنترنت.',
        fr: 'Caisse pour snacks marocains — vitesse maximale, gestion ingrédients, rapports heures pointe, hors ligne.',
        en: 'POS for Moroccan snack shops — maximum speed, ingredient management, peak-hour reports, offline-first.',
      },
    },
    whatsappMessage: {
      ar: 'السلام عليكم، عندي سناك/شاورما وبغيت نشوف كاش MAGHAREBIT يسرع البيع في الذروة',
      fr: 'Bonjour, j\'ai un snack/shawarma et je voudrais voir comment MAGHAREBIT accélère les ventes au rush',
      en: 'Hello, I have a snack/shawarma shop and want to see how MAGHAREBIT speeds up sales at rush hour',
    },
  },
  {
    slug: 'traiteur',
    emoji: '🍽️',
    gradient: 'linear-gradient(135deg, #78350F 0%, #B45309 50%, #F59E0B 100%)',
    name: {
      ar: 'مطبخ المناسبات (طرايتور)',
      fr: 'Traiteur & Événements',
      en: 'Catering & Events',
    },
    tagline: {
      ar: 'ادر طلبيات المناسبات من مكان واحد',
      fr: 'Gérez vos commandes événementielles depuis un seul endroit',
      en: 'Manage event orders from one place',
    },
    painPoints: {
      ar: [
        'تدبير طلبيات الأعراس والمناسبات على الورق — تواريخ مهمة تُنسى وقوائم تضيع',
        'حساب تكلفة كل حدث (مكونات + يد عاملة + إيجار) يدوياً مُرهِق ومصدر خسائر',
        'تتبع التسبيقات والمدفوعات في خمسة دفاتر مختلفة يُربك المحاسبة',
      ],
      fr: [
        'Gérer les commandes de mariages et événements sur papier — dates importantes oubliées et listes perdues',
        'Calculer le coût de chaque événement (ingrédients + main d\'œuvre + location) manuellement est épuisant et source de pertes',
        'Suivre acomptes et paiements dans cinq carnets différents complique la comptabilité',
      ],
      en: [
        'Managing wedding and event orders on paper — important dates forgotten and lists lost',
        'Manually calculating each event\'s cost (ingredients + labour + rentals) is exhausting and a source of losses',
        'Tracking deposits and payments across five different notebooks complicates accounting',
      ],
    },
    features: {
      ar: [
        '📅 تقويم الطلبيات المستقبلية مع تنبيهات قبل كل حدث',
        '💰 حساب تكلفة كل حدث تلقائياً — ربح صافي قبل القبول',
        '💸 تتبع التسبيقات والمدفوعات — كل عميلة بحسابها الكامل',
        '📦 توقع المكونات للأسبوع القادم بناءً على الطلبيات المؤكدة',
        '📄 توليد فواتير المناسبات بالعربية والفرنسية بنقرة',
      ],
      fr: [
        '📅 Calendrier des commandes futures avec alertes avant chaque événement',
        '💰 Calcul automatique du coût de chaque événement — bénéfice net avant acceptation',
        '💸 Suivi des acomptes et paiements — chaque cliente avec son compte complet',
        '📦 Prévision des ingrédients pour la semaine à venir selon les commandes confirmées',
        '📄 Génération de factures événements en arabe et français en un clic',
      ],
      en: [
        '📅 Future-order calendar with alerts before each event',
        '💰 Automatic per-event cost calculation — net profit before accepting',
        '💸 Deposit and payment tracking — each client with their full account',
        '📦 Ingredient forecasting for the coming week based on confirmed orders',
        '📄 Event invoice generation in Arabic and French in one click',
      ],
    },
    comparison: [
      {
        aspect: { ar: 'تدبير الطلبيات', fr: 'Gestion commandes', en: 'Order management' },
        competitor: { ar: 'دفتر ورقي — تواريخ تضيع', fr: 'Carnet papier — dates oubliées', en: 'Paper notebook — dates forgotten' },
        magharebit: { ar: 'تقويم رقمي بتنبيهات تلقائية', fr: 'Calendrier numérique avec alertes automatiques', en: 'Digital calendar with automatic alerts' },
      },
      {
        aspect: { ar: 'تكلفة الحدث', fr: 'Coût événement', en: 'Event cost' },
        competitor: { ar: 'حساب يدوي عند الانتهاء', fr: 'Calcul manuel à la fin', en: 'Manual calculation at the end' },
        magharebit: { ar: 'تكلفة وربح تلقائيين قبل القبول', fr: 'Coût et bénéfice automatiques avant acceptation', en: 'Automatic cost and profit before accepting' },
      },
      {
        aspect: { ar: 'التسبيقات', fr: 'Acomptes', en: 'Deposits' },
        competitor: { ar: 'دفاتر متعددة — ضياع للأموال', fr: 'Plusieurs carnets — pertes d\'argent', en: 'Multiple notebooks — money lost' },
        magharebit: { ar: 'سجل واحد لكل عميلة، كل دفعة مرئية', fr: 'Un registre par cliente, chaque paiement visible', en: 'One ledger per client, every payment visible' },
      },
    ],
    testimonial: {
      quote: {
        ar: 'كنت ننسى تسبيقات وأخلط بين الأعراس. مع MAGHAREBIT الكل واضح: من دفع كم ومتى الحدث.',
        fr: 'J\'oubliais des acomptes et je mélangeais les mariages. Avec MAGHAREBIT tout est clair : qui a payé combien et quand est l\'événement.',
        en: 'I forgot deposits and mixed up weddings. With MAGHAREBIT everything is clear: who paid how much and when the event is.',
      },
      name: 'لطيفة الفاسي',
      role: {
        ar: 'صاحبة طرايتور، فاس',
        fr: 'Traiteur, Fès',
        en: 'Caterer, Fez',
      },
      initials: 'LF',
    },
    meta: {
      title: {
        ar: 'MAGHAREBIT POS للطرايتور | تقويم المناسبات وتكلفة كل حدث',
        fr: 'MAGHAREBIT POS pour Traiteurs | Calendrier événements et coût par événement',
        en: 'MAGHAREBIT POS for Caterers | Event calendar and per-event costing',
      },
      desc: {
        ar: 'نظام إدارة لمطابخ المناسبات المغربية — تقويم، تكلفة لكل حدث، تتبع التسبيقات، توقع المكونات.',
        fr: 'Logiciel pour traiteurs marocains — calendrier, coût par événement, suivi acomptes, prévision ingrédients.',
        en: 'Management software for Moroccan caterers — calendar, per-event cost, deposit tracking, ingredient forecasting.',
      },
    },
    whatsappMessage: {
      ar: 'السلام عليكم، عندي طرايتور وبغيت نعرف كيف MAGHAREBIT يدبّر طلبيات الأعراس والتسبيقات',
      fr: 'Bonjour, je suis traiteur et je voudrais comprendre comment MAGHAREBIT gère les commandes de mariages et les acomptes',
      en: 'Hello, I am a caterer and want to understand how MAGHAREBIT handles wedding orders and deposits',
    },
  },
];
