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
      className="relative items-start justify-start"
      contentClassName="relative w-full max-w-[393px] h-[852px] px-0 pt-0 pb-0 space-y-0"
      style={{
        backgroundImage:
          'linear-gradient(180deg, rgba(15, 13, 14, 1) 0%, rgba(26, 22, 23, 1) 50%, rgba(45, 10, 15, 1) 100%), linear-gradient(90deg, rgba(15, 13, 14, 1) 0%, rgba(15, 13, 14, 1) 100%)'
      }}
    >
      <div className="relative w-full h-full">
        <div className="absolute z-10 h-[96px] left-1/2 top-[calc(50%+309px)] translate-x-[-50%] translate-y-[-50%] w-[448px]">
          <div className="flex flex-col gap-[16px] items-center justify-center pb-[20px]">
            <button
              type="button"
              onClick={onStart}
              className="bg-gradient-to-b from-[#8c1c38] to-[#a82847] h-[28px] w-[300px] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)]"
            >
              <span className="block text-[18px] leading-[28px] text-center text-white">
                Inizia
              </span>
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="border-2 border-[#a82847] h-[32px] w-[300px] rounded-[16.4px]"
            >
              <span className="block text-[18px] leading-[28px] text-center text-[#f4bf4f]">
                Accedi
              </span>
            </button>
          </div>
        </div>

        <div className="absolute z-0 pointer-events-none h-[852px] left-1/2 top-1/2 translate-x-[-50%] translate-y-[-50%] w-[393px]">
          <div className="relative flex flex-col gap-[20px] items-center justify-center w-full h-full">
            <div className="absolute bg-[#1a1617] border border-[#2d2728] h-[102px] left-[calc(50%+0.5px)] rounded-[16px] top-[calc(50%+115px)] translate-x-[-50%] translate-y-[-50%] w-[300px]">
              <div className="flex items-center justify-center w-full h-full">
                <p className="text-[16px] leading-[25.6px] text-center text-[#b8b2b3] w-[298px]">
                  Simula la carriera di un professionista del teatro e registra la tua
                  partecipazione agli eventi reali ATCL scansionando il QR sul biglietto.
                </p>
              </div>
            </div>

            <div className="absolute h-[211.984px] left-[calc(50%+0.31px)] top-[214px] translate-x-[-50%] w-[227.625px]">
              <div className="flex flex-col gap-[20px] items-center relative w-full h-full">
                <div className="bg-gradient-to-b from-[#a82847] to-[#6b1529] rounded-[24px] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] size-[128px]">
                  <div className="flex items-center justify-center w-full h-full">
                    <img alt="" className="size-[64px]" src={welcomeLogo} />
                  </div>
                </div>

                <div className="h-[38.391px] relative w-[194.891px]">
                  <p
                    className="absolute left-1/2 top-[calc(50%-22.2px)] translate-x-[-50%] text-[32px] leading-[38.4px] font-bold tracking-[-0.64px] text-transparent bg-clip-text"
                    style={{
                      WebkitTextFillColor: 'transparent',
                      backgroundImage:
                        'linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0) 100%), linear-gradient(180deg, rgba(244, 191, 79, 1) 0%, rgba(230, 162, 60, 1) 100%)'
                    }}
                  >
                    Turni di Palco
                  </p>
                </div>

                <div className="absolute h-[25px] left-[calc(50%+0.19px)] top-[calc(50%+112.9px)] translate-x-[-50%] translate-y-[-50%] w-[228px]">
                  <p className="text-[16px] leading-[25.6px] text-center text-[#b8b2b3]">
                    Costruisci la tua carriera a teatro
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}
