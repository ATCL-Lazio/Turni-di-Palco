import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { QrCode, X, Scan } from 'lucide-react';

interface QRScannerProps {
  onClose: () => void;
  onScanSuccess: (code: string) => void;
}

export function QRScanner({ onClose, onScanSuccess }: QRScannerProps) {
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(true);
  
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScanSuccess(manualCode.trim());
    }
  };
  
  // Simulate successful scan after 2 seconds
  const simulateScan = () => {
    setTimeout(() => {
      onScanSuccess('ATCL-001');
    }, 2000);
  };
  
  return (
    <div className="fixed inset-0 app-gradient z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#1a1617]">
        <h3 className="text-white">Scansiona QR</h3>
        <button
          onClick={onClose}
          className="flex items-center justify-center size-[44px] hover:bg-[#241f20] rounded-lg transition-colors"
        >
          <X className="text-[#f4bf4f]" size={24} />
        </button>
      </div>
      
      {/* Camera Preview Area */}
      <div className="flex-1 relative overflow-hidden">
        {isScanning ? (
          <>
            {/* Mock Camera View */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#1a1617] to-[#0f0d0e] flex items-center justify-center">
              {/* Scanning Frame */}
              <div className="relative w-64 h-64">
                {/* Corner Brackets */}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#f4bf4f] rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#f4bf4f] rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#f4bf4f] rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#f4bf4f] rounded-br-lg"></div>
                
                {/* Scanning Line Animation */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-1 bg-[#f4bf4f] animate-pulse"></div>
                </div>
                
                {/* QR Icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <QrCode className="text-[#f4bf4f]" size={120} />
                </div>
              </div>
            </div>
            
            {/* Instructions */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0f0d0e] to-transparent p-6">
              <div className="max-w-md mx-auto text-center">
                <p className="text-white mb-2">
                  Inquadra il QR sul tuo biglietto ATCL
                </p>
                <p className="text-sm text-[#b8b2b3] mb-6">
                  Posiziona il codice al centro del riquadro
                </p>
                
                {/* Demo Button - Remove in production */}
                <Button 
                  variant="ghost" 
                  onClick={simulateScan}
                  className="mb-4"
                >
                  <Scan size={18} />
                  Simula scansione (Demo)
                </Button>
                
                <button
                  onClick={() => setIsScanning(false)}
                  className="inline-flex items-center justify-center rounded-md px-2 py-[10px] text-[#f4bf4f] hover:text-[#e6a23c] transition-colors"
                >
                  Inserisci codice manualmente
                </button>
              </div>
            </div>
          </>
        ) : (
          // Manual Input
          <div className="p-6 max-w-md mx-auto">
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-[#241f20] rounded-full flex items-center justify-center mx-auto mb-4">
                <QrCode className="text-[#f4bf4f]" size={32} />
              </div>
              <h3 className="text-white mb-2">Inserisci il codice evento</h3>
              <p className="text-sm text-[#b8b2b3]">
                Trova il codice stampato sul tuo biglietto ATCL
              </p>
            </div>
            
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <Input
                type="text"
                placeholder="es. ATCL-EVENTO-20251215"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="text-center uppercase"
              />
              
              <Button type="submit" variant="primary" size="lg" fullWidth>
                Conferma codice
              </Button>
              
              <button
                type="button"
                onClick={() => setIsScanning(true)}
                className="w-full rounded-md py-[10px] text-[#f4bf4f] hover:text-[#e6a23c] transition-colors"
              >
                Torna alla scansione QR
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
