import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import { BRAND } from '@/lib/brand';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isAr = locale === 'ar';
  const title = isAr
    ? 'سياسة الخصوصية — MAGHAREBIT | نظام الكاشير المغربي'
    : locale === 'fr'
    ? 'Politique de confidentialité — MAGHAREBIT | Caisse marocaine'
    : 'Privacy Policy — MAGHAREBIT | Moroccan POS System';
  const description = isAr
    ? 'مشروع مغربي 100٪، صُمم في المغرب للتجار المغاربة. بياناتك تبقى في المغرب — نحن لا نبيعها ولا نشاركها.'
    : locale === 'fr'
    ? "Projet 100% marocain, conçu au Maroc pour les commerçants marocains. Vos données restent au Maroc — nous ne les vendons ni ne les partageons."
    : '100% Moroccan project, built in Morocco for Moroccan merchants. Your data stays in Morocco — we never sell or share it.';
  return {
    title,
    description,
    alternates: { canonical: `/${locale}/privacy` },
    openGraph: { title, description },
  };
}

const ABOUT_AR = {
  heading: 'من نحن',
  p1: 'MAGHAREBIT مشروع مغربي 100٪، أُسِّس من قِبَل فريق من المطورين والتجار المغاربة الذين عاشوا مشاكل إدارة المتاجر اليومية من الداخل. ولدنا من الحاجة الحقيقية، لا من غرفة الاجتماعات.',
  p2: 'نحن نبني نظام نقطة البيع الذي كنا نتمنى أن يكون موجوداً حين كنا نعمل في التجارة — بالعربية أولاً، يعمل بدون إنترنت، بسيط للكاشير وقوي للمالك.',
  p3: 'مقرنا في المغرب. نخدم التجار في المغرب والمهجر. بياناتك تبقى في المغرب.',
};
const ABOUT_FR = {
  heading: 'Qui sommes-nous',
  p1: "MAGHAREBIT est un projet 100% marocain, fondé par une équipe de développeurs et commerçants marocains qui ont vécu les problèmes de gestion de commerces de l'intérieur. Nous sommes nés d'un besoin réel, pas d'une salle de réunion.",
  p2: "Nous construisons le système de caisse que nous aurions voulu avoir quand nous travaillions dans le commerce — en arabe d'abord, fonctionnel hors-ligne, simple pour le caissier et puissant pour le propriétaire.",
  p3: 'Basés au Maroc. Au service des commerçants au Maroc et dans la diaspora. Vos données restent au Maroc.',
};
const ABOUT_EN = {
  heading: 'Who we are',
  p1: 'MAGHAREBIT is a 100% Moroccan project, founded by a team of Moroccan developers and merchants who experienced retail management challenges first-hand. We were born from a real need, not a boardroom.',
  p2: 'We are building the POS system we wish had existed when we worked in retail — Arabic-first, offline-capable, simple for the cashier and powerful for the owner.',
  p3: 'Based in Morocco. Serving merchants in Morocco and the diaspora. Your data stays in Morocco.',
};

const SECTIONS_AR = [
  {
    title: '١. مقدمة',
    body: 'تلتزم شركة Wayloz Group ("نحن"، "الشركة") بحماية خصوصيتك. هذه السياسة تشرح بوضوح كيف نتعامل مع بياناتك — بلغة بسيطة، بدون مصطلحات قانونية معقدة.',
  },
  {
    title: '٢. البيانات التي نجمعها',
    body: 'نجمع فقط ما نحتاجه لتشغيل خدمتك: اسم متجرك، رقم هاتفك، نوع نشاطك. لا نجمع بيانات إضافية. ولا نشتري بيانات من أي طرف ثالث.',
  },
  {
    title: '٣. لماذا نستخدم بياناتك',
    body: 'بياناتك تخدمك أنت أولاً: تشغيل النظام، الدعم التقني، تذكيرات الاشتراك، وتحسين المنتج بناءً على تجربتك. لا نستخدمها لأي شيء آخر.',
  },
  {
    title: '٤. مشاركة البيانات',
    body: 'لا نبيع بياناتك. لا نشاركها. أبداً. الاستثناء الوحيد: مزودي البنية التحتية التقنية (مثل خوادم MongoDB) الذين يلتزمون بمعايير حماية صارمة، ولا يطّلعون على محتوى بياناتك.',
  },
  {
    title: '٥. الأمان',
    body: 'نظام MAGHAREBIT يعمل أوفلاين أولاً — بياناتك محفوظة على جهازك أولاً قبل أي سحابة. كل ما يخرج من جهازك مشفّر بـ TLS، والبيانات الحساسة مخزّنة بتشفير AES-256.',
  },
  {
    title: '٦. أين تُخزَّن بياناتك',
    body: 'بياناتك مخزّنة بشكل أساسي على جهازك المحلي. النسخ السحابية تُحفظ على خوادم في أوروبا تخضع للقانون الأوروبي لحماية البيانات (GDPR). أنت تملك بياناتك، ويمكنك تصديرها في أي وقت.',
  },
  {
    title: '٧. مدة الاحتفاظ',
    body: 'نحتفظ ببياناتك ما دمت مشتركاً، وحتى 90 يوماً بعد الإلغاء — احتياطاً في حال أردت العودة. بعد 90 يوماً، تُمحى نهائياً. يمكنك طلب الحذف الفوري في أي وقت.',
  },
  {
    title: '٨. حقوقك',
    body: 'يحق لك الوصول إلى بياناتك، تصحيحها، حذفها، تصديرها، أو طلب إيقاف معالجتها. كل ما تحتاجه: رسالة بريد إلكتروني إلى ' + BRAND.contact.email + '. سنرد خلال 48 ساعة.',
  },
  {
    title: '٩. ملفات تعريف الارتباط (Cookies)',
    body: 'لا نستخدم ملفات تتبع إعلانية. ولا نسمح لشركات أخرى بتتبعك من خلال موقعنا. الكوكيز الوحيدة المستخدمة ضرورية لتشغيل تسجيل الدخول وتفضيلات اللغة.',
  },
  {
    title: '١٠. تحديثات هذه السياسة',
    body: 'إذا غيّرنا شيئاً مهماً، سنخبرك بالبريد الإلكتروني قبل أن يدخل التغيير حيز التنفيذ. لن تكتشف تغييرات الخصوصية بالصدفة.',
  },
];

