import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '../ui/Screen';

interface LoginProps {
  onBack: () => void;
  onLogin: (email: string, password: string) => void;
  onSignup: () => void;
  onForgotPassword: () => void;
  errorMessage?: string | null;
}

export function Login({ onBack, onLogin, onSignup, onForgotPassword, errorMessage }: LoginProps) {
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
            Accedi
          </p>
          <p className="text-[16px] leading-[25.6px] text-[#aeaeb2]">
            Inizia la tua carriera teatrale
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          method="post"
          action="/login"
          autoComplete="on"
          className="mt-8 flex w-full max-w-[300px] flex-col gap-6 mx-auto"
        >
          <div className="flex flex-col gap-2 w-full">
            <label htmlFor="login-email" className="text-[16px] leading-[24px] text-[#aeaeb2]">
              Email
            </label>
            <div
              className={`bg-[#2c2c2e] border-2 ${
                errors.email ? 'border-[#ff453a]' : 'border-[#3a3a3c]'
              } rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[#0a84ff]`}
            >
              <input
                id="login-email"
                name="username"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={Boolean(errors.email)}
                placeholder="tuo@email.com"
                enterKeyHint="next"
                className="w-full h-full bg-transparent px-[10px] py-0 text-[16px] leading-[28px] text-[#f2f2f7] placeholder:text-[#8e8e93] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <label htmlFor="login-password" className="text-[16px] leading-[24px] text-[#aeaeb2]">
              Password
            </label>
            <div
              className={`bg-[#2c2c2e] border-2 ${
                errors.password ? 'border-[#ff453a]' : 'border-[#3a3a3c]'
              } rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[#0a84ff]`}
            >
              <input
                id="login-password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                placeholder="••••••••"
                enterKeyHint="go"
                className="w-full h-full bg-transparent px-[10px] py-0 text-[16px] leading-[28px] text-[#f2f2f7] placeholder:text-[#8e8e93] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={onForgotPassword}
              className="self-start rounded-md px-2 py-[10px] mt-2 text-[16px] leading-[25.6px] text-[#0a84ff]"
            >
              Password dimenticata?
            </button>
          </div>

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
              Accedi
            </span>
          </button>
        </form>

        <div className="mt-auto pt-6 text-center">
          <p className="text-[16px] leading-[25.6px] text-[#aeaeb2]">
            Non hai un account?
          </p>
          <button
            type="button"
            onClick={onSignup}
            className="inline-flex items-center justify-center rounded-md px-2 py-[10px] text-[16px] leading-[25.6px] text-[#0a84ff]"
          >
            Registrati
          </button>
        </div>
      </div>
    </Screen>
  );
}

