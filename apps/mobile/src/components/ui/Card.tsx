import React from 'react';
import { cn } from './utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  style?: React.CSSProperties;
  animateOnMount?: boolean; // New prop for entrance animation
}

export function Card({ 
  children, 
  className = '', 
  onClick, 
  hoverable = false, 
  style,
  animateOnMount = false 
}: CardProps) {
  const hoverClass = hoverable || onClick ? 'mobile-card-hover cursor-pointer' : '';
  const animationClass = animateOnMount ? 'mobile-hero-reveal' : '';
  
  const defaultStyles: React.CSSProperties = {
    backgroundColor: 'var(--ios-card-bg)',
    borderRadius: '22px',
    border: '1px solid var(--ios-card-border)',
    boxShadow: 'var(--ios-elevated-shadow)',
    transitionDuration: '0.16s',
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    backdropFilter: 'blur(18px) saturate(140%)',
    WebkitBackdropFilter: 'blur(18px) saturate(140%)',
    ...style,
  };

  return (
    <div
      className={cn(
        'ios26-card relative p-4 transition-all duration-200',
        hoverClass,
        animationClass,
        className
      )}
      onClick={onClick}
      style={defaultStyles}
    >
      {children}
    </div>
  );
}
