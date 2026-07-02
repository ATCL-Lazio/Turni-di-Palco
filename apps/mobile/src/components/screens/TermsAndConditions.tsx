import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '../ui/Screen';
import { CopyrightNotice } from '../ui/CopyrightNotice';

interface TermsAndConditionsProps {
  onBack: () => void;
}

const LAST_UPDATED = '2 luglio 2026';
const CONTROLLER_NAME = 'A.T.C.L. – Associazione Teatrale fra i Comuni del Lazio';
const PRIVACY_EMAIL = 'privacy@atcllazio.it';

type Section = { title: string; body: React.ReactNode };

const SECTIONS: Section[] = [
  {
    title: '1. Titolare e oggetto',
    body: (
      <>
        Turni di Palco è un servizio digitale di {CONTROLLER_NAME} (di seguito “ATCL”),
        con sede in Via della Vasca Navale 56/58, 00146 Roma. I presenti Termini regolano
        l’uso dell’applicazione.
      </>
    ),
  },
  {
    title: '2. Requisiti di età',
    body: (
      <>
        Per registrarti devi avere almeno <b className="text-white">14 anni</b> (età del
        consenso digitale in Italia, D.Lgs. 101/2018). Al momento della registrazione ti
        viene chiesto di indicare la data di nascita per verificare tale requisito.
      </>
    ),
  },
  {
    title: '3. Account',
    body: (
      <>
        L’accesso richiede registrazione e autenticazione. Sei responsabile della
        riservatezza delle tue credenziali e delle attività svolte tramite il tuo account.
        Fornisci informazioni veritiere e aggiornate.
      </>
    ),
  },
  {
    title: '4. Uso del servizio',
    body: (
      <>
        È vietato utilizzare il servizio per attività illecite, per tentativi di abuso o per
        manipolare il sistema di ricompense (XP, badge, classifica). ATCL può adottare misure
        proporzionate in caso di uso anomalo.
      </>
    ),
  },
  {
    title: '5. Codici e QR',
    body: (
      <>
        I codici (es. biglietti) possono essere verificati e attivati una sola volta. In caso
        di uso anomalo o duplicazioni potremmo sospendere l’abilitazione dei codici.
      </>
    ),
  },
  {
    title: '6. Assistente AI “Maxwell”',
    body: (
      <>
        Il supporto è fornito da un assistente basato su intelligenza artificiale, segnalato
        come tale. Le risposte possono contenere imprecisioni e non costituiscono decisioni
        automatizzate con effetti giuridici sul tuo account. Puoi sempre rivolgerti a un
        operatore umano.
      </>
    ),
  },
  {
    title: '7. Proprietà intellettuale',
    body: (
      <>
        Il software, i contenuti, i marchi e la grafica di Turni di Palco sono di proprietà di
        ATCL o dei rispettivi titolari e sono protetti dalla legge. Ti è concessa una licenza
        d’uso personale, non esclusiva e non trasferibile, limitata alla fruizione del servizio.
      </>
    ),
  },
  {
    title: '8. Limitazione di responsabilità',
    body: (
      <>
        Il servizio è fornito “così com’è”. Nei limiti consentiti dalla legge, ATCL non risponde
        per interruzioni, indisponibilità temporanee o dati inseriti dagli utenti. Nulla in questi
        Termini esclude responsabilità non derogabili per legge, inclusi i diritti dei consumatori.
      </>
    ),
  },
  {
    title: '9. Modifiche',
    body: (
      <>
        Possiamo aggiornare funzionalità, contenuti e questi Termini. Le modifiche sostanziali
        verranno comunicate tramite l’app quando possibile.
      </>
    ),
  },
  {
    title: '10. Recesso e cancellazione',
    body: (
      <>
        Puoi smettere di usare il servizio ed eliminare il tuo account in qualsiasi momento dalle
        impostazioni dell’account. Il trattamento dei dati è descritto nella Privacy Policy.
      </>
    ),
  },
  {
    title: '11. Legge applicabile e foro',
    body: (
      <>
        I presenti Termini sono regolati dalla legge italiana. Per le controversie con i consumatori
        è competente il foro del luogo di residenza o domicilio dell’utente, se situato in Italia;
        negli altri casi è competente il foro di Roma.
      </>
    ),
  },
  {
    title: '12. Contatti',
    body: (
      <>
        Per richieste o segnalazioni puoi scrivere a {PRIVACY_EMAIL}.
      </>
    ),
  },
];

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
            Ultimo aggiornamento: {LAST_UPDATED}
          </p>

          <div className="flex flex-col gap-3 text-[14px] leading-[20px] text-[#b8b2b3]">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <p className="text-white font-semibold !m-0">{section.title}</p>
                <p className="!m-0">{section.body}</p>
              </div>
            ))}
          </div>
        </div>

        <CopyrightNotice />
      </div>
    </Screen>
  );
}
