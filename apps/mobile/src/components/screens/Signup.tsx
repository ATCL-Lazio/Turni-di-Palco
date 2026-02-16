import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '../ui/Screen';

interface SignupProps {
  onBack: () => void;
  onSignup: (name: string, email: string, password: string) => void;
  onLogin: () => void;
  onViewTerms: () => void;
  onViewPrivacy: () => void;
  errorMessage?: string | null;
}

export function Signup({
  onBack,
  onSignup,
  onLogin,
  onViewTerms,
  onViewPrivacy,
  errorMessage
}: SignupProps) {
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
      contentClassName="relative w-full flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] space-y-0 box-border"
    >
      <div className="flex h-full flex-col">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center size-[44px] text-[#0a84ff]"
          aria-label="Indietro"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="mt-4 flex flex-col items-start gap-1">
          <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-[#f2f2f7]">
            Crea il tuo account
          </p>
          <p className="text-[16px] leading-[25.6px] text-[#aeaeb2]">
            Inizia la tua carriera teatrale
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex w-full max-w-[300px] flex-col gap-6 mx-auto">
          <div className="flex flex-col gap-2 w-full">
            <label className="text-[16px] leading-[24px] text-[#aeaeb2]">
              Nome visualizzato
            </label>
            <div
              className={`bg-[#2c2c2e] border-2 ${
                errors.name ? 'border-[#ff453a]' : 'border-[#3a3a3c]'
              } rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[#0a84ff]`}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                placeholder="Come vuoi essere chiamato"
                className="w-full h-full bg-transparent px-[10px] py-0 text-[16px] leading-[28px] text-[#f2f2f7] placeholder:text-[#8e8e93] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <label className="text-[16px] leading-[24px] text-[#aeaeb2]">
              Email
            </label>
            <div
              className={`bg-[#2c2c2e] border-2 ${
                errors.email ? 'border-[#ff453a]' : 'border-[#3a3a3c]'
              } rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[#0a84ff]`}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                placeholder="tuo@email.com"
                className="w-full h-full bg-transparent px-[10px] py-0 text-[16px] leading-[28px] text-[#f2f2f7] placeholder:text-[#8e8e93] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col gap-2 w-full">
              <label className="text-[16px] leading-[24px] text-[#aeaeb2]">
                Password
              </label>
              <div
                className={`bg-[#2c2c2e] border-2 ${
                  errors.password ? 'border-[#ff453a]' : 'border-[#3a3a3c]'
                } rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[#0a84ff]`}
              >
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.password)}
                  placeholder="••••••••"
                  className="w-full h-full bg-transparent px-[10px] py-0 text-[16px] leading-[28px] text-[#f2f2f7] placeholder:text-[#8e8e93] focus:outline-none"
                />
              </div>
              <p className="mt-2 !mb-0 text-[16px] leading-[25.6px] text-[#8e8e93]">Almeno 8 caratteri</p>
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label className="text-[16px] leading-[24px] text-[#aeaeb2]">
                Conferma password
              </label>
              <div
                className={`bg-[#2c2c2e] border-2 ${
                  errors.confirmPassword ? 'border-[#ff453a]' : 'border-[#3a3a3c]'
                } rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[#0a84ff]`}
              >
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  placeholder="••••••••"
                  className="w-full h-full bg-transparent px-[10px] py-0 text-[16px] leading-[28px] text-[#f2f2f7] placeholder:text-[#8e8e93] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <label htmlFor="terms" className="flex gap-[12px] items-start rounded-md py-[6px] text-[14px] leading-[20px] text-[#aeaeb2]">
            <input
              id="terms"
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="bg-[#2c2c2e] border border-[#3a3a3c] size-[24px] accent-[#0a84ff]"
            />
            <span>
              Accetto i{' '}
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onViewTerms();
                }}
                className="text-[#0a84ff] underline underline-offset-2"
              >
                Termini e Condizioni
              </button>{' '}
              e la{' '}
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onViewPrivacy();
                }}
                className="text-[#0a84ff] underline underline-offset-2"
              >
                Privacy Policy
              </button>
            </span>
          </label>

          {errorMessage && (
            <p className="text-[14px] leading-[20px] text-[#ff453a] text-center">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            className="bg-gradient-to-b from-[#0066d6] to-[#0a84ff] h-[44px] w-full rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)]"
          >
            <span className="block text-[18px] leading-[28px] text-center text-white">
              Registrati
            </span>
          </button>
        </form>

        <div className="mt-auto pt-6 text-center">
          <p className="text-[16px] leading-[25.6px] text-[#aeaeb2]">Hai già un account?</p>
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex items-center justify-center rounded-md px-2 py-[10px] text-[16px] leading-[25.6px] text-[#0a84ff]"
          >
            Accedi
          </button>
        </div>
      </div>
    </Screen>
  );
}

