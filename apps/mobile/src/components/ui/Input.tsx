import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({ label, error, helperText, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-[--color-text-secondary] mb-2">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-[--color-bg-surface-elevated] border-2 ${
          error ? 'border-[--color-error]' : 'border-[--color-bg-surface-hover]'
        } rounded-lg px-4 py-3 text-white placeholder:text-[--color-text-tertiary] focus:border-[--color-gold-400] focus:outline-none transition-colors ${className}`}
        {...props}
      />
      {error && (
        <p className="text-[--color-error] mt-1 text-sm">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-[--color-text-tertiary] mt-1 text-sm">{helperText}</p>
      )}
    </div>
  );
}
