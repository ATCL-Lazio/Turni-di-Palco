import React from 'react';
import { cn } from './utils';
import { ProgressBar } from './ProgressBar';

interface MetricTileProps {
  label: string;
  value: string | number;
  helper?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  progress?: { value: number; max: number; color?: 'gold' | 'burgundy' };
  animateOnMount?: boolean; // New prop for entrance animation
}

export function MetricTile({ label, value, helper, icon, onClick, progress, animateOnMount = false }: MetricTileProps) {
  const animationClass = animateOnMount ? 'mobile-hero-reveal' : '';
  
  return (
    <div
      className={cn(
        'bg-[#1c1c1e] rounded-2xl p-3 border border-[#3a3a3c]',
        onClick ? 'hover:bg-[#2c2c2e] cursor-pointer active:scale-[0.99] transition-all duration-150 mobile-card-hover' : '',
        animationClass
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2 min-h-[32px]">
        <div className="text-xs leading-4 text-[#aeaeb2]">{label}</div>
        {icon ? <div className="text-[#0a84ff]">{icon}</div> : null}
      </div>
      <div className="text-white leading-tight" style={{ fontSize: '55px', margin: '10px 0 20px' }}>{value}</div>
      {helper ? <div className="text-xs text-[#8e8e93]">{helper}</div> : null}
      {progress ? (
        <div className="mt-2">
          <ProgressBar value={progress.value} max={progress.max} size="sm" color={progress.color ?? 'burgundy'} />
        </div>
      ) : null}
    </div>
  );
}

