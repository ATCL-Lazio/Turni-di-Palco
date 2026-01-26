import React, { useEffect, useRef } from 'react';

interface ScreenTransitionProps {
  children: React.ReactNode;
  animationClass?: string;
  animationKey?: number;
  onAnimationEnd?: () => void;
}

export function ScreenTransition({ 
  children, 
  animationClass = '', 
  animationKey,
  onAnimationEnd 
}: ScreenTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousClassRef = useRef<string>('');

  useEffect(() => {
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
      className="w-full h-full"
      onAnimationEnd={(event) => {
        if (event.target !== containerRef.current) return;
        onAnimationEnd?.();
      }}
    >
      {children}
    </div>
  );
}
