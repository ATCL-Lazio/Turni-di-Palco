import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'bg-gradient-to-b from-[--color-burgundy-700] to-[--color-burgundy-600] text-white shadow-md hover:shadow-lg hover:from-[--color-burgundy-800] hover:to-[--color-burgundy-700] active:scale-95',
        primary: 'bg-gradient-to-b from-[--color-burgundy-700] to-[--color-burgundy-600] text-white shadow-md hover:shadow-lg hover:from-[--color-burgundy-800] hover:to-[--color-burgundy-700] active:scale-95',
        destructive: 'bg-red-600 text-white hover:bg-red-700 active:scale-95',
        outline: 'border border-[--color-bg-surface-hover] bg-transparent text-[--color-text-primary] hover:bg-[--color-bg-surface-elevated] active:scale-95',
        secondary: 'border-2 border-[--color-burgundy-600] text-[--color-gold-400] bg-transparent hover:bg-[--color-burgundy-600]/10 active:scale-95',
        ghost: 'text-[--color-gold-400] hover:bg-[--color-bg-surface-elevated] active:scale-95',
        link: 'text-[--color-gold-400] underline-offset-4 hover:underline',
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
