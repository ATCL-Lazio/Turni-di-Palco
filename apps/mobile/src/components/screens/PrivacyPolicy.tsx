import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Shield, MapPin, Trash2, Eye, Lock, FileText, WifiOff, Sparkles,
  Building2, Database, Users, Clock, Baby, Scale, Cookie, Accessibility,
} from 'lucide-react';
import { Screen } from '../ui/Screen';
import { CopyrightNotice } from '../ui/CopyrightNotice';

interface PrivacyPolicyProps {
  onBack: () => void;
}

const IUBENDA_PRIVACY_POLICY_URL = 'https://www.iubenda.com/privacy-policy/15042123';

// Dati del titolare — fonte: privacy policy ATCL su Iubenda + comunicazioni ATCL.
const CONTROLLER = {
  name: 'A.T.C.L. – Associazione Teatrale fra i Comuni del Lazio',
  address: 'Via della Vasca Navale 56/58, 00146 Roma (Italia)',
  pec: 'atcl@pec.atcllazio.it',
  privacyEmail: 'privacy@atcllazio.it',
  dpo: 'Alessandra Caruso',
} as const;

const LAST_UPDATED = '2 luglio 2026';

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
  {
    icon: Sparkles,
    title: 'Assistente AI',
    desc: 'Il supporto "Maxwell" è un sistema di IA: ti avvisiamo sempre quando lo usi.',
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
            <p className="text-[12px] leading-[16px] text-[#b8b2b3]/60">
              Ultimo aggiornamento: {LAST_UPDATED}
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

        {/* Intelligenza Artificiale — EU AI Act (Reg. UE 2024/1689) Art. 50 */}
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#b8b2b3]/60 px-1">
            Intelligenza artificiale
          </p>
          <div className="bg-[#1a1617] rounded-[16px] p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center size-[36px] rounded-[10px] bg-[#f4bf4f]/10 shrink-0">
                <Sparkles size={18} className="text-[#f4bf4f]" />
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-[14px] font-semibold text-[#f5f5f5] leading-[19px]">
                  Assistente "Maxwell"
                </p>
                <p className="text-[12px] leading-[17px] text-[#b8b2b3]">
                  In conformità al Regolamento UE 2024/1689 (AI Act)
                </p>
              </div>
            </div>
            <p className="text-[13px] leading-[19px] text-[#b8b2b3]">
              Il supporto è gestito da <span className="text-[#f5f5f5] font-medium">Maxwell</span>,
              un assistente conversazionale basato su intelligenza artificiale. Ti
              informiamo sempre quando stai interagendo con l'IA e le sue risposte
              sono chiaramente indicate come generate automaticamente.
            </p>
            <ul className="flex flex-col gap-2 text-[13px] leading-[19px] text-[#b8b2b3]">
              <li className="flex gap-2">
                <span className="text-[#f4bf4f]">•</span>
                Le risposte possono contenere imprecisioni: verifica sempre le informazioni importanti.
              </li>
              <li className="flex gap-2">
                <span className="text-[#f4bf4f]">•</span>
                Non vengono prese decisioni automatizzate con effetti giuridici o significativi sul tuo account.
              </li>
              <li className="flex gap-2">
                <span className="text-[#f4bf4f]">•</span>
                I messaggi che invii vengono usati solo per generare la risposta ed eventuali segnalazioni di supporto.
              </li>
              <li className="flex gap-2">
                <span className="text-[#f4bf4f]">•</span>
                Puoi sempre richiedere assistenza a un operatore umano.
              </li>
            </ul>
          </div>
        </div>

        {/* Titolare del trattamento e DPO — GDPR Art. 13 */}
        <LegalSection icon={Building2} title="Titolare del trattamento">
          <p className="text-[13px] leading-[19px] text-[#b8b2b3]">
            Il titolare del trattamento è <span className="text-[#f5f5f5] font-medium">{CONTROLLER.name}</span>,
            {' '}{CONTROLLER.address}.
          </p>
          <ul className="flex flex-col gap-1.5 text-[13px] leading-[19px] text-[#b8b2b3]">
            <li>PEC: <span className="text-[#f5f5f5]">{CONTROLLER.pec}</span></li>
            <li>Email privacy: <span className="text-[#f5f5f5]">{CONTROLLER.privacyEmail}</span></li>
            <li>Responsabile della protezione dei dati (DPO/RPD): <span className="text-[#f5f5f5]">{CONTROLLER.dpo}</span> — {CONTROLLER.privacyEmail}</li>
          </ul>
        </LegalSection>

        {/* Dati raccolti, finalità e base giuridica — GDPR Art. 13 */}
        <LegalSection icon={Database} title="Dati che trattiamo e perché">
          <ul className="flex flex-col gap-2 text-[13px] leading-[19px] text-[#b8b2b3]">
            <Bullet>
              <b className="text-[#f5f5f5] font-medium">Dati account</b> (nome visualizzato, email, password, ruolo, foto profilo) — per creare e gestire il tuo account. Base giuridica: esecuzione del contratto (Art. 6.1.b).
            </Bullet>
            <Bullet>
              <b className="text-[#f5f5f5] font-medium">Data di nascita</b> — usata solo al momento della registrazione per verificare l'età minima (14 anni) e non conservata.
            </Bullet>
            <Bullet>
              <b className="text-[#f5f5f5] font-medium">Geolocalizzazione</b> — raccolta solo durante la registrazione dei turni, previo consenso esplicito (Art. 6.1.a). Puoi revocarlo in ogni momento.
            </Bullet>
            <Bullet>
              <b className="text-[#f5f5f5] font-medium">Dati di gioco</b> (progressi, turni, badge, classifica) — per il funzionamento del servizio. Base giuridica: contratto.
            </Bullet>
            <Bullet>
              <b className="text-[#f5f5f5] font-medium">Statistiche d'uso</b> — pseudonimizzate e raccolte solo con il tuo consenso analytics (Art. 6.1.a).
            </Bullet>
          </ul>
        </LegalSection>

        {/* Destinatari, sub-responsabili e trasferimenti — GDPR Artt. 28, 44-49 */}
        <LegalSection icon={Users} title="Destinatari e trasferimenti">
          <p className="text-[13px] leading-[19px] text-[#b8b2b3]">
            Non vendiamo i tuoi dati. Ci avvaliamo di fornitori che trattano i dati per nostro conto (responsabili del trattamento):
          </p>
          <ul className="flex flex-col gap-2 text-[13px] leading-[19px] text-[#b8b2b3]">
            <Bullet><b className="text-[#f5f5f5] font-medium">Supabase</b> — database, autenticazione e archiviazione.</Bullet>
            <Bullet><b className="text-[#f5f5f5] font-medium">Vercel</b> — hosting dell'applicazione e delle API.</Bullet>
            <Bullet><b className="text-[#f5f5f5] font-medium">Render</b> — servizio dell'assistente AI "Maxwell".</Bullet>
            <Bullet><b className="text-[#f5f5f5] font-medium">GitHub</b> — gestione delle segnalazioni di supporto.</Bullet>
            <Bullet><b className="text-[#f5f5f5] font-medium">Iubenda</b> — pubblicazione della documentazione privacy.</Bullet>
          </ul>
          <p className="text-[13px] leading-[19px] text-[#b8b2b3]">
            Alcuni fornitori possono trattare i dati al di fuori dell'UE/SEE: in tal caso il trasferimento è
            regolato da garanzie adeguate ai sensi degli Artt. 44-49 GDPR (es. Clausole Contrattuali Standard).
          </p>
        </LegalSection>

        {/* Conservazione — GDPR Art. 5.1.e */}
        <LegalSection icon={Clock} title="Per quanto tempo li conserviamo">
          <p className="text-[13px] leading-[19px] text-[#b8b2b3]">
            Conserviamo i dati per il tempo necessario alle finalità indicate e agli obblighi di legge.
            I dati del tuo account e quelli associati vengono cancellati quando ne richiedi l'eliminazione
            o dopo un periodo prolungato di inattività dell'account.
          </p>
        </LegalSection>

        {/* Minori — GDPR Art. 8 */}
        <LegalSection icon={Baby} title="Minori">
          <p className="text-[13px] leading-[19px] text-[#b8b2b3]">
            Il servizio è rivolto a persone di almeno <span className="text-[#f5f5f5] font-medium">14 anni</span>,
            età del consenso digitale in Italia (D.Lgs. 101/2018). Alla registrazione verifichiamo l'età e
            non consentiamo l'iscrizione agli under-14. Se ritieni che un minore di 14 anni si sia registrato,
            scrivici a {CONTROLLER.privacyEmail} e provvederemo.
          </p>
        </LegalSection>

        {/* Diritti dell'interessato — GDPR Artt. 15-22 */}
        <LegalSection icon={Scale} title="I tuoi diritti">
          <p className="text-[13px] leading-[19px] text-[#b8b2b3]">
            Puoi esercitare in ogni momento i diritti di accesso, rettifica, cancellazione, limitazione,
            opposizione e portabilità, e revocare i consensi prestati. Dall'app puoi scaricare i tuoi dati
            ed eliminare l'account. Per richieste: {CONTROLLER.privacyEmail}.
          </p>
          <p className="text-[13px] leading-[19px] text-[#b8b2b3]">
            Hai inoltre il diritto di proporre reclamo al <span className="text-[#f5f5f5] font-medium">Garante per la protezione dei dati personali</span> (garanteprivacy.it).
          </p>
        </LegalSection>

        {/* Cookie e archiviazione locale — ePrivacy */}
        <LegalSection icon={Cookie} title="Cookie e archiviazione locale">
          <p className="text-[13px] leading-[19px] text-[#b8b2b3]">
            Usiamo solo cookie/archiviazione tecnica necessari al funzionamento (sessione, preferenze,
            consensi). Le statistiche d'uso sono attivate solo con un consenso separato e revocabile,
            gestibile da "Gestisci account → Privacy". Non usiamo cookie di profilazione pubblicitaria.
          </p>
        </LegalSection>

        {/* Dichiarazione di accessibilità */}
        <LegalSection icon={Accessibility} title="Accessibilità">
          <p className="text-[13px] leading-[19px] text-[#b8b2b3]">
            Ci impegniamo a rendere l'applicazione accessibile e a migliorarla continuamente, ispirandoci
            alle Linee guida WCAG 2.1 livello AA. Se incontri barriere o difficoltà d'uso, segnalacelo a
            {' '}{CONTROLLER.privacyEmail}: interverremo per trovare una soluzione.
          </p>
        </LegalSection>

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

// === Helpers ===

function LegalSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#b8b2b3]/60 px-1">
        {title}
      </p>
      <div className="bg-[#1a1617] rounded-[16px] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-center size-[36px] rounded-[10px] bg-[#f4bf4f]/10">
          <Icon size={18} className="text-[#f4bf4f]" />
        </div>
        {children}
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-[#f4bf4f]">•</span>
      <span>{children}</span>
    </li>
  );
}
