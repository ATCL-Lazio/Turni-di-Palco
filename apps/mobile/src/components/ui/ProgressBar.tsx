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
    let timer: ReturnType<typeof setTimeout> | null = null;
    const rafId = requestAnimationFrame(() => {
      timer = setTimeout(() => setDisplayWidth(percentage), 30);
    });
    return () => {
      cancelAnimationFrame(rafId);
      if (timer !== null) clearTimeout(timer);
    };
  }, [percentage]);

  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-2.5'
  };

  const colors = {
    burgundy: 'bg-gradient-to-r from-[--color-burgundy-700] to-[--color-burgundy-600]',
    gold: 'bg-gradient-to-r from-[--color-gold-500] to-[--color-gold-400]'
  };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-sm text-[--color-text-secondary] mb-1">
          <span>{value}</span>
          <span>{max}</span>
        </div>
      )}
      <div
        className={`w-full bg-[--color-bg-surface-elevated] rounded-full overflow-hidden ${heights[size]}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
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
