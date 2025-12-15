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
        <label className="block text-[#b8b2b3] mb-2">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-[#241f20] border-2 ${
          error ? 'border-[#ff4d4f]' : 'border-[#2d2728]'
        } rounded-lg px-4 py-3 text-white placeholder:text-[#7a7577] focus:border-[#f4bf4f] focus:outline-none transition-colors ${className}`}
        {...props}
      />
      {error && (
        <p className="text-[#ff4d4f] mt-1 text-sm">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-[#7a7577] mt-1 text-sm">{helperText}</p>
      )}
    </div>
  );
}
