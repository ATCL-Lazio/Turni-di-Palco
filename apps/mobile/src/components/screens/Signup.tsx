import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '../ui/Screen';
import { FormField, FormInput, AuthFormLayout } from '../ui/FormField';
import { Button } from '../ui/Button';

interface SignupProps {
  onBack: () => void;
  onSignup: (name: string, email: string, password: string) => void;
  onLogin: () => void;
  onViewTerms: () => void;
  onViewPrivacy: () => void;
  errorMessage?: string | null;
}

export function Signup({ onBack, onSignup, onLogin, onViewTerms, onViewPrivacy, errorMessage }: SignupProps) {
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
    else if (password.length < 8) newErrors.password = 'Almeno 8 caratteri';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Le password non corrispondono';
    if (!acceptTerms) newErrors.terms = 'Devi accettare i termini e la privacy';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    onSignup(name, email, password);
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
          <h1 className="text-2xl font-bold tracking-[-0.24px] text-[#f5f5f5]">Crea il tuo account</h1>
          <p className="text-base text-[#b8b2b3]">Inizia la tua carriera teatrale</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex w-full max-w-[300px] flex-col gap-6 mx-auto">
          <FormField label="Nome visualizzato" error={errors.name}>
            <FormInput type="text" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              autoComplete="name" hasError={!!errors.name} placeholder="Come vuoi essere chiamato" />
          </FormField>

          <FormField label="Email" error={errors.email}>
            <FormInput type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              autoComplete="email" hasError={!!errors.email} placeholder="tuo@email.com" />
          </FormField>

          <div className="flex flex-col gap-4 w-full">
            <FormField label="Password" error={errors.password}>
              <FormInput type="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                autoComplete="new-password" hasError={!!errors.password} placeholder="••••••••" />
              <p className="mt-2 !mb-0 text-base text-[#7a7577]">Almeno 8 caratteri</p>
            </FormField>

            <FormField label="Conferma password" error={errors.confirmPassword}>
              <FormInput type="password" value={confirmPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                autoComplete="new-password" hasError={!!errors.confirmPassword} placeholder="••••••••" />
            </FormField>
          </div>

          <TermsCheckbox
            checked={acceptTerms}
            onChange={setAcceptTerms}
            error={errors.terms}
            onViewTerms={onViewTerms}
            onViewPrivacy={onViewPrivacy}
          />

          {errorMessage && (
            <p className="text-sm text-[#ff4d4f] text-center">{errorMessage}</p>
          )}

          <Button type="submit" fullWidth>Registrati</Button>
        </form>

        <div className="mt-auto pt-6 text-center">
          <p className="text-base text-[#b8b2b3]">Hai già un account?</p>
          <button type="button" onClick={onLogin}
            className="inline-flex items-center justify-center rounded-md px-2 py-2.5 text-base text-[#f4bf4f]">
            Accedi
          </button>
        </div>
      </AuthFormLayout>
    </Screen>
  );
}

function TermsCheckbox({
  checked,
  onChange,
  error,
  onViewTerms,
  onViewPrivacy,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  onViewTerms: () => void;
  onViewPrivacy: () => void;
}) {
  return (
    <div>
      <label htmlFor="terms" className="flex gap-3 items-start rounded-md py-1.5 text-sm text-[#b8b2b3]">
        <input id="terms" type="checkbox" checked={checked}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
          className="bg-[#241f20] border border-[#2d2728] size-6 accent-[#a82847]" />
        <span>
          Accetto i{' '}
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewTerms(); }}
            className="text-[#f4bf4f] underline underline-offset-2">Termini e Condizioni</button>{' '}
          e la{' '}
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewPrivacy(); }}
            className="text-[#f4bf4f] underline underline-offset-2">Privacy Policy</button>
        </span>
      </label>
      {error && <p className="text-sm text-[#ff4d4f] mt-1">{error}</p>}
    </div>
  );
}
