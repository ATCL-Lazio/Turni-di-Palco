import React from 'react';
import { cn } from './utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  style?: React.CSSProperties;
  animateOnMount?: boolean;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  role?: React.AriaRole;
  'aria-label'?: string;
  'aria-disabled'?: boolean;
}

export function Card({
  children,
  className = '',
  onClick,
  hoverable = false,
  style,
  animateOnMount = false,
  onPointerDown,
  role,
  'aria-label': ariaLabel,
  'aria-disabled': ariaDisabled,
}: CardProps) {
  const isClickable = hoverable || onClick;
  const hoverClass = isClickable ? 'mobile-card-hover cursor-pointer active:scale-[0.985] active:shadow-none' : '';
  const animationClass = animateOnMount ? 'animate-card-in' : '';

  const handleKeyDown = onClick ? (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  } : undefined;

  const defaultStyles: React.CSSProperties = {
    backgroundColor: 'rgb(26, 22, 23)',
    borderRadius: '16.4px',
    boxShadow: 'rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px',
    transitionDuration: '0.2s',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    ...style,
  };

  return (
    <div
      className={cn('relative transition-all duration-200 p-4', hoverClass, animationClass, className)}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onKeyDown={handleKeyDown}
      role={role ?? (onClick ? 'button' : undefined)}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      aria-disabled={ariaDisabled}
      style={defaultStyles}
    >
      {children}
    </div>
  );
}
