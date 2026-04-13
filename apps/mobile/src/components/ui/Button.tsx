import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'bg-gradient-to-b from-[#8c1c38] to-[#a82847] text-white shadow-md hover:shadow-lg hover:from-[#6b1529] hover:to-[#8c1c38] active:scale-95',
        primary: 'bg-gradient-to-b from-[#8c1c38] to-[#a82847] text-white shadow-md hover:shadow-lg hover:from-[#6b1529] hover:to-[#8c1c38] active:scale-95',
        destructive: 'bg-red-600 text-white hover:bg-red-700 active:scale-95',
        outline: 'border border-[#2d2728] bg-transparent text-[#f7f3f4] hover:bg-[#241f20] active:scale-95',
        secondary: 'border-2 border-[#a82847] text-[#f4bf4f] bg-transparent hover:bg-[#a82847]/10 active:scale-95',
        ghost: 'text-[#f4bf4f] hover:bg-[#241f20] active:scale-95',
        link: 'text-[#f4bf4f] underline-offset-4 hover:underline',
      },
      size: {
        default: 'px-6 py-3 text-base',
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  asChild = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), fullWidth ? 'w-full' : '', className)}
      {...props}
    >
      {children}
    </Comp>
  );
}
