'use client';

import { useParams, usePathname } from 'next/navigation';
import PortalShell from '@/components/portal/shell/PortalShell';

/**
 * Portal segment layout.
 * Renders the app shell (sidebar, header, network states) for all portal pages EXCEPT the login
 * and the root redirect — those render their own full-screen UI.
 */
export default function PortalSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ar';

  // Auth / redirect pages — pass through with no wrapper
  const isAuthPage =
    /\/portal\/?$/.test(pathname) ||
    /\/portal\/login/.test(pathname);

  if (isAuthPage) return <>{children}</>;

  return <PortalShell locale={locale}>{children}</PortalShell>;
}
