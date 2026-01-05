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
  style?: React.CSSProperties;
}

export function Screen({
  children,
  header,
  withBottomNavPadding = true,
  className,
  contentClassName,
  style
}: ScreenProps) {
  return (
    <div
      className={cn('min-h-screen min-h-[100dvh] flex flex-col items-center justify-center', className)}
      style={style}
    >
      {header}
      <div
        className={cn(
          'w-full app-content space-y-5 px-5 pt-5 pb-6',
          withBottomNavPadding && 'pb-[calc(env(safe-area-inset-bottom,_0px)+116px)]',
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

export function ScreenHeader({ children, gradient = false, className }: ScreenHeaderProps) {
  return (
    <div className={cn(gradient && 'bg-gradient-to-b from-[#2d0a0f] to-[#0f0d0e]', className)}>
      <div className="w-full app-content px-5 pt-5 pb-6 space-y-5">{children}</div>
    </div>
  );
}
