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
      style={defaultStyles}
    >
      {children}
    </div>
  );
}
