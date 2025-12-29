import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '../ui/Screen';

interface LoginProps {
  onBack: () => void;
  onLogin: (email: string, password: string) => void;
  onSignup: () => void;
  onForgotPassword: () => void;
}

export function Login({ onBack, onLogin, onSignup, onForgotPassword }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({ email: '', password: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = { email: '', password: '' };
    if (!email) newErrors.email = 'Email richiesta';
    if (!password) newErrors.password = 'Password richiesta';

    if (newErrors.email || newErrors.password) {
      setErrors(newErrors);
      return;
    }

    onLogin(email, password);
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
            Accedi
          </p>
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3]">
            Inizia la tua carriera teatrale
          </p>
        </div>

        <form onSubmit={handleSubmit} className="absolute inset-0">
          <div className="absolute flex flex-col h-[52px] items-start left-[calc(50%+0.5px)] top-[calc(50%-74px)] translate-x-[-50%] translate-y-[-50%] w-[300px]">
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

          <div className="absolute flex flex-col h-[78px] items-start left-[calc(50%+0.5px)] top-[calc(50%+40px)] translate-x-[-50%] translate-y-[-50%] w-[300px]">
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
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                placeholder="••••••••"
                className="w-full bg-transparent px-[10px] text-[16px] leading-[normal] text-[#f5f5f5] placeholder:text-[#7a7577] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={onForgotPassword}
              className="pt-[10px] text-[16px] leading-[25.6px] text-[#f4bf4f]"
            >
              Password dimenticata?
            </button>
          </div>

          <button
            type="submit"
            className="absolute bg-gradient-to-b from-[#8c1c38] to-[#a82847] h-[28px] left-[calc(50%+0.5px)] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] top-[calc(50%+273px)] translate-x-[-50%] translate-y-[-50%] w-[300px]"
          >
            <span className="block text-[18px] leading-[28px] text-center text-white">
              Accedi
            </span>
          </button>
        </form>

        <div className="absolute bottom-[47px] h-[75px] left-1/2 translate-x-[-50%] w-[393px] text-center">
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3]">
            Non hai un account?
          </p>
          <button
            type="button"
            onClick={onSignup}
            className="text-[16px] leading-[25.6px] text-[#f4bf4f]"
          >
            Registrati
          </button>
        </div>
      </div>
    </Screen>
  );
}
