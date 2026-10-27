'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from './AdminShell';
import AuditLogTable from './AuditLogTable';
import { ACTION_LABEL, ACTION_TONE, AUDIT_ACTIONS, TONE_STYLE } from './auditActions';
import { BTN, BTN_PRIMARY, FIELD, type Lang } from './adminUi';

interface Entry {
  id: string; ts: string; actorId: string; actorName: string; actorEmail?: string; actorRole: string;
  action: string; targetType: string; targetId: string; meta?: Record<string, unknown>; ip?: string;
}

const LIMIT = 30;

const COPY: Record<Lang, {
  title: string; subtitle: string; timeline: string; table: string; action: string; all: string; apply: string; refresh: string; loadMore: string; loading: string; empty: string; error: string; unavailable: string;
  performedBy: string; target: string; details: string; hide: string; show: string; role: string; ip: string; noDetails: string; shown: (a: number, b: number) => string; today: string; yesterday: string;
}> = {
  ar: {
    title: 'سجل التدقيق', subtitle: 'كل إجراءات المسؤولين، من الأحدث إلى الأقدم', timeline: 'خط زمني', table: 'جدول', action: 'الإجراء', all: 'كل الإجراءات', apply: 'تطبيق', refresh: 'تحديث',
    loadMore: 'عرض المزيد', loading: 'جارٍ التحميل…', empty: 'لا توجد إجراءات مسجّلة', error: 'تعذّر تحميل السجل', unavailable: 'قاعدة البيانات غير متاحة',
    performedBy: 'بواسطة', target: 'الهدف', details: 'التفاصيل', hide: 'إخفاء التفاصيل', show: 'عرض التفاصيل', role: 'الدور', ip: 'عنوان IP', noDetails: 'لا توجد تفاصيل إضافية',
    shown: (a, b) => `${a} من ${b}`, today: 'اليوم', yesterday: 'أمس',
  },
  fr: {
    title: 'Journal d’audit', subtitle: 'Toutes les actions des administrateurs, de la plus récente à la plus ancienne', timeline: 'Chronologie', table: 'Tableau', action: 'Action', all: 'Toutes les actions', apply: 'Appliquer', refresh: 'Actualiser',
    loadMore: 'Afficher plus', loading: 'Chargement…', empty: 'Aucune action enregistrée', error: 'Impossible de charger le journal', unavailable: 'Base de données indisponible',
    performedBy: 'Effectué par', target: 'Cible', details: 'Détails', hide: 'Masquer les détails', show: 'Afficher les détails', role: 'Rôle', ip: 'Adresse IP', noDetails: 'Aucun détail supplémentaire',
    shown: (a, b) => `${a} sur ${b}`, today: 'Aujourd’hui', yesterday: 'Hier',
  },
  en: {
    title: 'Audit logs', subtitle: 'Every admin action, newest first', timeline: 'Timeline', table: 'Table', action: 'Action', all: 'All actions', apply: 'Apply', refresh: 'Refresh',
    loadMore: 'Load more', loading: 'Loading…', empty: 'No recorded actions', error: 'Could not load the log', unavailable: 'Database unavailable',
    performedBy: 'Performed by', target: 'Target', details: 'Details', hide: 'Hide details', show: 'Show details', role: 'Role', ip: 'IP address', noDetails: 'No extra details',
    shown: (a, b) => `${a} of ${b}`, today: 'Today', yesterday: 'Yesterday',
  },
};

