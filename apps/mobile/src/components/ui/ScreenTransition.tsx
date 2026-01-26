import React, { useEffect, useRef } from 'react';

interface ScreenTransitionProps {
  children: React.ReactNode;
  animationClass?: string;
  onAnimationEnd?: () => void;
}

export function ScreenTransition({ 
  children, 
  animationClass = '', 
  onAnimationEnd 
}: ScreenTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const element = containerRef.current;
    
    // Remove any existing animation classes
    element.className = element.className.replace(/tab-\S+/g, '').trim();
    
    // Add new animation class if provided
    if (animationClass) {
      // Force reflow to restart animation
      void element.offsetWidth;
      element.classList.add(animationClass);
    }

    // Handle animation end
    const handleAnimationEnd = () => {
      onAnimationEnd?.();
    };

    element.addEventListener('animationend', handleAnimationEnd);
    
    return () => {
      element.removeEventListener('animationend', handleAnimationEnd);
    };
  }, [animationClass, onAnimationEnd]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full"
    >
      {children}
    </div>
  );
}
