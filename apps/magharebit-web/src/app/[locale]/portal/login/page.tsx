'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BRAND } from '@/lib/brand';
import Logo from '@/components/brand/Logo';
import { useLang, type Lang } from '@/components/landing/useLang';

// ─── License key auto-formatter ───────────────────────────────────────────────
// MGH key format: MGH-YYYYMM-8hex-4hex-2hex  (27 chars + 4 dashes = 31 total)
// Segments: [3, 6, 8, 4, 2]
const KEY_SEGMENTS = [3, 6, 8, 4, 2]; // sum = 23 alphanum chars
function formatLicenseKey(raw: string): string {
  const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 23);
  const parts: string[] = [];
  let idx = 0;
  for (const len of KEY_SEGMENTS) {
    if (idx >= clean.length) break;
    parts.push(clean.slice(idx, idx + len));
    idx += len;
  }
  return parts.join('-');
}

const LOCALES: Lang[] = ['ar', 'fr', 'en'];

// ─── Copy ─────────────────────────────────────────────────────────────────────
const COPY: Record<Lang, {
  language: string; tagline: string; subtitle: string; features: [string, string, string];
  title: string; intro: string; identifier: string; license: string; licenseEx: string;
  submit: string; submitting: string; noAccount: string; startTrial: string; needKey: string; contact: string; back: string;
  errors: Record<string, string>; errGeneric: string; errNetwork: string;
}> = {
  ar: {
    language: 'اللغة', tagline: 'إدارة متجرك بذكاء', subtitle: 'بوابة التحكم الاحترافية لأصحاب المتاجر',
    features: ['يعمل بدون اتصال بالإنترنت', 'واجهة عربية أصيلة ومريحة', 'دعم فني متواصل على مدار الساعة'],
    title: 'مرحباً بعودتك', intro: 'أدخل رقم هاتفك أو بريدك الإلكتروني ومفتاح الترخيص',
    identifier: 'رقم الهاتف أو البريد الإلكتروني', license: 'مفتاح الترخيص', licenseEx: 'مثال:',
    submit: 'تسجيل الدخول', submitting: 'جارٍ الدخول...', noAccount: 'ليس لديك حساب؟', startTrial: 'ابدأ تجربتك المجانية', needKey: 'هل تحتاج مفتاح ترخيص؟', contact: 'تواصل معنا', back: 'العودة إلى الموقع',
    errors: {
      identifier_required: 'يرجى إدخال رقم الهاتف أو البريد الإلكتروني',
      license_key_required: 'يرجى إدخال مفتاح الترخيص',
      invalid_license_key: 'مفتاح الترخيص غير صحيح',
      license_revoked: 'تم إلغاء هذا الترخيص',
      license_expired: 'انتهت صلاحية الترخيص — تواصل معنا للتجديد',
      account_not_found: 'لم يُعثر على حساب بهذه المعلومات',
      account_pending: 'حسابك قيد المراجعة — سيتم تفعيله قريباً',
      account_suspended: 'تم تعليق هذا الحساب — تواصل مع الدعم',
      license_not_for_this_account: 'مفتاح الترخيص لا ينتمي لهذا الحساب',
      service_unavailable: 'الخادم غير متاح مؤقتاً، حاول لاحقاً',
    },
    errGeneric: 'فشل تسجيل الدخول، حاول مرة أخرى', errNetwork: 'تعذر الاتصال بالخادم',
  },
  fr: {
    language: 'Langue', tagline: 'Gérez votre commerce intelligemment', subtitle: 'Le portail de pilotage pour les commerçants',
    features: ['Fonctionne sans connexion Internet', 'Interface en arabe, français et anglais', 'Assistance technique continue, 24 h/24'],
    title: 'Bon retour', intro: 'Saisissez votre téléphone ou votre e-mail et votre clé de licence',
    identifier: 'Téléphone ou e-mail', license: 'Clé de licence', licenseEx: 'Exemple :',
    submit: 'Se connecter', submitting: 'Connexion…', noAccount: 'Pas encore de compte ?', startTrial: 'Démarrez votre essai gratuit', needKey: 'Besoin d’une clé de licence ?', contact: 'Contactez-nous', back: 'Retour au site',
    errors: {
      identifier_required: 'Saisissez votre numéro de téléphone ou votre e-mail.',
      license_key_required: 'Saisissez votre clé de licence.',
      invalid_license_key: 'La clé de licence n’est pas valide.',
      license_revoked: 'Cette licence a été révoquée.',
      license_expired: 'La licence a expiré — contactez-nous pour la renouveler.',
      account_not_found: 'Aucun compte ne correspond à ces informations.',
      account_pending: 'Votre compte est en cours de vérification — il sera activé très bientôt.',
      account_suspended: 'Ce compte est suspendu — contactez le support.',
      license_not_for_this_account: 'Cette clé de licence n’appartient pas à ce compte.',
      service_unavailable: 'Le serveur est momentanément indisponible, réessayez plus tard.',
    },
    errGeneric: 'La connexion a échoué, réessayez.', errNetwork: 'Impossible de joindre le serveur.',
  },
  en: {
    language: 'Language', tagline: 'Run your store smarter', subtitle: 'The control portal for store owners',
    features: ['Works without an Internet connection', 'Interface in Arabic, French and English', 'Technical support around the clock'],
    title: 'Welcome back', intro: 'Enter your phone or email and your license key',
    identifier: 'Phone or email', license: 'License key', licenseEx: 'Example:',
    submit: 'Sign in', submitting: 'Signing in…', noAccount: 'No account yet?', startTrial: 'Start your free trial', needKey: 'Need a license key?', contact: 'Contact us', back: 'Back to the website',
    errors: {
      identifier_required: 'Enter your phone number or email.',
      license_key_required: 'Enter your license key.',
      invalid_license_key: 'The license key is not valid.',
      license_revoked: 'This license has been revoked.',
      license_expired: 'The license has expired — contact us to renew it.',
      account_not_found: 'No account matches this information.',
      account_pending: 'Your account is under review — it will be activated shortly.',
      account_suspended: 'This account is suspended — contact support.',
      license_not_for_this_account: 'This license key does not belong to this account.',
      service_unavailable: 'The server is temporarily unavailable, try again later.',
    },
    errGeneric: 'Sign-in failed, please try again.', errNetwork: 'Could not reach the server.',
  },
};

