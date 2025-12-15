import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({ children, className = '', onClick, hoverable = false }: CardProps) {
  const hoverClass = hoverable || onClick ? 'hover:bg-[#2d2728] cursor-pointer active:scale-[0.98]' : '';
  
  return (
    <div 
      className={`bg-[#1a1617] rounded-xl p-4 shadow-md transition-all duration-200 ${hoverClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
