import React from 'react';
import { QrCode, ChevronRight } from 'lucide-react';

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
      className={`ios26-prominent w-full rounded-[20px] border border-white/14 p-px shadow-[0_18px_30px_-22px_rgba(0,0,0,0.85)] transition-all duration-200 hover:opacity-95 active:scale-[0.99] ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(180deg, rgba(61, 156, 255, 0.95) 0%, rgba(10, 132, 255, 0.94) 100%), linear-gradient(90deg, rgba(28, 28, 30, 0.96) 0%, rgba(28, 28, 30, 0.96) 100%)',
        ...style,
      }}
    >
      <div className="flex h-[58px] items-center gap-3 pl-[5px] pr-0">
        <div className="flex size-[48px] items-center justify-center rounded-[16px] bg-white/14">
          <QrCode className="text-white" size={24} />
        </div>
        <div className="flex-1 flex items-center justify-between">
          <div className="flex flex-col items-start">
            <p className="text-[16px] leading-[25.6px] font-semibold !text-[#ffffff] !m-0">Scansiona QR</p>
            <p className="text-[16px] leading-[25.6px] !text-[#ffffff] !m-0">Registra un turno dal biglietto</p>
          </div>
          <ChevronRight className="text-white" size={22} />
        </div>
      </div>
    </button>
  );
}

