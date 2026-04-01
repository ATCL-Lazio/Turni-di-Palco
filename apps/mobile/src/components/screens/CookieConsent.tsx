import React from 'react';
import { Cookie, MapPin, Lock, Trash2 } from 'lucide-react';
import { Screen } from '../ui/Screen';
import { CopyrightNotice } from '../ui/CopyrightNotice';
import { COOKIE_CONSENT_KEY } from '../../constants/privacy';
import welcomeLogo from '../../assets/figma/welcome-logo.svg';

interface CookieConsentProps {
  onAccept: () => void;
  onViewPrivacy: () => void;
}

const bullets = [
  {
    icon: Cookie,
    title: 'Cookie tecnici',
    desc: "Usati esclusivamente per il funzionamento dell'app (sessione, preferenze di navigazione).",
  },
  {
    icon: MapPin,
    title: 'Geolocalizzazione',
    desc: 'Raccolta solo durante i turni, con il tuo consenso esplicito separato.',
  },
  {
    icon: Lock,
    title: 'Nessuna profilazione',
    desc: 'I tuoi dati non vengono usati per pubblicità o ceduti a terze parti.',
  },
  {
    icon: Trash2,
    title: 'Diritto alla cancellazione',
    desc: 'Puoi richiedere la rimozione del tuo account in qualsiasi momento.',
  },
] as const;

export function CookieConsent({ onAccept, onViewPrivacy }: CookieConsentProps) {
  const handleAccept = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, new Date().toISOString());
    }
    onAccept();
  };

  return (
    <Screen
      withBottomNavPadding={false}
      className="relative items-start justify-start h-[100dvh] overflow-hidden"
      contentClassName="relative w-full flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] space-y-0 box-border"
    >
      <div className="relative flex h-full flex-col items-center text-center">
        {/* Logo e titolo */}
        <div className="flex flex-col items-center gap-5 pt-3">
          <div className="bg-gradient-to-b from-[#a82847] to-[#6b1529] rounded-[28px] size-[96px] flex items-center justify-center ring-1 ring-[#a82847]/30">
            <img alt="" className="size-[48px]" src={welcomeLogo} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p
              className="text-[22px] leading-[1.2] font-bold tracking-[-0.02em] text-transparent bg-clip-text"
              style={{
                WebkitTextFillColor: 'transparent',
                backgroundImage: 'linear-gradient(180deg, rgba(244, 191, 79, 1) 0%, rgba(230, 162, 60, 1) 100%)',
              }}
            >
              Cookie e Privacy
            </p>
            <p className="text-[12px] leading-none text-[#7a7577] tracking-[0.10em] uppercase font-semibold">
              Prima di iniziare
            </p>
          </div>
        </div>

        {/* Card informativa */}
        <div className="mt-6 w-full bg-[#1a1617] border border-[#2d2728] rounded-2xl p-4">
          <div className="grid grid-cols-2 gap-2">
            {bullets.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex flex-col gap-2 rounded-[14px] bg-[#0f0d0e] p-3"
              >
                <div className="flex items-center justify-center size-[32px] rounded-[9px] bg-[#f4bf4f]/10 self-start">
                  <Icon size={15} className="text-[#f4bf4f]" />
                </div>
                <div className="text-left">
                  <p className="text-[12px] font-semibold text-[#f5f5f5] leading-[17px]">{title}</p>
                  <p className="text-[11px] leading-[16px] text-[#7a7577] mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Azioni */}
        <div className="mt-auto w-full flex flex-col items-center gap-3 pb-3">
          <button
            type="button"
            onClick={handleAccept}
            className="h-[50px] w-full max-w-[300px] rounded-2xl bg-gradient-to-b from-[#f4bf4f] to-[#e6a23c] shadow-[0_4px_20px_rgba(244,191,79,0.25)] active:shadow-none active:scale-[0.98] transition-all duration-150 text-[#0f0d0e]"
          >
            <span className="block text-[17px] font-semibold leading-none">Accetta e continua</span>
          </button>

          <button
            type="button"
            onClick={onViewPrivacy}
            className="h-[44px] w-full max-w-[300px] flex items-center justify-center"
          >
            <span className="text-[14px] text-[#b8b2b3] underline underline-offset-2">
              Leggi la Privacy Policy
            </span>
          </button>

          <p className="text-[11px] leading-[16px] text-[#7a7577] max-w-[280px]">
            Cliccando "Accetta e continua" acconsenti all'uso dei cookie tecnici necessari al funzionamento dell'app.
          </p>

          <CopyrightNotice className="mt-1" />
        </div>
      </div>
    </Screen>
  );
}
