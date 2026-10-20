import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl transition-[scale,transform,color,background-color,border-color,box-shadow] duration-100 ease-out motion-reduce:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'bg-gradient-to-b from-burgundy-bright to-burgundy-600 text-white shadow-md hover:shadow-lg hover:from-burgundy-800 hover:to-[#8c1c38] active:scale-[0.97]',
        primary: 'bg-gradient-to-b from-burgundy-bright to-burgundy-600 text-white shadow-md hover:shadow-lg hover:from-burgundy-800 hover:to-[#8c1c38] active:scale-[0.97]',
        destructive: 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.97]',
        outline: 'border border-border bg-transparent text-fg-primary hover:bg-[#241f20] active:scale-[0.97]',
        secondary: 'border-2 border-burgundy-600 text-accent bg-transparent hover:bg-burgundy-600/10 active:scale-[0.97]',
        ghost: 'text-accent hover:bg-[#241f20] active:scale-[0.97]',
        link: 'text-accent underline-offset-4 hover:underline',
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
