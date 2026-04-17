import React, { useMemo } from 'react';
import { Screen } from '../ui/Screen';
import { INSTALL_DISMISS_KEY, isStandaloneApp } from '../../lib/pwa';

type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(userAgent: string): Platform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

type InstallAppProps = {
  onContinue: () => void;
  onDismiss: () => void;
};

export function InstallApp({ onContinue, onDismiss }: InstallAppProps) {
  const platform = useMemo(() => {
    if (typeof navigator === 'undefined') return 'desktop' as const;
    return detectPlatform(navigator.userAgent);
  }, []);

  const standalone = useMemo(() => isStandaloneApp(), []);
  const qrSrc = `${import.meta.env.BASE_URL}qrcodes/RenderStaticQR.png`;

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(INSTALL_DISMISS_KEY, '1');
      } catch {
        // ignore
      }
    }
    onDismiss();
  };

  const steps = useMemo(() => {
    if (platform === 'ios') {
      return [
        'Apri questo link in Safari.',
        'Tocca il pulsante Condividi.',
        'Seleziona Aggiungi a Home.',
      ];
    }
    if (platform === 'android') {
      return [
        'Apri questo link in Chrome.',
        'Tocca il menu in alto a destra.',
        'Seleziona Installa app o Aggiungi a schermata Home.',
      ];
    }
    return [
      'Apri questo link dal tuo telefono.',
      'Scansiona il QR qui sotto.',
      'Installa dal menu del browser.',
    ];
  }, [platform]);

  return (
    <Screen withBottomNavPadding={false} className="justify-start" contentClassName="pt-10">
      <div className="space-y-3">
        <h1 className="text-[22px] leading-[28px] font-semibold text-white">Installa Turni di Palco</h1>
      </div>

      <section
        aria-labelledby="install-steps-heading"
        className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] p-4 space-y-2"
      >
        <p id="install-steps-heading" className="text-white font-semibold">
          Installazione ({platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'Desktop'})
        </p>
        <ol className="list-decimal pl-5 space-y-1 text-[#b8b2b3]" aria-describedby="install-steps-heading">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      {platform === 'desktop' ? (
        <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] p-4 flex flex-col items-center gap-3">
          <p className="text-white font-semibold">QR</p>
          <img
            src={qrSrc}
            alt="QR per aprire Turni di Palco su mobile"
            className="w-[220px] h-[220px] rounded-[12px] bg-white p-2"
            loading="lazy"
          />
        </div>
      ) : null}

      {standalone ? (
        <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] p-4">
          <p className="text-white font-semibold">Gia installata</p>
        </div>
      ) : null}

      <div className="space-y-3">
        <button
          type="button"
          onClick={onContinue}
          aria-label="Apri Turni di Palco senza installare"
          className="w-full bg-gradient-to-b from-[#8c1c38] to-[#a82847] rounded-[16.4px] h-[54px] flex items-center justify-center text-white font-semibold active:scale-[0.99] transition-transform"
        >
          Apri l'app
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Rimanda l'installazione dell'app"
          className="w-full h-[48px] rounded-[16.4px] border border-[#2d2728] text-[#f4bf4f] font-semibold"
        >
          Non ora
        </button>
      </div>
    </Screen>
  );
}
