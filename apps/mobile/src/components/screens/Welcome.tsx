import React from 'react';
import { Screen } from '../ui/Screen';
import welcomeLogo from '../../assets/figma/welcome-logo.svg';

interface WelcomeProps {
  onStart: () => void;
  onLogin: () => void;
}

export function Welcome({ onStart, onLogin }: WelcomeProps) {
  return (
    <Screen
      withBottomNavPadding={false}
      className="relative items-start justify-start h-[100dvh] overflow-hidden"
      contentClassName="relative w-full flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] space-y-0 box-border"
    >
      <div className="relative flex h-full flex-col items-center text-center">
        <WelcomeBranding />

        <div className="animate-stagger-4 mt-6 mb-5 w-full max-w-[300px] bg-[#1a1617] border border-[#2d2728] rounded-2xl px-4 py-3">
          <p className="!m-0 text-sm leading-relaxed text-center text-[#7a7577]">
            Simula la carriera di un professionista del teatro e registra la tua
            partecipazione agli eventi reali ATCL scansionando il QR sul biglietto.
          </p>
        </div>

        <div className="mt-auto w-full flex flex-col items-center gap-3 pb-3">
          <WelcomeButton variant="primary" onClick={onStart} className="animate-stagger-5">
            Inizia
          </WelcomeButton>
          <WelcomeButton variant="secondary" onClick={onLogin} className="animate-stagger-6">
            Accedi
          </WelcomeButton>
        </div>
      </div>
    </Screen>
  );
}

function WelcomeBranding() {
  return (
    <div className="flex flex-col items-center gap-5 pt-3">
      <div className="animate-stagger-1 animate-float welcome-logo-pulse bg-gradient-to-b from-[#a82847] to-[#6b1529] rounded-[28px] size-[120px] flex items-center justify-center ring-1 ring-[#a82847]/30">
        <img alt="" className="size-[60px]" src={welcomeLogo} />
      </div>
      <div className="flex flex-col items-center gap-2">
        <p
          className="animate-stagger-2 text-[32px] leading-[1.2] font-bold tracking-[-0.02em] text-transparent bg-clip-text"
          style={{
            WebkitTextFillColor: 'transparent',
            backgroundImage: 'linear-gradient(180deg, rgba(244, 191, 79, 1) 0%, rgba(230, 162, 60, 1) 100%)',
          }}
        >
          Turni di Palco
        </p>
        <p className="animate-stagger-3 text-[11px] leading-none text-[#7a7577] tracking-[0.14em] uppercase font-semibold">
          Costruisci la tua carriera a teatro
        </p>
      </div>
    </div>
  );
}

function WelcomeButton({
  variant,
  onClick,
  className = '',
  children,
}: {
  variant: 'primary' | 'secondary';
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const styles = variant === 'primary'
    ? 'bg-gradient-to-b from-[#a82847] to-[#8c1c38] shadow-[0_4px_20px_rgba(168,40,71,0.35)] active:shadow-none text-white'
    : 'border border-[#2d2728] bg-[#1a1617] active:bg-[#241f20] text-[#f4bf4f]';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[50px] w-full max-w-[300px] rounded-2xl active:scale-[0.98] transition-all duration-150 ${styles} ${className}`}
    >
      <span className="block text-[17px] font-semibold leading-none">{children}</span>
    </button>
  );
}
