import React from 'react';
import { Card } from './ui/Card';
import { QrCode, ChevronRight } from 'lucide-react';

interface ScanQRCardProps {
  onScanQR: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function ScanQRCard({ onScanQR, className = '', style }: ScanQRCardProps) {
  return (
    <Card className={`bg-gradient-to-r from-[#8c1c38] to-[#a82847] border border-[#f4bf4f]/30 ${className}`} style={style}>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-12 h-12 bg-[#f4bf4f] rounded-xl flex items-center justify-center ml-1 my-1">
          <QrCode className="text-[#2d0a0f]" size={24} />
        </div>
        <div className="flex-1">
          <button onClick={onScanQR} className="w-full text-left text-white hover:opacity-90 transition">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-base">Scansiona QR</p>
                <p className="text-sm text-[#f4bf4f]/90">Registra un turno dal biglietto</p>
              </div>
              <ChevronRight className="text-white" size={22} />
            </div>
          </button>
        </div>
      </div>
    </Card>
  );
}
