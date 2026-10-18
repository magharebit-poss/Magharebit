import PortalSkeleton from '@/components/portal/PortalSkeleton';

/**
 * Next.js App Router automatically wraps portal pages in a Suspense
 * boundary and renders this loading UI while the page streams.
 */
export default function PortalLoading() {
  return <PortalSkeleton />;
}
