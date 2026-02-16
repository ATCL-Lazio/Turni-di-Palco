import React from 'react';
import { cn } from './utils';

type TagVariant = 'default' | 'outline' | 'info';

interface TagProps {
  children: React.ReactNode;
  variant?: TagVariant;
  className?: string;
  size?: 'sm' | 'md';
}

export function Tag({ children, variant = 'default', className = '', size = 'md' }: TagProps) {
  const variants: Record<TagVariant, string> = {
    default: 'bg-[#2c2c2e] text-[#0a84ff]',
    outline: 'border border-[#0a84ff]/40 text-[#0a84ff]',
    info: 'bg-[#0a84ff]/10 text-[#0a84ff]',
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

