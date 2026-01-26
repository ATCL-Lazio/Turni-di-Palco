import React, { useEffect, useRef } from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'gold' | 'outline';
  size?: 'sm' | 'md';
  animate?: boolean; // New prop for animation trigger
}

export function Badge({ children, variant = 'default', size = 'sm', animate = false }: BadgeProps) {
  const badgeRef = useRef<HTMLSpanElement>(null);
  
  // Trigger animation when animate prop changes
  useEffect(() => {
    if (animate && badgeRef.current) {
      // Remove and re-add animation class to restart
      badgeRef.current.classList.remove('mobile-badge-pop');
      void badgeRef.current.offsetWidth; // Force reflow
      badgeRef.current.classList.add('mobile-badge-pop');
    }
  }, [animate]);

  const variants = {
    default: 'bg-[#241f20] text-[#b8b2b3]',
    success: 'bg-[#52c41a]/20 text-[#52c41a]',
    gold: 'bg-gradient-to-b from-[#e6a23c] to-[#f4bf4f] text-[#0f0d0e]',
    outline: 'border border-[#a82847] text-[#f4bf4f] bg-transparent'
  };
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm'
  };
  
  return (
    <span 
      ref={badgeRef}
      className={`inline-flex items-center gap-1 rounded-full ${variants[variant]} ${sizes[size]}`}
    >
      {children}
    </span>
  );
}
