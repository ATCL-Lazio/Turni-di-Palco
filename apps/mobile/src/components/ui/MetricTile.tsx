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
  animateOnMount?: boolean;
}

export function MetricTile({ label, value, helper, icon, onClick, progress, animateOnMount = false }: MetricTileProps) {
  return (
    <div
      className={cn(
        'bg-[--color-bg-surface] rounded-2xl p-3 border border-[--color-bg-surface-hover]',
        onClick ? 'hover:bg-[--color-bg-surface-elevated] cursor-pointer active:scale-[0.98] transition-all duration-150 mobile-card-hover' : '',
        animateOnMount ? 'animate-card-in' : ''
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2 min-h-[32px]">
        <div className="text-xs leading-4 text-[--color-text-secondary]">{label}</div>
        {icon ? <div className="text-[--color-gold-400]">{icon}</div> : null}
      </div>
      <div
        className={cn(
          'text-[52px] leading-none mt-2 mb-4 text-white font-semibold tracking-tight',
          animateOnMount ? 'animate-number-pop' : ''
        )}
      >
        {value}
      </div>
      {helper ? <div className="text-xs text-[--color-text-tertiary]">{helper}</div> : null}
      {progress ? (
        <div className="mt-2">
          <ProgressBar value={progress.value} max={progress.max} size="sm" color={progress.color ?? 'burgundy'} />
        </div>
      ) : null}
    </div>
  );
}
