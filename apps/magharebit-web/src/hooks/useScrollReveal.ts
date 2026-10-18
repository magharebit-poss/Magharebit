import { useEffect, useRef } from 'react';

/**
 * Applies a fade-up reveal when the element enters the viewport.
 * Uses IntersectionObserver (threshold 0.15), fires once.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Initial hidden state
    el.style.opacity = '0';
    el.style.transform = 'translateY(32px)';
    el.style.transition =
      'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          obs.disconnect();
        }
      },
      { threshold }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return ref;
}
