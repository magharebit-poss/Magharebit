'use client';

import { usePathname } from 'next/navigation';
import PortalLayout from '@/components/portal/PortalLayout';

/**
 * Portal segment layout.
 * Renders the sidebar+main shell for all portal pages EXCEPT the login
 * and the root redirect — those render their own full-screen UI.
 */
export default function PortalSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Auth / redirect pages — pass through with no wrapper
  const isAuthPage =
    /\/portal\/?$/.test(pathname) ||
    /\/portal\/login/.test(pathname);

  if (isAuthPage) return <>{children}</>;

  return <PortalLayout>{children}</PortalLayout>;
}
