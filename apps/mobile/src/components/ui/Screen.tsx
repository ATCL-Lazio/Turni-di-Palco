import React from 'react';
import { cn } from './utils';

interface ScreenProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  /**
   * Adds space for the fixed bottom navigation plus the device safe area inset.
   */
  withBottomNavPadding?: boolean;
  className?: string;
  contentClassName?: string;
}

export function Screen({
  children,
  header,
  withBottomNavPadding = true,
  className,
  contentClassName
}: ScreenProps) {
  return (
    <div className={cn('min-h-screen bg-[#0f0d0e]', className)}>
      {header}
      <div
        className={cn(
          'w-full max-w-md mx-auto space-y-6 px-6 pt-6 pb-8',
          withBottomNavPadding && 'pb-[calc(env(safe-area-inset-bottom,_0px)+96px)]',
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface ScreenHeaderProps {
  children: React.ReactNode;
  gradient?: boolean;
  className?: string;
}

export function ScreenHeader({ children, gradient = true, className }: ScreenHeaderProps) {
  return (
    <div className={cn(gradient && 'bg-gradient-to-b from-[#2d0a0f] to-[#0f0d0e]', className)}>
      <div className="w-full max-w-md mx-auto px-6 pt-6 pb-8">{children}</div>
    </div>
  );
}
