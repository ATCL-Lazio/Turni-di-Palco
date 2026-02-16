import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false,
  className = '',
  children,
  ...props 
}: ButtonProps) {
  const baseStyles =
    'ios26-button inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] font-semibold tracking-[-0.01em] transition-[transform,background-color,border-color,box-shadow,color] duration-150 ease-out disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black';
  
  const variants = {
    primary: 'bg-[#0a84ff] text-white shadow-[0_12px_24px_-16px_rgba(10,132,255,0.9)] hover:bg-[#3d9cff] active:bg-[#0066d6] active:scale-[0.99]',
    secondary: 'border border-white/12 bg-[#2c2c2e]/88 text-[#f2f2f7] hover:bg-[#3a3a3c]/95 active:scale-[0.99]',
    ghost: 'bg-transparent text-[#0a84ff] hover:bg-[#0a84ff]/12 active:bg-[#0a84ff]/18 active:scale-[0.99]'
  };
  
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-5 py-3 text-[15px]',
    lg: 'px-6 py-3.5 text-[17px]'
  };
  
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

