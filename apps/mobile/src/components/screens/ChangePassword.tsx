import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '../ui/Screen';

type ChangePasswordMode = 'change' | 'recovery';

interface ChangePasswordProps {
  email: string;
  mode?: ChangePasswordMode;
  onBack: () => void;
  onChangePassword: (currentPassword: string | undefined, newPassword: string) => Promise<void>;
  onSendResetEmail: () => Promise<void>;
}

export function ChangePassword({
  email,
  mode = 'change',
  onBack,
  onChangePassword,
  onSendResetEmail,
}: ChangePasswordProps) {
  const isRecovery = mode === 'recovery';
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetEmailStatus, setResetEmailStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [resetEmailError, setResetEmailError] = useState<string | null>(null);

  const handleSendResetEmail = async () => {
    setResetEmailError(null);
    setResetEmailStatus('sending');
    try {
      await onSendResetEmail();
      setResetEmailStatus('sent');
    } catch (error) {
      setResetEmailError(error instanceof Error ? error.message : 'Errore sconosciuto');
      setResetEmailStatus('idle');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    const nextErrors: Record<string, string> = {};
    if (!isRecovery && !currentPassword) nextErrors.currentPassword = 'Password attuale richiesta';
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
      await onChangePassword(!isRecovery ? currentPassword : undefined, password);
      setCurrentPassword('');
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
      contentClassName="relative w-full flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] space-y-0 box-border"
    >
      <div className="flex h-full flex-col">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center size-[44px] text-[--color-gold-400]"
          aria-label="Indietro"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="mt-4 flex flex-col items-start gap-1">
          <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-[--color-text-primary]">
            Cambia password
          </p>
          <p className="text-[16px] leading-[25.6px] text-[--color-text-secondary]">
            Account: <span className="text-white">{email || '—'}</span>
          </p>
          {isRecovery ? (
            <p className="text-[14px] leading-[20px] text-[--color-text-tertiary] !m-0 mt-2">
              Hai richiesto una reimpostazione: imposta una nuova password per completare.
            </p>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex w-full max-w-[300px] flex-col gap-6 mx-auto">
          <div className="flex flex-col gap-4 w-full">
            {!isRecovery ? (
              <div className="flex flex-col gap-2 w-full">
                <label htmlFor="current-password" className="text-[16px] leading-[24px] text-[--color-text-secondary]">
                  Password attuale
                </label>
                <div
                  className={`bg-[--color-bg-surface-elevated] border-2 ${
                    errors.currentPassword ? 'border-[--color-error]' : 'border-[--color-bg-surface-hover]'
                  } rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[--color-gold-400]`}
                >
                  <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.currentPassword)}
                    placeholder="••••••••"
                    className="w-full h-full bg-transparent px-[10px] py-0 text-[16px] leading-[28px] text-[--color-text-primary] placeholder:text-[--color-text-tertiary] focus:outline-none"
                    disabled={isSubmitting}
                  />
                </div>
                {errors.currentPassword ? (
                  <p className="text-[14px] leading-[20px] text-[--color-error] !m-0">
                    {errors.currentPassword}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleSendResetEmail}
                  disabled={isSubmitting || resetEmailStatus === 'sending'}
                  className="self-end text-[14px] leading-[20px] text-[--color-gold-400] underline underline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {resetEmailStatus === 'sending'
                    ? 'Invio email...'
                    : resetEmailStatus === 'sent'
                      ? 'Email inviata'
                      : 'Password dimenticata? Invia email di reimpostazione'}
                </button>

                {resetEmailError ? (
                  <p className="text-[14px] leading-[20px] text-[--color-error] !m-0">{resetEmailError}</p>
                ) : resetEmailStatus === 'sent' ? (
                  <p className="text-[14px] leading-[20px] text-[--color-text-tertiary] !m-0">
                    Controlla la posta e segui il link per reimpostare la password.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 w-full">
              <label htmlFor="new-password" className="text-[16px] leading-[24px] text-[--color-text-secondary]">
                Nuova password
              </label>
              <div
                className={`bg-[--color-bg-surface-elevated] border-2 ${
                  errors.password ? 'border-[--color-error]' : 'border-[--color-bg-surface-hover]'
                } rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[--color-gold-400]`}
              >
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.password)}
                  placeholder="••••••••"
                  className="w-full h-full bg-transparent px-[10px] py-0 text-[16px] leading-[28px] text-[--color-text-primary] placeholder:text-[--color-text-tertiary] focus:outline-none"
                  disabled={isSubmitting}
                />
              </div>
              {errors.password ? (
                <p className="text-[14px] leading-[20px] text-[--color-error] !m-0">
                  {errors.password}
                </p>
              ) : (
                <p className="text-[14px] leading-[20px] text-[--color-text-tertiary] !m-0">Almeno 8 caratteri</p>
              )}
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label htmlFor="confirm-password" className="text-[16px] leading-[24px] text-[--color-text-secondary]">
                Conferma password
              </label>
              <div
                className={`bg-[--color-bg-surface-elevated] border-2 ${
                  errors.confirmPassword ? 'border-[--color-error]' : 'border-[--color-bg-surface-hover]'
                } rounded-[10px] flex h-[44px] items-center overflow-clip w-full transition-colors focus-within:border-[--color-gold-400]`}
              >
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  placeholder="••••••••"
                  className="w-full h-full bg-transparent px-[10px] py-0 text-[16px] leading-[28px] text-[--color-text-primary] placeholder:text-[--color-text-tertiary] focus:outline-none"
                  disabled={isSubmitting}
                />
              </div>
              {errors.confirmPassword ? (
                <p className="text-[14px] leading-[20px] text-[--color-error] !m-0">
                  {errors.confirmPassword}
                </p>
              ) : null}
            </div>
          </div>

          {errorMessage ? (
            <p className="text-[14px] leading-[20px] text-[--color-error] text-center">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-gradient-to-b from-[--color-burgundy-700] to-[--color-burgundy-600] h-[44px] w-full rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] disabled:opacity-60 disabled:cursor-not-allowed"
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