const SECTIONS_FR = [
  {
    title: '1. Introduction',
    body: "Wayloz Group (« nous ») s'engage à protéger votre vie privée. Cette politique explique clairement comment nous traitons vos données — en langage simple, sans jargon juridique.",
  },
  {
    title: '2. Données collectées',
    body: 'Nous collectons uniquement ce dont nous avons besoin pour faire fonctionner votre service : nom de votre commerce, numéro de téléphone, type d\'activité. Rien de plus. Nous n\'achetons pas de données à des tiers.',
  },
  {
    title: '3. Pourquoi nous utilisons vos données',
    body: "Vos données vous servent en premier : faire fonctionner le système, le support technique, les rappels d'abonnement, et améliorer le produit selon votre expérience. Rien d'autre.",
  },
  {
    title: '4. Partage des données',
    body: 'Nous ne vendons pas vos données. Nous ne les partageons pas. Jamais. Seule exception : les fournisseurs d\'infrastructure technique (comme les serveurs MongoDB) soumis à des engagements stricts, qui n\'accèdent pas au contenu de vos données.',
  },
  {
    title: '5. Sécurité',
    body: 'MAGHAREBIT fonctionne hors-ligne d\'abord — vos données sont sauvegardées sur votre appareil avant tout cloud. Tout ce qui sort de votre appareil est chiffré en TLS, et les données sensibles sont stockées en AES-256.',
  },
  {
    title: '6. Où sont stockées vos données',
    body: "Vos données sont stockées principalement sur votre appareil local. Les sauvegardes cloud sont sur des serveurs en Europe soumis au RGPD. Vous êtes propriétaire de vos données, et vous pouvez les exporter à tout moment.",
  },
  {
    title: '7. Durée de conservation',
    body: 'Nous conservons vos données tant que vous êtes abonné, et jusqu\'à 90 jours après résiliation — au cas où vous voudriez revenir. Après 90 jours, suppression définitive. Vous pouvez demander la suppression immédiate à tout moment.',
  },
  {
    title: '8. Vos droits',
    body: 'Vous avez le droit d\'accéder, corriger, supprimer, exporter vos données ou demander l\'arrêt de leur traitement. Tout ce dont vous avez besoin : un email à ' + BRAND.contact.email + '. Nous répondons sous 48h.',
  },
  {
    title: '9. Cookies',
    body: "Aucun cookie publicitaire. Aucun traceur tiers. Les seuls cookies utilisés sont nécessaires au fonctionnement (connexion, préférences de langue).",
  },
  {
    title: '10. Modifications de cette politique',
    body: "Si nous changeons quelque chose d'important, nous vous prévenons par email avant que le changement n'entre en vigueur. Vous ne découvrirez jamais un changement par hasard.",
  },
];

