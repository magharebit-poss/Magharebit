import { useEffect, useState } from 'react';

/**
 * Counts from 0 to `target` over `duration`ms using an ease-out cubic.
 * Only starts when `trigger` is true (e.g. when element enters viewport).
 */
export function useCountUp(target: number, decimals: number, duration: number, trigger: boolean) {
  const [value, setValue] = useState('0');

  useEffect(() => {
    if (!trigger) return;
    let startTime: number | null = null;

    function step(ts: number) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue((target * eased).toFixed(decimals));
      if (progress < 1) requestAnimationFrame(step);
      else setValue(target.toFixed(decimals));
    }

    requestAnimationFrame(step);
  }, [trigger, target, decimals, duration]);

  return value;
}
