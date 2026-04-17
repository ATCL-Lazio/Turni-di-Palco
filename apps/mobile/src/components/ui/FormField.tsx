import React from 'react';
import { cn } from './utils';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, htmlFor, error, children, className }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-2 w-full', className)}>
      <label htmlFor={htmlFor} className="text-base leading-6 text-[#b8b2b3]">
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-[#ff4d4f]">{error}</p>}
    </div>
  );
}

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function FormInput({ hasError, className, ...props }: FormInputProps) {
  return (
    <div className={cn(
      'bg-[#241f20] border-2 rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[#f4bf4f]',
      hasError ? 'border-[#ff4d4f]' : 'border-[#2d2728]',
    )}>
      <input
        className={cn(
          'w-full h-full bg-transparent px-[10px] py-0 text-base leading-7 text-[#f5f5f5] placeholder:text-[#9a9697] focus:outline-none',
          className,
        )}
        {...props}
      />
    </div>
  );
}

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthFormLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex h-full flex-col">{children}</div>
  );
}
