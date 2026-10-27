'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';

const COPY = {
  ar: { title: 'تعذّر عرض هذه الصفحة', body: 'حدث خطأ غير متوقع في لوحة الإدارة. أعد تحميل الصفحة؛ إن تكرر الخطأ فأخبر فريق التطوير بالرمز أدناه.', reload: 'إعادة تحميل الصفحة', retry: 'المحاولة مرة أخرى', code: 'الرمز' },
  fr: { title: 'Cette page n’a pas pu s’afficher', body: 'Une erreur inattendue est survenue dans la console d’administration. Rechargez la page ; si elle se reproduit, transmettez le code ci-dessous à l’équipe technique.', reload: 'Recharger la page', retry: 'Réessayer', code: 'Code' },
  en: { title: 'This page could not be displayed', body: 'An unexpected error happened in the admin console. Reload the page; if it keeps happening, send the code below to the dev team.', reload: 'Reload the page', retry: 'Try again', code: 'Code' },
} as const;

/**
 * Error boundary for everything under /admin. A failed client-side navigation or a render error used to leave a
 * blank or frozen page; this keeps the console usable with a one-click full reload.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams();
  const l = params?.locale as string;
  const c = COPY[l === 'ar' || l === 'fr' ? l : 'en'];

  useEffect(() => { console.error('[admin] page error:', error); }, [error]);

  return (
    <main dir={l === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0A2318', padding: '24px' }}>
      <div role="alert" style={{ maxWidth: 520, background: '#0F3D2A', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '28px', color: '#fff' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>{c.title}</h1>
        <p style={{ margin: '0 0 16px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.7 }}>{c.body}</p>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: 'rgba(255,255,255,0.5)' }} dir="ltr">
          {c.code}: {error.digest ?? error.message.slice(0, 120)}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 48, padding: '0 22px', borderRadius: 4, border: 'none', background: '#F0B429', color: '#0A2318', fontWeight: 800, cursor: 'pointer' }}>{c.reload}</button>
          <button type="button" onClick={reset} style={{ minHeight: 48, padding: '0 22px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{c.retry}</button>
        </div>
      </div>
    </main>
  );
}
