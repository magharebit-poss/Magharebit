'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Props {
  /** The current page label. If omitted, "الرئيسية" is shown as the active (non-linked) leaf. */
  current?: string;
}

export default function PortalBreadcrumb({ current }: Props) {
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ar';

  if (!current) {
    // On the dashboard itself — just show "الرئيسية" as plain text
    return (
      <div style={{ fontSize: '13px', color: '#374151', fontWeight: 500, marginBottom: '24px' }}>
        الرئيسية
      </div>
    );
  }

  return (
    <div style={{
      fontSize: '13px',
      color: '#9CA3AF',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      <Link
        href={`/${locale}/portal/dashboard`}
        style={{ color: '#9CA3AF', textDecoration: 'none' }}
        onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.color = '#374151'; }}
        onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.color = '#9CA3AF'; }}
      >
        الرئيسية
      </Link>
      <span style={{ color: '#D1D5DB' }}>›</span>
      <span style={{ color: '#374151', fontWeight: 500 }}>{current}</span>
    </div>
  );
}
