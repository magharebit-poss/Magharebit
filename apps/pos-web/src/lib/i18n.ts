// i18n translations for MAGHAREBIT POS web cashier interface
// Three languages: ar (default), fr, en

export type Lang = 'ar' | 'fr' | 'en';

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'ar', label: 'العربية', flag: '🇲🇦' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export interface Translations {
  kds: {
    title: string;
    sendToKitchen: string;
    sentToKitchen: string;
    alreadyInKitchen: string;
    new: string;
    preparing: string;
    ready: string;
    done: string;
    start: string;
    markReady: string;
    markDone: string;
    walkin: string;
    whatsapp: string;
    table: string;
    takeaway: string;
    tableNumber: string;
    noOrders: string;
    elapsed: string;
    ordersCompleted: string;
    backToPOS: string;
    newOrderAlert: string;
    fulfillmentSurPlace: string;
    fulfillmentEmporter: string;
    notesPlaceholder: string;
    send: string;
    cancel: string;
    pending: string;
    refresh: string;
    tapToAdvance: string;
    enableSound: string;
    soundOn: string;
    soundOff: string;
    tapToEnableSound: string;
    newOrder: string;
    sessionExpired: string;
    signInToContinue: string;
  };
  products: {
    title: string;
    add: string;
    edit: string;
    delete: string;
    save: string;
    cancel: string;
    nameAr: string;
    nameFr: string;
    category: string;
    price: string;
    barcode: string;
    plu: string;
    image: string;
    uploadImage: string;
    imageHint: string;
    isWeighted: string;
    uom: string;
    isPerishable: string;
    trackStock: string;
    stockQty: string;
    lowStockThreshold: string;
    description: string;
    businessFields: string;
    businessType: string;
    setBusinessType: string;
    noProducts: string;
    searchProducts: string;
    confirmDelete: string;
    deleted: string;
    saved: string;
    imageUpdated: string;
    loading: string;
    allCategories: string;
    categoryPlaceholder: string;
    statsTotal: string;
    statsActive: string;
    statsInactive: string;
    stockLabel: string;
    addTitle: string;
    editPrefix: string;
    cost: string;
    isActive: string;
    addButton: string;
    inactiveBadge: string;
    errorNameRequired: string;
    errorSave: string;
    errorConnection: string;
    successAdd: string;
    successEdit: string;
    confirmDeleteMsg: string;
    uomLabels: { UNIT: string; KG: string; G: string; L: string; ML: string; BUNCH: string; BOX: string; BAG: string; PIECE: string };
    removeImage: string;
    imageTooBig: string;
    imageInvalidType: string;
    imageUploading: string;
    margin: string;
  };
  brand: {
    name: string;
    logoAlt: string;
    copyright: string;
  };
  shift: {
    title: string;
    subtitle: string;
    selectCashier: string;
    cashierLabel: string;
    changeCashier: string;
    enterPin: string;
    clear: string;
    editPin: string;
    openingFloat: string;
    startShift: string;
    starting: string;
    loading: string;
    errorConnect: string;
    errorOpen: string;
    errorUnknown: string;
    role: { CASHIER: string; MANAGER: string; SUPERVISOR: string };
    licenseTitle: string;
    licenseBody: string;
    licenseSupport: string;
  };
  pos: {
    searchPlaceholder: string;
    loading: string;
    noProducts: string;
    allCategories: string;
    productsCount: string;
    backToCategories: string;
    cashierLabel: string;
    shiftStarted: string;
    closeShift: string;
    cart: string;
    cartEmpty: string;
    bomNotice: string;
    delete: string;
    subtotal: string;
    tax: string;
    total: string;
    cash: string;
    card: string;
    manualPlu: string;
    productNotFound: string;
    pluSearch: string;
    pluHint: string;
    pluClose: string;
    cardComingSoon: string;
    pluComingSoon: string;
    confirmCloseWithCart: string;
    confirmCloseShift: string;
    errorProducts: string;
    scanBarcode: string;
    scanProduct: string;
    staffManagement: string;
    productManagement: string;
    printerSetup: string;
    tableMap: string;
    markdownSuggestion: string;
    discountNotePct: string;
    discountNoteFixed: string;
    category: {
      all: string;
      beverages: string;
      bakery: string;
      produce: string;
      juices: string;
      prepared: string;
      grocery: string;
      snacks: string;
      supplies: string;
      general: string;
    };
  };
  payment: {
    success: string;
    cashTitle: string;
    close: string;
    amountDue: string;
    amountPaid: string;
    match: string;
    change: string;
    confirm: string;
    processing: string;
    cancel: string;
    errorFailed: string;
    errorGeneric: string;
    exactAmount: string;
  };
  shiftClose: {
    title: string;
    subtitle: string;
    summaryHeading: string;
    totalSales: string;
    transactions: string;
    cashSales: string;
    cashCount: string;
    expected: string;
    variance: string;
    confirm: string;
    cancel: string;
    confirming: string;
    matchBadge: string;
    smallVariance: string;
    largeVariance: string;
    errorLoad: string;
    errorClose: string;
    shiftClosed: string;
    zeroTxWarning: string;
    zeroTxNote: string;
  };
  zReport: {
    title: string;
    shiftId: string;
    cashier: string;
    opened: string;
    closed: string;
    duration: string;
    minutes: string;
    salesHeading: string;
    totalSales: string;
    transactions: string;
    cashSales: string;
    cardSales: string;
    tax: string;
    cashHeading: string;
    openingFloat: string;
    expectedCash: string;
    actualCash: string;
    variance: string;
    top5Heading: string;
    colNum: string;
    colProduct: string;
    colQty: string;
    colTotal: string;
    tendersHeading: string;
    footer: string;
    print: string;
    done: string;
    splitPayment: string;
  };
  receipt: {
    title: string;
    receiptNo: string;
    date: string;
    cashier: string;
    item: string;
    qty: string;
    unitPrice: string;
    lineTotal: string;
    total: string;
    paymentLabel: string;
    paymentCash: string;
    paymentCard: string;
    taxIdLabel: string;
    thankYou: string;
    print: string;
    newSale: string;
  };
  invoice: {
    title: string;        // "فاتورة" / "Facture" / "Invoice"
    invoiceNo: string;    // label for the invoice number field
    taxRate: string;      // column header: rate
    taxBaseHT: string;    // column header: HT base
    taxAmount: string;    // column header: TVA amount
    taxTotalTTC: string;  // column header: TTC total
    disclaimer: string;   // legal footer on formal invoices
    generate: string;     // button: generate an invoice for this sale
    generating: string;   // button loading state
    generated: string;    // button label after generation (shows invoice number)
    iceLabel: string;
    ifLabel: string;
    rcLabel: string;
  };
  discount: {
    titleLine: string;
    titleCart: string;
    percentage: string;
    fixed: string;
    value: string;
    amount: string;
    apply: string;
    cancel: string;
    remove: string;
    approvalRequired: string;
    invalid: string;
    label: string;
    addLine: string;
    addCart: string;
  };
  waste: {
    title: string;
    subtitle: string;
    selectProduct: string;
    searchProduct: string;
    quantity: string;
    unitGrams: string;
    unitPieces: string;
    reasonHeading: string;
    reason: { SPOILED: string; EXPIRED: string; PREP_DAMAGE: string; OTHER: string };
    notes: string;
    notesPlaceholder: string;
    charactersRemaining: string;
    submit: string;
    submitting: string;
    recordAnother: string;
    backToPos: string;
    success: string;
    errorSubmit: string;
    errorNoProduct: string;
    errorNoQuantity: string;
    errorNoReason: string;
    recentHeading: string;
    recentEmpty: string;
    thresholdNotice: string;
    posButtonLabel: string;
    colProduct: string;
    colQty: string;
    colReason: string;
    colTime: string;
    approvedBy: string;
    chainHashLabel: string;
    chainTooltip: string;
    scanBarcode: string;
    scanProductTitle: string;
  };
  managerPin: {
    title: string;
    subtitle: string;
    selectManager: string;
    enterPin: string;
    changeManager: string;
    invalidPin: string;
    attemptsLeft: string;
    lockoutTitle: string;
    lockoutMessage: string;
    cancel: string;
    approving: string;
    noManagers: string;
    promptBody: string;
    pinLabel: string;
    confirm: string;
    errorConnection: string;
    enterFullPin: string;
    authTitle: string;
  };
  analytics: {
    title: string;
    totalSales: string;
    transactions: string;
    shifts: string;
    wasteKg: string;
    salesTrend: string;
    paymentSplit: string;
    topProducts: string;
    wasteAnalysis: string;
    shiftsPerformance: string;
    accessDenied: string;
    loading: string;
    noData: string;
    days7: string;
    days30: string;
    days90: string;
    backToPos: string;
    cashPayments: string;
    cardPayments: string;
    colCashier: string;
    colOpened: string;
    colClosed: string;
    colSales: string;
    colTx: string;
    colProduct: string;
    colQty: string;
    colRevenue: string;
    posButtonLabel: string;
    overviewTab: string;
    daysLabel: string;
    activeDays: string;
    wasteRecorded: string;
    kg: string;
    wasteRecordsCount: string;
    salesLabel: string;
    txShort: string;
    duration: string;
    noWasteRecords: string;
    noShifts: string;
    totalWaste: string;
    recordsShort: string;
    shiftsShort: string;
    topProductsShort: string;
    currency: string;
  };
  cashflow: {
    title: string;
    loading: string;
    loadError: string;
    noData: string;
    openingBalance: string;
    worstBalance: string;
    dailyBalance: string;
    totalInflow: string;
    supplierObligations: string;
    customerCredit: string;
    upcomingTitle: string;
    overdue: string;
    daysShort: string;
    obligationsLabel: string;
    risk: { none: string; low: string; medium: string; high: string; critical: string };
  };
  insights: {
    tabRisk: string;
    tabSuggestions: string;
    noRisk: string;
    noSuggestions: string;
    done: string;
    suggestionTypes: { credit_block: string; credit_warning: string; reactivation: string; loyalty_reward: string; upsell: string };
  };
  forecast: {
    title: string;
    reorderTitle: string;
    predicted: string;
    onHand: string;
    noAlerts: string;
    noForecasts: string;
    units: string;
  };
  assistant: {
    title: string;
    subtitle: string;
    examplesIntro: string;
    placeholder: string;
    analyzing: string;
    errorGeneric: string;
    errorConnection: string;
    suggested: { topProducts: string; peakHours: string; creditBalances: string; suspiciousAlerts: string; reorder: string };
  };
  integrity: {
    tabLabel: string;
    title: string;
    loading: string;
    noData: string;
    colCashier: string;
    colTotalTx: string;
    colVoidRate: string;
    colDiscountRate: string;
    colReturnRate: string;
    colCashShare: string;
    colAvgTxTime: string;
    colCashDiscrepancy: string;
    colAnomalies: string;
    anomalyBadge: string;
    drilldownTitle: string;
    drilldownVoids: string;
    drilldownDiscounts: string;
    drilldownReturns: string;
    drilldownCashShare: string;
    drilldownAvgTime: string;
    drilldownDiscrepancy: string;
    disclaimer: string;
  };
  customer: {
    title: string;
    phone: string;
    name: string;
    lookup: string;
    notFound: string;
    add: string;
    added: string;
    visits: string;
    spent: string;
    history: string;
    noHistory: string;
    notes: string;
    skip: string;
    loyalty: {
      title: string;
      stamps: string;
      stampsUntil: string;
      rewardReady: string;
      reward: string;
      noProgram: string;
    };
    createAndSelect: string;
    withoutCustomer: string;
    done: string;
    cancel: string;
    confirm: string;
  };
  card: {
    title: string;            // Modal header: "Paiement par carte"
    initiate: string;         // "Initier le paiement"
    idleInstruction: string;  // IDLE hint: customer should not approach terminal yet
    sending: string;          // "Envoi au terminal..."
    presentCard: string;      // "Veuillez présenter votre carte"
    timeoutIn: string;        // "Délai: {n}s" — countdown display
    processing: string;       // "Traitement en cours..."
    approved: string;         // "Paiement approuvé"
    approvalCode: string;     // label prefix: "Code:"
    declined: string;         // "Paiement refusé"
    timeout: string;          // "Délai dépassé"
    error: string;            // "Terminal non disponible"
    errorDetail: string;      // collapsible dev-facing label
    terminalUnavailable: string; // cashier-facing unavailable message
    retry: string;            // "Réessayer"
    cancel: string;           // "Annuler"
  };
  returns: {
    buttonLabel: string;      // "Retour" / "مرتجع" / "Return"
    title: string;            // Modal header
    lookupPlaceholder: string;// Receipt number input hint
    lookup: string;           // "Rechercher" / "بحث"
    noReceipt: string;        // "Sans ticket / بدون إيصال"
    loading: string;          // "Chargement..." / "جارٍ التحميل..."
    receiptNotFound: string;  // 404 error label
    fullyReturned: string;    // 422 error label — all items already returned
    selectItems: string;      // Section heading for item selection
    qty: string;              // "Qté" / "الكمية"
    maxQty: string;           // "Max: {n}" / "الحد الأقصى: {n}"
    disposition: string;      // Column label: "Disposition" / "التصرف"
    restock: string;          // "Remis en stock" / "إعادة للمخزون"
    damaged: string;          // "Endommagé" / "تالف"
    discard: string;          // "À jeter" / "للتخلص"
    freeformTitle: string;    // Heading for no-receipt return
    addItem: string;          // "+ Ajouter un article" / "+ إضافة صنف"
    itemName: string;         // Input placeholder: "Nom de l'article"
    unitPrice: string;        // Input placeholder: "Prix unitaire (MAD)"
    managerPinTitle: string;  // "Approbation manager requise"
    managerPinReason: string; // Over-threshold reason text
    managerPinFreeform: string; // Freeform reason text
    managerId: string;        // "Matricule manager" / "رقم المدير"
    managerPin: string;       // "Code PIN manager" / "رمز PIN المدير"
    refundMethod: string;     // Section label: "Mode de remboursement"
    cash: string;             // "Espèces" / "نقداً"
    card: string;             // "Carte" / "بطاقة"
    storeCredit: string;      // "Avoir" / "رصيد متجر"
    total: string;            // "Total remboursé" / "إجمالي المسترد"
    confirm: string;          // "Confirmer le retour" / "تأكيد الإرجاع"
    processing: string;       // "Traitement..." / "جارٍ المعالجة..."
    successTitle: string;     // "Retour enregistré" / "تم تسجيل الإرجاع"
    returnNumber: string;     // "N° retour: {n}" / "رقم الإرجاع: {n}"
    done: string;             // "Terminer" / "إنهاء"
    error: string;            // "Erreur lors du retour" / "خطأ في الإرجاع"
    retry: string;            // "Réessayer" / "أعد المحاولة"
    cancel: string;           // "Annuler" / "إلغاء"
  };
  lana: {
    title: string;            // Modal header: "Paiement Lana Cash"
    posButtonLabel: string;   // POS button: "Lana"
    generate: string;         // IDLE button: "Générer le QR"
    generating: string;       // Spinner label: "Génération..."
    scanInstruction: string;  // QR screen instruction for the cashier
    timeoutIn: string;        // Countdown: "Expire dans {n}s"
    paid: string;             // Brief success: "Paiement reçu !"
    recording: string;        // While saving transaction: "Enregistrement..."
    expired: string;          // QR timed out: "QR expiré"
    errorRecovery: string;    // Payment OK but DB write failed — manual recovery hint
  };
  stock: {
    inStock: string;          // Green badge: "En stock" / "متوفر"
    lowStock: string;         // Amber badge heading: "Stock faible" / "مخزون منخفض"
    outOfStock: string;       // Red badge: "Rupture" / "نفد"
    units: string;            // Unit suffix: "unités" / "وحدة"
    kg: string;               // Weight suffix: "kg" / "كغ"
    alertTitle: string;       // Panel title: "Alertes stock" / "تنبيهات المخزون"
    alertEmpty: string;       // Empty state: "Aucune alerte" / "لا توجد تنبيهات"
    threshold: string;        // Label: "Seuil" / "الحد الأدنى"
    close: string;            // Close button: "Fermer" / "إغلاق"
  };
  sync: {
    online: string;       // "En ligne" / "متصل" / "Online"
    offline: string;      // "Hors ligne" / "غير متصل" / "Offline"
    pending: string;      // "Sync: {n}" / "مزامنة: {n}" / "Sync: {n}"
    provisional: string;  // "Reçu provisoire" / "إيصال مؤقت" / "Provisional receipt"
    willSync: string;     // "sera synchronisé" / "سيتزامن" / "will sync"
  };
  markdown: {
    labelButton: string;  // 🏷️ tooltip: "Imprimer l'étiquette"
    modalTitle: string;   // "Étiquette de démarque"
    originalPrice: string;// column label: "Prix d'origine"
    effectivePrice: string;// column label: "Prix remisé"
    printButton: string;  // "Imprimer"
    close: string;        // "Fermer"
  };
  stores: {
    tabLabel: string;     // "Magasins"
    title: string;        // "Vue d'ensemble des magasins"
    store: string;        // "Magasin"
    sales: string;        // "Ventes"
    transactions: string; // "Transactions"
    waste: string;        // "Gaspillage"
    discounts: string;    // "Remises"
    viewDetail: string;   // "Voir détails"
    backToStores: string; // "Retour aux magasins"
    noStores: string;     // "Aucun magasin"
    accessDenied: string; // "Section réservée aux superviseurs"
  };
  orders: {
    title: string;
    badge: string;
    new: string;
    reviewing: string;
    confirmed: string;
    preparing: string;
    ready: string;
    completed: string;
    cancelled: string;
    pickup: string;
    delivery: string;
    cashOnDelivery: string;
    virement: string;
    tpe: string;
    paymentReceived: string;
    customerMessage: string;
    deliveryAddress: string;
    scheduledAt: string;
    assignTo: string;
    notes: string;
    convertToSale: string;
    noOrders: string;
    markPaymentReceived: string;
    close: string;
    cancelOrder: string;
    confirmCancel: string;
    backToList: string;
    filterAll: string;
    filterNew: string;
    filterInProgress: string;
    filterDone: string;
    sendToKds: string;
    kdsSent: string;
    kdsExisting: string;
    statusLabel: string;
    fulfillmentLabel: string;
    paymentLabel: string;
  };
  suppliers: {
    title: string;
    add: string;
    name: string;
    phone: string;
    address: string;
    notes: string;
    noSuppliers: string;
    errorNameRequired: string;
    suggestedQty: string;
    receiving: {
      title: string;
      newDelivery: string;
      supplier: string;
      product: string;
      quantity: string;
      unitCost: string;
      totalCost: string;
      addLine: string;
      confirm: string;
      confirmed: string;
      draft: string;
      received: string;
      history: string;
      ocrScan: string;
      ocrScanning: string;
      ocrSuccess: string;
      ocrError: string;
      ocrNotConfigured: string;
      ocrUnmatched: string;
      cancelled: string;
      notes: string;
      optional: string;
      unitCostPiastres: string;
      productsUpdated: string;
      markdownClockReset: string;
      forecastSuggestion: string;
      productsCount: string;
      errorNoProducts: string;
    };
    ledger: {
      title: string;
      balance: string;
      invoices: string;
      payments: string;
      newInvoice: string;
      recordPayment: string;
      invoiceRef: string;
      invoiceDate: string;
      dueDate: string;
      tax: string;
      total: string;
      paid: string;
      remaining: string;
      status: string;
      statusUnpaid: string;
      statusPartial: string;
      statusPaid: string;
      statusCancelled: string;
      payMethod: string;
      payReference: string;
      payDate: string;
      description: string;
      unit: string;
      unitCost: string;
      quantity: string;
      addLine: string;
      save: string;
      cancel: string;
      noInvoices: string;
      noPayments: string;
      selectSupplier: string;
      cancelled: string;
      currency: string;
      optional: string;
      errorNoLines: string;
      errorAmountRequired: string;
      product: string;
      searchProduct: string;
      noProductMatch: string;
      clearProduct: string;
      costAlertsTitle: string;
      costAlertsHint: string;
      costOld: string;
      costNew: string;
      costIncrease: string;
      marginBefore: string;
      marginAfter: string;
      belowCost: string;
      dismiss: string;
      paymentMethods: { cash: string; bank_transfer: string; cheque: string; mobile: string; other: string };
    };
  };
  license: {
    activationTitle: string;
    instructions: string;
    keyLabel: string;
    activateButton: string;
    verifying: string;
    errorEmptyKey: string;
    errorRevoked: string;
    errorChecksum: string;
    errorExpired: string;
    errorMachineMismatch: string;
    errorGeneric: string;
    errorNetwork: string;
    revokedTitle: string;
    revokedBody: string;
    whatsappButton: string;
    expiredTitle: string;
    expiredBody: string;
    renewButton: string;
    daysLeftBanner: string;
    daysLeftOne: string;
    daysLeftTwo: string;
    daysLeftFew: string;
    daysLeftMany: string;
    renewNow: string;
  };
  course: {
    panelTitle: string;
    noCourse: string;
    courseN: string;
    fire: string;
    fired: string;
    held: string;
    none: string;
    allergies: string;
    save: string;
    cancel: string;
    empty: string;
    takeaway: string;
    errorLoad: string;
    errorFire: string;
    errorSave: string;
    errorStarted: string;
  };
  voice: {
    tapToSpeak: string;
    listening: string;
    notSupported: string;
    noMic: string;
    noSpeech: string;
    networkError: string;
    error: string;
    clearConfirm: string;
    cancel: string;
  };
  nav: {
    branches: string;
  };
  branches: {
    title: string;
    tabOverview: string;
    tabStock: string;
    tabTransfers: string;
    refresh: string;
    totalRevenue: string;
    activeShifts: string;
    todayRevenue: string;
    transactions: string;
    staff: string;
    inactiveBranch: string;
    noBranches: string;
    product: string;
    stockNotice: string;
    transfer: string;
    fromStore: string;
    toStore: string;
    quantity: string;
    submit: string;
    cancel: string;
    noProducts: string;
    noTransfers: string;
    approve: string;
    markReceived: string;
    cancelTransfer: string;
    status: { pending: string; approved: string; in_transit: string; received: string; cancelled: string };
    errorLoad: string;
    errorSave: string;
    errorSameStore: string;
  };
  scale: {
    title: string;
    connect: string;
    connecting: string;
    connected: string;
    disconnect: string;
    readWeight: string;
    stabilize: string;
    port: string;
    baudRate: string;
    selectScale: string;
    driverAvailable: string;
    driverStub: string;
    testRead: string;
    weightResult: string;
    errorNoDriver: string;
    notConnected: string;
    weightUnit: string;
    stable: string;
    unstable: string;
    addToCart: string;
    noWebSerial: string;
    tare: string;
    errorNoSerial: string;
    errorConnect: string;
    errorDisconnected: string;
  };
  barcode: {
    defaultTitle: string;
    permissionDenied: string;
    permissionNote: string;
    retry: string;
    aim: string;
  };
  printer: {
    noWebUsb: string;
    noWebUsbHint: string;
    status: string;
    supported: string;
    connect: string;
    connecting: string;
    disconnect: string;
    statusDisconnected: string;
    statusConnecting: string;
    statusConnected: string;
    statusError: string;
  };
  split: {
    total: string;
    currencySuffix: string;
    fillRemaining: string;
    addTender: string;
    balanced: string;
    remaining: string;
    overpaid: string;
    errorLoadMethods: string;
    errorStatus: string;
  };
  credit: {
    buttonEmpty: string;
    buttonWithName: string;
    viewBalance: string;
    searchTitle: string;
    searchPlaceholder: string;
    searching: string;
    balanceClear: string;
    addNew: string;
    namePlaceholder: string;
    phonePlaceholder: string;
    save: string;
    balanceLabel: string;
    limitLabel: string;
    riskBanner: string;
    amountPlaceholder: string;
    notePlaceholder: string;
    chargeBtn: string;
    payBtn: string;
    showHistory: string;
    hideHistory: string;
    noTransactions: string;
    txCharge: string;
    txPayment: string;
    currencySuffix: string;
    errorInvalidAmount: string;
    errorLimitExceeded: string;
    errorGeneric: string;
  };
  tableMap: {
    title: string;
    loading: string;
    capacity: string;
    statusAvailable: string;
    statusOccupied: string;
    statusBilled: string;
    statusReserved: string;
  };
  modifiers: {
    selectAddons: string;
    loading: string;
    total: string;
    currencySuffix: string;
    addToOrder: string;
  };
  productQR: {
    generating: string;
    download: string;
  };
  staff: {
    title: string;
    addNew: string;
    loading: string;
    noStaff: string;
    addTitle: string;
    editPrefix: string;
    nameArLabel: string;
    nameFrLabel: string;
    roleLabel: string;
    pinLabel: string;
    pinNew: string;
    pinConfirm: string;
    editButton: string;
    deactivate: string;
    activate: string;
    addButton: string;
    saveButton: string;
    cancelButton: string;
    errorNameRequired: string;
    errorPinLength: string;
    errorPinMismatch: string;
    errorSave: string;
    errorConnection: string;
    successAdd: string;
    successEdit: string;
    roles: { CASHIER: string; SENIOR_CASHIER: string; INVENTORY: string; MANAGER: string; SUPERVISOR: string };
  };
  alerts: {
    types: { rapid_voids: string; void_spike: string; discount_over_limit: string; unusual_discount: string; cash_discrepancy: string; price_override: string; unusual_refund: string };
    score: string;
    acknowledge: string;
  };
}

