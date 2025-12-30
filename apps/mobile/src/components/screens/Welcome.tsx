import React from 'react';
import { Screen } from '../ui/Screen';

interface WelcomeProps {
  onStart: () => void;
  onLogin: () => void;
}

const welcomeLogo = 'https://www.figma.com/api/mcp/asset/38b244d2-d197-4a0b-8d19-239c55b6947f';

export function Welcome({ onStart, onLogin }: WelcomeProps) {
  return (
    <Screen
      withBottomNavPadding={false}
      className="relative items-start justify-start h-[100dvh] overflow-hidden"
      contentClassName="relative w-full max-w-[393px] flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] space-y-0 box-border"
      style={{
        backgroundImage:
          'linear-gradient(180deg, rgba(15, 13, 14, 1) 0%, rgba(26, 22, 23, 1) 50%, rgba(45, 10, 15, 1) 100%), linear-gradient(90deg, rgba(15, 13, 14, 1) 0%, rgba(15, 13, 14, 1) 100%)'
      }}
    >
      <div className="relative flex h-full flex-col items-center text-center">
        <div className="flex flex-col items-center gap-[20px] pt-[12px]">
          <div className="bg-gradient-to-b from-[#a82847] to-[#6b1529] rounded-[24px] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] size-[128px]">
            <div className="flex items-center justify-center w-full h-full">
              <img alt="" className="size-[64px]" src={welcomeLogo} />
            </div>
          </div>

          <p
            className="text-center text-[32px] leading-[38.4px] font-bold tracking-[-0.64px] text-transparent bg-clip-text"
            style={{
              WebkitTextFillColor: 'transparent',
              backgroundImage:
                'linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0) 100%), linear-gradient(180deg, rgba(244, 191, 79, 1) 0%, rgba(230, 162, 60, 1) 100%)'
            }}
          >
            Turni di Palco
          </p>

          <p className="text-[16px] leading-[25.6px] text-center text-[#b8b2b3]">
            Costruisci la tua carriera a teatro
          </p>
        </div>

        <div className="mt-[18px] mb-5 w-full max-w-[300px] bg-[#1a1617] border border-[#2d2728] rounded-[16px] px-4 py-3">
          <p className="!m-0 text-[16px] leading-[25.6px] text-center text-[#b8b2b3]">
            Simula la carriera di un professionista del teatro e registra la tua
            partecipazione agli eventi reali ATCL scansionando il QR sul biglietto.
          </p>
        </div>

        <div className="mt-auto w-full flex flex-col items-center gap-[16px] pb-[12px]">
          <button
            type="button"
            onClick={onStart}
            className="bg-gradient-to-b from-[#8c1c38] to-[#a82847] h-[44px] w-full max-w-[300px] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)]"
          >
            <span className="block text-[18px] leading-[28px] text-center text-white">
              Inizia
            </span>
          </button>
          <button
            type="button"
            onClick={onLogin}
            className="border-2 border-[#a82847] h-[44px] w-full max-w-[300px] rounded-[16.4px]"
          >
            <span className="block text-[18px] leading-[28px] text-center text-[#f4bf4f]">
              Accedi
            </span>
          </button>
        </div>
      </div>
    </Screen>
  );
}
