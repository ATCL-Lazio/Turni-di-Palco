import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ArrowLeft } from 'lucide-react';
import { Screen, ScreenHeader } from '../ui/Screen';

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
      header={
        <ScreenHeader gradient>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#f4bf4f] hover:text-[#e6a23c] transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Indietro</span>
          </button>
        </ScreenHeader>
      }
    >
      <div className="space-y-5">
        <div>
          <h2 className="mb-2">Benvenuto</h2>
          <p className="text-[#b8b2b3]">Accedi al tuo account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            type="email"
            label="Email"
            placeholder="tuo@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            autoComplete="email"
          />

          <Input
            type="password"
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
          />

          <div className="text-right">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-[#f4bf4f] text-sm hover:text-[#e6a23c] transition-colors"
            >
              Password dimenticata?
            </button>
          </div>

          <Button type="submit" variant="primary" size="lg" fullWidth>
            Accedi
          </Button>
        </form>

        <div className="text-center">
          <p className="text-[#b8b2b3]">
            Non hai un account?{' '}
            <button
              onClick={onSignup}
              className="text-[#f4bf4f] hover:text-[#e6a23c] transition-colors"
            >
              Registrati
            </button>
          </p>
        </div>
      </div>
    </Screen>
  );
}
