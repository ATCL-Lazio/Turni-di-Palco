import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '../ui/Screen';

interface PrivacyPolicyProps {
  onBack: () => void;
}

const IUBENDA_PRIVACY_POLICY_URL = 'https://www.iubenda.com/privacy-policy/78603233';
const IUBENDA_SCRIPT_SRC = 'https://cdn.iubenda.com/iubenda.js';
const IUBENDA_ANCHOR_CLASSES =
  'iubenda-nostyle no-brand iubenda-noiframe iubenda-embed iubenda-noiframe iub-body-embed';

function ensureIubendaScript() {
  if (typeof document === 'undefined') return;

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${IUBENDA_SCRIPT_SRC}"]`);
  if (existing) return;

  const script = document.createElement('script');
  script.src = IUBENDA_SCRIPT_SRC;
  script.async = true;
  document.body.appendChild(script);
}

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  useEffect(() => {
    ensureIubendaScript();
  }, []);

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
          className="flex items-center justify-center size-[44px] text-[#0a84ff]"
          aria-label="Indietro"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="flex flex-col items-start gap-1">
          <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-[#f2f2f7]">
            Privacy Policy
          </p>
          <p className="text-[16px] leading-[25.6px] text-[#aeaeb2]">Informativa sul trattamento dati</p>
        </div>

        <div className="bg-[#1c1c1e] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] p-4 flex flex-col gap-4">
          <p className="text-[14px] leading-[20px] text-[#aeaeb2] !m-0">
            Lâ€™informativa completa sulla privacy Ã¨ pubblicata e mantenuta tramite Iubenda.
          </p>

          <div className="legal-embed">
            <a href={IUBENDA_PRIVACY_POLICY_URL} className={IUBENDA_ANCHOR_CLASSES} title="Privacy Policy">
              Privacy Policy
            </a>
          </div>

          <p className="text-[12px] leading-[18px] text-[#aeaeb2] !m-0">
            Nota: Ã¨ necessaria una connessione internet per caricare il documento.
          </p>
        </div>
      </div>
    </Screen>
  );
}


