'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useAdmin } from './AdminShell';
import { foldText, type Lang } from './adminUi';

/** An admin page or setting the palette can jump to. `keywords` = the label in every language, plus synonyms. */
export interface PaletteLink { href: string; label: string; keywords: string }

type Group = 'pages' | 'merchants' | 'licenses' | 'leads' | 'coupons';
interface Hit { id: string; title: string; subtitle: string; q: string }
interface Item { key: string; group: Group; title: string; subtitle?: string; href: string }

const COPY: Record<Lang, {
  open: string; placeholder: string; close: string; searching: string; empty: string; tooShort: string; failed: string; hint: string;
  groups: Record<Group, string>;
}> = {
  ar: {
    open: 'بحث', placeholder: 'ابحث عن تاجر أو ترخيص أو عميل أو قسيمة أو صفحة…', close: 'إغلاق', searching: 'جارٍ البحث…',
    empty: 'لا توجد نتائج', tooShort: 'اكتب حرفين على الأقل للبحث في البيانات', failed: 'تعذّر البحث',
    hint: '↑ ↓ للتنقل · Enter للفتح · Esc للإغلاق',
    groups: { pages: 'الصفحات والإعدادات', merchants: 'التجار', licenses: 'التراخيص', leads: 'العملاء المحتملون', coupons: 'القسائم' },
  },
  fr: {
    open: 'Rechercher', placeholder: 'Commerçant, licence, prospect, coupon ou page…', close: 'Fermer', searching: 'Recherche…',
    empty: 'Aucun résultat', tooShort: 'Tapez au moins 2 caractères pour chercher dans les données', failed: 'Recherche impossible',
    hint: '↑ ↓ pour naviguer · Entrée pour ouvrir · Échap pour fermer',
    groups: { pages: 'Pages et réglages', merchants: 'Commerçants', licenses: 'Licences', leads: 'Prospects', coupons: 'Coupons' },
  },
  en: {
    open: 'Search', placeholder: 'Merchant, license, lead, coupon or page…', close: 'Close', searching: 'Searching…',
    empty: 'No results', tooShort: 'Type at least 2 characters to search the data', failed: 'Search failed',
    hint: '↑ ↓ to move · Enter to open · Esc to close',
    groups: { pages: 'Pages and settings', merchants: 'Merchants', licenses: 'Licenses', leads: 'Leads', coupons: 'Coupons' },
  },
};

const DATA_GROUPS: { group: Exclude<Group, 'pages'>; path: string }[] = [
  { group: 'merchants', path: 'merchants' },
  { group: 'licenses', path: 'licenses' },
  { group: 'leads', path: 'leads' },
  { group: 'coupons', path: 'coupons' },
];

function isMacLike(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
}

/** Header trigger + global Ctrl+K / Cmd+K shortcut. The dialog mounts only while open, so it starts fresh each time. */
export default function CommandPalette({ pages }: { pages: PaletteLink[] }) {
  const { lang } = useAdmin();
  const c = COPY[lang];
  const [open, setOpen] = useState(false);
  const [mac] = useState(isMacLike);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}
        data-palette-trigger=""
        className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-field)] px-3 text-sm text-[var(--adm-muted)] hover:border-[var(--adm-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)] md:min-w-[260px]"
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <span className="hidden md:inline">{c.open}…</span>
        <span className="sr-only md:hidden">{c.open}</span>
        <kbd dir="ltr" className="ms-auto hidden rounded border border-[var(--adm-border)] px-1.5 py-0.5 font-sans text-[11px] md:inline">{mac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      {open && <PaletteDialog pages={pages} onClose={() => setOpen(false)} />}
    </>
  );
}