function dayKey(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayLabel(key: string, lang: Lang, c: (typeof COPY)[Lang]): string {
  const now = new Date();
  const k = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (key === k(now)) return c.today;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (key === k(y)) return c.yesterday;
  const [yy, mm, dd] = key.split('-');
  return lang === 'en' ? `${dd}/${mm}/${yy}` : `${dd}/${mm}/${yy}`;
}
function timeOf(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function metaValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function Timeline() {
  const { lang } = useAdmin();
  const c = COPY[lang];
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [applied, setApplied] = useState('');
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'unavailable'>('loading');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (applied) p.set('action', applied);
    type Result = { state: 'ok'; entries: Entry[]; total: number } | { state: 'error' | 'unavailable' };
    fetch(`/api/admin/audit-logs?${p}`)
      .then(async (r): Promise<Result> => {
        if (r.status === 503) return { state: 'unavailable' };
        if (!r.ok) return { state: 'error' };
        const d = (await r.json()) as { entries: Entry[]; total: number };
        return { state: 'ok', entries: d.entries, total: d.total };
      })
      .catch((): Result => ({ state: 'error' }))
      .then((res) => {
        if (cancelled) return;
        if (res.state === 'ok') {
          // pages are appended; page 1 replaces
          setEntries((cur) => (page === 1 ? res.entries : [...cur, ...res.entries.filter((e) => !cur.some((x) => x.id === e.id))]));
          setTotal(res.total);
        }
        setState(res.state);
      });
    return () => { cancelled = true; };
  }, [page, applied, tick]);

  function reload(nextAction = applied) {
    setState('loading');
    setPage(1);
    setApplied(nextAction);
    setOpen({});
    setTick((t) => t + 1);
  }

  const groups: { key: string; items: Entry[] }[] = [];
  for (const e of entries) {
    const k = dayKey(e.ts);
    const g = groups[groups.length - 1];
    if (g && g.key === k) g.items.push(e); else groups.push({ key: k, items: [e] });
  }

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); reload(action); }} className="mb-4 flex flex-wrap items-end gap-3 rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
        <label className="flex min-w-0 flex-1 basis-[220px] flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.action}
          <select className={`${FIELD} sm:w-full`} value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">{c.all}</option>
            {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABEL[lang][a]} ({a})</option>)}
          </select>
        </label>
        <button type="submit" className={BTN_PRIMARY}>{c.apply}</button>
        <button type="button" onClick={() => reload()} className={BTN}>{c.refresh}</button>
      </form>

      {state === 'error' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.error}</p>}
      {state === 'unavailable' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.unavailable}</p>}
      {state === 'loading' && page === 1 && <p className="text-sm text-[var(--adm-muted)]">{c.loading}</p>}
      {state === 'ok' && entries.length === 0 && <p className="rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 text-center text-sm text-[var(--adm-muted)]">{c.empty}</p>}

      {groups.map((g) => (
        <section key={g.key} aria-label={dayLabel(g.key, lang, c)} className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--adm-muted)]">{dayLabel(g.key, lang, c)}</h2>
          <ol className="relative ms-3 border-s-2 border-[var(--adm-border)]">
            {g.items.map((e) => {
              const tone = TONE_STYLE[ACTION_TONE[e.action] ?? 'grey'];
              const isOpen = !!open[e.id];
              const metaEntries = Object.entries(e.meta ?? {});
              return (
                <li key={e.id} className="relative mb-4 ms-6">
                  <span aria-hidden="true" className={`absolute -start-[34px] top-4 h-3 w-3 rounded-full ring-4 ring-[var(--adm-bg)] ${tone.dot}`} />
                  <div className="rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone.tag}`}>{ACTION_LABEL[lang][e.action] ?? e.action}</span>
                      <code className="text-xs text-[var(--adm-muted)]" dir="ltr">API: {e.action}</code>
                      <time dateTime={e.ts} className="ms-auto text-xs text-[var(--adm-muted)]" dir="ltr">{timeOf(e.ts)}</time>
                    </div>
                    <p className="mt-2 text-sm text-[var(--adm-text)]">
                      {c.performedBy} <strong>{e.actorName}</strong>
                      {e.actorEmail && <> <span className="text-[var(--adm-muted)]" dir="ltr">[{e.actorEmail}]</span></>}
                    </p>
                    <p className="mt-1 text-xs text-[var(--adm-muted)]">{c.target}: {e.targetType} · <code className="break-all" dir="ltr">{e.targetId}</code></p>
                    <button
                      type="button" aria-expanded={isOpen} aria-controls={`audit-${e.id}`}
                      onClick={() => setOpen((cur) => ({ ...cur, [e.id]: !cur[e.id] }))}
                      className="mt-2 min-h-[44px] text-xs font-bold text-[var(--adm-accent)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)]"
                    >
                      {isOpen ? c.hide : c.show}
                    </button>
                    {isOpen && (
                      <dl id={`audit-${e.id}`} className="mt-1 grid gap-x-4 gap-y-1 rounded-[4px] bg-[var(--adm-head)] p-3 text-xs sm:grid-cols-[max-content_1fr]" dir="ltr">
                        {metaEntries.length === 0 && <dd className="text-[var(--adm-muted)] sm:col-span-2">{c.noDetails}</dd>}
                        {metaEntries.map(([k, v]) => (
                          <div key={k} className="contents"><dt className="font-semibold text-[var(--adm-muted)]">{k}</dt><dd className="break-all text-[var(--adm-text)]">{metaValue(v)}</dd></div>
                        ))}
                        <div className="contents"><dt className="font-semibold text-[var(--adm-muted)]">{c.role}</dt><dd className="text-[var(--adm-text)]">{e.actorRole}</dd></div>
                        {e.ip && <div className="contents"><dt className="font-semibold text-[var(--adm-muted)]">{c.ip}</dt><dd className="text-[var(--adm-text)]">{e.ip}</dd></div>}
                        <div className="contents"><dt className="font-semibold text-[var(--adm-muted)]">actorId</dt><dd className="break-all text-[var(--adm-text)]">{e.actorId}</dd></div>
                      </dl>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {state === 'ok' && entries.length > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm text-[var(--adm-muted)]">
          <span>{c.shown(entries.length, total)}</span>
          {entries.length < total && <button type="button" onClick={() => { setState('loading'); setPage((p) => p + 1); }} className={BTN}>{c.loadMore}</button>}
        </div>
      )}
    </div>
  );
}

/** Audit logs page: timeline by default, table view one click away. */
export default function AuditLogsView() {
  const { lang } = useAdmin();
  const c = COPY[lang];
  const [view, setView] = useState<'timeline' | 'table'>('timeline');

  return (
    <section aria-labelledby="audit-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="audit-title" className="text-2xl font-bold text-[var(--adm-text)]">{c.title}</h1>
          <p className="text-sm text-[var(--adm-muted)]">{c.subtitle}</p>
        </div>
        <div role="group" aria-label={c.title} className="inline-flex overflow-hidden rounded-[4px] border border-[var(--adm-border)]">
          {(['timeline', 'table'] as const).map((v) => (
            <button
              key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
              className={`min-h-[44px] px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)] ${view === v ? 'bg-[var(--adm-primary)] text-[var(--adm-primary-text)]' : 'bg-[var(--adm-surface)] text-[var(--adm-text)]'}`}
            >
              {v === 'timeline' ? c.timeline : c.table}
            </button>
          ))}
        </div>
      </div>
      {view === 'timeline' ? <Timeline /> : <AuditLogTable embedded />}
    </section>
  );
}
