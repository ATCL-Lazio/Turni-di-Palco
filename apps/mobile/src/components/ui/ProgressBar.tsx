import React from 'react';

interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'burgundy' | 'gold';
}

export function ProgressBar({ 
  value, 
  max = 100, 
  showLabel = false, 
  size = 'md',
  color = 'burgundy'
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-2.5'
  };
  
  const colors = {
    burgundy: 'bg-gradient-to-b from-[#0066d6] to-[#0a84ff]',
    gold: 'bg-gradient-to-b from-[#0066d6] to-[#0a84ff]'
  };
  
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-sm text-[#aeaeb2] mb-1">
          <span>{value}</span>
          <span>{max}</span>
        </div>
      )}
      <div className={`w-full bg-[#2c2c2e] rounded-full overflow-hidden ${heights[size]}`}>
        <div 
          className={`${heights[size]} ${colors[color]} transition-all duration-300 rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

