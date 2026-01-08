import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '../ui/Screen';

interface TermsAndConditionsProps {
  onBack: () => void;
}

export function TermsAndConditions({ onBack }: TermsAndConditionsProps) {
  return (
    <Screen
      withBottomNavPadding={false}
      className="relative items-start justify-start"
      contentClassName="relative w-full flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] space-y-0 box-border"
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
            Termini e Condizioni
          </p>
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3]">Condizioni d’uso</p>
        </div>

        <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] p-4 flex flex-col gap-4">
          <p className="text-[14px] leading-[20px] text-[#b8b2b3] !m-0">
            Ultimo aggiornamento: 31 Dic 2025
          </p>

          <div className="flex flex-col gap-3 text-[14px] leading-[20px] text-[#b8b2b3]">
            <p className="!m-0">
              Questo documento descrive le regole di utilizzo di Turni di Palco. Il testo è una base
              iniziale e potrà essere aggiornato.
            </p>

            <div>
              <p className="text-white font-semibold !m-0">1. Account</p>
              <p className="!m-0">
                L’accesso può richiedere registrazione e autenticazione. Sei responsabile della
                riservatezza delle credenziali.
              </p>
            </div>

            <div>
              <p className="text-white font-semibold !m-0">2. Uso del servizio</p>
              <p className="!m-0">
                È vietato utilizzare il servizio per attività illecite, tentativi di abuso o
                manipolazione del sistema di ricompense.
              </p>
            </div>

            <div>
              <p className="text-white font-semibold !m-0">3. Codici e QR</p>
              <p className="!m-0">
                I codici (es. biglietti) possono essere verificati e attivati una sola volta. In caso di
                uso anomalo o duplicazioni, potremmo sospendere l’abilitazione dei codici.
              </p>
            </div>

            <div>
              <p className="text-white font-semibold !m-0">4. Modifiche</p>
              <p className="!m-0">
                Possiamo aggiornare funzionalità e contenuti. Le modifiche sostanziali verranno
                comunicate tramite l’app quando possibile.
              </p>
            </div>

            <div>
              <p className="text-white font-semibold !m-0">5. Contatti</p>
              <p className="!m-0">
                Per richieste o segnalazioni, contatta il team tramite i canali indicati nelle
                informazioni del progetto.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

