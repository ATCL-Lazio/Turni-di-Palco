import React, { useState, useEffect } from 'react';
import { ArrowLeft, Shield, MapPin, Trash2, Eye, Lock, FileText, WifiOff } from 'lucide-react';
import { Screen } from '../ui/Screen';
import { CopyrightNotice } from '../ui/CopyrightNotice';

interface PrivacyPolicyProps {
  onBack: () => void;
}

const IUBENDA_PRIVACY_POLICY_URL = 'https://www.iubenda.com/privacy-policy/15042123';

const highlights = [
  {
    icon: MapPin,
    title: 'Geolocalizzazione',
    desc: 'Usata solo durante i turni, con il tuo consenso esplicito.',
  },
  {
    icon: Eye,
    title: 'Dati visibili',
    desc: 'Nickname e progressi mostrati agli altri partecipanti.',
  },
  {
    icon: Lock,
    title: 'Nessuna vendita',
    desc: 'I tuoi dati non vengono venduti a terze parti.',
  },
  {
    icon: Trash2,
    title: 'Diritto alla cancellazione',
    desc: 'Puoi richiedere la rimozione del tuo account in qualsiasi momento.',
  },
];

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <Screen
      withBottomNavPadding={false}
      className="relative items-start justify-start"
      contentClassName="relative w-full flex-1 px-5 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] box-border"
    >
      <div className="flex h-full w-full flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center size-[44px] text-[#f4bf4f] shrink-0"
            aria-label="Indietro"
          >
            <ArrowLeft size={24} />
          </button>
        </div>

        {/* Title block */}
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center size-[48px] rounded-[14px] bg-[#f4bf4f]/10 shrink-0">
            <Shield size={24} className="text-[#f4bf4f]" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[22px] leading-[28px] font-bold tracking-[-0.2px] text-[#f5f5f5]">
              Privacy Policy
            </h1>
            <p className="text-[14px] leading-[20px] text-[#b8b2b3]">
              Come trattiamo i tuoi dati
            </p>
          </div>
        </div>

        {/* Highlights */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#b8b2b3]/60 px-1">
            In sintesi
          </p>
          <div className="grid grid-cols-2 gap-2">
            {highlights.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-[#1a1617] rounded-[14px] p-3.5 flex flex-col gap-2"
              >
                <div className="flex items-center justify-center size-[32px] rounded-[9px] bg-[#f4bf4f]/10">
                  <Icon size={16} className="text-[#f4bf4f]" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#f5f5f5] leading-[18px]">{title}</p>
                  <p className="text-[12px] leading-[17px] text-[#b8b2b3] mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Full document */}
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#b8b2b3]/60 px-1">
            Documento completo
          </p>
          <div className="bg-[#1a1617] rounded-[16px] overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
              <FileText size={15} className="text-[#f4bf4f]" />
              <p className="text-[13px] text-[#b8b2b3]">
                Pubblicata e mantenuta tramite{' '}
                <span className="text-[#f5f5f5] font-medium">Iubenda</span>
              </p>
            </div>
            {isOnline ? (
              <>
                <div className="p-2">
                  {/* iframe embed — no script dependency, no remount issues,
                      works on iubenda free plan. White bg matches iubenda's
                      default light-theme document. */}
                  <iframe
                    src={IUBENDA_PRIVACY_POLICY_URL}
                    className="w-full rounded-[10px] bg-white"
                    style={{ height: '55vh', border: 'none' }}
                    title="Privacy Policy"
                    loading="lazy"
                  />
                </div>
                <div className="px-4 pb-3">
                  <p className="text-[11px] leading-[16px] text-[#b8b2b3]/50">
                    Richiesta connessione internet per caricare il documento.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                <WifiOff size={32} className="text-[#b8b2b3]/50" />
                <p className="text-sm text-[#b8b2b3]">
                  La privacy policy completa non è disponibile offline. Connettiti a internet per visualizzarla.
                </p>
              </div>
            )}
          </div>
        </div>

        <CopyrightNotice />
      </div>
    </Screen>
  );
}
