import { useEffect, useRef } from 'react';

/**
 * useIdleTimeout - logs out user after `timeoutMinutes` of inactivity
 * Resets on mouse move, key press, click, scroll, touch.
 */
export function useIdleTimeout(timeoutMinutes, onIdle) {
  const timerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!timeoutMinutes || timeoutMinutes <= 0) return;
    const limit = timeoutMinutes * 60 * 1000;

    const reset = () => {
      lastActivityRef.current = Date.now();
    };

    const check = () => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= limit) {
        onIdle?.();
      }
    };

    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    timerRef.current = setInterval(check, 30 * 1000); // check every 30s

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeoutMinutes, onIdle]);
}
