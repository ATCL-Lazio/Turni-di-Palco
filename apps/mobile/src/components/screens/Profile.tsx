import React, { useRef, useState } from 'react';
import { Award, BarChart3, Camera, ChevronRight, Info, LogOut, Settings, Theater, User } from 'lucide-react';
import { ProgressBar } from '../ui/ProgressBar';

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
}

export function Profile({
  userName,
  userRole,
  level,
  xp,
  xpTotal,
  xpSulCampo,
  reputationGlobal,
  cachet,
  tokenAtcl,
  theatreReputation,
  theatreReputationLoading,
  badgesUnlockedCount,
  newBadgesCount,
  profileImage,
  showCarriera = true,
  onViewCarriera,
  onViewTitoli,
  onSettings,
  onLogout,
  onUploadProfileImage
}: ProfileProps) {
  const safeXpTotal = Math.max(xpTotal, 1);
  const roleLabel = (userRole ?? 'Ruolo').replace(/\s*\/\s*/g, '/');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showTokenInfo, setShowTokenInfo] = useState(false);

  const handleImageSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Seleziona un file immagine valido.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('L\'immagine deve essere inferiore a 5MB.');
      return;
    }

    setIsUploading(true);
    try {
      await onUploadProfileImage(file);
    } catch (error) {
      console.error('Errore durante il caricamento:', error);
      alert('Errore durante il caricamento dell\'immagine.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}
    >
      <div className="w-full app-content pt-[36px] pb-0 flex flex-col gap-[20px]">
        <div className="relative flex flex-col items-center gap-3 pt-8 pb-5 px-6">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#1f1719] to-transparent pointer-events-none" />
          <div className="relative">
            <div className="bg-gradient-to-b from-[#a82847] to-[#6b1529] rounded-full shadow-[0_8px_24px_rgba(168,40,71,0.35)] size-[88px] flex items-center justify-center overflow-hidden ring-2 ring-[#a82847]/30">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profilo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="text-[#f4bf4f]" size={44} />
              )}
            </div>
            <button
              type="button"
              onClick={handleImageSelect}
              disabled={isUploading}
              className="absolute bottom-0 right-0 bg-[#f4bf4f] rounded-full p-1.5 shadow-lg disabled:opacity-50 ring-2 ring-[#0f0d0e]"
            >
              <Camera className="text-[#0f0d0e]" size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <p className="text-xl font-bold tracking-tight text-white text-center">
              {userName || 'Utente'}
            </p>
            <p className="text-sm text-[#f4bf4f] text-center">
              {roleLabel}
            </p>
          </div>
        </div>

        {showCarriera ? (
          <div className="px-[25px]">
            <button
              type="button"
              onClick={onViewCarriera}
              className="w-full bg-[#1a1617] border border-[#2d2728] rounded-2xl flex items-center gap-3 px-4 py-3 active:bg-[#241f20] transition-colors"
            >
              <div className="bg-gradient-to-b from-[#a82847] to-[#6b1529] rounded-xl size-[40px] flex items-center justify-center flex-shrink-0">
                <BarChart3 className="text-[#f4bf4f]" size={20} />
              </div>
              <p className="flex-1 text-[16px] font-medium text-white text-left !m-0">Carriera</p>
              <ChevronRight className="text-[#3d393a]" size={18} />
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-[20px] px-[25px]">
          <div className="bg-[#1a1617] rounded-2xl overflow-hidden border border-[#2d2728]">
            <div className="px-4 py-3 border-b border-[#2d2728]">
              <p className="text-sm font-semibold text-[#7a7577] uppercase tracking-[0.1em]">
                Statistiche generali
              </p>
            </div>
            <div className="divide-y divide-[#241f20]">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#b8b2b3]">Livello</span>
                <span className="text-sm font-semibold text-white">{level}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#b8b2b3]">XP totale</span>
                <span className="text-sm font-semibold text-white">{xpTotal}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#b8b2b3]">Cachet accumulato</span>
                <span className="text-sm font-semibold text-white">{cachet}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="flex items-center gap-1.5 text-sm text-[#b8b2b3]">
                  Token ATCL (premium)
                  <button
                    type="button"
                    onClick={() => setShowTokenInfo((v) => !v)}
                    className="text-[#7a7577] hover:text-[#b8b2b3] transition-colors"
                    aria-label="Informazioni valute"
                  >
                    <Info size={13} />
                  </button>
                </span>
                <span className="text-sm font-semibold text-[#f4bf4f]">{tokenAtcl}</span>
              </div>
              {showTokenInfo ? (
                <div className="px-4 py-3 bg-[#241f20]">
                  <p className="text-xs text-[#b8b2b3]">
                    Cachet = valuta base di gioco. Token ATCL = boost e futuri riscatti.
                  </p>
                </div>
              ) : null}
              <div className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-center justify-between text-sm text-[#b8b2b3]">
                  <span className="flex items-center gap-2">
                    <Theater size={13} />
                    XP sul campo (eventi ATCL)
                  </span>
                  <span className="font-semibold text-[#f4bf4f]">{xpSulCampo}</span>
                </div>
                <ProgressBar value={xpSulCampo} max={safeXpTotal} color="gold" size="md" />
              </div>
              <div className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-center justify-between text-sm text-[#b8b2b3]">
                  <span>Reputazione ATCL globale</span>
                  <span className="font-semibold text-white">{reputationGlobal}/100</span>
                </div>
                <ProgressBar value={reputationGlobal} max={100} color="burgundy" size="md" />
              </div>
            </div>
          </div>

          <div className="bg-[#1a1617] rounded-2xl overflow-hidden border border-[#2d2728]">
            <div className="px-4 py-3 border-b border-[#2d2728]">
              <p className="text-sm font-semibold text-[#7a7577] uppercase tracking-[0.1em]">
                Reputazione per teatro
              </p>
            </div>
            {theatreReputationLoading ? (
              <p className="px-4 py-3 text-sm text-[#b8b2b3]">Caricamento...</p>
            ) : null}
            <div className="divide-y divide-[#241f20]">
              {theatreReputation.map((theatre) => (
                <div key={theatre.name} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-center justify-between text-sm text-[#b8b2b3]">
                    <span>{theatre.name}</span>
                    <span className="font-semibold text-white">{theatre.reputation}/100</span>
                  </div>
                  <ProgressBar value={theatre.reputation} max={100} color="burgundy" size="sm" />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onViewTitoli}
            className="bg-[#1a1617] border border-[#2d2728] rounded-2xl px-4 py-3 flex items-center justify-between active:bg-[#241f20] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-b from-[#e6a23c] to-[#f4bf4f] rounded-xl size-[40px] flex items-center justify-center flex-shrink-0">
                <Award className="text-[#0f0d0e]" size={20} />
              </div>
              <div className="flex flex-col items-start">
                <p className="text-[16px] font-semibold text-white !m-0">Titoli ottenuti</p>
                <p className="text-[13px] text-[#7a7577] !m-0">{badgesUnlockedCount} badge sbloccati</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {newBadgesCount > 0 ? (
                <span className="bg-gradient-to-b from-[#e6a23c] to-[#f4bf4f] rounded-full size-[18px] flex items-center justify-center text-[11px] font-bold text-[#0f0d0e]">
                  {newBadgesCount}
                </span>
              ) : null}
              <ChevronRight className="text-[#3d393a]" size={18} />
            </div>
          </button>

          <button
            type="button"
            onClick={onSettings}
            className="bg-[#1a1617] border border-[#2d2728] rounded-2xl px-4 py-3 flex items-center justify-between active:bg-[#241f20] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-[40px] flex-shrink-0">
                <Settings className="text-[#f4bf4f]" size={22} />
              </div>
              <div className="flex flex-col items-start text-left">
                <p className="text-[16px] font-semibold text-white !m-0">Gestisci account</p>
                <p className="text-[13px] text-[#7a7577] !m-0">Impostazioni e privacy</p>
              </div>
            </div>
            <ChevronRight className="text-[#3d393a]" size={18} />
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center justify-center gap-2 h-[44px] rounded-xl text-[15px] font-medium text-[#ff4d4f]/80 hover:text-[#ff4d4f] transition-colors"
          >
            <LogOut size={20} />
            Esci
          </button>
        </div>
      </div>
    </div>
  );
}
