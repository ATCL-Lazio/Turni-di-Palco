import React from 'react';
import { Button } from '../ui/Button';
import { Theater } from 'lucide-react';

interface WelcomeProps {
  onStart: () => void;
  onLogin: () => void;
}

export function Welcome({ onStart, onLogin }: WelcomeProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 bg-gradient-to-b from-[#0f0d0e] via-[#1a1617] to-[#2d0a0f]">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">
        {/* Logo Area */}
        <div className="mb-8 animate-fade-in flex flex-col items-center">
          <div className="w-32 h-32 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-3xl flex items-center justify-center shadow-lg" style={{ marginBottom: "20px" }}>
            <Theater size={64} className="text-[#f4bf4f]" strokeWidth={1.5} />
          </div>

          <h1 className="text-center mb-3 bg-gradient-to-r from-[#f4bf4f] to-[#e6a23c] bg-clip-text text-transparent">
            Turni di Palco
          </h1>

          <p className="text-center text-[#b8b2b3] px-4">
            Costruisci la tua carriera a teatro
          </p>
        </div>

        {/* Description */}
        <div className="bg-[#1a1617] rounded-2xl p-6 border border-[#2d2728] animate-slide-up" style={{ margin: "20px 20px 0" }}>
          <p className="text-[#b8b2b3] text-center" style={{ maxWidth: "400px", margin: "0 20px" }}>
            Simula la carriera di un professionista del teatro e registra la tua partecipazione agli eventi reali ATCL scansionando il QR sul biglietto.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-md animate-slide-up flex flex-col items-center justify-center gap-4">
        <Button variant="primary" size="lg" fullWidth onClick={onStart} style={{ maxWidth: "400px", margin: "0 20px" }}>
          Inizia
        </Button>

        <Button variant="secondary" size="lg" fullWidth onClick={onLogin} style={{ maxWidth: "400px", margin: "auto 0 20px" }}>
          Accedi
        </Button>
      </div>
    </div>
  );
}