const FEATURE_ICONS = ['⚡', '🌿', '🛡️'];

const INPUT = 'min-h-[48px] w-full rounded-[10px] border-[1.5px] border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#111827] outline-none transition-colors duration-200 placeholder:text-[#9CA3AF] focus:border-[#0F3D2A] focus-visible:ring-2 focus-visible:ring-[#B8860B]/40';
const LINK = 'rounded text-sm transition-colors hover:text-[#0F3D2A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B]';

export default function LoginPage() {
  const router = useRouter();
  const { lang, isRTL, locale } = useLang();
  const c = COPY[lang];

  const [identifier, setIdentifier] = useState(''); // phone or email
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier: identifier.trim(), licenseKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(c.errors[data.error ?? ''] ?? c.errGeneric);
        return;
      }
      // Coming from a gated download (?next=/api/download/windows): continue to the installer.
      const next = new URLSearchParams(window.location.search).get('next') ?? '';
      if (/^\/api\/download\/(windows|android)\?locale=(ar|fr|en)$/.test(next)) {
        window.location.assign(next);
        return;
      }
      router.push(`/${locale}/portal/dashboard`);
    } catch {
      setError(c.errNetwork);
    } finally {
      setLoading(false);
    }
  }

  // Latin-script inputs are always LTR; their text sits on the start side of an RTL page (right) and of an LTR page (left)
  const align = isRTL ? 'text-right' : 'text-left';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} lang={lang} className={`flex min-h-screen ${isRTL ? 'font-arabic' : ''}`} data-testid="login-page" data-lang={lang}>
      {/* ── Brand column (md+): dark shell, zellige watermark behind the content only ── */}
      <div className="relative hidden flex-col items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#0A2318_0%,#0F3D2A_50%,#0A2318_100%)] p-12 md:flex md:basis-3/5">
        <div
          aria-hidden="true"
          data-testid="login-zellige"
          className="pointer-events-none absolute inset-0 bg-[#F0B429] opacity-5 [-webkit-mask-image:url('/brand/zellige-pattern.svg')] [-webkit-mask-size:368px_506.7px] [mask-image:url('/brand/zellige-pattern.svg')] [mask-size:368px_506.7px]"
        />
        <div className="relative z-10 max-w-[420px] text-center">
          <div className="mb-10 flex justify-center">
            <div className="flex h-[90px] w-[90px] items-center justify-center drop-shadow-[0_0_32px_rgba(240,180,41,0.45)]">
              <Logo height={84} on="dark" priority variant="emblem" />
            </div>
          </div>
          <div dir="ltr" className="mb-2 font-['Plus_Jakarta_Sans',sans-serif] text-[1.75rem] font-extrabold tracking-tight text-white">
            MAGHAR<span className="text-[#F0B429]">EBIT</span>
          </div>
          <p className="mb-2 text-xl font-semibold text-white/90">{c.tagline}</p>
          <p className="mb-12 text-sm leading-[1.7] text-white/55">{c.subtitle}</p>
          <ul className="flex flex-col gap-4 text-start">
            {c.features.map((text, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-[18px] py-3.5">
                <span aria-hidden="true" className="shrink-0 text-xl">{FEATURE_ICONS[i]}</span>
                <span className="text-sm font-medium text-white/80">{text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-12 border-t border-white/10 pt-8 text-xs text-white/40">
            <bdi dir="ltr">{BRAND.company.copyright} — Wayloz Group</bdi>
          </div>
        </div>
      </div>

      {/* ── Form column ── */}
      <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center bg-[#F8F9FA] px-6 py-10 md:basis-2/5">
        <nav aria-label={c.language} className="absolute end-4 top-4 flex items-center rounded-full bg-[#F3F4F6] p-1 ring-1 ring-[#E5E7EB]" data-testid="login-lang">
          {LOCALES.map((l) => (
            <Link
              key={l}
              href={`/${l}/portal/login`}
              hrefLang={l}
              lang={l}
              aria-current={l === lang ? 'true' : undefined}
              data-lang={l}
              // keep ?next= (gated download) when switching language
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                router.push(`/${l}/portal/login${window.location.search}`);
              }}
              className={`grid min-h-[40px] min-w-[44px] place-items-center rounded-full px-3 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B] ${l === lang ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'}`}
            >
              {l.toUpperCase()}
            </Link>
          ))}
        </nav>

        <div className="w-full max-w-[400px]">
          {/* Mobile-only logo (the brand column is hidden below md) */}
          <div className="mb-8 flex justify-center md:hidden">
            {/* on="light": this block sits on the #F8F9FA form column */}
            <Logo height={32} on="light" variant="horizontal" />
          </div>

          <div className="mb-8">
            <h1 className="mb-1.5 text-[1.75rem] font-bold text-[#111827]" data-testid="login-title">{c.title}</h1>
            <p className="text-sm text-[#6B7280]">{c.intro}</p>
          </div>

          <form onSubmit={handleLogin} noValidate>
            <div className="mb-5">
              <label htmlFor="login-identifier" className="mb-2 block text-sm font-semibold text-[#374151]">{c.identifier}</label>
              <input
                id="login-identifier" type="text" inputMode="email" dir="ltr" value={identifier}
                onChange={(e) => setIdentifier(e.target.value)} placeholder="0612345678 · example@email.com"
                required autoComplete="username" autoCapitalize="none" spellCheck={false}
                className={`${INPUT} ${align}`} data-testid="login-identifier"
              />
            </div>

            <div className="mb-7">
              <label htmlFor="login-license" className="mb-2 block text-sm font-semibold text-[#374151]">{c.license}</label>
              <input
                id="login-license" type="text" dir="ltr" value={licenseKey}
                onChange={(e) => setLicenseKey(formatLicenseKey(e.target.value))} placeholder="MGH-202501-XXXXXXXX-XXXX-XX"
                required autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={31}
                className={`${INPUT} text-center font-mono tracking-[0.12em]`} data-testid="login-license"
              />
              <p className="mt-1.5 text-start text-xs text-[#9CA3AF]">{c.licenseEx} <bdi dir="ltr">MGH-202501-A1B2C3D4-E5F6-G7</bdi></p>
            </div>

            {error && (
              <div role="alert" className="mb-4 rounded-[10px] border border-[#DC2626]/25 bg-[#DC2626]/10 px-4 py-3 text-center text-sm text-[#DC2626]" data-testid="login-error">
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="min-h-[48px] w-full rounded-[10px] bg-[#0F3D2A] px-4 py-3.5 text-base font-bold text-white transition-colors duration-200 hover:bg-[#1A5C3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B] disabled:cursor-not-allowed disabled:bg-[#1A5C3A]"
              data-testid="login-submit"
            >
              {loading ? c.submitting : c.submit}
            </button>
          </form>

          <div className="mt-4 text-center">
            <a href={`/${locale}/auth/signup`} className={`${LINK} text-[#374151]`}>
              {c.noAccount}{' '}
              <span className="font-semibold text-[#0F3D2A] underline">{c.startTrial}</span>
            </a>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            <a href={`/${locale}/demo`} className={`${LINK} text-[#6B7280]`}>
              {c.needKey}{' '}
              <span className="font-semibold text-[#0F3D2A] underline">{c.contact}</span>
            </a>
            <a href={`/${locale}`} className={`${LINK} flex items-center gap-1 text-[#6B7280]`}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
              {c.back}
            </a>
          </div>

          <p className="mt-12 text-center text-xs text-[#9CA3AF]"><bdi dir="ltr">{BRAND.company.copyright} — Wayloz Group</bdi></p>
        </div>
      </div>
    </div>
  );
}
