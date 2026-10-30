import type { Lang } from '@/components/landing/useLang';

/** Portal navigation: the same 8 pages as before, grouped. Labels follow the URL locale (shell only). */

export type NavSlug = 'dashboard' | 'products' | 'customers' | 'purchases' | 'employees' | 'marketing' | 'reports' | 'settings';
export type NavGroup = 'sell' | 'manage' | 'grow' | 'system';

export interface NavItem { slug: NavSlug; group: NavGroup; icon: string }

export const NAV: NavItem[] = [
  { slug: 'dashboard', group: 'sell', icon: 'M3 11 12 4l9 7v9h-6v-6H9v6H3z' },
  { slug: 'products', group: 'sell', icon: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8' },
  { slug: 'customers', group: 'sell', icon: 'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1a3 3 0 0 0-2-2.8M17 5.2a3 3 0 0 1 0 5.6' },
  { slug: 'purchases', group: 'manage', icon: 'M3 6h11v9H3zM14 9h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z' },
  { slug: 'employees', group: 'manage', icon: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19v-1a5 5 0 0 1 10 0v1M16 11l2 2 4-4' },
  { slug: 'marketing', group: 'grow', icon: 'M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11' },
  { slug: 'reports', group: 'grow', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { slug: 'settings', group: 'system', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
];

export const GROUP_ORDER: NavGroup[] = ['sell', 'manage', 'grow', 'system'];

export const SHELL_COPY: Record<Lang, {
  nav: Record<NavSlug, string>;
  groups: Record<NavGroup, string>;
  portal: string; menu: string; closeMenu: string; collapse: string; expand: string; skip: string;
  notifications: string; logout: string; account: string; language: string; daysLeft: (n: number) => string; trial: string;
  status: { online: string; reconnecting: string; offline: string; degraded: string };
  banner: { offline: string; degraded: string };
  toast: { offlineWrite: string; sessionExpired: string; close: string };
}> = {
  fr: {
    nav: { dashboard: 'Tableau de bord', products: 'Produits', customers: 'Clients', purchases: 'Achats', employees: 'Employés', marketing: 'Marketing', reports: 'Rapports', settings: 'Paramètres' },
    groups: { sell: 'Vente', manage: 'Gestion', grow: 'Croissance', system: 'Compte' },
    portal: 'Portail commerçant', menu: 'Ouvrir le menu', closeMenu: 'Fermer le menu', collapse: 'Réduire le menu', expand: 'Agrandir le menu',
    skip: 'Aller au contenu', notifications: 'Notifications', logout: 'Se déconnecter', account: 'Compte', language: 'Langue',
    daysLeft: (n) => (n <= 1 ? `${n} jour restant` : `${n} jours restants`), trial: 'Essai',
    status: { online: 'En ligne', reconnecting: 'Reconnexion…', offline: 'Hors ligne', degraded: 'Serveur indisponible' },
    banner: {
      offline: 'Hors ligne — les données affichées peuvent dater ; les modifications reprendront au retour du réseau.',
      degraded: 'Le serveur MAGHAREBIT ne répond pas pour l’instant — vos données sont en sécurité, réessayez dans un moment.',
    },
    toast: { offlineWrite: 'Modification non envoyée : vous êtes hors ligne. Réessayez au retour du réseau.', sessionExpired: 'Votre session a expiré. Reconnectez-vous.', close: 'Fermer' },
  },
  ar: {
    nav: { dashboard: 'لوحة التحكم', products: 'المنتجات', customers: 'العملاء', purchases: 'المشتريات', employees: 'الموظفون', marketing: 'التسويق', reports: 'التقارير', settings: 'الإعدادات' },
    groups: { sell: 'البيع', manage: 'الإدارة', grow: 'النمو', system: 'الحساب' },
    portal: 'بوابة التاجر', menu: 'فتح القائمة', closeMenu: 'إغلاق القائمة', collapse: 'تصغير القائمة', expand: 'توسيع القائمة',
    skip: 'الانتقال إلى المحتوى', notifications: 'الإشعارات', logout: 'تسجيل الخروج', account: 'الحساب', language: 'اللغة',
    // Arabic counted nouns: 1 / 2 / 3–10 / 11+
    daysLeft: (n) => (n <= 1 ? 'يوم واحد متبقٍ' : n === 2 ? 'يومان متبقيان' : n <= 10 ? `${n} أيام متبقية` : `${n} يوماً متبقياً`), trial: 'تجربة',
    status: { online: 'متصل', reconnecting: 'جارٍ إعادة الاتصال…', offline: 'غير متصل', degraded: 'الخادم غير متاح' },
    banner: {
      offline: 'غير متصل — قد تكون البيانات المعروضة قديمة؛ ستستأنف التعديلات عند عودة الشبكة.',
      degraded: 'خادم MAGHAREBIT لا يستجيب حالياً — بياناتك في أمان، أعد المحاولة بعد قليل.',
    },
    toast: { offlineWrite: 'لم يُرسل التعديل: أنت غير متصل. أعد المحاولة عند عودة الشبكة.', sessionExpired: 'انتهت جلستك. سجّل الدخول من جديد.', close: 'إغلاق' },
  },
  en: {
    nav: { dashboard: 'Dashboard', products: 'Products', customers: 'Customers', purchases: 'Purchases', employees: 'Staff', marketing: 'Marketing', reports: 'Reports', settings: 'Settings' },
    groups: { sell: 'Sell', manage: 'Manage', grow: 'Grow', system: 'Account' },
    portal: 'Merchant portal', menu: 'Open the menu', closeMenu: 'Close the menu', collapse: 'Collapse the menu', expand: 'Expand the menu',
    skip: 'Skip to content', notifications: 'Notifications', logout: 'Sign out', account: 'Account', language: 'Language',
    daysLeft: (n) => (n === 1 ? '1 day left' : `${n} days left`), trial: 'Trial',
    status: { online: 'Online', reconnecting: 'Reconnecting…', offline: 'Offline', degraded: 'Server unavailable' },
    banner: {
      offline: 'Offline — what you see may be out of date; changes resume when the network is back.',
      degraded: 'The MAGHAREBIT server is not responding right now — your data is safe, try again in a moment.',
    },
    toast: { offlineWrite: 'Change not sent: you are offline. Try again when the network is back.', sessionExpired: 'Your session has expired. Please sign in again.', close: 'Close' },
  },
};
