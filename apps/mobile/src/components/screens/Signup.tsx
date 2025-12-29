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
      contentClassName="relative w-full max-w-[393px] h-[852px] px-0 pt-0 pb-0 space-y-0"
    >
      <div className="relative w-full h-full">
        <button
          type="button"
          onClick={onBack}
          className="absolute content-stretch flex items-center left-[27px] p-0 size-[40px] top-[56px] text-[#f4bf4f]"
          aria-label="Indietro"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="absolute flex flex-col h-[57px] items-start left-[calc(50%+0.5px)] top-[calc(50%-279.5px)] translate-x-[-50%] translate-y-[-50%] w-[222px]">
          <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-[#f5f5f5]">
            Crea il tuo account
          </p>
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3]">
            Inizia la tua carriera teatrale
          </p>
        </div>

        <form onSubmit={handleSubmit} className="absolute inset-0">
          <div className="absolute flex flex-col h-[52px] items-start left-[calc(50%+0.5px)] top-[calc(50%-203.5px)] translate-x-[-50%] translate-y-[-50%] w-[300px]">
            <label className="h-[24px] text-[16px] leading-[24px] text-[#b8b2b3]">
              Nome visualizzato
            </label>
            <div
              className={`bg-[#241f20] border-2 ${
                errors.name ? 'border-[#ff4d4f]' : 'border-[#2d2728]'
              } rounded-[10px] flex h-[28px] items-center overflow-clip w-full transition-colors focus-within:border-[#f4bf4f]`}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                placeholder="Come vuoi essere chiamato"
                className="w-full bg-transparent px-[10px] text-[16px] leading-[normal] text-[#f5f5f5] placeholder:text-[#7a7577] focus:outline-none"
              />
            </div>
          </div>

          <div className="absolute flex flex-col h-[52px] items-start left-[calc(50%+0.5px)] top-[calc(50%-113.5px)] translate-x-[-50%] translate-y-[-50%] w-[300px]">
            <label className="h-[24px] text-[16px] leading-[24px] text-[#b8b2b3]">
              Email
            </label>
            <div
              className={`bg-[#241f20] border-2 ${
                errors.email ? 'border-[#ff4d4f]' : 'border-[#2d2728]'
              } rounded-[10px] flex h-[28px] items-center overflow-clip w-full transition-colors focus-within:border-[#f4bf4f]`}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                placeholder="tuo@email.com"
                className="w-full bg-transparent px-[10px] text-[16px] leading-[normal] text-[#f5f5f5] placeholder:text-[#7a7577] focus:outline-none"
              />
            </div>
          </div>

          <div className="absolute flex flex-col h-[78px] items-start left-[calc(50%+0.5px)] top-[calc(50%-0.5px)] translate-x-[-50%] translate-y-[-50%] w-[300px]">
            <label className="h-[24px] text-[16px] leading-[24px] text-[#b8b2b3]">
              Password
            </label>
            <div
              className={`bg-[#241f20] border-2 ${
                errors.password ? 'border-[#ff4d4f]' : 'border-[#2d2728]'
              } rounded-[10px] flex h-[28px] items-center overflow-clip w-full transition-colors focus-within:border-[#f4bf4f]`}
            >
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                placeholder="••••••••"
                className="w-full bg-transparent px-[10px] text-[16px] leading-[normal] text-[#f5f5f5] placeholder:text-[#7a7577] focus:outline-none"
              />
            </div>
            <p className="text-[16px] leading-[25.6px] text-[#7a7577]">Almeno 8 caratteri</p>
          </div>

          <div className="absolute flex flex-col h-[52px] items-start left-[calc(50%+0.5px)] top-[calc(50%+114.5px)] translate-x-[-50%] translate-y-[-50%] w-[300px]">
            <label className="h-[24px] text-[16px] leading-[24px] text-[#b8b2b3]">
              Conferma password
            </label>
            <div
              className={`bg-[#241f20] border-2 ${
                errors.confirmPassword ? 'border-[#ff4d4f]' : 'border-[#2d2728]'
              } rounded-[10px] flex h-[28px] items-center overflow-clip w-full transition-colors focus-within:border-[#f4bf4f]`}
            >
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
                placeholder="••••••••"
                className="w-full bg-transparent px-[10px] text-[16px] leading-[normal] text-[#f5f5f5] placeholder:text-[#7a7577] focus:outline-none"
              />
            </div>
          </div>

          <div className="absolute flex gap-[12px] h-[20px] items-start left-[calc(50%+0.5px)] top-[calc(50%+176.5px)] translate-x-[-50%] translate-y-[-50%] w-[300px]">
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
            className="absolute bg-gradient-to-b from-[#8c1c38] to-[#a82847] h-[28px] left-[calc(50%+0.5px)] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] top-[calc(50%+233.5px)] translate-x-[-50%] translate-y-[-50%] w-[300px]"
          >
            <span className="block text-[18px] leading-[28px] text-center text-white">
              Registrati
            </span>
          </button>
        </form>

        <div className="absolute bottom-[47px] h-[75px] left-1/2 translate-x-[-50%] w-[393px] text-center">
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
