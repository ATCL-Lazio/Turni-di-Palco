import React, { useMemo } from 'react';
import { Screen } from '../ui/Screen';

type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(userAgent: string): Platform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari exposes `navigator.standalone` when launched from Home Screen.
  // Other browsers use the display-mode media query.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (typeof nav.standalone === 'boolean') return nav.standalone;
  return window.matchMedia?.('(display-mode: standalone)').matches ?? false;
}

export function InstallApp({ onContinue }: { onContinue: () => void }) {
  const platform = useMemo(() => {
    if (typeof navigator === 'undefined') return 'desktop' as const;
    return detectPlatform(navigator.userAgent);
  }, []);

  const standalone = useMemo(() => isStandalone(), []);

  const steps = useMemo(() => {
    if (platform === 'ios') {
      return [
        'Apri questo link in Safari.',
        'Tocca il pulsante Condividi (quadrato con freccia).',
        'Seleziona “Aggiungi a Home”.',
      ];
    }
    if (platform === 'android') {
      return [
        'Apri questo link in Chrome.',
        'Tocca il menu ⋮ in alto a destra.',
        'Seleziona “Installa app” oppure “Aggiungi a schermata Home”.',
      ];
    }
    return [
      'Apri questo link dal tuo telefono.',
      'Usa il menu del browser per installare o aggiungere alla Home.',
    ];
  }, [platform]);

  return (
    <Screen withBottomNavPadding={false} className="justify-start" contentClassName="pt-10">
      <div className="space-y-3">
        <h1 className="text-[22px] leading-[28px] font-semibold text-white">Installa Turni di Palco</h1>
        <p className="text-[#b8b2b3]">
          Aggiungendo l’app alla schermata Home avrai un’esperienza più simile a un’app nativa
          (full-screen, avvio rapido).
        </p>
      </div>

      <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] p-4 space-y-2">
        <p className="text-white font-semibold">Istruzioni ({platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'Desktop'})</p>
        <ol className="list-decimal pl-5 space-y-1 text-[#b8b2b3]">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      {standalone ? (
        <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] p-4">
          <p className="text-white font-semibold">Già installata</p>
          <p className="text-[#b8b2b3]">Sembra che tu stia già usando la versione installata.</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onContinue}
        className="w-full bg-gradient-to-b from-[#8c1c38] to-[#a82847] rounded-[16.4px] h-[54px] flex items-center justify-center text-white font-semibold active:scale-[0.99] transition-transform"
      >
        Apri l’app
      </button>
    </Screen>
  );
}

