import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from './utils';

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  hasError?: boolean;
}

/**
 * Campo password con toggle visibilità (mostra/nascondi).
 * Wrappa la stessa struttura di FormInput per coerenza visiva.
 */
export function PasswordInput({ hasError, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={cn(
        'bg-[--color-bg-surface-elevated] border-2 rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[--color-gold-400]',
        hasError ? 'border-[--color-error]' : 'border-[--color-bg-surface-hover]',
      )}
    >
      <input
        type={visible ? 'text' : 'password'}
        className={cn(
          'flex-1 h-full bg-transparent pl-[10px] pr-1 py-0 text-base leading-7 text-[--color-text-primary] placeholder:text-[--color-text-tertiary] focus:outline-none',
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Nascondi password' : 'Mostra password'}
        tabIndex={-1}
        className="flex-shrink-0 flex items-center justify-center w-10 h-full text-[--color-text-tertiary] hover:text-[--color-text-secondary] transition-colors"
      >
        {visible
          ? <EyeOff size={16} aria-hidden="true" />
          : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}