const SECTIONS_EN = [
  {
    title: '1. Introduction',
    body: 'Wayloz Group ("we") is committed to protecting your privacy. This policy explains clearly how we handle your data — in plain language, without legal jargon.',
  },
  {
    title: '2. Data We Collect',
    body: 'We collect only what we need to run your service: your store name, phone number, business type. Nothing more. We do not buy data from any third party.',
  },
  {
    title: '3. Why We Use Your Data',
    body: 'Your data serves you first: running the system, technical support, subscription reminders, and improving the product based on your experience. Nothing else.',
  },
  {
    title: '4. Data Sharing',
    body: 'We do not sell your data. We do not share it. Ever. Only exception: technical infrastructure providers (like MongoDB servers) bound by strict commitments, who never access the content of your data.',
  },
  {
    title: '5. Security',
    body: 'MAGHAREBIT runs offline-first — your data is saved on your device before any cloud. Everything leaving your device is TLS-encrypted, and sensitive data is stored with AES-256.',
  },
  {
    title: '6. Where Your Data Is Stored',
    body: 'Your data is stored primarily on your local device. Cloud backups live on European servers subject to GDPR. You own your data, and you can export it at any time.',
  },
  {
    title: '7. Retention Period',
    body: 'We keep your data as long as you are subscribed, plus 90 days after cancellation — in case you want to come back. After 90 days, permanent deletion. You can request immediate deletion at any time.',
  },
  {
    title: '8. Your Rights',
    body: 'You have the right to access, correct, delete, export your data or request a halt to processing. All you need: an email to ' + BRAND.contact.email + '. We respond within 48 hours.',
  },
  {
    title: '9. Cookies',
    body: 'No advertising cookies. No third-party trackers. The only cookies used are necessary for operation (login, language preferences).',
  },
  {
    title: '10. Policy Changes',
    body: 'If we change something important, we will notify you by email before the change takes effect. You will never discover a privacy change by accident.',
  },
];

export default async function PrivacyPage() {
  const locale = await getLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL
    ? 'Noto Naskh Arabic, Cairo, serif'
    : 'Inter, sans-serif';

  const sections =
    locale === 'ar' ? SECTIONS_AR : locale === 'fr' ? SECTIONS_FR : SECTIONS_EN;
  const about =
    locale === 'ar' ? ABOUT_AR : locale === 'fr' ? ABOUT_FR : ABOUT_EN;

  const heading =
    locale === 'ar'
      ? 'سياسة الخصوصية'
      : locale === 'fr'
      ? 'Politique de Confidentialité'
      : 'Privacy Policy';

  const lastUpdated =
    locale === 'ar'
      ? 'آخر تحديث: يونيو 2025'
      : locale === 'fr'
      ? 'Dernière mise à jour : juin 2025'
      : 'Last updated: June 2025';

  return (
    <>
      <Navbar />
      <main style={{ background: '#0A2318', minHeight: '100vh' }}>

        {/* Hero */}
        <section
          style={{
            paddingTop: '120px',
            paddingBottom: '40px',
            paddingLeft: '24px',
            paddingRight: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '720px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <h1
              className="font-arabic font-extrabold text-white"
              style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)', lineHeight: 1.15, marginBottom: '12px' }}
            >
              {heading}
            </h1>
            <p
              style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.40)' }}
            >
              {lastUpdated}
            </p>
          </div>
        </section>

        {/* Content */}
        <section style={{ padding: '0 24px 100px' }}>
          <div
            style={{
              maxWidth: '720px',
              margin: '0 auto',
              direction: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {/* About MAGHAREBIT — authentic Moroccan identity card */}
            <div
              style={{
                background: 'rgba(240,180,41,0.04)',
                border: '1px solid rgba(240,180,41,0.15)',
                borderRadius: '16px',
                padding: '32px 40px',
                marginBottom: '40px',
              }}
            >
              <h2
                style={{
                  fontFamily: fontBody,
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#F0B429',
                  marginBottom: '20px',
                  lineHeight: 1.3,
                }}
              >
                {about.heading}
              </h2>
              <p style={{ fontFamily: fontBody, fontSize: '16px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, marginBottom: '16px' }}>
                {about.p1}
              </p>
              <p style={{ fontFamily: fontBody, fontSize: '16px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, marginBottom: '16px' }}>
                {about.p2}
              </p>
              <p style={{ fontFamily: fontBody, fontSize: '16px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, marginBottom: 0 }}>
                {about.p3}
              </p>
            </div>

            {/* Legal sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
              {sections.map((sec, i) => (
                <div key={i}>
                  <h2
                    style={{
                      fontFamily: fontBody,
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#F0B429',
                      marginBottom: '12px',
                      lineHeight: 1.3,
                    }}
                  >
                    {sec.title}
                  </h2>
                  <p
                    style={{
                      fontFamily: fontBody,
                      fontSize: '15px',
                      color: 'rgba(255,255,255,0.75)',
                      lineHeight: 1.8,
                    }}
                  >
                    {sec.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Contact box */}
            <div
              style={{
                marginTop: '40px',
                background: 'rgba(240,180,41,0.08)',
                border: '1px solid rgba(240,180,41,0.2)',
                borderRadius: '14px',
                padding: '24px',
              }}
            >
              <p
                style={{
                  fontFamily: fontBody,
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.70)',
                  lineHeight: 1.8,
                  margin: 0,
                }}
              >
                {locale === 'ar'
                  ? `للأسئلة المتعلقة بسياسة الخصوصية، تواصل معنا على: ${BRAND.contact.email} أو عبر واتساب ${BRAND.contact.whatsapp}`
                  : locale === 'fr'
                  ? `Pour toute question relative à cette politique, contactez-nous à : ${BRAND.contact.email} ou via WhatsApp ${BRAND.contact.whatsapp}`
                  : `For privacy questions, contact us at: ${BRAND.contact.email} or via WhatsApp ${BRAND.contact.whatsapp}`}
              </p>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
