import React from 'react';
import { Ticket, ChevronRight } from 'lucide-react';

interface ScanQRCardProps {
  onScanQR: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function ScanQRCard({ onScanQR, className = '', style }: ScanQRCardProps) {
  return (
    <button
      type="button"
      onClick={onScanQR}
      className={`w-full border border-[#f4bf4f]/30 rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] p-px transition-all duration-200 hover:opacity-95 active:scale-[0.99] ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(180deg, rgba(140, 28, 56, 1) 0%, rgba(168, 40, 71, 1) 100%), linear-gradient(90deg, rgba(26, 22, 23, 1) 0%, rgba(26, 22, 23, 1) 100%)',
        ...style,
      }}
    >
      <div className="flex items-center gap-3 h-[58px] pl-[5px] pr-0">
        <div className="bg-[#f4bf4f] rounded-[16.4px] size-[48px] flex items-center justify-center">
          <Ticket className="text-[#2d0a0f]" size={24} />
        </div>
        <div className="flex-1 flex items-center justify-between">
          <div className="flex flex-col items-start">
            <p className="text-[16px] leading-[25.6px] font-semibold !text-[#ffffff] !m-0">Registra Biglietto</p>
            <p className="text-[16px] leading-[25.6px] !text-[#ffffff] !m-0">Inserisci il numero del tuo ticket</p>
          </div>
          <ChevronRight className="text-white" size={22} />
        </div>
      </div>
    </button>
  );
}
