'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { LEAD_MODAL_EVENT } from '@/lib/lead-modal';

// The dialog (and its translations) is only fetched when it is first opened.
const LeadModal = dynamic(() => import('./LeadModal'), { ssr: false });

const SEEN_KEY = 'mgh_lead_modal_seen';
const SEEN_DAYS = 7;
const EXIT_INTENT_DELAY_MS = 20_000;
/** Pages where an exit-intent popup would be wrong: funnel, account and admin screens. */
const NO_EXIT_INTENT = /\/(auth|portal|admin|demo|download)(\/|$)/;

function recentlySeen(): boolean {
  try {
    const at = Number(localStorage.getItem(SEEN_KEY));
    return !!at && Date.now() - at < SEEN_DAYS * 86_400_000;
  } catch {
    return false;
  }
}
function markSeen() {
  try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* private mode */ }
}

/**
 * Mounts once in the locale layout. Opens the lead modal when
 *  - any element with `data-lead-modal` is clicked, or openLeadModal() is called, or
 *  - on desktop, the pointer leaves through the top of the window after 20 s (once per 7 days).
 */
export default function LeadModalHost() {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => { setOpen(false); markSeen(); }, []);

  useEffect(() => {
    const onEvent = () => show();
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-lead-modal]');
      if (el) { e.preventDefault(); show(); }
    };
    window.addEventListener(LEAD_MODAL_EVENT, onEvent);
    document.addEventListener('click', onClick);
    return () => { window.removeEventListener(LEAD_MODAL_EVENT, onEvent); document.removeEventListener('click', onClick); };
  }, [show]);

  useEffect(() => {
    if (NO_EXIT_INTENT.test(pathname) || recentlySeen()) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return; // desktop pointers only
    let armed = false;
    const timer = window.setTimeout(() => { armed = true; }, EXIT_INTENT_DELAY_MS);
    const onLeave = (e: MouseEvent) => {
      if (!armed || e.clientY > 0 || e.relatedTarget || recentlySeen()) return;
      if (document.querySelector('dialog[open]')) return;
      show();
    };
    document.addEventListener('mouseout', onLeave);
    return () => { window.clearTimeout(timer); document.removeEventListener('mouseout', onLeave); };
  }, [pathname, show]);

  return open ? <LeadModal onClose={hide} /> : null;
}
