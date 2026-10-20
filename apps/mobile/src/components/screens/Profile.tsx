import React, { useEffect, useRef, useState } from 'react';
import { Award, BarChart3, Camera, ChevronRight, Info, LogOut, Settings, Share2, Theater, User } from 'lucide-react';
import { ProgressBar } from '../ui/ProgressBar';
import { Screen } from '../ui/Screen';

interface TheatreReputation {
  name: string;
  reputation: number;
}

interface ProfileProps {
  userName: string;
  userRole: string;
  level: number;
  xp: number;
  xpTotal: number;
  xpSulCampo: number;
  reputationGlobal: number;
  cachet: number;
  tokenAtcl: number;
  theatreReputation: TheatreReputation[];
  theatreReputationLoading: boolean;
  badgesUnlockedCount: number;
  newBadgesCount: number;
  profileImage?: string;
  showCarriera?: boolean;
  onViewCarriera: () => void;
  onViewTitoli: () => void;
  onSettings: () => void;
  onLogout: () => void;
  onUploadProfileImage: (file: File) => void;
  /** Condivisione del profilo pubblico (#473). Se omesso, il bottone non viene mostrato. */
  onShareProfile?: () => void;
}

export function Profile({
  userName, userRole, level, xp: _xp, xpTotal, xpSulCampo, reputationGlobal,
  cachet, tokenAtcl, theatreReputation, theatreReputationLoading,
  badgesUnlockedCount, newBadgesCount, profileImage, showCarriera = true,
  onViewCarriera, onViewTitoli, onSettings, onLogout, onUploadProfileImage,
  onShareProfile,
}: ProfileProps) {
  const safeXpTotal = Math.max(xpTotal, 1);
  const roleLabel = (userRole ?? 'Ruolo').replace(/\s*\/\s*/g, '/');

  return (
    <Screen withBottomNavPadding contentClassName="px-0 pt-0 space-y-0">
      <div className="w-full app-content pt-9 pb-0 flex flex-col gap-5">
        <ProfileAvatar
          profileImage={profileImage}
          userName={userName}
          roleLabel={roleLabel}
          onUploadProfileImage={onUploadProfileImage}
        />

        {showCarriera && (
          <div className="px-6">
            <ProfileMenuButton icon={BarChart3} label="Carriera" onClick={onViewCarriera} gradient />
          </div>
        )}

        <div className="flex flex-col gap-5 px-6">
          <StatsCard
            level={level} xpTotal={xpTotal} cachet={cachet} tokenAtcl={tokenAtcl}
            xpSulCampo={xpSulCampo} safeXpTotal={safeXpTotal} reputationGlobal={reputationGlobal}
          />

          <TheatreReputationCard
            theatreReputation={theatreReputation}
            loading={theatreReputationLoading}
          />

          <BadgesButton
            badgesUnlockedCount={badgesUnlockedCount}
            newBadgesCount={newBadgesCount}
            onClick={onViewTitoli}
          />

          {onShareProfile ? (
            <ProfileMenuButton
              icon={Share2}
              label="Condividi profilo"
              subtitle="Una card sintetica della tua carriera"
              onClick={onShareProfile}
            />
          ) : null}

          <ProfileMenuButton
            icon={Settings}
            label="Gestisci account"
            subtitle="Impostazioni e privacy"
            onClick={onSettings}
          />

          <button type="button" onClick={onLogout}
            className="flex items-center justify-center gap-2 h-11 rounded-xl text-[15px] font-medium text-[#ff4d4f]/80 hover:text-[#ff4d4f] transition-colors">
            <LogOut size={20} /> Esci
          </button>
        </div>
      </div>
    </Screen>
  );
}

// === Sub-components ===

function ProfileAvatar({
  profileImage, userName, roleLabel, onUploadProfileImage,
}: {
  profileImage?: string;
  userName: string;
  roleLabel: string;
  onUploadProfileImage: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Seleziona un file immagine valido.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('L\'immagine deve essere inferiore a 5MB.');
      event.target.value = '';
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try { await onUploadProfileImage(file); }
    catch { if (isMountedRef.current) setUploadError('Errore durante il caricamento dell\'immagine.'); }
    finally { if (isMountedRef.current) { setIsUploading(false); event.target.value = ''; } }
  };

  return (
    <div className="relative flex flex-col items-center gap-3 pt-8 pb-5 px-6">
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-surface to-transparent pointer-events-none" />
      <div className="relative">
        <div className="bg-gradient-to-b from-burgundy-600 to-burgundy-800 rounded-full shadow-[0_8px_24px_rgba(168,40,71,0.35)] size-[88px] flex items-center justify-center overflow-hidden ring-2 ring-burgundy-600/30">
          {profileImage ? (
            <img src={profileImage} alt="Profilo" className="w-full h-full object-cover" />
          ) : (
            <User className="text-accent" size={44} />
          )}
        </div>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
          aria-label="Carica immagine profilo"
          className="absolute bottom-0 right-0 bg-gold-400 rounded-full p-1.5 shadow-lg disabled:opacity-50 ring-2 ring-[#0f0d0e]">
          <Camera className="text-[#0f0d0e]" size={14} aria-hidden="true" />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <p className="text-xl font-bold tracking-tight text-white text-center">{userName || 'Utente'}</p>
        <p className="text-sm text-accent text-center">{roleLabel}</p>
        {uploadError && (
          <p className="text-xs text-error text-center mt-1">{uploadError}</p>
        )}
      </div>
    </div>
  );
}

