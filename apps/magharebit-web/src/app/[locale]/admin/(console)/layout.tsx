import type { ReactNode } from 'react';
import AdminShell from '@/components/admin/AdminShell';

// Route group: adds the sidebar shell to the pages inside (console) without
// changing their URLs. Legacy admin pages (merchants, licenses, leads) keep
// their own chrome until they are migrated.
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
