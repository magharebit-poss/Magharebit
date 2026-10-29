'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const ADMIN_ROUTE = /^\/(ar|fr|en)\/admin(\/|$)/;

/**
 * Marketing chrome (trust ribbon, trust bar, floating WhatsApp button, lead modal) belongs to the public site only.
 * The admin console is an internal tool with its own shell, so none of it renders under /[locale]/admin.
 * Admin pages are prerendered per locale and usePathname() works during prerender, so the static HTML is clean too.
 */
export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  if (ADMIN_ROUTE.test(pathname)) return null;
  return <>{children}</>;
}
