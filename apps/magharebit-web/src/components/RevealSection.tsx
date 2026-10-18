'use client';

import { useScrollReveal } from '@/hooks/useScrollReveal';

/**
 * Drop-in wrapper that applies scroll-reveal to any section.
 * Server components can import this and wrap their <section> in it.
 */
export default function RevealSection({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
