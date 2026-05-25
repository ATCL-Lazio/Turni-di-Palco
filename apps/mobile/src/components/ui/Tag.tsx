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
    default: 'bg-[--color-bg-surface-elevated] text-[--color-gold-400]',
    outline: 'border border-[--color-gold-400]/40 text-[--color-gold-400]',
    info: 'bg-[--color-gold-400]/10 text-[--color-gold-400]',
    success: 'bg-[--color-success]/10 text-[--color-success] border border-[--color-success]/30',
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
