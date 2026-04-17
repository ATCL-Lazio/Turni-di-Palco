import { useEffect, useRef } from 'react';

let _announce: ((msg: string, politeness?: 'polite' | 'assertive') => void) | null = null;

export function announce(msg: string, politeness: 'polite' | 'assertive' = 'polite') {
  _announce?.(msg, politeness);
}

export function LiveRegion() {
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    _announce = (msg, politeness = 'polite') => {
      const el = politeness === 'assertive' ? assertiveRef.current : politeRef.current;
      if (!el) return;
      el.textContent = '';
      requestAnimationFrame(() => {
        el.textContent = msg;
      });
    };
    return () => {
      _announce = null;
    };
  }, []);

  return (
    <>
      <div ref={politeRef} aria-live="polite" aria-atomic="true" className="sr-only" />
      <div ref={assertiveRef} aria-live="assertive" aria-atomic="true" className="sr-only" />
    </>
  );
}
