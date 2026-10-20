import React from 'react';
import { cn } from './utils';

interface ScreenProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  /**
   * Adds space for the fixed bottom navigation plus the device safe area inset.
   */
  withBottomNavPadding?: boolean;
  /**
   * Centra verticalmente il contenuto (stati vuoti/di caricamento). Usa `100svh`,
   * che non cambia quando la toolbar di iOS Safari si espande o si comprime.
   */
  center?: boolean;
  className?: string;
  contentClassName?: string;
  style?: React.CSSProperties;
}

export function Screen({
  children,
  header,
  withBottomNavPadding = true,
  center = false,
  className,
  contentClassName,
  style
}: ScreenProps) {
  return (
    <main
      className={cn(
        'flex flex-col items-center',
        // Default: contenuto allineato in alto, così non si sposta al variare di 100dvh.
        center ? 'min-h-[100svh] justify-center' : 'min-h-screen min-h-[100dvh] justify-start',
        className
      )}
      style={style}
    >
      {header}
      <div
        className={cn(
          'w-full app-content space-y-5 px-5 pt-5 pb-6',
          withBottomNavPadding && 'pb-[calc(var(--safe-area-inset-bottom)+96px)]',
          contentClassName
        )}
      >
        {children}
      </div>
    </main>
  );
}

interface ScreenHeaderProps {
  children: React.ReactNode;
  gradient?: boolean;
  className?: string;
}

export function ScreenHeader({ children, gradient = false, className }: ScreenHeaderProps) {
  return (
    <div className={cn(gradient && 'bg-gradient-to-b from-burgundy-deep to-page', className)}>
      <div className="w-full app-content px-5 pt-5 pb-6 space-y-5">{children}</div>
    </div>
  );
}
