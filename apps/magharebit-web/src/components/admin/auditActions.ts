// Audit action catalogue shared by the audit table and the timeline: filter list, labels (ar/fr/en) and tag colours.

import type { Lang } from './adminUi';

export const AUDIT_ACTIONS = [
  'generateLicense', 'revokeKey', 'extendSubscription', 'approveMerchant', 'suspendMerchant',
  'reactivateMerchant', 'createCoupon', 'broadcastNotification', 'createAdmin', 'disableAdmin', 'adminLogin',
  'activateLead', 'updateLeadStatus', 'releaseTerminal',
  'updateTipping', 'updateCommission', 'createCatalogItem', 'updateCatalogItem', 'updateNotification',
  'exportData',
] as const;

export const ACTION_LABEL: Record<Lang, Record<string, string>> = {
  ar: {
    generateLicense: 'إنشاء ترخيص', revokeKey: 'إلغاء مفتاح', extendSubscription: 'تمديد الاشتراك',
    approveMerchant: 'قبول تاجر', suspendMerchant: 'تعليق تاجر', reactivateMerchant: 'إعادة تفعيل تاجر',
    createCoupon: 'إنشاء قسيمة', broadcastNotification: 'بث إشعار', createAdmin: 'إنشاء مسؤول',
    disableAdmin: 'تعطيل مسؤول', adminLogin: 'تسجيل دخول',
    activateLead: 'تفعيل عميل محتمل', updateLeadStatus: 'تغيير حالة عميل', releaseTerminal: 'تحرير جهاز',
    updateTipping: 'تحديث البقشيش', updateCommission: 'تحديث العمولة', createCatalogItem: 'إضافة عنصر',
    updateCatalogItem: 'تعديل عنصر', updateNotification: 'تعديل إشعار', exportData: 'تصدير بيانات',
  },
  fr: {
    generateLicense: 'Licence générée', revokeKey: 'Clé révoquée', extendSubscription: 'Abonnement prolongé',
    approveMerchant: 'Commerçant approuvé', suspendMerchant: 'Commerçant suspendu', reactivateMerchant: 'Commerçant réactivé',
    createCoupon: 'Coupon créé', broadcastNotification: 'Notification diffusée', createAdmin: 'Admin créé',
    disableAdmin: 'Admin désactivé', adminLogin: 'Connexion',
    activateLead: 'Prospect activé', updateLeadStatus: 'Statut du prospect modifié', releaseTerminal: 'Terminal libéré',
    updateTipping: 'Pourboires modifiés', updateCommission: 'Commission modifiée', createCatalogItem: 'Élément ajouté',
    updateCatalogItem: 'Élément modifié', updateNotification: 'Notification modifiée', exportData: 'Données exportées',
  },
  en: {
    generateLicense: 'License generated', revokeKey: 'Key revoked', extendSubscription: 'Subscription extended',
    approveMerchant: 'Merchant approved', suspendMerchant: 'Merchant suspended', reactivateMerchant: 'Merchant reactivated',
    createCoupon: 'Coupon created', broadcastNotification: 'Notification broadcast', createAdmin: 'Admin created',
    disableAdmin: 'Admin disabled/enabled', adminLogin: 'Sign-in',
    activateLead: 'Lead activated', updateLeadStatus: 'Lead status changed', releaseTerminal: 'Terminal released',
    updateTipping: 'Tipping updated', updateCommission: 'Commission updated', createCatalogItem: 'Item added',
    updateCatalogItem: 'Item edited', updateNotification: 'Notification edited', exportData: 'Data exported',
  },
};

export type AuditTone = 'green' | 'red' | 'gold' | 'blue' | 'grey';

/** Tag colour per action: creation/approval green, revocation/suspension red, money/limits gold, content blue, sign-in grey. */
export const ACTION_TONE: Record<string, AuditTone> = {
  generateLicense: 'green', approveMerchant: 'green', reactivateMerchant: 'green', createAdmin: 'green', activateLead: 'green', createCatalogItem: 'green', createCoupon: 'green',
  revokeKey: 'red', suspendMerchant: 'red', disableAdmin: 'red', releaseTerminal: 'red',
  extendSubscription: 'gold', updateCommission: 'gold', updateTipping: 'gold',
  broadcastNotification: 'blue', updateNotification: 'blue', updateCatalogItem: 'blue', updateLeadStatus: 'blue',
  adminLogin: 'grey', exportData: 'grey',
};

export const TONE_STYLE: Record<AuditTone, { tag: string; dot: string }> = {
  green: { tag: 'bg-[#DCFCE7] text-[#166534]', dot: 'bg-[#16A34A]' },
  red: { tag: 'bg-[#FEE2E2] text-[#991B1B]', dot: 'bg-[#DC2626]' },
  gold: { tag: 'bg-[#FEF3C7] text-[#92400E]', dot: 'bg-[#F0B429]' },
  blue: { tag: 'bg-[#DBEAFE] text-[#1E40AF]', dot: 'bg-[#2563EB]' },
  grey: { tag: 'bg-[#E5E7EB] text-[#374151]', dot: 'bg-[#9CA3AF]' },
};
