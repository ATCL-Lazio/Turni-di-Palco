import React from 'react';
import { cn } from './utils';

type TagVariant = 'default' | 'outline' | 'info' | 'success';

interface TagProps {
  children: React.ReactNode;
  variant?: TagVariant;
  className?: string;
  size?: 'sm' | 'md';
}

export function Tag({ children, variant = 'default', className = '', size = 'md' }: TagProps) {
  const variants: Record<TagVariant, string> = {
    default: 'bg-[#241f20] text-[#f4bf4f]',
    outline: 'border border-[#f4bf4f]/40 text-[#f4bf4f]',
    info: 'bg-[#f4bf4f]/10 text-[#f4bf4f]',
    success: 'bg-[#52c41a]/10 text-[#52c41a] border border-[#52c41a]/30',
  };

  const sizes = {
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3.5 py-1.5 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}
