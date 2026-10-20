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
    default: 'bg-surface-elevated text-accent',
    outline: 'border border-accent/40 text-accent',
    info: 'bg-accent/10 text-accent',
    success: 'bg-[#52c41a]/10 text-success border border-[#52c41a]/30',
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
