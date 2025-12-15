import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ArrowLeft } from 'lucide-react';

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
    <div className="min-h-screen bg-[#0f0d0e] p-6 pb-20">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#f4bf4f] mb-8 hover:text-[#e6a23c] transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Indietro</span>
        </button>
        
        <div className="mb-8">
          <h2 className="mb-2">Crea il tuo account</h2>
          <p className="text-[#b8b2b3]">Inizia la tua carriera teatrale</p>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            type="text"
            label="Nome visualizzato"
            placeholder="Come vuoi essere chiamato"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          
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
            helperText="Almeno 8 caratteri"
          />
          
          <Input
            type="password"
            label="Conferma password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
          />
          
          {/* Terms */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="terms"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-2 border-[#2d2728] bg-[#241f20] checked:bg-[#a82847] focus:ring-2 focus:ring-[#f4bf4f] cursor-pointer"
            />
            <label htmlFor="terms" className="text-sm text-[#b8b2b3] cursor-pointer">
              Accetto i{' '}
              <span className="text-[#f4bf4f]">Termini e Condizioni</span>
              {' '}e la{' '}
              <span className="text-[#f4bf4f]">Privacy Policy</span>
            </label>
          </div>
          {errors.terms && (
            <p className="text-[#ff4d4f] text-sm -mt-2">{errors.terms}</p>
          )}
          
          <Button type="submit" variant="primary" size="lg" fullWidth>
            Registrati
          </Button>
        </form>
        
        {/* Login Link */}
        <div className="mt-8 text-center">
          <p className="text-[#b8b2b3]">
            Hai già un account?{' '}
            <button 
              onClick={onLogin}
              className="text-[#f4bf4f] hover:text-[#e6a23c] transition-colors"
            >
              Accedi
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
