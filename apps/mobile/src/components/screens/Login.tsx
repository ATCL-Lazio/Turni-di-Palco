import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ArrowLeft } from 'lucide-react';

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
    
    // Simple validation
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
    <div className="min-h-screen bg-[#0f0d0e] p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        {/* Header */}
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#f4bf4f] mb-8 hover:text-[#e6a23c] transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Indietro</span>
        </button>
        
        <div className="mb-8">
          <h2 className="mb-2">Benvenuto</h2>
          <p className="text-[#b8b2b3]">Accedi al tuo account</p>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            type="email"
            label="Email"
            placeholder="tuo@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          
          <Input
            type="password"
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[#f4bf4f] text-sm hover:text-[#e6a23c] transition-colors"
          >
            Password dimenticata?
          </button>
          
          <Button type="submit" variant="primary" size="lg" fullWidth>
            Accedi
          </Button>
        </form>
        
        {/* Signup Link */}
        <div className="mt-8 text-center">
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
    </div>
  );
}
