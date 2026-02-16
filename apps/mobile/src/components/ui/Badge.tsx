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
    default: 'bg-[#2c2c2e] text-[#aeaeb2]',
    success: 'bg-[#30d158]/20 text-[#30d158]',
    gold: 'bg-gradient-to-b from-[#0066d6] to-[#0a84ff] text-[#000000]',
    outline: 'border border-[#0a84ff] text-[#0a84ff] bg-transparent'
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

