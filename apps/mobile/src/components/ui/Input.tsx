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
        <label className="block text-fg-secondary mb-2">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-surface-elevated border-2 ${
          error ? 'border-error' : 'border-border'
        } rounded-lg px-4 py-3 text-white placeholder:text-[#9a9697] focus:border-gold-400 focus:outline-none transition-colors ${className}`}
        {...props}
      />
      {error && (
        <p className="text-error mt-1 text-sm">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-fg-tertiary mt-1 text-sm">{helperText}</p>
      )}
    </div>
  );
}
