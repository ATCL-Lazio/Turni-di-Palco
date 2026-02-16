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
        <label className="mb-2 block text-[15px] font-medium text-[#aeaeb2]">
          {label}
        </label>
      )}
      <input
        className={`ios26-input h-[48px] w-full rounded-[14px] border px-4 text-[16px] text-[#f2f2f7] placeholder:text-[#8e8e93] transition-[background-color,border-color,box-shadow] focus:outline-none ${
          error
            ? 'border-[#ff453a]/85 bg-[#2c2c2e]'
            : 'border-white/12 bg-[#2c2c2e]/88 focus:border-[#0a84ff] focus:bg-[#2c2c2e]'
        } focus:ring-4 focus:ring-[#0a84ff]/20 ${className}`}
        {...props}
      />
      {error && (
        <p className="text-[#ff453a] mt-1 text-sm">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-[#8e8e93] mt-1 text-sm">{helperText}</p>
      )}
    </div>
  );
}

