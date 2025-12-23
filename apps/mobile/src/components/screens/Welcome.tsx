import React from 'react';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';

interface WelcomeProps {
  onStart: () => void;
  onLogin: () => void;
}

const welcomeLogo = 'https://www.figma.com/api/mcp/asset/da06f11f-a826-4321-a838-e7b2f427f86f';

export function Welcome({ onStart, onLogin }: WelcomeProps) {
  return (
    <Screen
      className="bg-[linear-gradient(90deg,#0f0d0e_0%,#0f0d0e_40%,#1a1617_70%,#2d0a0f_100%)]"
      withBottomNavPadding={false}
      contentClassName="min-h-[calc(100vh-32px)] flex items-center justify-center px-6 py-16"
    >
      <div className="flex w-full flex-col items-center gap-10 text-center">
        <div className="flex flex-col items-center gap-6">
          <div className="flex h-28 w-28 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#6b1529] to-[#a82847] shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
            <img src={welcomeLogo} alt="Turni di Palco" className="h-16 w-16" />
          </div>

          <div className="space-y-2">
            <h1 className="text-[32px] font-bold leading-[38px] text-[#f5f5f5]">Turni di Palco</h1>
            <p className="text-[16px] leading-[22px] text-[#f5f5f5]">Costruisci la tua carriera a teatro</p>
          </div>

          <div className="w-full max-w-[320px] rounded-[16px] border border-[#2d2728] bg-[#1a1617] px-5 py-4 text-[#f5f5f5] shadow-[0_10px_30px_rgba(0,0,0,0.28)] animate-slide-up">
            <p className="text-[16px] leading-[25.6px]">
              Simula la carriera di un professionista del teatro e registra la tua partecipazione agli eventi reali ATCL scansionando il QR sul biglietto.
            </p>
          </div>
        </div>

        <div className="flex w-full max-w-[320px] flex-col gap-3 animate-slide-up">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onStart}
            className="h-11 rounded-[16px] text-[18px] leading-[28px] font-normal"
          >
            Inizia
          </Button>

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={onLogin}
            className="h-11 rounded-[16px] text-[18px] leading-[28px] font-normal"
          >
            Accedi
          </Button>
        </div>
      </div>
    </Screen>
  );
}
