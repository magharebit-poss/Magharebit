'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from './AdminShell';
import { BTN_PRIMARY, FIELD, fmtDate, type Lang } from './adminUi';

const MIN = 0;
const MAX = 1000;
const COUNT = 3;

const COPY: Record<Lang, {
  title: string; subtitle: string; tip: (n: number) => string; unit: string; inc: (n: number) => string; dec: (n: number) => string;
  hint: string; preview: string; previewHelp: string; update: string; updating: string; updated: string; unchanged: string;
  loading: string; error: string; unavailable: string; invalid: string; forbidden: string; failed: string; auditFail: string; readOnly: string;
  last: (when: string, by: string) => string; defaults: string; hidden: string;
}> = {
  ar: {
    title: 'البقشيش', subtitle: 'المبالغ الافتراضية للبقشيش المعروضة عند الدفع في نقطة البيع',
    tip: (n) => `البقشيش ${n}`, unit: 'درهم', inc: (n) => `زيادة البقشيش ${n}`, dec: (n) => `إنقاص البقشيش ${n}`,
    hint: 'أعداد صحيحة من 0 إلى 1000 درهم. القيمة 0 تخفي هذا الخيار.', preview: 'المعاينة في نقطة البيع', previewHelp: 'هكذا يظهر البقشيش للكاشير والزبون.',
    update: 'تحديث', updating: 'جارٍ التحديث…', updated: 'تم تحديث مبالغ البقشيش', unchanged: 'لا توجد تغييرات',
    loading: 'جارٍ التحميل…', error: 'تعذّر تحميل الإعدادات', unavailable: 'قاعدة البيانات غير متاحة', invalid: 'أدخل أعداداً صحيحة بين 0 و1000',
    forbidden: 'ليست لديك صلاحية التعديل', failed: 'تعذّر الحفظ', auditFail: 'تحذير: لم يُسجَّل الإجراء في سجل التدقيق', readOnly: 'حسابك للقراءة فقط',
    last: (w, b) => `آخر تحديث ${w} بواسطة ${b}`, defaults: 'القيم الافتراضية (لم يُحفظ شيء بعد)', hidden: 'مخفي',
  },
  fr: {
    title: 'Pourboires', subtitle: 'Montants de pourboire proposés par défaut à l’encaissement du POS',
    tip: (n) => `Pourboire ${n}`, unit: 'MAD', inc: (n) => `Augmenter le pourboire ${n}`, dec: (n) => `Diminuer le pourboire ${n}`,
    hint: 'Nombres entiers de 0 à 1000 MAD. 0 masque cette option.', preview: 'Aperçu dans le POS', previewHelp: 'Voici ce que voient le caissier et le client.',
    update: 'Mettre à jour', updating: 'Mise à jour…', updated: 'Montants de pourboire mis à jour', unchanged: 'Aucun changement',
    loading: 'Chargement…', error: 'Impossible de charger les réglages', unavailable: 'Base de données indisponible', invalid: 'Saisissez des nombres entiers entre 0 et 1000',
    forbidden: 'Vous n’avez pas le droit de modifier', failed: 'Enregistrement impossible', auditFail: 'Attention : action non inscrite au journal d’audit', readOnly: 'Votre compte est en lecture seule',
    last: (w, b) => `Dernière mise à jour ${w} par ${b}`, defaults: 'Valeurs par défaut (rien d’enregistré)', hidden: 'Masqué',
  },
  en: {
    title: 'Tipping', subtitle: 'Default tip amounts offered at POS checkout',
    tip: (n) => `Tip ${n}`, unit: 'MAD', inc: (n) => `Increase tip ${n}`, dec: (n) => `Decrease tip ${n}`,
    hint: 'Whole numbers from 0 to 1000 MAD. 0 hides that option.', preview: 'Preview in the POS', previewHelp: 'This is what the cashier and customer see.',
    update: 'Update', updating: 'Updating…', updated: 'Tip amounts updated', unchanged: 'No changes',
    loading: 'Loading…', error: 'Could not load the settings', unavailable: 'Database unavailable', invalid: 'Enter whole numbers between 0 and 1000',
    forbidden: 'You are not allowed to edit', failed: 'Could not save', auditFail: 'Warning: action was not recorded in the audit log', readOnly: 'Your account is read-only',
    last: (w, b) => `Last updated ${w} by ${b}`, defaults: 'Default values (nothing saved yet)', hidden: 'Hidden',
  },
};

interface Tipping { tips: number[]; saved: boolean; updatedAt?: string; updatedBy?: string }

