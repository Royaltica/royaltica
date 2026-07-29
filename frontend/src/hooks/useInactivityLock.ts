import React, { useEffect } from 'react';

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000;

export function useInactivityLock(isActive: boolean, onLock: () => void) {
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isActive) return;
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onLock, INACTIVITY_TIMEOUT_MS);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach(e => window.addEventListener(e, reset));
    reset();
    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, onLock]);
}
