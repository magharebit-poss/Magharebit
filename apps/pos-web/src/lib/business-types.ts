export type BusinessType =
  | 'grocery'
  | 'cafe'
  | 'restaurant'
  | 'bakery'
  | 'clothing'
  | 'auto_parts';

export interface BusinessFieldConfig {
  key: string;
  labelAr: string;
  labelFr: string;
  type: 'text' | 'number' | 'multiselect' | 'boolean';
  options?: string[];
  required?: boolean;
}

export interface BusinessTypeConfig {
  type: BusinessType;
  labelAr: string;
  labelFr: string;
  icon: string;
  defaultCategories: string[];
  extraFields: BusinessFieldConfig[];
  showBarcodeField: boolean;
  showWeightField: boolean;
  showPluField: boolean;
}

export const BUSINESS_TYPE_CONFIGS: Record<BusinessType, BusinessTypeConfig> = {
  grocery: {
    type: 'grocery',
    labelAr: 'بقالة / سوبرماركت',
    labelFr: 'Épicerie / Supermarché',
    icon: '🛒',
    defaultCategories: ['مواد غذائية', 'خضر وفواكه', 'مشروبات', 'منظفات', 'متفرقات'],
    extraFields: [],
    showBarcodeField: true,
    showWeightField: true,
    showPluField: true,
  },

  cafe: {
    type: 'cafe',
    labelAr: 'مقهى',
    labelFr: 'Café',
    icon: '☕',
    defaultCategories: ['مشروبات ساخنة', 'مشروبات باردة', 'حلويات', 'وجبات خفيفة'],
    extraFields: [
      {
        key: 'temp_options',
        labelAr: 'خيارات الحرارة',
        labelFr: 'Options température',
        type: 'multiselect',
        options: ['ساخن', 'بارد', 'فاتر'],
      },
      {
        key: 'size_options',
        labelAr: 'الأحجام',
        labelFr: 'Tailles',
        type: 'multiselect',
        options: ['صغير', 'وسط', 'كبير'],
      },
    ],
    showBarcodeField: false,
    showWeightField: false,
    showPluField: false,
  },

  restaurant: {
    type: 'restaurant',
    labelAr: 'مطعم',
    labelFr: 'Restaurant',
    icon: '🍽️',
    defaultCategories: ['مقبلات', 'أطباق رئيسية', 'حساء', 'مشاوي', 'حلويات', 'مشروبات'],
    extraFields: [
      {
        key: 'prep_time_minutes',
        labelAr: 'وقت التحضير (دقيقة)',
        labelFr: 'Temps de préparation (min)',
        type: 'number',
      },
      {
        key: 'allergens',
        labelAr: 'المواد المثيرة للحساسية',
        labelFr: 'Allergènes',
        type: 'multiselect',
        options: ['gluten', 'lactose', 'arachides', 'fruits de mer', 'œufs'],
      },
      {
        key: 'is_vegetarian',
        labelAr: 'نباتي',
        labelFr: 'Végétarien',
        type: 'boolean',
      },
      {
        key: 'spice_level',
        labelAr: 'مستوى الحرارة',
        labelFr: 'Niveau épices',
        type: 'multiselect',
        options: ['🌶', '🌶🌶', '🌶🌶🌶'],
      },
    ],
    showBarcodeField: false,
    showWeightField: false,
    showPluField: false,
  },

  bakery: {
    type: 'bakery',
    labelAr: 'مخبزة / حلواني',
    labelFr: 'Boulangerie / Pâtisserie',
    icon: '🥐',
    defaultCategories: ['خبز', 'معجنات', 'كعك', 'حلويات', 'مشروبات'],
    extraFields: [
      {
        key: 'shelf_life_days',
        labelAr: 'مدة الصلاحية (أيام)',
        labelFr: 'Durée conservation (jours)',
        type: 'number',
      },
      {
        key: 'contains_gluten',
        labelAr: 'يحتوي على غلوتين',
        labelFr: 'Contient gluten',
        type: 'boolean',
      },
    ],
    showBarcodeField: false,
    showWeightField: true,
    showPluField: false,
  },

  clothing: {
    type: 'clothing',
    labelAr: 'ملابس',
    labelFr: 'Vêtements',
    icon: '👕',
    defaultCategories: ['رجالي', 'نسائي', 'أطفال', 'إكسسوارات', 'أحذية'],
    extraFields: [
      {
        key: 'sizes',
        labelAr: 'المقاسات المتاحة',
        labelFr: 'Tailles disponibles',
        type: 'multiselect',
        options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '36', '38', '40', '42', '44', '46'],
      },
      {
        key: 'colors',
        labelAr: 'الألوان',
        labelFr: 'Couleurs',
        type: 'text',
      },
      {
        key: 'material',
        labelAr: 'المادة',
        labelFr: 'Matière',
        type: 'text',
      },
      {
        key: 'gender',
        labelAr: 'الفئة',
        labelFr: 'Genre',
        type: 'multiselect',
        options: ['رجالي', 'نسائي', 'مختلط', 'أطفال'],
      },
    ],
    showBarcodeField: true,
    showWeightField: false,
    showPluField: false,
  },

  auto_parts: {
    type: 'auto_parts',
    labelAr: 'قطع غيار',
    labelFr: 'Pièces détachées',
    icon: '🔧',
    defaultCategories: ['محركات', 'فرامل', 'كهرباء', 'هيكل', 'إطارات', 'زيوت', 'متفرقات'],
    extraFields: [
      {
        key: 'reference_number',
        labelAr: 'الرقم المرجعي',
        labelFr: 'Référence',
        type: 'text',
        required: true,
      },
      {
        key: 'compatibility',
        labelAr: 'التوافق (ماركات / موديلات)',
        labelFr: 'Compatibilité',
        type: 'text',
      },
      {
        key: 'brand',
        labelAr: 'الماركة',
        labelFr: 'Marque',
        type: 'text',
      },
      {
        key: 'condition',
        labelAr: 'الحالة',
        labelFr: 'État',
        type: 'multiselect',
        options: ['جديد', 'مستعمل', 'مجدد'],
      },
    ],
    showBarcodeField: true,
    showWeightField: false,
    showPluField: true,
  },
};

export const ALL_BUSINESS_TYPES = Object.values(BUSINESS_TYPE_CONFIGS);
