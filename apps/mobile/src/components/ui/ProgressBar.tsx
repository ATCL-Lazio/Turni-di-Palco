import React, { useState, useEffect } from 'react';

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

  // Animate fill from 0 to percentage on mount / value change
  const [displayWidth, setDisplayWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const timer = setTimeout(() => setDisplayWidth(percentage), 30);
      return () => clearTimeout(timer);
    });
    return () => cancelAnimationFrame(id);
  }, [percentage]);

  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-2.5'
  };

  const colors = {
    burgundy: 'bg-gradient-to-r from-[#8c1c38] to-[#a82847]',
    gold: 'bg-gradient-to-r from-[#e6a23c] to-[#f4bf4f]'
  };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-sm text-[#b8b2b3] mb-1">
          <span>{value}</span>
          <span>{max}</span>
        </div>
      )}
      <div className={`w-full bg-[#241f20] rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${heights[size]} ${colors[color]} rounded-full`}
          style={{
            width: `${displayWidth}%`,
            transition: 'width 700ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  );
}
