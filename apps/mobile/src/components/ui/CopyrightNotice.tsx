import React from 'react';
import { cn } from './utils';

interface CopyrightNoticeProps {
  className?: string;
}

export function CopyrightNotice({ className }: CopyrightNoticeProps) {
  return (
    <p
      className={cn(
        'text-center text-[11px] leading-[16px] text-[#7a7577] !m-0',
        className
      )}
    >
      Copyright © 2025 A.T.C.L. Associazione Teatrale fra i Comuni del Lazio. Tutti i diritti
      riservati.
    </p>
  );
}