export default function TippingForm() {
  const { lang, actor } = useAdmin();
  const c = COPY[lang];
  const canWrite = actor.role !== 'viewer';

  const [server, setServer] = useState<Tipping | null>(null);
  const [draft, setDraft] = useState<string[]>(Array(COUNT).fill(''));
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'unavailable'>('loading');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    type Result = { state: 'ok'; data: Tipping } | { state: 'error' | 'unavailable' };
    fetch('/api/admin/settings/tipping')
      .then(async (r): Promise<Result> => {
        if (r.status === 503) return { state: 'unavailable' };
        if (!r.ok) return { state: 'error' };
        return { state: 'ok', data: (await r.json()) as Tipping };
      })
      .catch((): Result => ({ state: 'error' }))
      .then((res) => {
        if (cancelled) return;
        if (res.state === 'ok') { setServer(res.data); setDraft(res.data.tips.map(String)); }
        setState(res.state);
      });
    return () => { cancelled = true; };
  }, []);

  const parsed = draft.map((d) => (/^\d{1,4}$/.test(d) ? Number(d) : NaN));
  const valid = parsed.every((n) => Number.isInteger(n) && n >= MIN && n <= MAX);
  const dirty = !!server && draft.some((d, i) => d !== String(server.tips[i]));

  function step(i: number, delta: number) {
    setNotice(null);
    setDraft((cur) => {
      const n = /^\d{1,4}$/.test(cur[i]) ? Number(cur[i]) : 0;
      const next = Math.min(MAX, Math.max(MIN, n + delta));
      return cur.map((v, k) => (k === i ? String(next) : v));
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) { setNotice({ kind: 'err', text: c.invalid }); return; }
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch('/api/admin/settings/tipping', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tips: parsed }) });
      const d = (await r.json().catch(() => ({}))) as Tipping & { auditRecorded?: boolean };
      if (r.ok) {
        setServer({ tips: d.tips, saved: true, updatedAt: d.updatedAt, updatedBy: d.updatedBy });
        setDraft(d.tips.map(String));
        setNotice({ kind: d.auditRecorded === false ? 'warn' : 'ok', text: d.auditRecorded === false ? `${c.updated}. ${c.auditFail}` : c.updated });
      } else {
        setNotice({ kind: 'err', text: r.status === 403 ? c.forbidden : r.status === 422 ? c.invalid : c.failed });
      }
    } catch {
      setNotice({ kind: 'err', text: c.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="tipping-title">
      <div className="mb-4">
        <h1 id="tipping-title" className="text-2xl font-bold text-[var(--adm-text)]">{c.title}</h1>
        <p className="text-sm text-[var(--adm-muted)]">{c.subtitle}</p>
      </div>

      {state === 'loading' && <p className="text-sm text-[var(--adm-muted)]">{c.loading}</p>}
      {state === 'error' && <p role="alert" className="text-sm text-[var(--adm-error)]">{c.error}</p>}
      {state === 'unavailable' && <p role="alert" className="text-sm text-[var(--adm-error)]">{c.unavailable}</p>}

      {state === 'ok' && server && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={(e) => void save(e)} noValidate className="rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5">
            <div className="grid gap-5 sm:grid-cols-3">
              {draft.map((value, i) => {
                const n = i + 1;
                const bad = value !== '' && !/^\d{1,4}$/.test(value) ? true : /^\d{1,4}$/.test(value) && Number(value) > MAX;
                return (
                  <div key={n}>
                    <label htmlFor={`tip-${n}`} className="mb-1.5 block text-sm font-bold text-[var(--adm-text)]">{c.tip(n)}</label>
                    <div className="flex items-stretch gap-1.5" dir="ltr">
                      <button type="button" disabled={!canWrite} onClick={() => step(i, -1)} aria-label={c.dec(n)}
                        className="grid min-h-[48px] w-12 shrink-0 place-items-center rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-surface)] text-xl font-bold text-[var(--adm-text)] hover:border-[var(--adm-accent)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)]">−</button>
                      <input
                        id={`tip-${n}`} inputMode="numeric" value={value} disabled={!canWrite}
                        onChange={(e) => { setNotice(null); setDraft((cur) => cur.map((v, k) => (k === i ? e.target.value.replace(/\s/g, '') : v))); }}
                        aria-invalid={bad} aria-describedby="tip-hint"
                        className={`${FIELD} min-w-0 flex-1 text-center text-lg font-bold sm:w-full ${bad ? '!border-[var(--adm-error)]' : ''}`}
                      />
                      <button type="button" disabled={!canWrite} onClick={() => step(i, 1)} aria-label={c.inc(n)}
                        className="grid min-h-[48px] w-12 shrink-0 place-items-center rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-surface)] text-xl font-bold text-[var(--adm-text)] hover:border-[var(--adm-accent)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)]">+</button>
                    </div>
                    <p className="mt-1 text-center text-xs text-[var(--adm-muted)]">{c.unit}</p>
                  </div>
                );
              })}
            </div>
            <p id="tip-hint" className="mt-4 text-xs text-[var(--adm-muted)]">{c.hint}</p>

            {notice && (
              <p role={notice.kind === 'err' ? 'alert' : 'status'} className={`mt-4 text-sm ${notice.kind === 'err' ? 'text-[var(--adm-error)]' : 'text-[var(--adm-text)]'}`}>{notice.text}</p>
            )}

            {canWrite ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button type="submit" disabled={busy || !dirty || !valid} className={`${BTN_PRIMARY} min-w-[140px]`}>{busy ? c.updating : c.update}</button>
                {!dirty && !busy && <span className="text-xs text-[var(--adm-muted)]">{c.unchanged}</span>}
              </div>
            ) : (
              <p className="mt-5 text-sm text-[var(--adm-muted)]">{c.readOnly}</p>
            )}
            <p className="mt-4 text-xs text-[var(--adm-muted)]">
              {server.saved && server.updatedAt ? c.last(fmtDate(server.updatedAt, lang), server.updatedBy ?? '') : c.defaults}
            </p>
          </form>

          <aside aria-label={c.preview} className="rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-5">
            <h2 className="text-sm font-bold text-[var(--adm-text)]">{c.preview}</h2>
            <p className="mb-3 text-xs text-[var(--adm-muted)]">{c.previewHelp}</p>
            <div className="flex flex-wrap gap-2" dir="ltr">
              {(valid ? parsed : server.tips).map((n, i) => (
                n === 0
                  ? <span key={i} className="rounded-full border border-dashed border-[var(--adm-border)] px-4 py-2 text-xs text-[var(--adm-muted)]">{c.hidden}</span>
                  : <span key={i} className="rounded-full bg-[var(--adm-primary)] px-5 py-2.5 text-sm font-bold text-[var(--adm-primary-text)]">{n} {c.unit}</span>
              ))}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
