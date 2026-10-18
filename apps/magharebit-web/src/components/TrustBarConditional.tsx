'use client';

import { usePathname } from 'next/navigation';
import TrustBar from './TrustBar';

export default function TrustBarConditional() {
  const pathname = usePathname();

  // Hide on portal pages
  if (pathname.includes('/portal')) return null;

  return <TrustBar />;
}
