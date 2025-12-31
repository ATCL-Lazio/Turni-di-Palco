import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '../ui/Screen';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  return (
    <Screen
      withBottomNavPadding={false}
      className="relative items-start justify-start"
      contentClassName="relative w-full max-w-[393px] flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] space-y-0 box-border"
    >
      <div className="flex h-full w-full flex-col gap-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center size-[44px] text-[#f4bf4f]"
          aria-label="Indietro"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="flex flex-col items-start gap-1">
          <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-[#f5f5f5]">
            Privacy Policy
          </p>
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3]">Informativa sul trattamento dati</p>
        </div>

        <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] p-4 flex flex-col gap-4">
          <p className="text-[14px] leading-[20px] text-[#b8b2b3] !m-0">
            Ultimo aggiornamento: 31 Dic 2025
          </p>

          <div className="flex flex-col gap-3 text-[14px] leading-[20px] text-[#b8b2b3]">
            <p className="!m-0">
              Questa informativa descrive in modo sintetico quali dati vengono trattati e per quali
              finalità. Il testo è una base iniziale e potrà essere aggiornato.
            </p>

            <div>
              <p className="text-white font-semibold !m-0">1. Dati trattati</p>
              <p className="!m-0">
                Possiamo trattare dati di account (es. email, nome), dati di gioco (turni, ricompense,
                progressi) e dati tecnici necessari al funzionamento (es. sessione).
              </p>
            </div>

            <div>
              <p className="text-white font-semibold !m-0">2. Finalità</p>
              <p className="!m-0">
                Utilizziamo i dati per autenticazione, sincronizzazione dei progressi, prevenzione di
                abusi (es. codici duplicati) e miglioramento dell’esperienza.
              </p>
            </div>

            <div>
              <p className="text-white font-semibold !m-0">3. Conservazione</p>
              <p className="!m-0">
                Conserviamo i dati per il tempo necessario a fornire il servizio e per esigenze di
                sicurezza e integrità del sistema.
              </p>
            </div>

            <div>
              <p className="text-white font-semibold !m-0">4. Diritti</p>
              <p className="!m-0">
                Puoi richiedere accesso, rettifica o cancellazione dei dati. Le modalità operative
                verranno rese disponibili nelle impostazioni dell’account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

