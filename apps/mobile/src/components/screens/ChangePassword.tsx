import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '../ui/Screen';

interface ChangePasswordProps {
  email: string;
  onBack: () => void;
  onChangePassword: (newPassword: string) => Promise<void>;
}

export function ChangePassword({ email, onBack, onChangePassword }: ChangePasswordProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    const nextErrors: Record<string, string> = {};
    if (!password) nextErrors.password = 'Password richiesta';
    if (password && password.length < 8) nextErrors.password = 'Almeno 8 caratteri';
    if (password !== confirmPassword) nextErrors.confirmPassword = 'Le password non corrispondono';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      await onChangePassword(password);
      setPassword('');
      setConfirmPassword('');
      if (typeof window !== 'undefined') {
        window.alert('Password aggiornata');
      }
      onBack();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Errore sconosciuto');
    } finally {
      setIsSubmitting(false);
    }
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
          className="flex items-center justify-center size-[44px] text-[#f4bf4f]"
          aria-label="Indietro"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="mt-4 flex flex-col items-start gap-1">
          <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-[#f5f5f5]">
            Cambia password
          </p>
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3]">
            Account: <span className="text-white">{email || '—'}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex w-full max-w-[300px] flex-col gap-6 mx-auto">
          <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col gap-2 w-full">
              <label className="text-[16px] leading-[24px] text-[#b8b2b3]">
                Nuova password
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
                  disabled={isSubmitting}
                />
              </div>
              {errors.password ? (
                <p className="text-[14px] leading-[20px] text-[#ff4d4f] !m-0">
                  {errors.password}
                </p>
              ) : (
                <p className="text-[14px] leading-[20px] text-[#7a7577] !m-0">Almeno 8 caratteri</p>
              )}
            </div>

            <div className="flex flex-col gap-2 w-full">
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
                  disabled={isSubmitting}
                />
              </div>
              {errors.confirmPassword ? (
                <p className="text-[14px] leading-[20px] text-[#ff4d4f] !m-0">
                  {errors.confirmPassword}
                </p>
              ) : null}
            </div>
          </div>

          {errorMessage ? (
            <p className="text-[14px] leading-[20px] text-[#ff4d4f] text-center">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-gradient-to-b from-[#8c1c38] to-[#a82847] h-[44px] w-full rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="block text-[18px] leading-[28px] text-center text-white">
              {isSubmitting ? 'Aggiornamento...' : 'Aggiorna password'}
            </span>
          </button>
        </form>
      </div>
    </Screen>
  );
}
