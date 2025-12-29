import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '../ui/Screen';

interface SignupProps {
  onBack: () => void;
  onSignup: (name: string, email: string, password: string) => void;
  onLogin: () => void;
}

export function Signup({ onBack, onSignup, onLogin }: SignupProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!name) newErrors.name = 'Nome richiesto';
    if (!email) newErrors.email = 'Email richiesta';
    if (!password) newErrors.password = 'Password richiesta';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Le password non corrispondono';
    if (!acceptTerms) newErrors.terms = 'Devi accettare i termini e la privacy';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSignup(name, email, password);
  };

  return (
    <Screen
      withBottomNavPadding={false}
      className="relative items-start justify-start"
      contentClassName="relative w-full max-w-[393px] flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] space-y-0 box-border"
    >
      <div className="flex h-full flex-col">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center size-[40px] text-[#f4bf4f]"
          aria-label="Indietro"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="mt-4 flex flex-col items-start gap-1">
          <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-[#f5f5f5]">
            Crea il tuo account
          </p>
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3]">
            Inizia la tua carriera teatrale
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex w-full max-w-[300px] flex-col gap-5 self-center">
          <div className="flex flex-col gap-2">
            <label className="text-[16px] leading-[24px] text-[#b8b2b3]">
              Nome visualizzato
            </label>
            <div
              className={`bg-[#241f20] border-2 ${
                errors.name ? 'border-[#ff4d4f]' : 'border-[#2d2728]'
              } rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[#f4bf4f]`}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                placeholder="Come vuoi essere chiamato"
                className="w-full h-full bg-transparent px-[10px] py-0 text-[16px] leading-[28px] text-[#f5f5f5] placeholder:text-[#7a7577] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[16px] leading-[24px] text-[#b8b2b3]">
              Email
            </label>
            <div
              className={`bg-[#241f20] border-2 ${
                errors.email ? 'border-[#ff4d4f]' : 'border-[#2d2728]'
              } rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[#f4bf4f]`}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                placeholder="tuo@email.com"
                className="w-full h-full bg-transparent px-[10px] py-0 text-[16px] leading-[28px] text-[#f5f5f5] placeholder:text-[#7a7577] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[16px] leading-[24px] text-[#b8b2b3]">
              Password
            </label>
            <div
              className={`bg-[#241f20] border-2 ${
                errors.password ? 'border-[#ff4d4f]' : 'border-[#2d2728]'
              } rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[#f4bf4f]`}
            >
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                placeholder="••••••••"
                className="w-full h-full bg-transparent px-[10px] py-0 text-[16px] leading-[28px] text-[#f5f5f5] placeholder:text-[#7a7577] focus:outline-none"
              />
            </div>
            <p className="text-[16px] leading-[25.6px] text-[#7a7577]">Almeno 8 caratteri</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[16px] leading-[24px] text-[#b8b2b3]">
              Conferma password
            </label>
            <div
              className={`bg-[#241f20] border-2 ${
                errors.confirmPassword ? 'border-[#ff4d4f]' : 'border-[#2d2728]'
              } rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[#f4bf4f]`}
            >
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
                placeholder="••••••••"
                className="w-full h-full bg-transparent px-[10px] py-0 text-[16px] leading-[28px] text-[#f5f5f5] placeholder:text-[#7a7577] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-[12px] items-start">
            <input
              id="terms"
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="bg-[#241f20] border border-[#2d2728] size-[20px] accent-[#a82847]"
            />
            <label htmlFor="terms" className="text-[14px] leading-[20px] text-[#b8b2b3]">
              Accetto i <span className="text-[#f4bf4f]">Termini e Condizioni</span> e la{' '}
              <span className="text-[#f4bf4f]">Privacy Policy</span>
            </label>
          </div>

          <button
            type="submit"
            className="bg-gradient-to-b from-[#8c1c38] to-[#a82847] h-[44px] w-full rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)]"
          >
            <span className="block text-[18px] leading-[28px] text-center text-white">
              Registrati
            </span>
          </button>
        </form>

        <div className="mt-auto pt-6 text-center">
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3]">Hai già un account?</p>
          <button
            type="button"
            onClick={onLogin}
            className="text-[16px] leading-[25.6px] text-[#f4bf4f]"
          >
            Accedi
          </button>
        </div>
      </div>
    </Screen>
  );
}
