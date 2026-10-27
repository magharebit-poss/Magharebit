'use client';

/** Status toggle used by the admin tables: a real button with role="switch", 44px touch area. */
export default function AdminSwitch({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  /** Accessible name, e.g. "Disable Bakery". */
  label: string;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)]"
    >
      <span aria-hidden="true" className={`relative inline-block h-6 w-11 rounded-full transition-colors ${checked ? 'bg-[#16A34A]' : 'bg-[#9CA3AF]'}`}>
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ insetInlineStart: checked ? 22 : 2 }} />
      </span>
    </button>
  );
}
