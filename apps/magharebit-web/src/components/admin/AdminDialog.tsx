'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Modal dialog for the admin console (native <dialog>: focus trap, Esc and backdrop come from the browser).
 * Rendered inside the themed console, so it follows the light/dark theme variables.
 */
export default function AdminDialog({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = ''; };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="adm-dialog-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      className="m-auto w-[min(560px,calc(100vw-24px))] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-0 text-[var(--adm-text)] shadow-2xl backdrop:bg-[#0A2318]/70"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--adm-border)] px-5 py-4">
        <h2 id="adm-dialog-title" className="text-lg font-extrabold">{title}</h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label={closeLabel}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[4px] border border-[var(--adm-border)] text-lg hover:border-[var(--adm-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)]"
        >
          ×
        </button>
      </div>
      <div className="px-5 py-5">{children}</div>
    </dialog>
  );
}
