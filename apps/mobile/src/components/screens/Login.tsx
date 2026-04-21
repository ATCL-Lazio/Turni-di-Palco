import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '../ui/Screen';
import { FormField, FormInput, AuthFormLayout } from '../ui/FormField';
import { Button } from '../ui/Button';

interface LoginProps {
  onBack: () => void;
  onLogin: (email: string, password: string) => void | Promise<void>;
  onSignup: () => void;
  onForgotPassword: () => void;
  errorMessage?: string | null;
}

export function Login({ onBack, onLogin, onSignup, onForgotPassword, errorMessage }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = { email: '', password: '' };
    if (!email) newErrors.email = 'Email richiesta';
    if (!password) newErrors.password = 'Password richiesta';
    if (newErrors.email || newErrors.password) { setErrors(newErrors); return; }
    setIsSubmitting(true);
    try {
      await onLogin(email.trim().toLowerCase(), password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen
      withBottomNavPadding={false}
      className="relative items-start justify-start"
      contentClassName="relative w-full flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] space-y-0 box-border"
    >
      <AuthFormLayout>
        <button type="button" onClick={onBack}
          className="flex items-center justify-center size-[44px] text-[#f4bf4f]" aria-label="Indietro">
          <ArrowLeft size={24} />
        </button>

        <div className="mt-4 flex flex-col items-start gap-1">
          <h1 className="text-2xl font-bold tracking-[-0.24px] text-[#f5f5f5]">Accedi</h1>
          <p className="text-base text-[#b8b2b3]">Inizia la tua carriera teatrale</p>
        </div>

        <form onSubmit={handleSubmit} autoComplete="on"
          className="mt-8 flex w-full max-w-[300px] flex-col gap-6 mx-auto">

          <FormField label="Email" htmlFor="login-email" error={errors.email}>
            <FormInput
              id="login-email" name="username" type="email"
              value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              autoComplete="username" inputMode="email" autoCapitalize="none"
              autoCorrect="off" spellCheck={false} hasError={!!errors.email}
              placeholder="tuo@email.com" enterKeyHint="next"
            />
          </FormField>

          <FormField label="Password" htmlFor="login-password" error={errors.password}>
            <FormInput
              id="login-password" name="password" type="password"
              value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              autoComplete="current-password" hasError={!!errors.password}
              placeholder="••••••••" enterKeyHint="go"
            />
            <button type="button" onClick={onForgotPassword}
              className="self-start rounded-md px-2 py-2.5 mt-2 text-base text-[#f4bf4f]">
              Password dimenticata?
            </button>
          </FormField>

          {errorMessage && (
            <p className="text-sm text-[#ff4d4f] text-center">{errorMessage}</p>
          )}

          <Button type="submit" fullWidth disabled={isSubmitting} className={isSubmitting ? 'opacity-50 pointer-events-none' : ''}>
            {isSubmitting ? 'Accesso in corso...' : 'Accedi'}
          </Button>
        </form>

        <div className="mt-auto pt-6 text-center">
          <p className="text-base text-[#b8b2b3]">Non hai un account?</p>
          <button type="button" onClick={onSignup}
            className="inline-flex items-center justify-center rounded-md px-2 py-2.5 text-base text-[#f4bf4f]">
            Registrati
          </button>
        </div>
      </AuthFormLayout>
    </Screen>
  );
}
