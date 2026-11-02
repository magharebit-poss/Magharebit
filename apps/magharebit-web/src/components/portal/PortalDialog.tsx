'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Modal on a native <dialog>: focus trap, Escape and focus return come from the browser.
 * Controlled with `open`; `onClose` fires for Escape, the backdrop, the close button and `open` → false.
 */
export default function PortalDialog({
  open,
  onClose,
  title,
  description,
  closeLabel,
  size = 'md',
  children,
  footer,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  closeLabel: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children?: ReactNode;
  footer?: ReactNode;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const width = size === 'sm' ? 'max-w-[420px]' : size === 'lg' ? 'max-w-[640px]' : size === 'xl' ? 'max-w-[760px]' : 'max-w-[520px]';
  return (
    <dialog
      ref={ref}
      data-testid={testId}
      aria-labelledby={testId ? `${testId}-title` : undefined}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      className={`portal-dialog m-auto w-[calc(100vw-2rem)] ${width} max-h-[calc(100dvh-2rem)] overflow-visible rounded-2xl border-0 bg-transparent p-0 text-[#111827] backdrop:bg-[#0A2318]/55 backdrop:backdrop-blur-[2px]`}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgba(10,35,24,0.28)] ring-1 ring-black/5">
        <div className="flex items-start gap-4 border-b border-[#F1F2F4] px-6 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={testId ? `${testId}-title` : undefined} className="text-lg font-bold text-[#111827]">{title}</h2>
            {description && <div className="mt-1 text-sm leading-relaxed text-[#6B7280]">{description}</div>}
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label={closeLabel}
            className="-me-2 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B]"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        {children && <div className="min-h-0 overflow-y-auto px-6 py-5">{children}</div>}
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#F1F2F4] bg-[#FAFAFB] px-6 py-4">{footer}</div>}
      </div>
    </dialog>
  );
}

/** Button styles shared by the portal pages (light content theme). */
export const BTN = {
  primary: 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#0F3D2A] px-4 text-sm font-semibold text-white shadow-sm transition-[background-color,box-shadow] duration-150 hover:bg-[#145236] hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
  secondary: 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#374151] shadow-sm transition-colors duration-150 hover:border-[#D1D5DB] hover:bg-[#F9FAFB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
  danger: 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#D32F2F] px-4 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[#B71C1C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D32F2F] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
  gold: 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#F0B429] px-4 text-sm font-bold text-[#0A2318] shadow-sm transition-colors duration-150 hover:bg-[#E0A51E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A2318]',
};

export const FIELD = 'block w-full rounded-lg border border-[#D1D5DB] bg-white px-3.5 py-2.5 text-sm text-[#111827] shadow-sm transition-[border-color,box-shadow] duration-150 placeholder:text-[#9CA3AF] focus:border-[#B8860B] focus:outline-none focus:ring-2 focus:ring-[#F0B429]/30';
export const LABEL = 'mb-1.5 block text-[13px] font-semibold text-[#374151]';
export const CARD = 'rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]';
