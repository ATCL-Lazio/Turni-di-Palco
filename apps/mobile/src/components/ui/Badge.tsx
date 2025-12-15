import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'gold' | 'outline';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  const variants = {
    default: 'bg-[#241f20] text-[#b8b2b3]',
    success: 'bg-[#52c41a]/20 text-[#52c41a]',
    gold: 'bg-gradient-to-r from-[#e6a23c] to-[#f4bf4f] text-[#0f0d0e]',
    outline: 'border border-[#a82847] text-[#f4bf4f] bg-transparent'
  };
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm'
  };
  
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
}
