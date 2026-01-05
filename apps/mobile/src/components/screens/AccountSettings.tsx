import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  History,
  KeyRound,
  LogOut,
  Shield,
  Trash2,
} from 'lucide-react';
import { Screen } from '../ui/Screen';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

interface AccountSettingsProps {
  userName: string;
  email: string;
  onBack: () => void;
  onViewTerms: () => void;
  onViewPrivacy: () => void;
  onChangePassword: () => void;
  onResetProgress: () => void;
  onLogout: () => void;
}

type ChangelogEntry = {
  sha: string;
  message: string;
  date: string | null;
  author: string;
  url: string;
};

type AppInfo = {
  version: string;
  repo: string | null;
  changelog: ChangelogEntry[];
};

function formatChangelogDate(value: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export function AccountSettings({
  userName,
  email,
  onBack,
  onViewTerms,
  onViewPrivacy,
  onChangePassword,
  onResetProgress,
  onLogout,
}: AccountSettingsProps) {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [appInfoStatus, setAppInfoStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [appInfoError, setAppInfoError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadAppInfo = async () => {
      setAppInfoStatus('loading');
      setAppInfoError(null);

      if (!isSupabaseConfigured || !supabase) {
        if (!mounted) return;
        setAppInfo({ version: 'dev', repo: null, changelog: [] });
        setAppInfoStatus('idle');
        return;
      }

      const { data, error } = await supabase.functions.invoke('app-version', {
        body: { limit: 8 },
      });

      if (!mounted) return;

      if (error) {
        setAppInfoStatus('error');
        setAppInfoError(error.message || 'Impossibile caricare la versione');
        return;
      }

      setAppInfo({
        version: typeof data?.version === 'string' ? data.version : 'dev',
        repo: typeof data?.repo === 'string' ? data.repo : null,
        changelog: Array.isArray(data?.changelog) ? data.changelog : [],
      });
      setAppInfoStatus('idle');
    };

    loadAppInfo();

    return () => {
      mounted = false;
    };
  }, []);

  const handleReset = () => {
    if (typeof window === 'undefined') return;
    const ok = window.confirm(
      'Vuoi davvero resettare i progressi? Questa modifica è irreversibile: cancelleremo turni, badge e statistiche e ti riporteremo alla scelta del ruolo.'
    );
    if (!ok) return;
    onResetProgress();
  };

  return (
    <Screen
      withBottomNavPadding={false}
      className="relative items-start justify-start"
      contentClassName="relative w-full max-w-[393px] flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] space-y-0 box-border"
    >
      <div className="flex h-full w-full flex-col gap-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center size-[44px] text-[#f4bf4f]"
          aria-label="Indietro"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="flex flex-col items-start gap-1">
          <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-[#f5f5f5]">
            Gestisci account
          </p>
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3]">Impostazioni e privacy</p>
        </div>

        <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] px-[12px] py-[12px] flex flex-col gap-[10px]">
          <div className="flex items-center justify-between text-[14px] leading-[20px] text-[#b8b2b3]">
            <span>Nome</span>
            <span className="text-white">{userName || 'Utente'}</span>
          </div>
          <div className="flex items-center justify-between text-[14px] leading-[20px] text-[#b8b2b3]">
            <span>Email</span>
            <span className="text-white">{email || '—'}</span>
          </div>
        </div>

        <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] px-[12px] py-[12px] flex flex-col gap-[12px]">
          <div className="flex items-center gap-[12px]">
            <History className="text-[#f4bf4f]" size={24} />
            <div className="text-left">
              <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">
                Versione app
              </p>
              <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">
                {appInfo?.version ? `v${appInfo.version}` : 'vdev'}
              </p>
            </div>
          </div>
          <div className="border-t border-[#2d2728] pt-[10px] flex flex-col gap-[8px]">
            <div className="flex items-center justify-between">
              <p className="text-[16px] leading-[25.6px] text-white !m-0">Changelog</p>
              {appInfo?.repo ? (
                <span className="text-[12px] leading-[16px] text-[#7a7577]">{appInfo.repo}</span>
              ) : null}
            </div>
            {appInfoStatus === 'loading' ? (
              <p className="text-[14px] leading-[20px] text-[#b8b2b3]">Caricamento...</p>
            ) : null}
            {appInfoStatus === 'error' ? (
              <p className="text-[14px] leading-[20px] text-[#ff4d4f]">
                {appInfoError ?? 'Impossibile caricare il changelog'}
              </p>
            ) : null}
            {appInfoStatus === 'idle' && appInfo?.changelog?.length ? (
              <div className="flex flex-col gap-[10px]">
                {appInfo.changelog.map((entry) => (
                  <div key={entry.sha} className="flex flex-col gap-[2px]">
                    <p className="text-[14px] leading-[20px] text-white !m-0">
                      {entry.message}
                    </p>
                    <p className="text-[12px] leading-[16px] text-[#7a7577] !m-0">
                      {entry.sha}
                      {entry.date ? ` - ${formatChangelogDate(entry.date)}` : ''}
                      {entry.author ? ` - ${entry.author}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            {appInfoStatus === 'idle' && !appInfo?.changelog?.length ? (
              <p className="text-[14px] leading-[20px] text-[#7a7577]">
                Nessun aggiornamento disponibile.
              </p>
            ) : null}
          </div>
        </div>

        <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] px-[12px] py-[12px] flex flex-col gap-[8px]">
          <button
            type="button"
            onClick={onViewTerms}
            className="h-[51px] flex items-center justify-between"
          >
            <div className="flex items-center gap-[12px]">
              <FileText className="text-[#f4bf4f]" size={24} />
              <div className="text-left">
                <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">
                  Termini e Condizioni
                </p>
                <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">
                  Condizioni d’uso del servizio
                </p>
              </div>
            </div>
            <ChevronRight className="text-[#7a7577]" size={20} />
          </button>

          <button
            type="button"
            onClick={onViewPrivacy}
            className="h-[51px] flex items-center justify-between"
          >
            <div className="flex items-center gap-[12px]">
              <Shield className="text-[#f4bf4f]" size={24} />
              <div className="text-left">
                <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">
                  Privacy Policy
                </p>
                <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">
                  Come trattiamo i tuoi dati
                </p>
              </div>
            </div>
            <ChevronRight className="text-[#7a7577]" size={20} />
          </button>
        </div>

        <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] px-[12px] py-[12px] flex flex-col gap-[8px]">
          <button
            type="button"
            onClick={onChangePassword}
            className="h-[51px] flex items-center justify-between"
          >
            <div className="flex items-center gap-[12px]">
              <KeyRound className="text-[#f4bf4f]" size={24} />
              <div className="text-left">
                <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">
                  Cambia password
                </p>
                <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">
                  Aggiorna le credenziali di accesso
                </p>
              </div>
            </div>
            <ChevronRight className="text-[#7a7577]" size={20} />
          </button>
        </div>

        <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] px-[12px] py-[12px] flex flex-col gap-[8px]">
          <button
            type="button"
            onClick={handleReset}
            className="h-[51px] flex items-center justify-between"
          >
            <div className="flex items-center gap-[12px]">
              <Trash2 className="text-[#ff4d4f]" size={24} />
              <div className="text-left">
                <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">
                  Resetta progressi
                </p>
                <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">
                  Azzeramento irreversibile della carriera
                </p>
              </div>
            </div>
            <ChevronRight className="text-[#7a7577]" size={20} />
          </button>
        </div>

        <div className="mt-auto">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center justify-center gap-[6px] h-[44px] rounded-md text-[18px] leading-[28px] text-[#ff4d4f] w-full"
          >
            <LogOut size={20} />
            Esci
          </button>
        </div>
      </div>
    </Screen>
  );
}