export const TRANSLATIONS: Record<Lang, Translations> = {
  ar: {
    brand: {
      name: 'MAGHAREBIT POS',
      logoAlt: 'شعار MAGHAREBIT',
      copyright: '© 2026 MAGHAREBIT — Wayloz Group',
    },
    shift: {
      title: 'MAGHAREBIT POS',
      subtitle: 'فتح وردية جديدة',
      selectCashier: 'اختر الكاشير',
      cashierLabel: 'الكاشير',
      changeCashier: 'تغيير',
      enterPin: 'أدخل رمز PIN',
      clear: 'مسح',
      editPin: 'تعديل PIN',
      openingFloat: 'رصيد الافتتاح (اختياري)',
      startShift: 'بدء الوردية',
      starting: 'جاري البدء...',
      loading: 'جاري التحميل...',
      errorConnect: 'فشل الاتصال بالخادم',
      errorOpen: 'فشل فتح الوردية',
      errorUnknown: 'خطأ غير معروف',
      role: { CASHIER: 'كاشير', MANAGER: 'مدير', SUPERVISOR: 'مشرف' },
      licenseTitle: 'هذا الترخيص غير مُفعّل',
      licenseBody: 'تعذّر التحقق من ترخيص البرنامج. يرجى التواصل مع الدعم لتفعيل أو تجديد الاشتراك.',
      licenseSupport: 'الدعم',
    },
    pos: {
      searchPlaceholder: 'ابحث عن منتج أو امسح الباركود',
      loading: 'جاري التحميل...',
      noProducts: 'لا توجد منتجات',
      allCategories: 'جميع الفئات',
      productsCount: '{n} منتج',
      backToCategories: 'العودة للفئات',
      cashierLabel: 'الكاشير',
      shiftStarted: 'بدأت',
      closeShift: 'إغلاق الوردية',
      cart: 'السلة',
      cartEmpty: 'السلة فارغة',
      bomNotice: 'يتضمن خصم تلقائي للمكونات',
      delete: 'حذف',
      subtotal: 'المجموع',
      tax: 'الضريبة (20%)',
      total: 'الإجمالي',
      cash: 'نقداً',
      card: 'بطاقة',
      manualPlu: 'إدخال يدوي (PLU)',
      productNotFound: 'المنتج غير موجود',
      pluSearch: 'بحث',
      pluHint: 'PLU / الباركود',
      pluClose: 'إغلاق',
      cardComingSoon: 'قريباً — الدفع بالبطاقة عبر طرفية CMI',
      pluComingSoon: 'قريباً — إدخال PLU يدوي',
      confirmCloseWithCart: 'السلة تحتوي على عناصر — هل تريد إغلاق الوردية؟',
      confirmCloseShift: 'تأكيد إغلاق الوردية؟',
      errorProducts: 'فشل تحميل المنتجات',
      scanBarcode: 'مسح الباركود',
      scanProduct: 'مسح منتج',
      staffManagement: 'إدارة الموظفين',
      productManagement: 'إدارة المنتجات',
      printerSetup: 'إعداد الطابعة',
      tableMap: 'خريطة الطاولات',
      markdownSuggestion: 'تخفيض {n}٪ موصى به',
      discountNotePct: 'خصم {n}٪',
      discountNoteFixed: 'خصم {n} د.م',
      category: {
        all: 'الكل',
        beverages: 'مشروبات',
        bakery: 'مخبوزات',
        produce: 'خضر وفواكه',
        juices: 'عصائر',
        prepared: 'وجبات',
        grocery: 'بقالة',
        snacks: 'سناكس',
        supplies: 'مستلزمات',
        general: 'عام',
      },
    },
    payment: {
      success: 'تمت العملية بنجاح',
      cashTitle: 'دفع نقدي',
      close: 'إغلاق',
      amountDue: 'المبلغ المستحق',
      amountPaid: 'المبلغ المدفوع',
      match: 'مطابق',
      change: 'الباقي',
      confirm: 'تأكيد الدفع',
      processing: 'جاري المعالجة...',
      cancel: 'إلغاء',
      errorFailed: 'فشلت العملية',
      errorGeneric: 'خطأ',
      exactAmount: 'المبلغ بالضبط',
    },
    shiftClose: {
      title: 'إغلاق الوردية',
      subtitle: 'احسب النقد في الصندوق',
      summaryHeading: 'ملخص الوردية',
      totalSales: 'إجمالي المبيعات',
      transactions: 'عدد العمليات',
      cashSales: 'مبيعات نقدية',
      cashCount: 'النقد المحسوب في الصندوق',
      expected: 'المتوقع في الصندوق',
      variance: 'الفرق',
      confirm: 'تأكيد الإغلاق',
      cancel: 'إلغاء',
      confirming: 'جاري الإغلاق...',
      matchBadge: '✓ متطابق',
      smallVariance: 'فرق بسيط',
      largeVariance: '⚠ فرق كبير — تحقق',
      errorLoad: 'فشل تحميل ملخص الوردية',
      errorClose: 'فشل إغلاق الوردية',
      shiftClosed: 'الوردية مغلقة بالفعل',
      zeroTxWarning: 'لا توجد مبيعات مسجلة في هذه الوردية',
      zeroTxNote: 'تحقق من صحة هذا قبل الإغلاق.',
    },
    zReport: {
      title: 'تقرير نهاية الوردية',
      shiftId: 'رقم الوردية',
      cashier: 'الكاشير',
      opened: 'الافتتاح',
      closed: 'الإغلاق',
      duration: 'المدة',
      minutes: 'دقيقة',
      salesHeading: 'المبيعات',
      totalSales: 'إجمالي المبيعات',
      transactions: 'عدد العمليات',
      cashSales: 'مبيعات نقدية',
      cardSales: 'مبيعات بطاقة',
      tax: 'الضريبة المُحصَّلة',
      cashHeading: 'تسوية النقد',
      openingFloat: 'رصيد الافتتاح',
      expectedCash: 'المتوقع في الصندوق',
      actualCash: 'الفعلي في الصندوق',
      variance: 'الفرق',
      top5Heading: 'أعلى 5 منتجات',
      colNum: '#',
      colProduct: 'المنتج',
      colQty: 'الكمية',
      colTotal: 'الإجمالي',
      tendersHeading: 'تفصيل وسائل الدفع',
      footer: 'شكراً — MAGHAREBIT POS',
      print: 'طباعة',
      done: 'تم',
      splitPayment: 'دفع مقسّم',
    },
    receipt: {
      title: 'إيصال',
      receiptNo: 'إيصال رقم',
      date: 'التاريخ',
      cashier: 'الكاشير',
      item: 'الصنف',
      qty: 'الكمية',
      unitPrice: 'سعر الوحدة',
      lineTotal: 'المجموع',
      total: 'الإجمالي',
      paymentLabel: 'طريقة الدفع',
      paymentCash: 'نقداً',
      paymentCard: 'بطاقة',
      taxIdLabel: 'ICE',
      thankYou: 'شكراً لزيارتكم',
      print: 'طباعة',
      newSale: 'بيع جديد',
    },
    invoice: {
      title: 'فاتورة',
      invoiceNo: 'فاتورة رقم',
      taxRate: 'المعدل',
      taxBaseHT: 'الأساس خ.ض',
      taxAmount: 'م.ض.م',
      taxTotalTTC: 'م.ش.ض',
      disclaimer: 'وثيقة تحل محل الفاتورة',
      generate: 'إصدار فاتورة',
      generating: 'جاري الإصدار...',
      generated: 'فاتورة {n}',
      iceLabel: 'ICE',
      ifLabel: 'IF',
      rcLabel: 'RC',
    },
    discount: {
      titleLine: 'خصم على السطر',
      titleCart: 'خصم على السلة',
      percentage: 'نسبة مئوية (%)',
      fixed: 'مبلغ ثابت (درهم)',
      value: 'القيمة',
      amount: 'الخصم',
      apply: 'تطبيق',
      cancel: 'إلغاء',
      remove: 'إزالة',
      approvalRequired: 'يتطلب اعتماد المدير',
      invalid: 'قيمة غير صحيحة',
      label: 'خصم',
      addLine: 'خصم',
      addCart: 'خصم على السلة',
    },
    waste: {
      title: 'تسجيل الهالك',
      subtitle: 'سجّل المنتجات التالفة أو المنتهية',
      selectProduct: 'اختر المنتج',
      searchProduct: 'ابحث عن منتج...',
      quantity: 'الكمية',
      unitGrams: 'غرام',
      unitPieces: 'قطعة',
      reasonHeading: 'السبب',
      reason: {
        SPOILED: 'تالف',
        EXPIRED: 'منتهي الصلاحية',
        PREP_DAMAGE: 'تلف أثناء التحضير',
        OTHER: 'أخرى',
      },
      notes: 'ملاحظات (اختياري)',
      notesPlaceholder: 'تفاصيل إضافية...',
      charactersRemaining: 'حرف متبقي',
      submit: 'تسجيل الهالك',
      submitting: 'جاري الحفظ...',
      recordAnother: 'تسجيل آخر',
      backToPos: 'العودة إلى نقطة البيع',
      success: '✓ تم تسجيل الهالك',
      errorSubmit: 'فشل تسجيل الهالك',
      errorNoProduct: 'يرجى اختيار منتج',
      errorNoQuantity: 'يرجى إدخال كمية صحيحة',
      errorNoReason: 'يرجى اختيار السبب',
      recentHeading: 'آخر السجلات في هذه الوردية',
      recentEmpty: 'لا توجد سجلات بعد',
      thresholdNotice: 'هذه الكمية تتجاوز 10 كغ — يلزم اعتماد المدير',
      posButtonLabel: 'تسجيل هالك',
      colProduct: 'المنتج',
      colQty: 'الكمية',
      colReason: 'السبب',
      colTime: 'الوقت',
      approvedBy: 'اعتمد بواسطة',
      chainHashLabel: 'تسلسل التحقق',
      chainTooltip: 'تسلسل تشفيري — يضمن سلامة السجلات',
      scanBarcode: 'مسح الباركود',
      scanProductTitle: 'مسح منتج للهالك',
    },
    managerPin: {
      title: 'اعتماد المدير مطلوب',
      subtitle: 'هذه الكمية تتطلب موافقة مدير',
      selectManager: 'اختر المدير',
      enterPin: 'أدخل رمز PIN الخاص بالمدير',
      changeManager: 'تغيير المدير',
      invalidPin: 'رمز PIN غير صحيح',
      attemptsLeft: 'المحاولات المتبقية',
      lockoutTitle: 'تم قفل الإدخال مؤقتاً',
      lockoutMessage: 'يرجى الانتظار {seconds} ثانية',
      cancel: 'إلغاء',
      approving: 'جاري التحقق...',
      noManagers: 'لا يوجد مدراء متاحون',
      promptBody: 'هذه العملية تتطلب تفويض المدير',
      pinLabel: 'رمز PIN',
      confirm: 'تأكيد',
      errorConnection: 'خطأ في الاتصال — حاول مجدداً',
      enterFullPin: 'أدخل الرمز كاملاً',
      authTitle: 'تفويض المدير',
    },
    analytics: {
      title: 'لوحة تحليل البيانات',
      totalSales: 'إجمالي المبيعات',
      transactions: 'عدد العمليات',
      shifts: 'عدد الورديات',
      wasteKg: 'الهالك (كغ)',
      salesTrend: 'مبيعات آخر {days} أيام',
      paymentSplit: 'طرق الدفع',
      topProducts: 'أعلى المنتجات مبيعاً',
      wasteAnalysis: 'تحليل الهالك',
      shiftsPerformance: 'أداء الورديات',
      accessDenied: 'هذه الصفحة للمديرين فقط',
      loading: 'جاري تحميل البيانات...',
      noData: 'لا توجد بيانات للفترة المحددة',
      days7: '7 أيام',
      days30: '30 يوم',
      days90: '90 يوم',
      backToPos: 'العودة إلى نقطة البيع',
      cashPayments: 'نقدي',
      cardPayments: 'بطاقة',
      colCashier: 'الكاشير',
      colOpened: 'الافتتاح',
      colClosed: 'الإغلاق',
      colSales: 'المبيعات',
      colTx: 'العمليات',
      colProduct: 'المنتج',
      colQty: 'الكمية',
      colRevenue: 'الإيرادات',
      posButtonLabel: 'تحليلات',
      overviewTab: 'نظرة عامة',
      daysLabel: '{days} أيام',
      activeDays: '{n} أيام نشطة',
      wasteRecorded: 'الهالك المسجل',
      kg: 'كغ',
      wasteRecordsCount: '{n} سجل هالك',
      salesLabel: 'المبيعات',
      txShort: 'عملية',
      duration: 'المدة',
      noWasteRecords: 'لا توجد سجلات هالك في هذه الفترة',
      noShifts: 'لا توجد ورديات في هذه الفترة',
      totalWaste: 'إجمالي الهالك',
      recordsShort: 'سجل',
      shiftsShort: 'الورديات',
      topProductsShort: 'أعلى المنتجات',
      currency: 'د.م',
    },
    cashflow: {
      title: 'التدفق النقدي — 30 يوماً',
      loading: 'جارٍ تحميل التدفق النقدي...',
      loadError: 'تعذر تحميل بيانات التدفق النقدي',
      noData: 'لا توجد بيانات',
      openingBalance: 'رصيد افتتاحي:',
      worstBalance: 'أسوأ رصيد:',
      dailyBalance: 'الرصيد اليومي المتوقع',
      totalInflow: 'إجمالي الإيرادات',
      supplierObligations: 'التزامات الموردين',
      customerCredit: 'ذمم الزبائن',
      upcomingTitle: 'التزامات 14 يوماً القادمة',
      overdue: '(متأخر)',
      daysShort: '({n}ي)',
      obligationsLabel: 'التزامات:',
      risk: {
        none: 'التدفق النقدي متوازن في الـ 30 يوماً القادمة',
        low: 'ملاحظة: مديونيات الزبائن مرتفعة — تابع التحصيل',
        medium: 'الاحتياطي النقدي منخفض — راجع التزامات الموردين',
        high: 'تحذير: ضغط نقدي متوقع خلال 14 يوماً',
        critical: '⚠️ خطر: الرصيد سيصبح سالباً خلال 7 أيام ({days} يوم متأثر)',
      },
    },
    insights: {
      tabRisk: 'خطر الكريدي',
      tabSuggestions: 'الاقتراحات',
      noRisk: 'لا توجد زبائن في منطقة خطر',
      noSuggestions: 'لا توجد اقتراحات نشطة',
      done: 'تم التصرف',
      suggestionTypes: {
        credit_block: '🚫 تجميد الكريدي',
        credit_warning: '⚠️ تنبيه رصيد',
        reactivation: '🔔 إعادة تنشيط',
        loyalty_reward: '🎁 مكافأة ولاء',
        upsell: '📈 بيع إضافي',
      },
    },
    forecast: {
      title: 'توقعات الطلب',
      reorderTitle: 'تنبيهات إعادة الطلب',
      predicted: 'المتوقع',
      onHand: 'المخزون',
      noAlerts: 'لا توجد تنبيهات إعادة طلب اليوم',
      noForecasts: 'لا توجد توقعات متاحة',
      units: 'وحدة',
    },
    assistant: {
      title: 'مساعد التحليلات',
      subtitle: 'اسأل عن مبيعاتك بالعربية أو الفرنسية',
      examplesIntro: 'أمثلة على أسئلة يمكنك طرحها:',
      placeholder: 'اسأل عن مبيعاتك...',
      analyzing: 'جارٍ التحليل...',
      errorGeneric: 'خطأ في المساعد',
      errorConnection: 'تعذر الاتصال بالمساعد',
      suggested: {
        topProducts: 'ما هي أكثر المنتجات مبيعاً هذا الأسبوع؟',
        peakHours: 'ما هي ساعات الذروة في المبيعات؟',
        creditBalances: 'من لديه رصيد كريدي مرتفع؟',
        suspiciousAlerts: 'هل هناك تنبيهات مشبوهة اليوم؟',
        reorder: 'ما المنتجات التي تحتاج إعادة طلب؟',
      },
    },
    integrity: {
      tabLabel: 'النزاهة',
      title: 'لوحة نزاهة الكاشير',
      loading: 'جاري تحميل البيانات...',
      noData: 'لا توجد بيانات للفترة المحددة',
      colCashier: 'الكاشير',
      colTotalTx: 'العمليات',
      colVoidRate: 'نسبة الإلغاء',
      colDiscountRate: 'نسبة الخصم الكبير',
      colReturnRate: 'نسبة المرتجعات',
      colCashShare: 'نسبة النقدي',
      colAvgTxTime: 'متوسط وقت العملية',
      colCashDiscrepancy: 'فرق الصندوق',
      colAnomalies: 'التنبيهات',
      anomalyBadge: 'تنبيه',
      drilldownTitle: 'تفاصيل',
      drilldownVoids: 'إلغاءات',
      drilldownDiscounts: 'خصومات كبيرة',
      drilldownReturns: 'مرتجعات كبيرة',
      drilldownCashShare: 'نسبة الدفع النقدي',
      drilldownAvgTime: 'متوسط ​​وقت العملية (ث)',
      drilldownDiscrepancy: 'متوسط ​​فرق الصندوق',
      disclaimer: 'هذه البيانات تحليلية إرشادية فقط. يُرجى التحقق من الوقائع قبل اتخاذ أي إجراء.',
    },
    customer: {
      title: 'العميل',
      phone: 'رقم الهاتف',
      name: 'الاسم',
      lookup: 'بحث',
      notFound: 'عميل غير موجود',
      add: 'إضافة عميل',
      added: 'تم إضافة العميل',
      visits: 'زيارات',
      spent: 'إجمالي الإنفاق',
      history: 'آخر المشتريات',
      noHistory: 'لا توجد مشتريات سابقة',
      notes: 'ملاحظات',
      skip: 'تخطي',
      loyalty: {
        title: 'بطاقة الولاء',
        stamps: 'طوابع',
        stampsUntil: 'طابع حتى المكافأة',
        rewardReady: '🎉 مكافأة جاهزة!',
        reward: 'المكافأة',
        noProgram: 'لا يوجد برنامج ولاء',
      },
      createAndSelect: 'إنشاء واختيار',
      withoutCustomer: 'بدون عميل',
      done: 'تم',
      cancel: 'إلغاء',
      confirm: 'تأكيد',
    },
    card: {
      title: 'دفع بالبطاقة',
      initiate: 'ابدأ الدفع',
      idleInstruction: 'لا تقرّب البطاقة من الطرفية حتى تظهر الإشارة',
      sending: 'إرسال للطرفية...',
      presentCard: 'قدّم بطاقتك للطرفية',
      timeoutIn: 'المهلة: {n}ث',
      processing: 'جارٍ المعالجة...',
      approved: 'تمت الموافقة',
      approvalCode: 'الكود:',
      declined: 'رُفض الدفع',
      timeout: 'انتهت المهلة',
      error: 'الطرفية غير متاحة',
      errorDetail: 'تفاصيل (تقني)',
      terminalUnavailable: 'الطرفية غير متاحة — تحقق من التوصيل',
      retry: 'أعد المحاولة',
      cancel: 'إلغاء',
    },
    returns: {
      buttonLabel: 'مرتجع',
      title: 'إرجاع / استرداد',
      lookupPlaceholder: 'رقم الإيصال (مثال: R-000042)',
      lookup: 'بحث',
      noReceipt: 'بدون إيصال',
      loading: 'جارٍ التحميل...',
      receiptNotFound: 'الإيصال غير موجود',
      fullyReturned: 'جميع أصناف هذا الإيصال مُرجَعة بالفعل',
      selectItems: 'اختر الأصناف المراد إرجاعها',
      qty: 'الكمية',
      maxQty: 'الحد الأقصى: {n}',
      disposition: 'التصرف',
      restock: 'إعادة للمخزون',
      damaged: 'تالف',
      discard: 'للتخلص',
      freeformTitle: 'إرجاع بدون إيصال',
      addItem: 'إضافة صنف',
      itemName: 'اسم الصنف',
      unitPrice: 'السعر الوحدوي (درهم)',
      managerPinTitle: 'مطلوب موافقة المدير',
      managerPinReason: 'هذا الإرجاع يتجاوز الحد المسموح به ويستلزم اعتماد مدير.',
      managerPinFreeform: 'الإرجاع بدون إيصال يستلزم دائماً اعتماد مدير.',
      managerId: 'رقم المدير',
      managerPin: 'رمز PIN المدير',
      refundMethod: 'طريقة الاسترداد',
      cash: 'نقداً',
      card: 'بطاقة',
      storeCredit: 'رصيد متجر',
      total: 'إجمالي المسترد',
      confirm: 'تأكيد الإرجاع',
      processing: 'جارٍ المعالجة...',
      successTitle: 'تم تسجيل الإرجاع',
      returnNumber: 'رقم الإرجاع: {n}',
      done: 'إنهاء',
      error: 'خطأ في تسجيل الإرجاع',
      retry: 'أعد المحاولة',
      cancel: 'إلغاء',
    },
    lana: {
      title: 'دفع Lana Cash',
      posButtonLabel: 'Lana',
      generate: 'إنشاء رمز QR',
      generating: 'جارٍ الإنشاء...',
      scanInstruction: 'اطلب من العميل مسح رمز QR بتطبيق Lana Cash',
      timeoutIn: 'تنتهي خلال {n}ث',
      paid: 'تم الدفع!',
      recording: 'جارٍ التسجيل...',
      expired: 'انتهت صلاحية رمز QR',
      errorRecovery: 'تم الدفع لكن فشل التسجيل. اتصل بالدعم.',
    },
    stock: {
      inStock: 'متوفر',
      lowStock: 'مخزون منخفض',
      outOfStock: 'نفد',
      units: 'وحدة',
      kg: 'كغ',
      alertTitle: 'تنبيهات المخزون',
      alertEmpty: 'لا توجد تنبيهات',
      threshold: 'الحد الأدنى',
      close: 'إغلاق',
    },
    sync: {
      online: 'متصل',
      offline: 'غير متصل',
      pending: 'مزامنة: {n}',
      provisional: 'إيصال مؤقت',
      willSync: 'سيتزامن',
    },
    markdown: {
      labelButton: 'طباعة البطاقة',
      modalTitle: 'بطاقة التخفيض',
      originalPrice: 'السعر الأصلي',
      effectivePrice: 'السعر المخفض',
      printButton: 'طباعة',
      close: 'إغلاق',
    },
    stores: {
      tabLabel: 'المتاجر',
      title: 'نظرة عامة على المتاجر',
      store: 'المتجر',
      sales: 'المبيعات',
      transactions: 'المعاملات',
      waste: 'الهدر',
      discounts: 'الخصومات',
      viewDetail: 'عرض التفاصيل',
      backToStores: 'العودة للمتاجر',
      noStores: 'لا توجد متاجر',
      accessDenied: 'هذا القسم متاح للمشرفين فقط',
    },
    orders: {
      title: 'الطلبات',
      badge: 'طلب جديد',
      new: 'جديد',
      reviewing: 'قيد المراجعة',
      confirmed: 'مؤكد',
      preparing: 'قيد التحضير',
      ready: 'جاهز',
      completed: 'مكتمل',
      cancelled: 'ملغى',
      pickup: 'استلام من المتجر',
      delivery: 'توصيل',
      cashOnDelivery: 'نقداً عند الاستلام',
      virement: 'تحويل بنكي',
      tpe: 'بطاقة بنكية',
      paymentReceived: 'تم استلام الدفع',
      customerMessage: 'رسالة العميل',
      deliveryAddress: 'عنوان التوصيل',
      scheduledAt: 'وقت التسليم',
      assignTo: 'تعيين لـ',
      notes: 'ملاحظات',
      convertToSale: 'تحويل إلى مبيعة',
      noOrders: 'لا توجد طلبات',
      markPaymentReceived: 'تأكيد استلام الدفع',
      close: 'إغلاق',
      cancelOrder: 'إلغاء الطلب',
      confirmCancel: 'هل تريد إلغاء هذا الطلب؟',
      backToList: 'العودة للقائمة',
      filterAll: 'الكل',
      filterNew: 'الجديدة',
      filterInProgress: 'جارية',
      filterDone: 'المنتهية',
      sendToKds: '🍳 أرسل للمطبخ',
      kdsSent: 'أُرسل للمطبخ ✓',
      kdsExisting: 'موجود في المطبخ ✓',
      statusLabel: 'الحالة',
      fulfillmentLabel: 'نوع الطلب',
      paymentLabel: 'طريقة الدفع',
    },
    suppliers: {
      title: 'الموردون',
      add: 'إضافة مورد',
      name: 'اسم المورد',
      phone: 'هاتف',
      address: 'العنوان',
      notes: 'ملاحظات',
      noSuppliers: 'لا يوجد موردون',
      errorNameRequired: 'اسم المورد مطلوب',
      suggestedQty: 'طلب مقترح',
      receiving: {
        title: 'استلام بضاعة',
        newDelivery: 'استلام جديد',
        supplier: 'المورد',
        product: 'المنتج',
        quantity: 'الكمية',
        unitCost: 'تكلفة الوحدة',
        totalCost: 'التكلفة الإجمالية',
        addLine: 'إضافة منتج',
        confirm: 'تأكيد الاستلام',
        confirmed: 'تم استلام البضاعة',
        draft: 'مسودة',
        received: 'مستلم',
        history: 'سجل الاستلام',
        ocrScan: '📷 مسح الفاتورة',
        ocrScanning: 'جارٍ التحليل...',
        ocrSuccess: 'تم اكتشاف {n} سطراً — {m} منتج تم التعرف عليه. راجع وصحح قبل التأكيد.',
        ocrError: 'فشل تحليل الصورة',
        ocrNotConfigured: 'OCR غير مفعّل — يرجى إعداد المزود',
        ocrUnmatched: '⚠ منتج غير معروف — اختر من القائمة',
        cancelled: 'ملغى',
        notes: 'ملاحظات',
        optional: 'اختياري',
        unitCostPiastres: 'تكلفة الوحدة (سنتيم)',
        productsUpdated: 'منتج تم تحديثه',
        markdownClockReset: 'تم إعادة ضبط ساعة التخفيض التلقائي',
        forecastSuggestion: 'توقع 7 أيام: {n} وحدة مقترحة',
        productsCount: 'منتج',
        errorNoProducts: 'أضف منتجاً صالحاً واحداً على الأقل',
      },
      ledger: {
        title: 'الكونّاش',
        balance: 'الرصيد',
        invoices: 'الفواتير',
        payments: 'المدفوعات',
        newInvoice: 'فاتورة جديدة',
        recordPayment: 'تسجيل دفع',
        invoiceRef: 'رقم الفاتورة',
        invoiceDate: 'تاريخ الفاتورة',
        dueDate: 'تاريخ الاستحقاق',
        tax: 'الضريبة',
        total: 'الإجمالي',
        paid: 'المدفوع',
        remaining: 'المتبقي',
        status: 'الحالة',
        statusUnpaid: 'غير مدفوع',
        statusPartial: 'جزئي',
        statusPaid: 'مدفوع',
        statusCancelled: 'ملغى',
        payMethod: 'طريقة الدفع',
        payReference: 'المرجع',
        payDate: 'تاريخ الدفع',
        description: 'البيان',
        unit: 'الوحدة',
        unitCost: 'سعر الوحدة (د.م.)',
        quantity: 'الكمية',
        addLine: 'إضافة سطر',
        save: 'حفظ',
        cancel: 'إلغاء',
        noInvoices: 'لا توجد فواتير',
        noPayments: 'لا توجد مدفوعات',
        selectSupplier: 'اختر مورداً',
        cancelled: 'ملغى',
        currency: 'د.م.',
        optional: 'اختياري',
        errorNoLines: 'أضف سطراً واحداً على الأقل',
        errorAmountRequired: 'المبلغ مطلوب',
        product: 'المنتج (اختياري)',
        searchProduct: 'ابحث عن منتج...',
        noProductMatch: 'لا توجد نتائج',
        clearProduct: 'إزالة الربط',
        costAlertsTitle: 'تنبيه تكلفة الشراء',
        costAlertsHint: 'للعلم فقط — لم يتم تغيير أي سعر بيع.',
        costOld: 'التكلفة السابقة',
        costNew: 'التكلفة الجديدة',
        costIncrease: 'الزيادة',
        marginBefore: 'الهامش قبل',
        marginAfter: 'الهامش بعد',
        belowCost: 'أقل من التكلفة',
        dismiss: 'إغلاق',
        paymentMethods: {
          cash: 'نقداً',
          bank_transfer: 'تحويل بنكي',
          cheque: 'شيك',
          mobile: 'دفع عبر الهاتف',
          other: 'أخرى',
        },
      },
    },
    license: {
      activationTitle: 'تفعيل البرنامج',
      instructions: 'أدخل مفتاح الترخيص الذي وصلك عبر واتساب بعد التسجيل في منصة MAGHAREBIT.',
      keyLabel: 'مفتاح الترخيص',
      activateButton: 'تفعيل البرنامج',
      verifying: 'جارٍ التحقق...',
      errorEmptyKey: 'أدخل مفتاح الترخيص',
      errorRevoked: 'هذا المفتاح موقوف. تواصل مع الدعم.',
      errorChecksum: 'مفتاح غير صالح. تحقق من الكتابة.',
      errorExpired: 'انتهت صلاحية الترخيص. جدد اشتراكك.',
      errorMachineMismatch: 'هذا المفتاح مرتبط بجهاز آخر.',
      errorGeneric: 'فشل التفعيل. حاول مجدداً.',
      errorNetwork: 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.',
      revokedTitle: 'الترخيص موقوف',
      revokedBody: 'تم إيقاف هذا الترخيص. يرجى التواصل مع الدعم الفني لإعادة التفعيل.',
      whatsappButton: 'تواصل عبر واتساب',
      expiredTitle: 'انتهت صلاحية الترخيص',
      expiredBody: 'انتهت صلاحية اشتراكك. جدد عبر منصة MAGHAREBIT للاستمرار.',
      renewButton: 'تجديد الاشتراك',
      daysLeftBanner: 'ينتهي ترخيصك خلال {days} أيام',
      daysLeftOne: 'يوم واحد متبقٍ — جدد الآن',
      daysLeftTwo: 'يومان متبقيان — جدد الآن',
      daysLeftFew: '{days} أيام متبقية — جدد الآن',
      daysLeftMany: '{days} يوماً متبقياً — جدد الآن',
      renewNow: 'جدد الآن',
    },
    course: {
      panelTitle: 'الأطباق',
      noCourse: 'بدون طبق (فوري)',
      courseN: 'طبق {n}',
      fire: 'أرسل الطبق',
      fired: 'تم الإرسال',
      held: 'محجوز',
      none: 'بدون',
      allergies: 'الحساسية',
      save: 'حفظ',
      cancel: 'إلغاء',
      empty: 'لا توجد أصناف في الطلب',
      takeaway: 'سفري',
      errorLoad: 'تعذر تحميل الطلب',
      errorFire: 'فشل إرسال الطبق',
      errorSave: 'فشل الحفظ',
      errorStarted: 'بدأ المطبخ بهذا الصنف بالفعل',
    },
    voice: {
      tapToSpeak: 'اضغط للكلام',
      listening: 'جارٍ الاستماع...',
      notSupported: 'الأوامر الصوتية غير مدعومة في هذا المتصفح',
      noMic: 'لم يُسمح بالميكروفون',
      noSpeech: 'لم يُكتشف صوت',
      networkError: 'خطأ في الشبكة',
      error: 'خطأ صوتي',
      clearConfirm: 'امسح الطلب؟',
      cancel: 'إلغاء',
    },
    nav: {
      branches: 'الفروع',
    },
    branches: {
      title: 'الفروع',
      tabOverview: 'لوحة التحكم',
      tabStock: 'مقارنة المخزون',
      tabTransfers: 'النقل',
      refresh: 'تحديث',
      totalRevenue: 'إيرادات اليوم (كل الفروع)',
      activeShifts: 'الورديات المفتوحة',
      todayRevenue: 'إيرادات اليوم',
      transactions: 'العمليات',
      staff: 'الموظفون',
      inactiveBranch: 'غير نشط',
      noBranches: 'لا توجد فروع',
      product: 'المنتج',
      stockNotice: 'المخزون غير مفصول حسب الفرع بعد، والأرقام تخص الشركة كلها',
      transfer: '+ نقل',
      fromStore: 'من فرع',
      toStore: 'إلى فرع',
      quantity: 'الكمية',
      submit: 'إرسال',
      cancel: 'إلغاء',
      noProducts: 'لا توجد منتجات',
      noTransfers: 'لا توجد عمليات نقل',
      approve: 'موافقة',
      markReceived: 'تم الاستلام',
      cancelTransfer: 'إلغاء النقل',
      status: {
        pending: 'قيد الانتظار',
        approved: 'موافق عليه',
        in_transit: 'قيد النقل',
        received: 'تم الاستلام',
        cancelled: 'ملغى',
      },
      errorLoad: 'تعذر تحميل البيانات',
      errorSave: 'تعذر تنفيذ العملية',
      errorSameStore: 'اختر فرعين مختلفين',
    },
    scale: {
      title: 'الميزان',
      connect: 'اتصال',
      connecting: 'جارٍ الاتصال...',
      connected: 'متصل ✓',
      disconnect: 'قطع الاتصال',
      readWeight: 'قراءة الوزن',
      stabilize: 'ثبّت الميزان',
      port: 'المنفذ (COM)',
      baudRate: 'سرعة الاتصال',
      selectScale: 'اختر نوع الميزان',
      driverAvailable: 'متاح ✓',
      driverStub: 'قيد التطوير',
      testRead: 'اختبار القراءة',
      weightResult: '{n} غرام',
      errorNoDriver: 'برنامج تشغيل هذا الميزان غير متوفر بعد',
      notConnected: 'الميزان غير متصل',
      weightUnit: 'كيلوغرام',
      stable: 'مستقر',
      unstable: 'غير مستقر',
      addToCart: 'أضف للسلة',
      noWebSerial: 'Web Serial غير مدعوم',
      tare: 'صفّر',
      errorNoSerial: 'Web Serial غير مدعوم في هذا المتصفح. استخدم Chrome أو Edge.',
      errorConnect: 'فشل الاتصال بالميزان: {msg}',
      errorDisconnected: 'انقطع الاتصال بالميزان',
    },
    barcode: {
      defaultTitle: 'مسح الباركود',
      permissionDenied: 'يرجى السماح بالوصول إلى الكاميرا',
      permissionNote: 'يلزم الإذن بالكاميرا لمسح الباركود.',
      retry: 'حاول مرة أخرى',
      aim: 'وجّه الكاميرا نحو الباركود',
    },
    printer: {
      noWebUsb: 'المتصفح لا يدعم Web USB',
      noWebUsbHint: 'استخدم Chrome أو Edge للطباعة عبر USB.',
      status: 'الحالة',
      supported: 'الطابعات المدعومة: طابعات ESC/POS الحرارية 80mm عبر USB (Epson TM, BIXOLON, Xprinter وما يشابهها).',
      connect: 'توصيل طابعة USB',
      connecting: 'جارٍ الاتصال…',
      disconnect: 'قطع الاتصال',
      statusDisconnected: 'غير متصل',
      statusConnecting: 'جارٍ الاتصال…',
      statusConnected: 'متصل ✓',
      statusError: 'خطأ في الطابعة',
    },
    split: {
      total: 'الإجمالي',
      currencySuffix: 'د.م',
      fillRemaining: 'ملء المبلغ المتبقي',
      addTender: '+ إضافة وسيلة دفع',
      balanced: 'المبلغ متطابق',
      remaining: 'متبقي {n}',
      overpaid: 'زيادة {n}',
      errorLoadMethods: 'فشل تحميل وسائل الدفع',
      errorStatus: 'خطأ {n}',
    },
    credit: {
      buttonEmpty: '+ كريدي / زبون',
      buttonWithName: 'كريدي — {name}',
      viewBalance: 'عرض رصيد {name}',
      searchTitle: 'اختر زبون / كريدي',
      searchPlaceholder: 'ابحث بالاسم أو الهاتف...',
      searching: 'جارٍ البحث...',
      balanceClear: 'صافي',
      addNew: '+ إضافة زبون جديد "{name}"',
      namePlaceholder: 'اسم الزبون *',
      phonePlaceholder: 'الهاتف (اختياري)',
      save: 'حفظ',
      balanceLabel: 'الرصيد المستحق',
      limitLabel: 'الحد: {n} د.م',
      riskBanner: 'هذا الزبون في منطقة خطر الكريدي',
      amountPlaceholder: 'المبلغ بالدرهم',
      notePlaceholder: 'ملاحظة (اختياري)',
      chargeBtn: '+ دَيْن (كريدي)',
      payBtn: 'دفع',
      showHistory: 'عرض السجل',
      hideHistory: 'إخفاء السجل',
      noTransactions: 'لا توجد معاملات',
      txCharge: 'دَيْن',
      txPayment: 'دفع',
      currencySuffix: 'د.م',
      errorInvalidAmount: 'أدخل مبلغاً صحيحاً',
      errorLimitExceeded: 'تجاوز الحد الائتماني ({n} د.م)',
      errorGeneric: 'حدث خطأ',
    },
    tableMap: {
      title: 'خريطة الطاولات',
      loading: 'جارٍ التحميل...',
      capacity: '{n} أشخاص',
      statusAvailable: 'شاغر',
      statusOccupied: 'مشغول',
      statusBilled: 'فاتورة',
      statusReserved: 'محجوز',
    },
    modifiers: {
      selectAddons: 'اختر الإضافات',
      loading: 'جارٍ التحميل...',
      total: 'الإجمالي',
      currencySuffix: 'د.م',
      addToOrder: 'أضف للطلب',
    },
    productQR: {
      generating: 'جاري التوليد...',
      download: 'تحميل PNG',
    },
    kds: {
      title: 'شاشة المطبخ',
      sendToKitchen: 'أرسل للمطبخ',
      sentToKitchen: 'تم الإرسال للمطبخ ✓',
      alreadyInKitchen: 'موجود في المطبخ ✓',
      new: 'جديد',
      preparing: 'قيد التحضير',
      ready: 'جاهز ✓',
      done: 'تم التسليم',
      start: '▶ ابدأ',
      markReady: '✓ جاهز',
      markDone: '✓ سُلِّم',
      walkin: 'طلب مباشر',
      whatsapp: 'واتساب',
      table: 'طاولة',
      takeaway: 'للمحل',
      tableNumber: 'رقم الطاولة',
      noOrders: 'لا توجد طلبات',
      elapsed: 'منذ',
      ordersCompleted: 'مكتملة',
      backToPOS: '← POS',
      newOrderAlert: 'طلب جديد!',
      fulfillmentSurPlace: '🪑 على الطاولة',
      fulfillmentEmporter: '🥡 للمحل',
      notesPlaceholder: 'ملاحظات...',
      send: 'إرسال',
      cancel: 'إلغاء',
      pending: 'انتظار',
      refresh: 'تحديث ↺',
      tapToAdvance: '← للتقدم اضغط',
      enableSound: 'تفعيل الصوت',
      soundOn: '🔊 الصوت مفعّل',
      soundOff: '🔇 كتم الصوت',
      tapToEnableSound: 'اضغط لتفعيل الصوت 🔔',
      newOrder: 'طلب جديد!',
      sessionExpired: 'انتهت الجلسة',
      signInToContinue: 'سجّل الدخول للمتابعة',
    },
    products: {
      title: 'المنتجات',
      add: 'إضافة منتج',
      edit: 'تعديل',
      delete: 'حذف',
      save: 'حفظ',
      cancel: 'إلغاء',
      nameAr: 'الاسم بالعربية',
      nameFr: 'الاسم بالفرنسية',
      category: 'الفئة',
      price: 'السعر (درهم)',
      barcode: 'الباركود',
      plu: 'رمز PLU',
      image: 'صورة المنتج',
      uploadImage: 'رفع صورة',
      imageHint: 'JPG/PNG/WebP — سيتم تحجيمها تلقائياً',
      isWeighted: 'منتج موزون',
      uom: 'وحدة القياس',
      isPerishable: 'قابل للتلف (تخفيض تلقائي)',
      trackStock: 'تتبع المخزون',
      stockQty: 'الكمية الحالية',
      lowStockThreshold: 'حد المخزون المنخفض',
      description: 'الوصف',
      businessFields: 'حقول إضافية',
      businessType: 'نوع النشاط التجاري',
      setBusinessType: 'اختر نوع نشاطك التجاري',
      noProducts: 'لا توجد منتجات',
      searchProducts: 'بحث في المنتجات',
      confirmDelete: 'هل أنت متأكد من حذف هذا المنتج؟',
      deleted: 'تم حذف المنتج',
      saved: 'تم حفظ المنتج',
      imageUpdated: 'تم تحديث الصورة',
      loading: 'جارٍ التحميل...',
      allCategories: 'كل الفئات',
      categoryPlaceholder: '— اختر فئة —',
      statsTotal: 'إجمالي',
      statsActive: 'نشط',
      statsInactive: 'موقوف',
      stockLabel: 'مخزون',
      addTitle: 'إضافة منتج جديد',
      editPrefix: 'تعديل: ',
      cost: 'سعر التكلفة (د.م)',
      isActive: 'نشط',
      addButton: 'إضافة',
      inactiveBadge: 'موقوف',
      errorNameRequired: 'الاسم بالعربية مطلوب',
      errorSave: 'فشل الحفظ',
      errorConnection: 'تعذر الاتصال بالخادم',
      successAdd: 'تم إضافة المنتج بنجاح ✓',
      successEdit: 'تم تحديث المنتج بنجاح ✓',
      confirmDeleteMsg: 'هل تريد حذف "{name}"؟',
      uomLabels: { UNIT: 'وحدة', KG: 'كجم', G: 'جرام', L: 'لتر', ML: 'مل', BUNCH: 'حزمة', BOX: 'صندوق', BAG: 'كيس', PIECE: 'قطعة' },
      removeImage: 'حذف الصورة',
      imageTooBig: 'حجم الصورة كبير (الحد الأقصى 20 ميغابايت)',
      imageInvalidType: 'نوع غير مدعوم',
      imageUploading: 'جارٍ الرفع...',
      margin: 'الهامش',
    },
    staff: {
      title: 'إدارة الموظفين',
      addNew: '+ موظف جديد',
      loading: 'جارٍ التحميل...',
      noStaff: 'لا يوجد موظفون',
      addTitle: 'إضافة موظف جديد',
      editPrefix: 'تعديل: ',
      nameArLabel: 'الاسم بالعربية *',
      nameFrLabel: 'الاسم بالفرنسية',
      roleLabel: 'الدور',
      pinLabel: 'PIN *',
      pinNew: 'PIN جديد (اتركه فارغاً للإبقاء)',
      pinConfirm: 'تأكيد PIN',
      editButton: 'تعديل',
      deactivate: 'إيقاف',
      activate: 'تفعيل',
      addButton: 'إضافة',
      saveButton: 'حفظ',
      cancelButton: 'إلغاء',
      errorNameRequired: 'الاسم بالعربية مطلوب',
      errorPinLength: 'PIN يجب أن يكون 4 أرقام على الأقل',
      errorPinMismatch: 'PIN غير متطابق',
      errorSave: 'فشل الحفظ',
      errorConnection: 'تعذر الاتصال بالخادم',
      successAdd: 'تم إضافة الموظف بنجاح ✓',
      successEdit: 'تم تحديث الموظف بنجاح ✓',
      roles: { CASHIER: 'كاشير', SENIOR_CASHIER: 'كاشير أول', INVENTORY: 'مسؤول المخزون', MANAGER: 'مدير', SUPERVISOR: 'مشرف' },
    },
    alerts: {
      types: { rapid_voids: 'إلغاء متكرر ⚠️', void_spike: 'ارتفاع معدل الإلغاء', discount_over_limit: 'خصم استثنائي', unusual_discount: 'خصم غير معتاد', cash_discrepancy: 'فرق في الصندوق 💰', price_override: 'تغيير سعر', unusual_refund: 'استرداد مشبوه' },
      score: 'درجة: {score} / 100',
      acknowledge: 'تم ✓',
    },
  },
  fr: {
    brand: {
      name: 'MAGHAREBIT POS',
      logoAlt: 'Logo MAGHAREBIT',
      copyright: '© 2026 MAGHAREBIT — Wayloz Group',
    },
    shift: {
      title: 'MAGHAREBIT POS',
      subtitle: 'Ouvrir un nouveau service',
      selectCashier: 'Sélectionner le caissier',
      cashierLabel: 'Caissier',
      changeCashier: 'Changer',
      enterPin: 'Entrer le code PIN',
      clear: 'Effacer',
      editPin: 'Modifier PIN',
      openingFloat: 'Fonds de caisse (optionnel)',
      startShift: 'Démarrer le service',
      starting: 'Démarrage...',
      loading: 'Chargement...',
      errorConnect: 'Erreur de connexion au serveur',
      errorOpen: "Échec d'ouverture du service",
      errorUnknown: 'Erreur inconnue',
      role: { CASHIER: 'Caissier', MANAGER: 'Manager', SUPERVISOR: 'Superviseur' },
      licenseTitle: 'Licence non activée',
      licenseBody: "La licence du logiciel n'a pas pu être validée. Veuillez contacter le support pour activer ou renouveler l'abonnement.",
      licenseSupport: 'Support',
    },
    pos: {
      searchPlaceholder: 'Rechercher un produit ou scanner un code-barres',
      loading: 'Chargement...',
      noProducts: 'Aucun produit',
      allCategories: 'Toutes catégories',
      productsCount: '{n} produit(s)',
      backToCategories: 'Retour aux catégories',
      cashierLabel: 'Caissier',
      shiftStarted: 'Début',
      closeShift: 'Fermer le service',
      cart: 'Panier',
      cartEmpty: 'Panier vide',
      bomNotice: 'Inclut la déduction automatique des ingrédients',
      delete: 'Supprimer',
      subtotal: 'Sous-total',
      tax: 'TVA (20%)',
      total: 'Total',
      cash: 'Espèces',
      card: 'Carte',
      manualPlu: 'Saisie manuelle (PLU)',
      productNotFound: 'Produit introuvable',
      pluSearch: 'Rechercher',
      pluHint: 'PLU / Code-barres',
      pluClose: 'Fermer',
      cardComingSoon: 'Bientôt — Paiement par carte via terminal CMI',
      pluComingSoon: 'Bientôt — Saisie PLU manuelle',
      confirmCloseWithCart: 'Le panier contient des articles — fermer le service ?',
      confirmCloseShift: 'Confirmer la fermeture du service ?',
      errorProducts: 'Échec du chargement des produits',
      scanBarcode: 'Scanner le code-barres',
      scanProduct: 'Scanner un produit',
      staffManagement: 'Gestion du personnel',
      productManagement: 'Gestion des produits',
      printerSetup: 'Configuration de l\'imprimante',
      tableMap: 'Plan des tables',
      markdownSuggestion: 'Remise {n}% recommandée',
      discountNotePct: 'Remise {n}%',
      discountNoteFixed: 'Remise {n} MAD',
      category: {
        all: 'Tous',
        beverages: 'Boissons',
        bakery: 'Boulangerie',
        produce: 'Fruits & Légumes',
        juices: 'Jus',
        prepared: 'Plats préparés',
        grocery: 'Épicerie',
        snacks: 'Snacks',
        supplies: 'Fournitures',
        general: 'Général',
      },
    },
    payment: {
      success: 'Transaction réussie',
      cashTitle: 'Paiement en espèces',
      close: 'Fermer',
      amountDue: 'Montant dû',
      amountPaid: 'Montant payé',
      match: 'Exact',
      change: 'Monnaie',
      confirm: 'Confirmer le paiement',
      processing: 'Traitement...',
      cancel: 'Annuler',
      errorFailed: 'Échec de la transaction',
      errorGeneric: 'Erreur',
      exactAmount: 'Montant exact',
    },
    shiftClose: {
      title: 'Fermer le service',
      subtitle: 'Comptez le tiroir-caisse',
      summaryHeading: 'Résumé du service',
      totalSales: 'Ventes totales',
      transactions: 'Transactions',
      cashSales: 'Ventes espèces',
      cashCount: 'Espèces comptées',
      expected: 'Montant attendu',
      variance: 'Écart',
      confirm: 'Confirmer la fermeture',
      cancel: 'Annuler',
      confirming: 'Fermeture...',
      matchBadge: '✓ Équilibré',
      smallVariance: 'Écart mineur',
      largeVariance: '⚠ Écart important',
      errorLoad: 'Erreur de chargement',
      errorClose: 'Erreur de fermeture',
      shiftClosed: 'Service déjà fermé',
      zeroTxWarning: 'Aucune vente enregistrée dans ce service.',
      zeroTxNote: "Vérifiez que c'est correct avant de fermer.",
    },
    zReport: {
      title: 'Rapport de fin de service',
      shiftId: 'N° service',
      cashier: 'Caissier',
      opened: 'Ouverture',
      closed: 'Fermeture',
      duration: 'Durée',
      minutes: 'min',
      salesHeading: 'Ventes',
      totalSales: 'Total ventes',
      transactions: 'Transactions',
      cashSales: 'Ventes espèces',
      cardSales: 'Ventes carte',
      tax: 'TVA collectée',
      cashHeading: 'Réconciliation caisse',
      openingFloat: "Fond d'ouverture",
      expectedCash: 'Montant attendu',
      actualCash: 'Montant compté',
      variance: 'Écart',
      top5Heading: 'Top 5 produits',
      colNum: '#',
      colProduct: 'Produit',
      colQty: 'Qté',
      colTotal: 'Total',
      tendersHeading: 'Détail des modes de paiement',
      footer: 'Merci — MAGHAREBIT POS',
      print: 'Imprimer',
      done: 'Terminer',
      splitPayment: 'Paiement mixte',
    },
    receipt: {
      title: 'Reçu',
      receiptNo: 'Reçu N°',
      date: 'Date',
      cashier: 'Caissier',
      item: 'Article',
      qty: 'Qté',
      unitPrice: 'P.U.',
      lineTotal: 'Total',
      total: 'TOTAL',
      paymentLabel: 'Paiement',
      paymentCash: 'Espèces',
      paymentCard: 'Carte',
      taxIdLabel: 'ICE',
      thankYou: 'Merci de votre visite',
      print: 'Imprimer',
      newSale: 'Nouvelle vente',
    },
    invoice: {
      title: 'Facture',
      invoiceNo: 'Facture N°',
      taxRate: 'Taux',
      taxBaseHT: 'Base HT',
      taxAmount: 'TVA',
      taxTotalTTC: 'TTC',
      disclaimer: 'Document tenant lieu de facture',
      generate: 'Générer une facture',
      generating: 'Génération...',
      generated: 'Facture {n}',
      iceLabel: 'ICE',
      ifLabel: 'IF',
      rcLabel: 'RC',
    },
    discount: {
      titleLine: 'Remise sur la ligne',
      titleCart: 'Remise sur le panier',
      percentage: 'Pourcentage (%)',
      fixed: 'Montant fixe (MAD)',
      value: 'Valeur',
      amount: 'Remise',
      apply: 'Appliquer',
      cancel: 'Annuler',
      remove: 'Retirer',
      approvalRequired: 'Validation manager requise',
      invalid: 'Valeur invalide',
      label: 'Remise',
      addLine: 'Remise',
      addCart: 'Remise panier',
    },
    waste: {
      title: 'Enregistrer une perte',
      subtitle: 'Enregistrez les produits abîmés ou périmés',
      selectProduct: 'Sélectionnez le produit',
      searchProduct: 'Rechercher un produit...',
      quantity: 'Quantité',
      unitGrams: 'g',
      unitPieces: 'pcs',
      reasonHeading: 'Raison',
      reason: {
        SPOILED: 'Abîmé',
        EXPIRED: 'Périmé',
        PREP_DAMAGE: 'Dégâts en préparation',
        OTHER: 'Autre',
      },
      notes: 'Notes (optionnel)',
      notesPlaceholder: 'Détails supplémentaires...',
      charactersRemaining: 'caractères restants',
      submit: 'Enregistrer la perte',
      submitting: 'Enregistrement...',
      recordAnother: 'Enregistrer une autre',
      backToPos: 'Retour à la caisse',
      success: '✓ Perte enregistrée',
      errorSubmit: "Échec de l'enregistrement",
      errorNoProduct: 'Veuillez sélectionner un produit',
      errorNoQuantity: 'Veuillez saisir une quantité valide',
      errorNoReason: 'Veuillez sélectionner une raison',
      recentHeading: 'Dernières pertes de ce service',
      recentEmpty: 'Aucune perte enregistrée',
      thresholdNotice: 'Quantité supérieure à 10 kg — validation manager requise',
      posButtonLabel: 'Perte',
      colProduct: 'Produit',
      colQty: 'Qté',
      colReason: 'Raison',
      colTime: 'Heure',
      approvedBy: 'Validé par',
      chainHashLabel: 'Empreinte',
      chainTooltip: "Chaîne cryptographique — garantit l'intégrité des registres",
      scanBarcode: 'Scanner le code-barres',
      scanProductTitle: 'Scanner un produit pour déchets',
    },
    managerPin: {
      title: 'Validation manager requise',
      subtitle: 'Cette quantité nécessite l\'approbation d\'un manager',
      selectManager: 'Sélectionnez le manager',
      enterPin: 'Entrez le PIN du manager',
      changeManager: 'Changer de manager',
      invalidPin: 'PIN incorrect',
      attemptsLeft: 'Tentatives restantes',
      lockoutTitle: 'Saisie temporairement bloquée',
      lockoutMessage: 'Veuillez patienter {seconds} secondes',
      cancel: 'Annuler',
      approving: 'Vérification...',
      noManagers: 'Aucun manager disponible',
      promptBody: 'Cette opération nécessite l\'autorisation du manager',
      pinLabel: 'Code PIN',
      confirm: 'Confirmer',
      errorConnection: 'Erreur de connexion — réessayez',
      enterFullPin: 'Entrez le code complet',
      authTitle: 'Autorisation manager',
    },
    analytics: {
      title: "Tableau d'analyse",
      totalSales: 'Ventes totales',
      transactions: 'Transactions',
      shifts: 'Services',
      wasteKg: 'Pertes (kg)',
      salesTrend: 'Ventes des {days} derniers jours',
      paymentSplit: 'Répartition des paiements',
      topProducts: 'Meilleurs produits',
      wasteAnalysis: 'Analyse des pertes',
      shiftsPerformance: 'Performance des services',
      accessDenied: 'Accès réservé aux managers',
      loading: 'Chargement...',
      noData: 'Aucune donnée pour cette période',
      days7: '7 jours',
      days30: '30 jours',
      days90: '90 jours',
      backToPos: 'Retour à la caisse',
      cashPayments: 'Espèces',
      cardPayments: 'Carte',
      colCashier: 'Caissier',
      colOpened: 'Ouverture',
      colClosed: 'Fermeture',
      colSales: 'Ventes',
      colTx: 'Transactions',
      colProduct: 'Produit',
      colQty: 'Qté',
      colRevenue: 'Revenus',
      posButtonLabel: 'Analyses',
      overviewTab: 'Vue générale',
      daysLabel: '{days} jours',
      activeDays: '{n} jours actifs',
      wasteRecorded: 'Pertes enregistrées',
      kg: 'kg',
      wasteRecordsCount: '{n} enregistrements',
      salesLabel: 'Ventes',
      txShort: 'trans.',
      duration: 'Durée',
      noWasteRecords: 'Aucune perte enregistrée sur cette période',
      noShifts: 'Aucun service sur cette période',
      totalWaste: 'Total des pertes',
      recordsShort: 'enreg.',
      shiftsShort: 'Services',
      topProductsShort: 'Meilleurs produits',
      currency: 'MAD',
    },
    cashflow: {
      title: 'Trésorerie — 30 jours',
      loading: 'Chargement de la trésorerie...',
      loadError: 'Impossible de charger les données de trésorerie',
      noData: 'Aucune donnée',
      openingBalance: "Solde d'ouverture :",
      worstBalance: 'Solde le plus bas :',
      dailyBalance: 'Solde quotidien prévu',
      totalInflow: 'Total des recettes',
      supplierObligations: 'Échéances fournisseurs',
      customerCredit: 'Créances clients',
      upcomingTitle: 'Échéances des 14 prochains jours',
      overdue: '(en retard)',
      daysShort: '({n} j)',
      obligationsLabel: 'Échéances :',
      risk: {
        none: 'Trésorerie équilibrée sur les 30 prochains jours',
        low: 'À noter : les créances clients sont élevées — suivez les encaissements',
        medium: 'Réserve de trésorerie faible — vérifiez les échéances fournisseurs',
        high: 'Attention : tension de trésorerie prévue dans les 14 jours',
        critical: '⚠️ Risque : le solde deviendra négatif sous 7 jours ({days} jours concernés)',
      },
    },
    insights: {
      tabRisk: 'Risque crédit',
      tabSuggestions: 'Suggestions',
      noRisk: 'Aucun client à risque',
      noSuggestions: 'Aucune suggestion active',
      done: 'Traité',
      suggestionTypes: {
        credit_block: '🚫 Blocage crédit',
        credit_warning: '⚠️ Avertissement solde',
        reactivation: '🔔 Réactivation',
        loyalty_reward: '🎁 Récompense fidélité',
        upsell: '📈 Vente additionnelle',
      },
    },
    forecast: {
      title: 'Prévisions de demande',
      reorderTitle: 'Alertes de réapprovisionnement',
      predicted: 'Prévu',
      onHand: 'En stock',
      noAlerts: "Aucune alerte de réapprovisionnement aujourd'hui",
      noForecasts: 'Aucune prévision disponible',
      units: 'u',
    },
    assistant: {
      title: 'Assistant analytique',
      subtitle: 'Posez vos questions sur vos ventes en arabe ou en français',
      examplesIntro: 'Exemples de questions :',
      placeholder: 'Posez une question sur vos ventes...',
      analyzing: 'Analyse en cours...',
      errorGeneric: "Erreur de l'assistant",
      errorConnection: "Impossible de joindre l'assistant",
      suggested: {
        topProducts: 'Quels sont les produits les plus vendus cette semaine ?',
        peakHours: 'Quelles sont les heures de pointe des ventes ?',
        creditBalances: 'Quels clients ont un solde de crédit élevé ?',
        suspiciousAlerts: "Y a-t-il des alertes suspectes aujourd'hui ?",
        reorder: 'Quels produits doivent être réapprovisionnés ?',
      },
    },
    integrity: {
      tabLabel: 'Intégrité',
      title: 'Tableau de bord intégrité',
      loading: 'Chargement...',
      noData: 'Aucune donnée pour cette période',
      colCashier: 'Caissier',
      colTotalTx: 'Transactions',
      colVoidRate: 'Taux annulation',
      colDiscountRate: 'Taux remise élevée',
      colReturnRate: 'Taux retours',
      colCashShare: 'Part espèces',
      colAvgTxTime: 'Temps moyen tx',
      colCashDiscrepancy: 'Écart de caisse',
      colAnomalies: 'Alertes',
      anomalyBadge: 'Alerte',
      drilldownTitle: 'Détails',
      drilldownVoids: 'Annulations',
      drilldownDiscounts: 'Remises importantes',
      drilldownReturns: 'Retours importants',
      drilldownCashShare: 'Part paiements espèces',
      drilldownAvgTime: 'Temps moyen tx (s)',
      drilldownDiscrepancy: 'Écart de caisse moyen',
      disclaimer: "Ces données sont indicatives uniquement. Vérifiez les faits avant toute action.",
    },
    customer: {
      title: 'Client',
      phone: 'Téléphone',
      name: 'Nom',
      lookup: 'Rechercher',
      notFound: 'Client introuvable',
      add: 'Ajouter client',
      added: 'Client ajouté',
      visits: 'Visites',
      spent: 'Total dépensé',
      history: 'Derniers achats',
      noHistory: 'Aucun achat précédent',
      notes: 'Notes',
      skip: 'Passer',
      loyalty: {
        title: 'Carte fidélité',
        stamps: 'Tampons',
        stampsUntil: 'tampon(s) avant récompense',
        rewardReady: '🎉 Récompense disponible !',
        reward: 'Récompense',
        noProgram: 'Pas de programme fidélité',
      },
      createAndSelect: 'Créer et sélectionner',
      withoutCustomer: 'Sans client',
      done: 'Fermer',
      cancel: 'Annuler',
      confirm: 'Confirmer',
    },
    card: {
      title: 'Paiement par carte',
      initiate: 'Initier le paiement',
      idleInstruction: "N'approchez pas encore la carte du terminal",
      sending: 'Envoi au terminal...',
      presentCard: 'Veuillez présenter votre carte',
      timeoutIn: 'Délai: {n}s',
      processing: 'Traitement en cours...',
      approved: 'Paiement approuvé',
      approvalCode: 'Code:',
      declined: 'Paiement refusé',
      timeout: 'Délai dépassé',
      error: 'Terminal non disponible',
      errorDetail: 'Détails (développeur)',
      terminalUnavailable: 'Terminal non disponible — vérifiez la connexion',
      retry: 'Réessayer',
      cancel: 'Annuler',
    },
    returns: {
      buttonLabel: 'Retour',
      title: 'Retour / Remboursement',
      lookupPlaceholder: 'Numéro de ticket (ex: R-000042)',
      lookup: 'Rechercher',
      noReceipt: 'Sans ticket',
      loading: 'Chargement...',
      receiptNotFound: 'Ticket introuvable',
      fullyReturned: 'Tous les articles de ce ticket ont déjà été retournés',
      selectItems: 'Sélectionner les articles à retourner',
      qty: 'Qté',
      maxQty: 'Max: {n}',
      disposition: 'Disposition',
      restock: 'Remis en stock',
      damaged: 'Endommagé',
      discard: 'À jeter',
      freeformTitle: 'Retour sans ticket',
      addItem: 'Ajouter un article',
      itemName: "Nom de l'article",
      unitPrice: 'Prix unitaire (MAD)',
      managerPinTitle: 'Approbation manager requise',
      managerPinReason: 'Ce retour dépasse le seuil autorisé et nécessite une approbation manager.',
      managerPinFreeform: 'Les retours sans ticket nécessitent toujours une approbation manager.',
      managerId: 'Matricule manager',
      managerPin: 'Code PIN manager',
      refundMethod: 'Mode de remboursement',
      cash: 'Espèces',
      card: 'Carte',
      storeCredit: 'Avoir',
      total: 'Total remboursé',
      confirm: 'Confirmer le retour',
      processing: 'Traitement...',
      successTitle: 'Retour enregistré',
      returnNumber: 'N° retour: {n}',
      done: 'Terminer',
      error: 'Erreur lors du retour',
      retry: 'Réessayer',
      cancel: 'Annuler',
    },
    lana: {
      title: 'Paiement Lana Cash',
      posButtonLabel: 'Lana',
      generate: 'Générer le QR',
      generating: 'Génération...',
      scanInstruction: 'Demandez au client de scanner ce QR avec l\'application Lana Cash',
      timeoutIn: 'Expire dans {n}s',
      paid: 'Paiement reçu !',
      recording: 'Enregistrement...',
      expired: 'QR expiré',
      errorRecovery: 'Paiement reçu mais enregistrement échoué. Contactez le support.',
    },
    stock: {
      inStock: 'En stock',
      lowStock: 'Stock faible',
      outOfStock: 'Rupture',
      units: 'unités',
      kg: 'kg',
      alertTitle: 'Alertes stock',
      alertEmpty: 'Aucune alerte',
      threshold: 'Seuil',
      close: 'Fermer',
    },
    sync: {
      online: 'En ligne',
      offline: 'Hors ligne',
      pending: 'Sync: {n}',
      provisional: 'Reçu provisoire',
      willSync: 'sera synchronisé',
    },
    markdown: {
      labelButton: "Imprimer l'étiquette",
      modalTitle: 'Étiquette de démarque',
      originalPrice: "Prix d'origine",
      effectivePrice: 'Prix remisé',
      printButton: 'Imprimer',
      close: 'Fermer',
    },
    stores: {
      tabLabel: 'Magasins',
      title: "Vue d'ensemble des magasins",
      store: 'Magasin',
      sales: 'Ventes',
      transactions: 'Transactions',
      waste: 'Gaspillage',
      discounts: 'Remises',
      viewDetail: 'Voir détails',
      backToStores: 'Retour aux magasins',
      noStores: 'Aucun magasin',
      accessDenied: 'Section réservée aux superviseurs',
    },
    orders: {
      title: 'Commandes',
      badge: 'Nouvelle commande',
      new: 'Nouveau',
      reviewing: 'En cours',
      confirmed: 'Confirmé',
      preparing: 'En préparation',
      ready: 'Prêt',
      completed: 'Terminé',
      cancelled: 'Annulé',
      pickup: 'Retrait en magasin',
      delivery: 'Livraison',
      cashOnDelivery: 'Espèces à la livraison',
      virement: 'Virement bancaire',
      tpe: 'Carte bancaire',
      paymentReceived: 'Paiement reçu',
      customerMessage: 'Message du client',
      deliveryAddress: 'Adresse de livraison',
      scheduledAt: 'Heure de livraison',
      assignTo: 'Assigner à',
      notes: 'Notes',
      convertToSale: 'Convertir en vente',
      noOrders: 'Aucune commande',
      markPaymentReceived: 'Confirmer réception paiement',
      close: 'Fermer',
      cancelOrder: 'Annuler la commande',
      confirmCancel: 'Confirmer l\'annulation de cette commande ?',
      backToList: 'Retour à la liste',
      filterAll: 'Toutes',
      filterNew: 'Nouvelles',
      filterInProgress: 'En cours',
      filterDone: 'Terminées',
      sendToKds: '🍳 Envoyer en cuisine',
      kdsSent: 'Envoyé en cuisine ✓',
      kdsExisting: 'Déjà en cuisine ✓',
      statusLabel: 'Statut',
      fulfillmentLabel: 'Exécution',
      paymentLabel: 'Paiement',
    },
    suppliers: {
      title: 'Fournisseurs',
      add: 'Ajouter fournisseur',
      name: 'Nom fournisseur',
      phone: 'Téléphone',
      address: 'Adresse',
      notes: 'Notes',
      noSuppliers: 'Aucun fournisseur',
      errorNameRequired: 'Nom du fournisseur requis',
      suggestedQty: 'Suggéré',
      receiving: {
        title: 'Réception marchandise',
        newDelivery: 'Nouvelle réception',
        supplier: 'Fournisseur',
        product: 'Produit',
        quantity: 'Quantité',
        unitCost: 'Coût unitaire',
        totalCost: 'Coût total',
        addLine: 'Ajouter produit',
        confirm: 'Confirmer réception',
        confirmed: 'Marchandise reçue',
        draft: 'Brouillon',
        received: 'Reçu',
        history: 'Historique réceptions',
        ocrScan: '📷 Scanner une facture',
        ocrScanning: 'Analyse en cours...',
        ocrSuccess: '{n} lignes détectées — {m} produits identifiés. Vérifiez avant de confirmer.',
        ocrError: "Échec de l'analyse",
        ocrNotConfigured: 'OCR non configuré — configurez le fournisseur',
        ocrUnmatched: '⚠ Produit non reconnu — sélectionnez dans la liste',
        cancelled: 'Annulé',
        notes: 'Notes',
        optional: 'facultatif',
        unitCostPiastres: 'Coût unitaire (centimes)',
        productsUpdated: 'produit(s) mis à jour',
        markdownClockReset: 'Horloge de marquage automatique réinitialisée',
        forecastSuggestion: 'Prévision 7j: {n} unités suggérées',
        productsCount: 'produit(s)',
        errorNoProducts: 'Ajoutez au moins un produit valide',
      },
      ledger: {
        title: 'Konnash',
        balance: 'Solde',
        invoices: 'Factures',
        payments: 'Paiements',
        newInvoice: 'Nouvelle facture',
        recordPayment: 'Enregistrer paiement',
        invoiceRef: 'N° facture',
        invoiceDate: 'Date facture',
        dueDate: 'Échéance',
        tax: 'TVA',
        total: 'Total',
        paid: 'Payé',
        remaining: 'Reste à payer',
        status: 'Statut',
        statusUnpaid: 'Non payé',
        statusPartial: 'Partiel',
        statusPaid: 'Payé',
        statusCancelled: 'Annulé',
        payMethod: 'Mode de paiement',
        payReference: 'Référence',
        payDate: 'Date',
        description: 'Désignation',
        unit: 'Unité',
        unitCost: 'P.U. (MAD)',
        quantity: 'Qté',
        addLine: 'Ajouter ligne',
        save: 'Enregistrer',
        cancel: 'Annuler',
        noInvoices: 'Aucune facture',
        noPayments: 'Aucun paiement',
        selectSupplier: 'Sélectionnez un fournisseur',
        cancelled: 'Annulé',
        currency: 'MAD',
        optional: 'optionnel',
        errorNoLines: 'Ajoutez au moins une ligne',
        errorAmountRequired: 'Montant requis',
        product: 'Produit (facultatif)',
        searchProduct: 'Rechercher un produit...',
        noProductMatch: 'Aucun résultat',
        clearProduct: 'Dissocier',
        costAlertsTitle: "Alerte sur le coût d'achat",
        costAlertsHint: "À titre informatif — aucun prix de vente n'a été modifié.",
        costOld: 'Ancien coût',
        costNew: 'Nouveau coût',
        costIncrease: 'Hausse',
        marginBefore: 'Marge avant',
        marginAfter: 'Marge après',
        belowCost: 'Sous le coût',
        dismiss: 'Fermer',
        paymentMethods: {
          cash: 'Espèces',
          bank_transfer: 'Virement bancaire',
          cheque: 'Chèque',
          mobile: 'Mobile',
          other: 'Autre',
        },
      },
    },
    license: {
      activationTitle: 'Activation du logiciel',
      instructions: 'Saisissez la clé de licence reçue par WhatsApp après votre inscription sur la plateforme MAGHAREBIT.',
      keyLabel: 'Clé de licence',
      activateButton: 'Activer le logiciel',
      verifying: 'Vérification...',
      errorEmptyKey: 'Saisissez la clé de licence',
      errorRevoked: 'Cette clé est suspendue. Contactez le support.',
      errorChecksum: 'Clé invalide. Vérifiez la saisie.',
      errorExpired: "La licence a expiré. Renouvelez votre abonnement.",
      errorMachineMismatch: 'Cette clé est liée à un autre appareil.',
      errorGeneric: "Échec de l'activation. Réessayez.",
      errorNetwork: 'Impossible de joindre le serveur. Vérifiez votre connexion Internet.',
      revokedTitle: 'Licence suspendue',
      revokedBody: 'Cette licence a été suspendue. Contactez le support technique pour la réactiver.',
      whatsappButton: 'Contacter via WhatsApp',
      expiredTitle: 'Licence expirée',
      expiredBody: 'Votre abonnement a expiré. Renouvelez-le via la plateforme MAGHAREBIT pour continuer.',
      renewButton: "Renouveler l'abonnement",
      daysLeftBanner: 'Votre licence expire dans {days} jours',
      daysLeftOne: "Plus qu'un jour — Renouvelez",
      daysLeftTwo: '{days} jours restants — Renouvelez',
      daysLeftFew: '{days} jours restants — Renouvelez',
      daysLeftMany: '{days} jours restants — Renouvelez',
      renewNow: 'Renouveler maintenant',
    },
    course: {
      panelTitle: 'Plats',
      noCourse: 'Sans plat (immédiat)',
      courseN: 'Plat {n}',
      fire: 'Envoyer le plat',
      fired: 'Envoyé',
      held: 'En attente',
      none: 'Aucun',
      allergies: 'Allergies',
      save: 'Enregistrer',
      cancel: 'Annuler',
      empty: 'Aucun article dans la commande',
      takeaway: 'À emporter',
      errorLoad: 'Impossible de charger la commande',
      errorFire: "Échec de l'envoi du plat",
      errorSave: 'Échec de la sauvegarde',
      errorStarted: 'La cuisine a déjà commencé cet article',
    },
    voice: {
      tapToSpeak: 'Appuyez pour parler',
      listening: 'Écoute...',
      notSupported: 'Commandes vocales non prises en charge par ce navigateur',
      noMic: 'Micro refusé',
      noSpeech: 'Aucune voix détectée',
      networkError: 'Erreur réseau voix',
      error: 'Erreur vocale',
      clearConfirm: 'Effacer ?',
      cancel: 'Annuler',
    },
    nav: {
      branches: 'Succursales',
    },
    branches: {
      title: 'Succursales',
      tabOverview: "Vue d'ensemble",
      tabStock: 'Comparaison des stocks',
      tabTransfers: 'Transferts',
      refresh: 'Actualiser',
      totalRevenue: 'CA du jour (toutes succursales)',
      activeShifts: 'Services ouverts',
      todayRevenue: 'CA du jour',
      transactions: 'Transactions',
      staff: 'Personnel',
      inactiveBranch: 'Inactive',
      noBranches: 'Aucune succursale',
      product: 'Produit',
      stockNotice: "Le stock n'est pas encore suivi par succursale ; les chiffres sont globaux",
      transfer: '+ Transférer',
      fromStore: 'De la succursale',
      toStore: 'Vers la succursale',
      quantity: 'Quantité',
      submit: 'Envoyer',
      cancel: 'Annuler',
      noProducts: 'Aucun produit',
      noTransfers: 'Aucun transfert',
      approve: 'Approuver',
      markReceived: 'Marquer reçu',
      cancelTransfer: 'Annuler le transfert',
      status: {
        pending: 'En attente',
        approved: 'Approuvé',
        in_transit: 'En transit',
        received: 'Reçu',
        cancelled: 'Annulé',
      },
      errorLoad: 'Impossible de charger les données',
      errorSave: "Échec de l'opération",
      errorSameStore: 'Choisissez deux succursales différentes',
    },
    scale: {
      title: 'Balance',
      connect: 'Connecter',
      connecting: 'Connexion...',
      connected: 'Connectée ✓',
      disconnect: 'Déconnecter',
      readWeight: 'Lire le poids',
      stabilize: 'Stabilisez la balance',
      port: 'Port (COM)',
      baudRate: 'Vitesse (baud)',
      selectScale: 'Choisir la balance',
      driverAvailable: 'Disponible ✓',
      driverStub: 'En attente',
      testRead: 'Tester la lecture',
      weightResult: '{n} grammes',
      errorNoDriver: 'Driver non disponible pour ce modèle',
      notConnected: 'Balance non connectée',
      weightUnit: 'kg',
      stable: 'Stable',
      unstable: 'Instable',
      addToCart: 'Ajouter au panier',
      noWebSerial: 'Web Serial non pris en charge',
      tare: 'Tare',
      errorNoSerial: 'Web Serial non pris en charge dans ce navigateur. Utilisez Chrome ou Edge.',
      errorConnect: 'Échec de connexion à la balance : {msg}',
      errorDisconnected: 'Déconnexion de la balance',
    },
    barcode: {
      defaultTitle: 'Scanner le code-barres',
      permissionDenied: 'Veuillez autoriser l\'accès à la caméra',
      permissionNote: 'L\'accès à la caméra est requis pour scanner les codes-barres.',
      retry: 'Réessayer',
      aim: 'Pointez la caméra vers le code-barres',
    },
    printer: {
      noWebUsb: 'Le navigateur ne prend pas en charge Web USB',
      noWebUsbHint: 'Utilisez Chrome ou Edge pour imprimer via USB.',
      status: 'État',
      supported: 'Imprimantes prises en charge : thermiques ESC/POS 80mm via USB (Epson TM, BIXOLON, Xprinter, etc.).',
      connect: 'Connecter l\'imprimante USB',
      connecting: 'Connexion en cours…',
      disconnect: 'Déconnecter',
      statusDisconnected: 'Non connectée',
      statusConnecting: 'Connexion…',
      statusConnected: 'Connectée ✓',
      statusError: 'Erreur d\'impression',
    },
    split: {
      total: 'Total',
      currencySuffix: 'MAD',
      fillRemaining: 'Compléter le montant restant',
      addTender: '+ Ajouter un mode de paiement',
      balanced: 'Montant équilibré',
      remaining: 'Reste {n}',
      overpaid: 'Surplus {n}',
      errorLoadMethods: 'Échec du chargement des modes de paiement',
      errorStatus: 'Erreur {n}',
    },
    credit: {
      buttonEmpty: '+ Crédit / Client',
      buttonWithName: 'Crédit — {name}',
      viewBalance: 'Solde de {name}',
      searchTitle: 'Sélectionner client / Crédit',
      searchPlaceholder: 'Rechercher par nom ou téléphone...',
      searching: 'Recherche...',
      balanceClear: 'Soldé',
      addNew: '+ Ajouter "{name}"',
      namePlaceholder: 'Nom du client *',
      phonePlaceholder: 'Téléphone (optionnel)',
      save: 'Enregistrer',
      balanceLabel: 'Solde dû',
      limitLabel: 'Limite : {n} MAD',
      riskBanner: 'Ce client est en zone de risque crédit',
      amountPlaceholder: 'Montant en MAD',
      notePlaceholder: 'Note (optionnel)',
      chargeBtn: '+ Dette (crédit)',
      payBtn: 'Payer',
      showHistory: 'Voir l\'historique',
      hideHistory: 'Masquer l\'historique',
      noTransactions: 'Aucune transaction',
      txCharge: 'Dette',
      txPayment: 'Paiement',
      currencySuffix: 'MAD',
      errorInvalidAmount: 'Entrez un montant valide',
      errorLimitExceeded: 'Limite de crédit dépassée ({n} MAD)',
      errorGeneric: 'Une erreur est survenue',
    },
    tableMap: {
      title: 'Plan des tables',
      loading: 'Chargement...',
      capacity: '{n} pers.',
      statusAvailable: 'Libre',
      statusOccupied: 'Occupée',
      statusBilled: 'À encaisser',
      statusReserved: 'Réservée',
    },
    modifiers: {
      selectAddons: 'Choisissez les options',
      loading: 'Chargement...',
      total: 'Total',
      currencySuffix: 'MAD',
      addToOrder: 'Ajouter à la commande',
    },
    productQR: {
      generating: 'Génération...',
      download: 'Télécharger PNG',
    },
    kds: {
      title: 'Affichage cuisine',
      sendToKitchen: 'Envoyer en cuisine',
      sentToKitchen: 'Envoyé en cuisine ✓',
      alreadyInKitchen: 'Déjà en cuisine ✓',
      new: 'Nouveau',
      preparing: 'En préparation',
      ready: 'Prêt ✓',
      done: 'Servi',
      start: '▶ Commencer',
      markReady: '✓ Prêt',
      markDone: '✓ Servi / Livré',
      walkin: 'Sur place',
      whatsapp: 'WhatsApp',
      table: 'Table',
      takeaway: 'À emporter',
      tableNumber: 'N° table',
      noOrders: 'Aucune commande en cours',
      elapsed: 'il y a',
      ordersCompleted: 'Terminées',
      backToPOS: '← POS',
      newOrderAlert: 'Nouvelle commande !',
      fulfillmentSurPlace: '🪑 Sur place',
      fulfillmentEmporter: '🥡 À emporter',
      notesPlaceholder: 'Notes...',
      send: 'Envoyer',
      cancel: 'Annuler',
      pending: 'En attente',
      refresh: 'Actualiser ↺',
      tapToAdvance: 'Appuyer pour avancer →',
      enableSound: 'Activer le son',
      soundOn: '🔊 Son activé',
      soundOff: '🔇 Son coupé',
      tapToEnableSound: 'Appuyer pour activer le son 🔔',
      newOrder: 'Nouvelle commande !',
      sessionExpired: 'Session expirée',
      signInToContinue: 'Connectez-vous pour continuer',
    },
    products: {
      title: 'Produits',
      add: 'Ajouter produit',
      edit: 'Modifier',
      delete: 'Supprimer',
      save: 'Enregistrer',
      cancel: 'Annuler',
      nameAr: 'Nom en arabe',
      nameFr: 'Nom en français',
      category: 'Catégorie',
      price: 'Prix (MAD)',
      barcode: 'Code-barres',
      plu: 'Code PLU',
      image: 'Image produit',
      uploadImage: 'Télécharger image',
      imageHint: 'JPG/PNG/WebP — redimensionnée auto',
      isWeighted: 'Produit vendu au poids',
      uom: 'Unité de mesure',
      isPerishable: 'Périssable (remise auto)',
      trackStock: 'Suivre le stock',
      stockQty: 'Quantité actuelle',
      lowStockThreshold: 'Seuil stock faible',
      description: 'Description',
      businessFields: 'Champs supplémentaires',
      businessType: "Type d'activité",
      setBusinessType: "Choisissez votre type d'activité",
      noProducts: 'Aucun produit',
      searchProducts: 'Rechercher produits',
      confirmDelete: 'Confirmer la suppression ?',
      deleted: 'Produit supprimé',
      saved: 'Produit enregistré',
      imageUpdated: 'Image mise à jour',
      loading: 'Chargement...',
      allCategories: 'Toutes les catégories',
      categoryPlaceholder: '— Choisir une catégorie —',
      statsTotal: 'Total',
      statsActive: 'Actif',
      statsInactive: 'Inactif',
      stockLabel: 'Stock',
      addTitle: 'Ajouter un produit',
      editPrefix: 'Modifier : ',
      cost: 'Prix de revient (MAD)',
      isActive: 'Actif',
      addButton: 'Ajouter',
      inactiveBadge: 'Inactif',
      errorNameRequired: 'Le nom en arabe est requis',
      errorSave: 'Échec de la sauvegarde',
      errorConnection: 'Impossible de contacter le serveur',
      successAdd: 'Produit ajouté avec succès ✓',
      successEdit: 'Produit mis à jour ✓',
      confirmDeleteMsg: 'Supprimer "{name}" ?',
      uomLabels: { UNIT: 'Unité', KG: 'Kg', G: 'g', L: 'L', ML: 'mL', BUNCH: 'Botte', BOX: 'Boîte', BAG: 'Sachet', PIECE: 'Pièce' },
      removeImage: "Supprimer l'image",
      imageTooBig: 'Image trop volumineuse (20 Mo max)',
      imageInvalidType: 'Format non supporté',
      imageUploading: 'Envoi en cours...',
      margin: 'Marge',
    },
    staff: {
      title: 'Gestion du personnel',
      addNew: '+ Nouvel employé',
      loading: 'Chargement...',
      noStaff: 'Aucun employé',
      addTitle: 'Ajouter un employé',
      editPrefix: 'Modifier : ',
      nameArLabel: 'Nom en arabe *',
      nameFrLabel: 'Nom en français',
      roleLabel: 'Rôle',
      pinLabel: 'PIN *',
      pinNew: 'Nouveau PIN (laisser vide pour conserver)',
      pinConfirm: 'Confirmer le PIN',
      editButton: 'Modifier',
      deactivate: 'Désactiver',
      activate: 'Activer',
      addButton: 'Ajouter',
      saveButton: 'Enregistrer',
      cancelButton: 'Annuler',
      errorNameRequired: 'Le nom en arabe est requis',
      errorPinLength: 'Le PIN doit comporter au moins 4 chiffres',
      errorPinMismatch: 'Les PIN ne correspondent pas',
      errorSave: 'Échec de la sauvegarde',
      errorConnection: 'Impossible de contacter le serveur',
      successAdd: 'Employé ajouté avec succès ✓',
      successEdit: 'Employé mis à jour ✓',
      roles: { CASHIER: 'Caissier', SENIOR_CASHIER: 'Caissier Senior', INVENTORY: 'Responsable Stock', MANAGER: 'Manager', SUPERVISOR: 'Superviseur' },
    },
    alerts: {
      types: { rapid_voids: 'Annulations répétées ⚠️', void_spike: "Pic d'annulations", discount_over_limit: 'Remise exceptionnelle', unusual_discount: 'Remise inhabituelle', cash_discrepancy: 'Écart de caisse 💰', price_override: 'Modification de prix', unusual_refund: 'Remboursement suspect' },
      score: 'Score : {score} / 100',
      acknowledge: 'Traité ✓',
    },
  },
  en: {
    brand: {
      name: 'MAGHAREBIT POS',
      logoAlt: 'MAGHAREBIT logo',
      copyright: '© 2026 MAGHAREBIT — Wayloz Group',
    },
    shift: {
      title: 'MAGHAREBIT POS',
      subtitle: 'Open a new shift',
      selectCashier: 'Select cashier',
      cashierLabel: 'Cashier',
      changeCashier: 'Change',
      enterPin: 'Enter PIN',
      clear: 'Clear',
      editPin: 'Edit PIN',
      openingFloat: 'Opening float (optional)',
      startShift: 'Start shift',
      starting: 'Starting...',
      loading: 'Loading...',
      errorConnect: 'Failed to connect to server',
      errorOpen: 'Failed to open shift',
      errorUnknown: 'Unknown error',
      role: { CASHIER: 'Cashier', MANAGER: 'Manager', SUPERVISOR: 'Supervisor' },
      licenseTitle: 'Licence not activated',
      licenseBody: 'The software licence could not be validated. Please contact support to activate or renew your subscription.',
      licenseSupport: 'Support',
    },
    pos: {
      searchPlaceholder: 'Search products or scan barcode',
      loading: 'Loading...',
      noProducts: 'No products found',
      allCategories: 'All categories',
      productsCount: '{n} product(s)',
      backToCategories: 'Back to categories',
      cashierLabel: 'Cashier',
      shiftStarted: 'Started',
      closeShift: 'Close shift',
      cart: 'Cart',
      cartEmpty: 'Cart is empty',
      bomNotice: 'Includes automatic ingredient deduction',
      delete: 'Delete',
      subtotal: 'Subtotal',
      tax: 'Tax (20%)',
      total: 'Total',
      cash: 'Cash',
      card: 'Card',
      manualPlu: 'Manual entry (PLU)',
      productNotFound: 'Product not found',
      pluSearch: 'Search',
      pluHint: 'PLU / Barcode',
      pluClose: 'Close',
      cardComingSoon: 'Coming soon — Card payment via CMI terminal',
      pluComingSoon: 'Coming soon — Manual PLU entry',
      confirmCloseWithCart: 'Cart contains items — close shift anyway?',
      confirmCloseShift: 'Confirm close shift?',
      errorProducts: 'Failed to load products',
      scanBarcode: 'Scan barcode',
      scanProduct: 'Scan product',
      staffManagement: 'Staff management',
      productManagement: 'Product management',
      printerSetup: 'Printer setup',
      tableMap: 'Table map',
      markdownSuggestion: '{n}% markdown recommended',
      discountNotePct: '{n}% discount',
      discountNoteFixed: '{n} MAD discount',
      category: {
        all: 'All',
        beverages: 'Beverages',
        bakery: 'Bakery',
        produce: 'Produce',
        juices: 'Juices',
        prepared: 'Prepared',
        grocery: 'Grocery',
        snacks: 'Snacks',
        supplies: 'Supplies',
        general: 'General',
      },
    },
    payment: {
      success: 'Transaction successful',
      cashTitle: 'Cash payment',
      close: 'Close',
      amountDue: 'Amount due',
      amountPaid: 'Amount paid',
      match: 'Exact',
      change: 'Change',
      confirm: 'Confirm payment',
      processing: 'Processing...',
      cancel: 'Cancel',
      errorFailed: 'Transaction failed',
      errorGeneric: 'Error',
      exactAmount: 'Exact amount',
    },
    shiftClose: {
      title: 'Close shift',
      subtitle: 'Count the cash drawer',
      summaryHeading: 'Shift summary',
      totalSales: 'Total sales',
      transactions: 'Transactions',
      cashSales: 'Cash sales',
      cashCount: 'Cash counted in drawer',
      expected: 'Expected in drawer',
      variance: 'Variance',
      confirm: 'Confirm close',
      cancel: 'Cancel',
      confirming: 'Closing...',
      matchBadge: '✓ Balanced',
      smallVariance: 'Minor variance',
      largeVariance: '⚠ Large variance — please check',
      errorLoad: 'Failed to load shift summary',
      errorClose: 'Failed to close shift',
      shiftClosed: 'Shift already closed',
      zeroTxWarning: 'No transactions found for this shift.',
      zeroTxNote: 'Confirm this is correct before closing.',
    },
    zReport: {
      title: 'End-of-shift report',
      shiftId: 'Shift ID',
      cashier: 'Cashier',
      opened: 'Opened',
      closed: 'Closed',
      duration: 'Duration',
      minutes: 'min',
      salesHeading: 'Sales',
      totalSales: 'Total sales',
      transactions: 'Transactions',
      cashSales: 'Cash sales',
      cardSales: 'Card sales',
      tax: 'Tax collected',
      cashHeading: 'Cash reconciliation',
      openingFloat: 'Opening float',
      expectedCash: 'Expected cash',
      actualCash: 'Actual cash',
      variance: 'Variance',
      top5Heading: 'Top 5 products',
      colNum: '#',
      colProduct: 'Product',
      colQty: 'Qty',
      colTotal: 'Total',
      tendersHeading: 'Payment method breakdown',
      footer: 'Thank you — MAGHAREBIT POS',
      print: 'Print',
      done: 'Done',
      splitPayment: 'Split payment',
    },
    receipt: {
      title: 'Receipt',
      receiptNo: 'Receipt No.',
      date: 'Date',
      cashier: 'Cashier',
      item: 'Item',
      qty: 'Qty',
      unitPrice: 'Unit',
      lineTotal: 'Total',
      total: 'TOTAL',
      paymentLabel: 'Payment',
      paymentCash: 'Cash',
      paymentCard: 'Card',
      taxIdLabel: 'Tax ID',
      thankYou: 'Thank you for your visit',
      print: 'Print',
      newSale: 'New sale',
    },
    invoice: {
      title: 'Invoice',
      invoiceNo: 'Invoice No.',
      taxRate: 'Rate',
      taxBaseHT: 'Base (excl. tax)',
      taxAmount: 'VAT',
      taxTotalTTC: 'Total (incl.)',
      disclaimer: 'This document serves as a VAT invoice',
      generate: 'Generate invoice',
      generating: 'Generating...',
      generated: 'Invoice {n}',
      iceLabel: 'ICE',
      ifLabel: 'IF',
      rcLabel: 'RC',
    },
    discount: {
      titleLine: 'Line discount',
      titleCart: 'Cart discount',
      percentage: 'Percentage (%)',
      fixed: 'Fixed (MAD)',
      value: 'Value',
      amount: 'Discount',
      apply: 'Apply',
      cancel: 'Cancel',
      remove: 'Remove',
      approvalRequired: 'Manager approval required',
      invalid: 'Invalid value',
      label: 'Discount',
      addLine: 'Discount',
      addCart: 'Cart discount',
    },
    waste: {
      title: 'Record waste',
      subtitle: 'Log spoiled or expired products',
      selectProduct: 'Select product',
      searchProduct: 'Search product...',
      quantity: 'Quantity',
      unitGrams: 'g',
      unitPieces: 'pcs',
      reasonHeading: 'Reason',
      reason: {
        SPOILED: 'Spoiled',
        EXPIRED: 'Expired',
        PREP_DAMAGE: 'Prep damage',
        OTHER: 'Other',
      },
      notes: 'Notes (optional)',
      notesPlaceholder: 'Additional details...',
      charactersRemaining: 'characters remaining',
      submit: 'Record waste',
      submitting: 'Saving...',
      recordAnother: 'Record another',
      backToPos: 'Back to POS',
      success: '✓ Waste recorded',
      errorSubmit: 'Failed to record waste',
      errorNoProduct: 'Please select a product',
      errorNoQuantity: 'Please enter a valid quantity',
      errorNoReason: 'Please select a reason',
      recentHeading: 'Recent records this shift',
      recentEmpty: 'No waste recorded yet',
      thresholdNotice: 'Quantity exceeds 10 kg — manager approval required',
      posButtonLabel: 'Record waste',
      colProduct: 'Product',
      colQty: 'Qty',
      colReason: 'Reason',
      colTime: 'Time',
      approvedBy: 'Approved by',
      chainHashLabel: 'Audit chain',
      chainTooltip: 'Cryptographic hash chain — ensures record integrity',
      scanBarcode: 'Scan barcode',
      scanProductTitle: 'Scan product for waste',
    },
    managerPin: {
      title: 'Manager approval required',
      subtitle: 'This quantity requires manager approval',
      selectManager: 'Select manager',
      enterPin: 'Enter manager PIN',
      changeManager: 'Change manager',
      invalidPin: 'Incorrect PIN',
      attemptsLeft: 'Attempts left',
      lockoutTitle: 'Input temporarily locked',
      lockoutMessage: 'Please wait {seconds} seconds',
      cancel: 'Cancel',
      approving: 'Verifying...',
      noManagers: 'No managers available',
      promptBody: 'This operation requires manager authorization',
      pinLabel: 'PIN code',
      confirm: 'Confirm',
      errorConnection: 'Connection error — please try again',
      enterFullPin: 'Enter the full PIN',
      authTitle: 'Manager authorization',
    },
    analytics: {
      title: 'Data Analytics',
      totalSales: 'Total Sales',
      transactions: 'Transactions',
      shifts: 'Shifts',
      wasteKg: 'Waste (kg)',
      salesTrend: 'Sales last {days} days',
      paymentSplit: 'Payment Split',
      topProducts: 'Top Products',
      wasteAnalysis: 'Waste Analysis',
      shiftsPerformance: 'Shifts Performance',
      accessDenied: 'Manager access only',
      loading: 'Loading data...',
      noData: 'No data for this period',
      days7: '7 days',
      days30: '30 days',
      days90: '90 days',
      backToPos: 'Back to POS',
      cashPayments: 'Cash',
      cardPayments: 'Card',
      colCashier: 'Cashier',
      colOpened: 'Opened',
      colClosed: 'Closed',
      colSales: 'Sales',
      colTx: 'Transactions',
      colProduct: 'Product',
      colQty: 'Qty',
      colRevenue: 'Revenue',
      posButtonLabel: 'Analytics',
      overviewTab: 'Overview',
      daysLabel: '{days} days',
      activeDays: '{n} active days',
      wasteRecorded: 'Waste recorded',
      kg: 'kg',
      wasteRecordsCount: '{n} records',
      salesLabel: 'Sales',
      txShort: 'tx',
      duration: 'Duration',
      noWasteRecords: 'No waste records in this period',
      noShifts: 'No shifts in this period',
      totalWaste: 'Total waste',
      recordsShort: 'records',
      shiftsShort: 'Shifts',
      topProductsShort: 'Top products',
      currency: 'MAD',
    },
    cashflow: {
      title: 'Cash flow — 30 days',
      loading: 'Loading cash flow...',
      loadError: 'Could not load cash flow data',
      noData: 'No data',
      openingBalance: 'Opening balance:',
      worstBalance: 'Lowest balance:',
      dailyBalance: 'Projected daily balance',
      totalInflow: 'Total revenue',
      supplierObligations: 'Supplier obligations',
      customerCredit: 'Customer receivables',
      upcomingTitle: 'Obligations due in the next 14 days',
      overdue: '(overdue)',
      daysShort: '({n}d)',
      obligationsLabel: 'Obligations:',
      risk: {
        none: 'Cash flow is balanced over the next 30 days',
        low: 'Note: customer receivables are high — follow up on collections',
        medium: 'Cash reserve is low — review supplier obligations',
        high: 'Warning: cash squeeze expected within 14 days',
        critical: '⚠️ Risk: balance will turn negative within 7 days ({days} days affected)',
      },
    },
    insights: {
      tabRisk: 'Credit Risk',
      tabSuggestions: 'Suggestions',
      noRisk: 'No customers at risk',
      noSuggestions: 'No active suggestions',
      done: 'Done',
      suggestionTypes: {
        credit_block: '🚫 Credit block',
        credit_warning: '⚠️ Balance warning',
        reactivation: '🔔 Reactivation',
        loyalty_reward: '🎁 Loyalty reward',
        upsell: '📈 Upsell',
      },
    },
    forecast: {
      title: 'Demand Forecasts',
      reorderTitle: 'Reorder Alerts',
      predicted: 'Predicted',
      onHand: 'On hand',
      noAlerts: 'No reorder alerts today',
      noForecasts: 'No forecasts available',
      units: 'u',
    },
    assistant: {
      title: 'Analytics assistant',
      subtitle: 'Ask about your sales in Arabic or French',
      examplesIntro: 'Example questions:',
      placeholder: 'Ask about your sales...',
      analyzing: 'Analyzing...',
      errorGeneric: 'Assistant error',
      errorConnection: 'Could not reach the assistant',
      suggested: {
        topProducts: 'What are the top-selling products this week?',
        peakHours: 'What are the peak sales hours?',
        creditBalances: 'Which customers have a high credit balance?',
        suspiciousAlerts: 'Are there any suspicious alerts today?',
        reorder: 'Which products need reordering?',
      },
    },
    integrity: {
      tabLabel: 'Integrity',
      title: 'Cashier Integrity Dashboard',
      loading: 'Loading data...',
      noData: 'No data for this period',
      colCashier: 'Cashier',
      colTotalTx: 'Transactions',
      colVoidRate: 'Void rate',
      colDiscountRate: 'Large discount rate',
      colReturnRate: 'Return rate',
      colCashShare: 'Cash share',
      colAvgTxTime: 'Avg tx time',
      colCashDiscrepancy: 'Cash discrepancy',
      colAnomalies: 'Flags',
      anomalyBadge: 'Flag',
      drilldownTitle: 'Details',
      drilldownVoids: 'Voids',
      drilldownDiscounts: 'Large discounts',
      drilldownReturns: 'Large returns',
      drilldownCashShare: 'Cash payment share',
      drilldownAvgTime: 'Avg tx time (s)',
      drilldownDiscrepancy: 'Avg cash discrepancy',
      disclaimer: 'This data is for analytical guidance only. Verify facts before taking any action.',
    },
    customer: {
      title: 'Customer',
      phone: 'Phone',
      name: 'Name',
      lookup: 'Search',
      notFound: 'Customer not found',
      add: 'Add customer',
      added: 'Customer added',
      visits: 'Visits',
      spent: 'Total spent',
      history: 'Recent purchases',
      noHistory: 'No previous purchases',
      notes: 'Notes',
      skip: 'Skip',
      loyalty: {
        title: 'Loyalty card',
        stamps: 'Stamps',
        stampsUntil: 'stamp(s) until reward',
        rewardReady: '🎉 Reward ready!',
        reward: 'Reward',
        noProgram: 'No loyalty program',
      },
      createAndSelect: 'Create and select',
      withoutCustomer: 'Without customer',
      done: 'Done',
      cancel: 'Cancel',
      confirm: 'Confirm',
    },
    card: {
      title: 'Card payment',
      initiate: 'Initiate payment',
      idleInstruction: 'Do not present the card to the terminal yet',
      sending: 'Sending to terminal...',
      presentCard: 'Please present your card',
      timeoutIn: 'Timeout: {n}s',
      processing: 'Processing...',
      approved: 'Payment approved',
      approvalCode: 'Code:',
      declined: 'Payment declined',
      timeout: 'Timed out',
      error: 'Terminal unavailable',
      errorDetail: 'Details (developer)',
      terminalUnavailable: 'Terminal unavailable — check connection',
      retry: 'Retry',
      cancel: 'Cancel',
    },
    returns: {
      buttonLabel: 'Return',
      title: 'Return / Refund',
      lookupPlaceholder: 'Receipt number (e.g. R-000042)',
      lookup: 'Search',
      noReceipt: 'No receipt',
      loading: 'Loading...',
      receiptNotFound: 'Receipt not found',
      fullyReturned: 'All items on this receipt have already been returned',
      selectItems: 'Select items to return',
      qty: 'Qty',
      maxQty: 'Max: {n}',
      disposition: 'Disposition',
      restock: 'Back to stock',
      damaged: 'Damaged',
      discard: 'Discard',
      freeformTitle: 'Return without receipt',
      addItem: 'Add item',
      itemName: 'Item name',
      unitPrice: 'Unit price (MAD)',
      managerPinTitle: 'Manager approval required',
      managerPinReason: 'This return exceeds the threshold and requires manager approval.',
      managerPinFreeform: 'Returns without a receipt always require manager approval.',
      managerId: 'Manager ID',
      managerPin: 'Manager PIN',
      refundMethod: 'Refund method',
      cash: 'Cash',
      card: 'Card',
      storeCredit: 'Store credit',
      total: 'Total refunded',
      confirm: 'Confirm return',
      processing: 'Processing...',
      successTitle: 'Return recorded',
      returnNumber: 'Return no.: {n}',
      done: 'Done',
      error: 'Return failed',
      retry: 'Retry',
      cancel: 'Cancel',
    },
    lana: {
      title: 'Lana Cash Payment',
      posButtonLabel: 'Lana',
      generate: 'Generate QR',
      generating: 'Generating...',
      scanInstruction: 'Ask the customer to scan this QR code with the Lana Cash app',
      timeoutIn: 'Expires in {n}s',
      paid: 'Payment received!',
      recording: 'Recording...',
      expired: 'QR expired',
      errorRecovery: 'Payment received but recording failed. Contact support.',
    },
    stock: {
      inStock: 'In stock',
      lowStock: 'Low stock',
      outOfStock: 'Out of stock',
      units: 'units',
      kg: 'kg',
      alertTitle: 'Stock alerts',
      alertEmpty: 'No alerts',
      threshold: 'Threshold',
      close: 'Close',
    },
    sync: {
      online: 'Online',
      offline: 'Offline',
      pending: 'Sync: {n}',
      provisional: 'Provisional receipt',
      willSync: 'will sync',
    },
    markdown: {
      labelButton: 'Print label',
      modalTitle: 'Markdown Label',
      originalPrice: 'Original price',
      effectivePrice: 'Sale price',
      printButton: 'Print',
      close: 'Close',
    },
    stores: {
      tabLabel: 'Stores',
      title: 'Stores overview',
      store: 'Store',
      sales: 'Sales',
      transactions: 'Transactions',
      waste: 'Waste',
      discounts: 'Discounts',
      viewDetail: 'View detail',
      backToStores: 'Back to stores',
      noStores: 'No stores',
      accessDenied: 'Supervisor access only',
    },
    orders: {
      title: 'Orders',
      badge: 'New order',
      new: 'New',
      reviewing: 'Reviewing',
      confirmed: 'Confirmed',
      preparing: 'Preparing',
      ready: 'Ready',
      completed: 'Completed',
      cancelled: 'Cancelled',
      pickup: 'Pickup',
      delivery: 'Delivery',
      cashOnDelivery: 'Cash on delivery',
      virement: 'Bank transfer',
      tpe: 'Card',
      paymentReceived: 'Payment received',
      customerMessage: 'Customer message',
      deliveryAddress: 'Delivery address',
      scheduledAt: 'Scheduled time',
      assignTo: 'Assign to',
      notes: 'Notes',
      convertToSale: 'Convert to sale',
      noOrders: 'No orders',
      markPaymentReceived: 'Mark payment received',
      close: 'Close',
      cancelOrder: 'Cancel order',
      confirmCancel: 'Cancel this order?',
      backToList: 'Back to list',
      filterAll: 'All',
      filterNew: 'New',
      filterInProgress: 'In progress',
      filterDone: 'Done',
      sendToKds: '🍳 Send to kitchen',
      kdsSent: 'Sent to kitchen ✓',
      kdsExisting: 'Already in kitchen ✓',
      statusLabel: 'Status',
      fulfillmentLabel: 'Fulfillment',
      paymentLabel: 'Payment',
    },
    suppliers: {
      title: 'Suppliers',
      add: 'Add supplier',
      name: 'Supplier name',
      phone: 'Phone',
      address: 'Address',
      notes: 'Notes',
      noSuppliers: 'No suppliers',
      errorNameRequired: 'Supplier name is required',
      suggestedQty: 'Suggested',
      receiving: {
        title: 'Stock receiving',
        newDelivery: 'New delivery',
        supplier: 'Supplier',
        product: 'Product',
        quantity: 'Quantity',
        unitCost: 'Unit cost',
        totalCost: 'Total cost',
        addLine: 'Add product',
        confirm: 'Confirm receiving',
        confirmed: 'Stock received',
        draft: 'Draft',
        received: 'Received',
        history: 'Receiving history',
        ocrScan: '📷 Scan invoice',
        ocrScanning: 'Scanning...',
        ocrSuccess: '{n} lines detected — {m} products matched. Review before confirming.',
        ocrError: 'Scan failed',
        ocrNotConfigured: 'OCR not configured — set up the provider',
        ocrUnmatched: '⚠ Unknown product — select from list',
        cancelled: 'Cancelled',
        notes: 'Notes',
        optional: 'optional',
        unitCostPiastres: 'Unit cost (piastres)',
        productsUpdated: 'product(s) updated',
        markdownClockReset: 'Auto-markdown clock reset',
        forecastSuggestion: 'Forecast 7d: {n} units suggested',
        productsCount: 'product(s)',
        errorNoProducts: 'Add at least one valid product',
      },
      ledger: {
        title: 'Konnash',
        balance: 'Balance',
        invoices: 'Invoices',
        payments: 'Payments',
        newInvoice: 'New invoice',
        recordPayment: 'Record payment',
        invoiceRef: 'Invoice #',
        invoiceDate: 'Invoice date',
        dueDate: 'Due date',
        tax: 'Tax',
        total: 'Total',
        paid: 'Paid',
        remaining: 'Remaining',
        status: 'Status',
        statusUnpaid: 'Unpaid',
        statusPartial: 'Partial',
        statusPaid: 'Paid',
        statusCancelled: 'Cancelled',
        payMethod: 'Method',
        payReference: 'Reference',
        payDate: 'Date',
        description: 'Description',
        unit: 'Unit',
        unitCost: 'Unit cost (MAD)',
        quantity: 'Qty',
        addLine: 'Add line',
        save: 'Save',
        cancel: 'Cancel',
        noInvoices: 'No invoices',
        noPayments: 'No payments',
        selectSupplier: 'Select a supplier',
        cancelled: 'Cancelled',
        currency: 'MAD',
        optional: 'optional',
        errorNoLines: 'Add at least one line',
        errorAmountRequired: 'Amount is required',
        product: 'Product (optional)',
        searchProduct: 'Search product...',
        noProductMatch: 'No matches',
        clearProduct: 'Unlink',
        costAlertsTitle: 'Purchase cost alert',
        costAlertsHint: 'For information only — no selling price was changed.',
        costOld: 'Previous cost',
        costNew: 'New cost',
        costIncrease: 'Increase',
        marginBefore: 'Margin before',
        marginAfter: 'Margin after',
        belowCost: 'Below cost',
        dismiss: 'Dismiss',
        paymentMethods: {
          cash: 'Cash',
          bank_transfer: 'Bank transfer',
          cheque: 'Cheque',
          mobile: 'Mobile',
          other: 'Other',
        },
      },
    },
    license: {
      activationTitle: 'Software activation',
      instructions: 'Enter the license key sent to you via WhatsApp after registering on the MAGHAREBIT platform.',
      keyLabel: 'License key',
      activateButton: 'Activate',
      verifying: 'Verifying...',
      errorEmptyKey: 'Enter the license key',
      errorRevoked: 'This key has been suspended. Contact support.',
      errorChecksum: 'Invalid key. Check what you typed.',
      errorExpired: 'The license has expired. Renew your subscription.',
      errorMachineMismatch: 'This key is bound to another device.',
      errorGeneric: 'Activation failed. Please try again.',
      errorNetwork: 'Could not reach the server. Check your internet connection.',
      revokedTitle: 'License suspended',
      revokedBody: 'This license has been suspended. Contact technical support to reactivate it.',
      whatsappButton: 'Contact via WhatsApp',
      expiredTitle: 'License expired',
      expiredBody: 'Your subscription has expired. Renew through the MAGHAREBIT platform to continue.',
      renewButton: 'Renew subscription',
      daysLeftBanner: 'Your license expires in {days} days',
      daysLeftOne: '1 day left — Renew now',
      daysLeftTwo: '{days} days left — Renew now',
      daysLeftFew: '{days} days left — Renew now',
      daysLeftMany: '{days} days left — Renew now',
      renewNow: 'Renew now',
    },
    course: {
      panelTitle: 'Courses',
      noCourse: 'No course (immediate)',
      courseN: 'Course {n}',
      fire: 'Fire course',
      fired: 'Fired',
      held: 'Held',
      none: 'None',
      allergies: 'Allergies',
      save: 'Save',
      cancel: 'Cancel',
      empty: 'No items in the order',
      takeaway: 'Take Away',
      errorLoad: 'Could not load the order',
      errorFire: 'Could not fire the course',
      errorSave: 'Save failed',
      errorStarted: 'The kitchen has already started this item',
    },
    voice: {
      tapToSpeak: 'Tap to speak',
      listening: 'Listening...',
      notSupported: 'Voice commands are not supported in this browser',
      noMic: 'Microphone access denied',
      noSpeech: 'No speech detected',
      networkError: 'Voice network error',
      error: 'Voice error',
      clearConfirm: 'Clear cart?',
      cancel: 'Cancel',
    },
    nav: {
      branches: 'Branches',
    },
    branches: {
      title: 'Branches',
      tabOverview: 'Overview',
      tabStock: 'Stock comparison',
      tabTransfers: 'Transfers',
      refresh: 'Refresh',
      totalRevenue: "Today's revenue (all branches)",
      activeShifts: 'Open shifts',
      todayRevenue: "Today's revenue",
      transactions: 'Transactions',
      staff: 'Staff',
      inactiveBranch: 'Inactive',
      noBranches: 'No branches',
      product: 'Product',
      stockNotice: 'Stock is not tracked per branch yet; figures are company-wide',
      transfer: '+ Transfer',
      fromStore: 'From branch',
      toStore: 'To branch',
      quantity: 'Quantity',
      submit: 'Submit',
      cancel: 'Cancel',
      noProducts: 'No products',
      noTransfers: 'No transfers',
      approve: 'Approve',
      markReceived: 'Mark received',
      cancelTransfer: 'Cancel transfer',
      status: {
        pending: 'Pending',
        approved: 'Approved',
        in_transit: 'In transit',
        received: 'Received',
        cancelled: 'Cancelled',
      },
      errorLoad: 'Could not load data',
      errorSave: 'Action failed',
      errorSameStore: 'Pick two different branches',
    },
    scale: {
      title: 'Scale',
      connect: 'Connect',
      connecting: 'Connecting...',
      connected: 'Connected ✓',
      disconnect: 'Disconnect',
      readWeight: 'Read weight',
      stabilize: 'Stabilize scale',
      port: 'Port',
      baudRate: 'Baud rate',
      selectScale: 'Select scale model',
      driverAvailable: 'Available ✓',
      driverStub: 'Pending',
      testRead: 'Test reading',
      weightResult: '{n} grams',
      errorNoDriver: 'Driver not available for this model',
      notConnected: 'Scale not connected',
      weightUnit: 'kg',
      stable: 'Stable',
      unstable: 'Unstable',
      addToCart: 'Add to cart',
      noWebSerial: 'Web Serial not supported',
      tare: 'Tare',
      errorNoSerial: 'Web Serial is not supported in this browser. Use Chrome or Edge.',
      errorConnect: 'Failed to connect to scale: {msg}',
      errorDisconnected: 'Scale disconnected',
    },
    barcode: {
      defaultTitle: 'Scan barcode',
      permissionDenied: 'Please allow camera access',
      permissionNote: 'Camera permission is required to scan barcodes.',
      retry: 'Retry',
      aim: 'Point the camera at the barcode',
    },
    printer: {
      noWebUsb: 'Browser does not support Web USB',
      noWebUsbHint: 'Use Chrome or Edge for USB printing.',
      status: 'Status',
      supported: 'Supported printers: 80mm ESC/POS thermal via USB (Epson TM, BIXOLON, Xprinter and similar).',
      connect: 'Connect USB printer',
      connecting: 'Connecting…',
      disconnect: 'Disconnect',
      statusDisconnected: 'Disconnected',
      statusConnecting: 'Connecting…',
      statusConnected: 'Connected ✓',
      statusError: 'Printer error',
    },
    split: {
      total: 'Total',
      currencySuffix: 'MAD',
      fillRemaining: 'Fill remaining amount',
      addTender: '+ Add payment method',
      balanced: 'Amount balanced',
      remaining: 'Remaining {n}',
      overpaid: 'Overpaid {n}',
      errorLoadMethods: 'Failed to load payment methods',
      errorStatus: 'Error {n}',
    },
    credit: {
      buttonEmpty: '+ Credit / Customer',
      buttonWithName: 'Credit — {name}',
      viewBalance: 'View balance of {name}',
      searchTitle: 'Select customer / Credit',
      searchPlaceholder: 'Search by name or phone...',
      searching: 'Searching...',
      balanceClear: 'Cleared',
      addNew: '+ Add "{name}"',
      namePlaceholder: 'Customer name *',
      phonePlaceholder: 'Phone (optional)',
      save: 'Save',
      balanceLabel: 'Outstanding balance',
      limitLabel: 'Limit: {n} MAD',
      riskBanner: 'This customer is in credit risk zone',
      amountPlaceholder: 'Amount in MAD',
      notePlaceholder: 'Note (optional)',
      chargeBtn: '+ Charge (credit)',
      payBtn: 'Pay',
      showHistory: 'Show history',
      hideHistory: 'Hide history',
      noTransactions: 'No transactions',
      txCharge: 'Charge',
      txPayment: 'Payment',
      currencySuffix: 'MAD',
      errorInvalidAmount: 'Enter a valid amount',
      errorLimitExceeded: 'Credit limit exceeded ({n} MAD)',
      errorGeneric: 'An error occurred',
    },
    tableMap: {
      title: 'Table Map',
      loading: 'Loading...',
      capacity: '{n} seats',
      statusAvailable: 'Available',
      statusOccupied: 'Occupied',
      statusBilled: 'Billed',
      statusReserved: 'Reserved',
    },
    modifiers: {
      selectAddons: 'Choose options',
      loading: 'Loading...',
      total: 'Total',
      currencySuffix: 'MAD',
      addToOrder: 'Add to order',
    },
    productQR: {
      generating: 'Generating...',
      download: 'Download PNG',
    },
    kds: {
      title: 'Kitchen Display',
      sendToKitchen: 'Send to kitchen',
      sentToKitchen: 'Sent to kitchen ✓',
      alreadyInKitchen: 'Already in kitchen ✓',
      new: 'New',
      preparing: 'Preparing',
      ready: 'Ready ✓',
      done: 'Done',
      start: '▶ Start',
      markReady: '✓ Ready',
      markDone: '✓ Done',
      walkin: 'Walk-in',
      whatsapp: 'WhatsApp',
      table: 'Table',
      takeaway: 'Takeaway',
      tableNumber: 'Table number',
      noOrders: 'No active orders',
      elapsed: 'ago',
      ordersCompleted: 'Completed',
      backToPOS: '← POS',
      newOrderAlert: 'New order!',
      fulfillmentSurPlace: '🪑 Dine-in',
      fulfillmentEmporter: '🥡 Takeaway',
      notesPlaceholder: 'Notes...',
      send: 'Send',
      cancel: 'Cancel',
      pending: 'Waiting',
      refresh: 'Refresh ↺',
      tapToAdvance: 'Tap to advance →',
      enableSound: 'Enable sound',
      soundOn: '🔊 Sound on',
      soundOff: '🔇 Sound off',
      tapToEnableSound: 'Tap to enable sound 🔔',
      newOrder: 'New order!',
      sessionExpired: 'Session expired',
      signInToContinue: 'Sign in to continue',
    },
    products: {
      title: 'Products',
      add: 'Add product',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
      nameAr: 'Name in Arabic',
      nameFr: 'Name in French',
      category: 'Category',
      price: 'Price (MAD)',
      barcode: 'Barcode',
      plu: 'PLU code',
      image: 'Product image',
      uploadImage: 'Upload image',
      imageHint: 'JPG/PNG/WebP — auto-resized',
      isWeighted: 'Sold by weight',
      uom: 'Unit of measure',
      isPerishable: 'Perishable (auto-markdown)',
      trackStock: 'Track stock',
      stockQty: 'Current stock',
      lowStockThreshold: 'Low stock threshold',
      description: 'Description',
      businessFields: 'Additional fields',
      businessType: 'Business type',
      setBusinessType: 'Choose your business type',
      noProducts: 'No products',
      searchProducts: 'Search products',
      confirmDelete: 'Confirm delete?',
      deleted: 'Product deleted',
      saved: 'Product saved',
      imageUpdated: 'Image updated',
      loading: 'Loading...',
      allCategories: 'All categories',
      categoryPlaceholder: '— Select a category —',
      statsTotal: 'Total',
      statsActive: 'Active',
      statsInactive: 'Inactive',
      stockLabel: 'Stock',
      addTitle: 'Add new product',
      editPrefix: 'Edit: ',
      cost: 'Cost price (MAD)',
      isActive: 'Active',
      addButton: 'Add',
      inactiveBadge: 'Inactive',
      errorNameRequired: 'Arabic name is required',
      errorSave: 'Save failed',
      errorConnection: 'Could not connect to server',
      successAdd: 'Product added ✓',
      successEdit: 'Product updated ✓',
      confirmDeleteMsg: 'Delete "{name}"?',
      uomLabels: { UNIT: 'Unit', KG: 'Kg', G: 'g', L: 'L', ML: 'mL', BUNCH: 'Bunch', BOX: 'Box', BAG: 'Bag', PIECE: 'Piece' },
      removeImage: 'Remove image',
      imageTooBig: 'Image too large (max 20 MB)',
      imageInvalidType: 'Unsupported format (JPEG/PNG/WebP)',
      imageUploading: 'Uploading...',
      margin: 'Margin',
    },
    staff: {
      title: 'Staff Management',
      addNew: '+ New staff',
      loading: 'Loading...',
      noStaff: 'No staff members',
      addTitle: 'Add new staff',
      editPrefix: 'Edit: ',
      nameArLabel: 'Name in Arabic *',
      nameFrLabel: 'Name in French',
      roleLabel: 'Role',
      pinLabel: 'PIN *',
      pinNew: 'New PIN (leave blank to keep)',
      pinConfirm: 'Confirm PIN',
      editButton: 'Edit',
      deactivate: 'Deactivate',
      activate: 'Activate',
      addButton: 'Add',
      saveButton: 'Save',
      cancelButton: 'Cancel',
      errorNameRequired: 'Arabic name is required',
      errorPinLength: 'PIN must be at least 4 digits',
      errorPinMismatch: 'PINs do not match',
      errorSave: 'Save failed',
      errorConnection: 'Could not connect to server',
      successAdd: 'Staff member added ✓',
      successEdit: 'Staff member updated ✓',
      roles: { CASHIER: 'Cashier', SENIOR_CASHIER: 'Senior Cashier', INVENTORY: 'Stock Manager', MANAGER: 'Manager', SUPERVISOR: 'Supervisor' },
    },
    alerts: {
      types: { rapid_voids: 'Repeated voids ⚠️', void_spike: 'Void spike', discount_over_limit: 'Excessive discount', unusual_discount: 'Unusual discount', cash_discrepancy: 'Cash discrepancy 💰', price_override: 'Price override', unusual_refund: 'Suspicious refund' },
      score: 'Score: {score} / 100',
      acknowledge: 'Done ✓',
    },
  },
};

export function getDir(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export function getFontClass(lang: Lang): string {
  return lang === 'ar' ? 'font-cairo' : 'font-inter';
}