function StatsCard({
  level, xpTotal, cachet, tokenAtcl, xpSulCampo, safeXpTotal, reputationGlobal,
}: {
  level: number; xpTotal: number; cachet: number; tokenAtcl: number;
  xpSulCampo: number; safeXpTotal: number; reputationGlobal: number;
}) {
  const [showTokenInfo, setShowTokenInfo] = useState(false);

  return (
    <div className="bg-surface rounded-2xl overflow-hidden border border-border">
      <SectionHeader>Statistiche generali</SectionHeader>
      <div className="divide-y divide-[#241f20]">
        <StatRow label="Livello" value={level} />
        <StatRow label="XP totale" value={xpTotal} />
        <StatRow label="Cachet accumulato" value={cachet} />
        <div className="flex items-center justify-between px-4 py-3">
          <span className="flex items-center gap-1.5 text-sm text-fg-secondary">
            Token ATCL (premium)
            <button type="button" onClick={() => setShowTokenInfo(v => !v)}
              className="text-fg-tertiary hover:text-[#b8b2b3] transition-colors" aria-label="Informazioni valute">
              <Info size={13} />
            </button>
          </span>
          <span className="text-sm font-semibold text-accent">{tokenAtcl}</span>
        </div>
        {showTokenInfo && (
          <div className="px-4 py-3 bg-surface-elevated">
            <p className="text-xs text-fg-secondary">Cachet = valuta base di gioco. Token ATCL = boost e futuri riscatti.</p>
          </div>
        )}
        <div className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between text-sm text-fg-secondary">
            <span className="flex items-center gap-2"><Theater size={13} /> XP sul campo (eventi ATCL)</span>
            <span className="font-semibold text-accent">{xpSulCampo}</span>
          </div>
          <ProgressBar value={xpSulCampo} max={safeXpTotal} color="gold" size="md" />
        </div>
        <div className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between text-sm text-fg-secondary">
            <span>Reputazione ATCL globale</span>
            <span className="font-semibold text-white">{reputationGlobal}/100</span>
          </div>
          <ProgressBar value={reputationGlobal} max={100} color="burgundy" size="md" />
        </div>
      </div>
    </div>
  );
}

function TheatreReputationCard({
  theatreReputation, loading,
}: {
  theatreReputation: TheatreReputation[];
  loading: boolean;
}) {
  return (
    <div className="bg-surface rounded-2xl overflow-hidden border border-border">
      <SectionHeader>Reputazione per teatro</SectionHeader>
      {loading && <p className="px-4 py-3 text-sm text-fg-secondary">Caricamento...</p>}
      <div className="divide-y divide-[#241f20]">
        {theatreReputation.map(theatre => (
          <div key={theatre.name} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-center justify-between text-sm text-fg-secondary">
              <span>{theatre.name}</span>
              <span className="font-semibold text-white">{theatre.reputation}/100</span>
            </div>
            <ProgressBar value={theatre.reputation} max={100} color="burgundy" size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

function BadgesButton({
  badgesUnlockedCount, newBadgesCount, onClick,
}: {
  badgesUnlockedCount: number;
  newBadgesCount: number;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className="bg-surface border border-border rounded-2xl px-4 py-3 flex items-center justify-between active:bg-[#241f20] transition-colors">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-b from-gold-500 to-gold-400 rounded-xl size-10 flex items-center justify-center flex-shrink-0">
          <Award className="text-[#0f0d0e]" size={20} />
        </div>
        <div className="flex flex-col items-start">
          <p className="text-base font-semibold text-white !m-0">Titoli ottenuti</p>
          <p className="text-[13px] text-fg-tertiary !m-0">{badgesUnlockedCount} badge sbloccati</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {newBadgesCount > 0 && (
          <span className="bg-gradient-to-b from-gold-500 to-gold-400 rounded-full size-[18px] flex items-center justify-center text-[11px] font-bold text-[#0f0d0e]">
            {newBadgesCount}
          </span>
        )}
        <ChevronRight className="text-fg-tertiary" size={18} />
      </div>
    </button>
  );
}

function ProfileMenuButton({
  icon: Icon, label, subtitle, onClick, gradient,
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  subtitle?: string;
  onClick: () => void;
  gradient?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
      className="w-full bg-surface border border-border rounded-2xl flex items-center gap-3 px-4 py-3 active:bg-[#241f20] transition-colors">
      <div className={`rounded-xl size-10 flex items-center justify-center flex-shrink-0 ${
        gradient ? 'bg-gradient-to-b from-burgundy-600 to-burgundy-800' : ''
      }`}>
        <Icon className="text-accent" size={gradient ? 20 : 22} />
      </div>
      <div className="flex-1 text-left">
        <p className="text-base font-medium text-white !m-0">{label}</p>
        {subtitle && <p className="text-[13px] text-fg-tertiary !m-0">{subtitle}</p>}
      </div>
      <ChevronRight className="text-fg-tertiary" size={18} />
    </button>
  );
}

// Shared helpers
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-border">
      <p className="text-sm font-semibold text-fg-tertiary uppercase tracking-[0.1em]">{children}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-fg-secondary">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}
