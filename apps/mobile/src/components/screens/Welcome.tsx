import React from 'react';
import { Button } from '../ui/Button';
import { Theater } from 'lucide-react';
import { Screen } from '../ui/Screen';

interface WelcomeProps {
  onStart: () => void;
  onLogin: () => void;
}

export function Welcome({ onStart, onLogin }: WelcomeProps) {
  return (
    <Screen
      className="bg-gradient-to-b from-[#0f0d0e] via-[#1a1617] to-[#2d0a0f]"
      withBottomNavPadding={false}
      contentClassName="min-h-[calc(100vh-32px)] flex flex-col justify-between"
    >
      <div className="flex flex-col items-center text-center gap-6">
        <div className="w-32 h-32 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-3xl flex items-center justify-center shadow-lg mb-5 mx-auto">
          <Theater size={64} className="text-[#f4bf4f]" strokeWidth={1.5} />
        </div>

        <div className="space-y-2">
          <h1 className="text-center bg-gradient-to-r from-[#f4bf4f] to-[#e6a23c] bg-clip-text text-transparent">
            Turni di Palco
          </h1>
          <p className="text-center text-[#b8b2b3]">Costruisci la tua carriera a teatro</p>
        </div>

        <div className="bg-[#1a1617] rounded-2xl p-[5px] border border-[#2d2728] animate-slide-up my-5 mx-auto max-w-[300px]">
          <p className="text-[#b8b2b3] text-center">
            Simula la carriera di un professionista del teatro e registra la tua partecipazione agli eventi reali ATCL
            scansionando il QR sul biglietto.
          </p>
        </div>
      </div>

      <div className="animate-slide-up flex flex-col gap-4">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onStart}
          className="welcome-button-primary max-w-[300px] mx-auto"
        >
          Inizia
        </Button>

        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={onLogin}
          className="welcome-button-secondary max-w-[300px] mx-auto"
        >
          Accedi
        </Button>
      </div>
    </Screen>
  );
}
