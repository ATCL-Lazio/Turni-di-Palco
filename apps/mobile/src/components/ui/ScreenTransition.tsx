import React, { useLayoutEffect, useRef } from 'react';

interface ScreenTransitionProps {
  children: React.ReactNode;
  animationClass?: string;
  animationKey?: number;
  onAnimationEnd?: () => void;
}

/**
 * Wrapper per la transizione tra schermate. Deve usare solo animazioni di
 * opacità: un `transform` (o `will-change: transform`) renderebbe questo
 * elemento il containing block dei discendenti `position: fixed`.
 */
export function ScreenTransition({
  children,
  animationClass = '',
  animationKey,
  onAnimationEnd
}: ScreenTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousClassRef = useRef<string>('');

  // Layout effect: la classe viene applicata prima del paint del nuovo contenuto.
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const element = containerRef.current;

    if (previousClassRef.current) {
      element.classList.remove(previousClassRef.current);
    }

    // Add new animation class if provided
    if (animationClass) {
      // Force reflow to restart animation
      void element.offsetWidth;
      element.classList.add(animationClass);
    }

    previousClassRef.current = animationClass;
  }, [animationClass, animationKey]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden"
      onAnimationEnd={(event) => {
        if (event.target !== containerRef.current) return;
        // A fine animazione rimuove la classe: nessuno stacking context residuo.
        if (previousClassRef.current) {
          event.currentTarget.classList.remove(previousClassRef.current);
          previousClassRef.current = '';
        }
        onAnimationEnd?.();
      }}
    >
      {children}
    </div>
  );
}