function PaletteDialog({ pages, onClose }: { pages: PaletteLink[]; onClose: () => void }) {
  const { lang, locale } = useAdmin();
  const c = COPY[lang];
  const ref = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  // Server hits are kept with the query they answer, so stale answers are simply not shown.
  const [server, setServer] = useState<{ q: string; state: 'ok' | 'error'; results: Record<string, Hit[]> } | null>(null);

  const folded = foldText(query);
  const dataQuery = folded.length >= 2 ? query.trim() : '';

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (!dataQuery) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(dataQuery)}`, { signal: ctrl.signal })
        .then(async (r) => (r.ok ? { state: 'ok' as const, results: ((await r.json()) as { results: Record<string, Hit[]> }).results } : { state: 'error' as const, results: {} }))
        .catch((e: unknown) => ((e as Error)?.name === 'AbortError' ? null : { state: 'error' as const, results: {} }))
        .then((res) => { if (res) setServer({ q: dataQuery, ...res }); });
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [dataQuery]);

  const items: Item[] = useMemo(() => {
    const out: Item[] = pages
      .filter((p) => !folded || foldText(`${p.label} ${p.keywords}`).includes(folded))
      .map((p) => ({ key: `page:${p.href}`, group: 'pages', title: p.label, href: p.href }));
    if (server && server.q === dataQuery && server.state === 'ok') {
      for (const { group, path } of DATA_GROUPS) {
        for (const h of server.results[group] ?? []) {
          out.push({ key: `${group}:${h.id}`, group, title: h.title, subtitle: h.subtitle, href: `/${locale}/admin/${path}?q=${encodeURIComponent(h.q)}` });
        }
      }
    }
    return out;
  }, [pages, folded, server, dataQuery, locale]);

  const current = Math.min(active, Math.max(0, items.length - 1));
  const searching = Boolean(dataQuery) && server?.q !== dataQuery;
  const failed = Boolean(dataQuery) && server?.q === dataQuery && server.state === 'error';

  function go(item: Item | undefined) {
    if (item) window.location.assign(item.href);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      const next = (current + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      setActive(next);
      listRef.current?.querySelector(`#pal-opt-${next}`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(items[current]);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-label={c.open}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      className="mx-auto mb-auto mt-[8vh] w-[min(640px,calc(100vw-24px))] overflow-hidden rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-0 text-[var(--adm-text)] shadow-2xl backdrop:bg-[#0A2318]/70"
    >
      <div className="flex items-center gap-2 border-b border-[var(--adm-border)] px-4">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[var(--adm-muted)]"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          autoFocus
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls="pal-list"
          aria-autocomplete="list"
          aria-activedescendant={items.length ? `pal-opt-${current}` : undefined}
          aria-label={c.placeholder}
          placeholder={c.placeholder}
          value={query}
          dir="auto"
          maxLength={64}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          className="min-h-[56px] w-full bg-transparent text-base text-[var(--adm-text)] placeholder:text-[var(--adm-muted)] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label={c.close}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[4px] text-lg text-[var(--adm-muted)] hover:text-[var(--adm-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)]"
        >
          ×
        </button>
      </div>

      <ul id="pal-list" ref={listRef} role="listbox" aria-label={c.open} className="max-h-[min(60vh,480px)] overflow-y-auto p-2">
        {items.map((it, i) => {
          const heading = it.group !== items[i - 1]?.group ? c.groups[it.group] : null;
          return (
            <li key={it.key} role="presentation">
              {heading && <div role="presentation" className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-[var(--adm-muted)]">{heading}</div>}
              <div
                id={`pal-opt-${i}`}
                role="option"
                aria-selected={i === current}
                data-href={it.href}
                onMouseMove={() => { if (i !== current) setActive(i); }}
                onClick={() => go(it)}
                className={`flex min-h-[48px] cursor-pointer flex-col justify-center rounded-[4px] px-3 py-2 ${i === current ? 'bg-[var(--adm-head)] outline outline-2 outline-[var(--adm-accent)]' : ''}`}
              >
                <span dir="auto" className="text-sm font-semibold">{it.title}</span>
                {it.subtitle && <span dir="auto" className="text-xs text-[var(--adm-muted)]">{it.subtitle}</span>}
              </div>
            </li>
          );
        })}
      </ul>

      <div aria-live="polite" className="border-t border-[var(--adm-border)] px-4 py-2 text-xs text-[var(--adm-muted)]">
        {searching ? c.searching : failed ? c.failed : folded && folded.length < 2 ? c.tooShort : folded && items.length === 0 ? c.empty : c.hint}
      </div>
    </dialog>
  );
}
