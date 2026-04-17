import React, { useCallback, useEffect, useState } from 'react';
import {
  Accessibility, ArrowLeft, Bell, Camera, ChevronRight, Download, FileText, History, KeyRound,
  LogOut, MapPin, MessageCircle, QrCode, RotateCcw, Shield, ShieldCheck, Sun, Trash2, UserX,
} from 'lucide-react';
import { Screen } from '../ui/Screen';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { Switch } from '../ui/switch';
import { getPermission, requestPermission, type NotificationPermissionState } from '../../lib/notifications';
import { checkAiSupportAvailability } from '../../services/ai';
import { CopyrightNotice } from '../ui/CopyrightNotice';
import { GEO_CONSENT_KEY } from '../../constants/privacy';
import { useGameState } from '../../state/store';

interface AccountSettingsProps {
  userName: string;
  email: string;
  showAiSupport: boolean;
  showTicketPrototype: boolean;
  leaderboardVisible: boolean;
  onBack: () => void;
  onViewTerms: () => void;
  onViewPrivacy: () => void;
  onViewSupport: () => void;
  onViewTicketPrototype: () => void;
  onChangePassword: () => void;
  onResetProgress: () => void;
  onResetTutorial: () => void;
  onDeleteAccount: () => Promise<void>;
  onExportData: () => void;
  onToggleLeaderboard: (visible: boolean) => void;
  onLogout: () => void;
}

type ChangelogEntry = { sha: string; message: string; date: string | null; author: string; url: string };
type AppInfo = { version: string; repo: string | null; changelog: ChangelogEntry[] };
type PermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';
type PermissionKey = 'notifications' | 'camera' | 'geolocation';

export function AccountSettings({
  userName, email, showAiSupport, showTicketPrototype, leaderboardVisible,
  onBack, onViewTerms, onViewPrivacy, onViewSupport, onViewTicketPrototype,
  onChangePassword, onResetProgress, onResetTutorial, onDeleteAccount, onExportData, onToggleLeaderboard, onLogout,
}: AccountSettingsProps) {
  const { appInfo, appInfoStatus, appInfoError } = useAppInfo();
  const { permissionStatuses, permissionMessages, handlePermissionRequest } = usePermissions();
  const { notificationPermission, notificationStatusLabel, handleNotificationToggle } = useNotificationToggle();
  const supportStatus = useSupportStatus(showAiSupport);
  const { geoConsent, grantGeoConsent, denyGeoConsent } = useGeoConsent();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleResetTutorial = () => {
    if (typeof window === 'undefined') return;
    const ok = window.confirm('Vuoi rivedere il tutorial di benvenuto? Apparirà alla prossima apertura della home.');
    if (ok) onResetTutorial();
  };

  const handleReset = () => {
    if (typeof window === 'undefined') return;
    const ok = window.confirm(
      'Vuoi davvero resettare i progressi? Questa modifica è irreversibile: cancelleremo turni, badge e statistiche e ti riporteremo alla scelta del ruolo.'
    );
    if (ok) onResetProgress();
  };

  const handleDeleteAccount = async () => {
    if (typeof window === 'undefined') return;
    const ok = window.confirm(
      'Stai per eliminare definitivamente il tuo account e tutti i dati associati (turni, badge, statistiche, immagine profilo). Questa operazione è irreversibile. Continuare?'
    );
    if (!ok) return;
    setDeleteError(null);
    try {
      await onDeleteAccount();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Impossibile eliminare il profilo. Riprova.');
    }
  };

  return (
    <Screen
      withBottomNavPadding={false}
      className="relative items-start justify-start"
      contentClassName="relative w-full flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] space-y-0 box-border"
    >
      <div className="flex h-full w-full flex-col gap-6">
        <button type="button" onClick={onBack}
          className="flex items-center justify-center size-[44px] text-[#f4bf4f]" aria-label="Indietro">
          <ArrowLeft size={24} />
        </button>

        <div className="flex flex-col items-start gap-1">
          <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-[#f5f5f5]">Gestisci account</p>
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3]">Impostazioni e privacy</p>
        </div>

        <UserInfoCard userName={userName} email={email} />
        <VersionCard appInfo={appInfo} appInfoStatus={appInfoStatus} appInfoError={appInfoError} />
        <PermissionsSection
          permissionStatuses={permissionStatuses}
          permissionMessages={permissionMessages}
          onRequest={handlePermissionRequest}
        />
        <NotificationToggleCard
          notificationPermission={notificationPermission}
          notificationStatusLabel={notificationStatusLabel}
          onToggle={handleNotificationToggle}
        />
        <GdprPrivacyCard
          leaderboardVisible={leaderboardVisible}
          geoConsent={geoConsent}
          onToggleLeaderboard={onToggleLeaderboard}
          onGrantGeoConsent={grantGeoConsent}
          onDenyGeoConsent={denyGeoConsent}
          onExportData={onExportData}
        />
        <AccessibilityCard />
        <LinksSection
          showAiSupport={showAiSupport}
          showTicketPrototype={showTicketPrototype}
          supportStatus={supportStatus}
          onViewSupport={onViewSupport}
          onViewTicketPrototype={onViewTicketPrototype}
          onViewTerms={onViewTerms}
          onViewPrivacy={onViewPrivacy}
        />
        <SettingsActionCard icon={KeyRound} label="Cambia password" subtitle="Aggiorna le credenziali di accesso" onClick={onChangePassword} />
        <SettingsActionCard icon={RotateCcw} label="Reimposta tutorial" subtitle="Rivedi la guida di benvenuto" onClick={handleResetTutorial} />
        <SettingsActionCard icon={Trash2} label="Resetta progressi" subtitle="Azzeramento irreversibile della carriera" onClick={handleReset} iconColor="text-[#ff4d4f]" />

        <div className="mt-auto flex flex-col gap-4">
          {deleteError && <p className="text-[14px] leading-[20px] text-[#ff4d4f] text-center">{deleteError}</p>}
          <CopyrightNotice />
          <button type="button" onClick={handleDeleteAccount}
            className="flex items-center justify-center gap-[6px] h-[44px] rounded-md text-[14px] leading-[20px] text-[#ff4d4f]/70 w-full">
            <UserX size={16} /> Elimina account
          </button>
          <button type="button" onClick={onLogout}
            className="flex items-center justify-center gap-[6px] h-[44px] rounded-md text-[18px] leading-[28px] text-[#ff4d4f] w-full">
            <LogOut size={20} /> Esci
          </button>
        </div>
      </div>
    </Screen>
  );
}

// === Sub-components ===

function UserInfoCard({ userName, email }: { userName: string; email: string }) {
  return (
    <SettingsCard>
      <div className="flex items-center justify-between text-[14px] leading-[20px] text-[#b8b2b3]">
        <span>Nome</span><span className="text-white">{userName || 'Utente'}</span>
      </div>
      <div className="flex items-center justify-between text-[14px] leading-[20px] text-[#b8b2b3]">
        <span>Email</span><span className="text-white">{email || '—'}</span>
      </div>
    </SettingsCard>
  );
}

function VersionCard({ appInfo, appInfoStatus, appInfoError }: {
  appInfo: AppInfo | null; appInfoStatus: string; appInfoError: string | null;
}) {
  return (
    <SettingsCard className="gap-[12px]">
      <div className="flex items-center gap-[12px]">
        <History className="text-[#f4bf4f]" size={24} />
        <div className="text-left">
          <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">Versione app</p>
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">{appInfo?.version ? `v${appInfo.version}` : 'vdev'}</p>
        </div>
      </div>
      <div className="border-t border-[#2d2728] pt-[10px] flex flex-col gap-[8px]">
        <div className="flex items-center justify-between">
          <p className="text-[16px] leading-[25.6px] text-white !m-0">Changelog</p>
          {appInfo?.repo && <span className="text-[12px] leading-[16px] text-[#9a9697]">{appInfo.repo}</span>}
        </div>
        {appInfoStatus === 'loading' && <p className="text-[14px] leading-[20px] text-[#b8b2b3]">Caricamento...</p>}
        {appInfoStatus === 'error' && <p className="text-[14px] leading-[20px] text-[#ff4d4f]">{appInfoError ?? 'Impossibile caricare il changelog'}</p>}
        {appInfoStatus === 'idle' && appInfo?.changelog?.length ? (
          <div className="flex flex-col gap-[10px]">
            {appInfo.changelog.map(entry => (
              <div key={entry.sha} className="flex flex-col gap-[2px]">
                <p className="text-[14px] leading-[20px] text-white !m-0">{entry.message}</p>
                <p className="text-[12px] leading-[16px] text-[#9a9697] !m-0">
                  {entry.sha}{entry.date ? ` - ${formatChangelogDate(entry.date)}` : ''}{entry.author ? ` - ${entry.author}` : ''}
                </p>
              </div>
            ))}
          </div>
        ) : null}
        {appInfoStatus === 'idle' && !appInfo?.changelog?.length && (
          <p className="text-[14px] leading-[20px] text-[#9a9697]">Nessun aggiornamento disponibile.</p>
        )}
      </div>
    </SettingsCard>
  );
}

function PermissionsSection({ permissionStatuses, permissionMessages, onRequest }: {
  permissionStatuses: Record<PermissionKey, PermissionStatus>;
  permissionMessages: Record<PermissionKey, string | null>;
  onRequest: (key: PermissionKey) => void;
}) {
  const canRequest: Record<PermissionKey, boolean> = {
    notifications: typeof window !== 'undefined' && typeof window.Notification !== 'undefined',
    camera: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    geolocation: typeof navigator !== 'undefined' && !!navigator.geolocation,
  };

  const PERMISSION_ROWS: { key: PermissionKey; icon: React.ElementType; label: string }[] = [
    { key: 'notifications', icon: Bell, label: 'Notifiche' },
    { key: 'camera', icon: Camera, label: 'Fotocamera' },
    { key: 'geolocation', icon: MapPin, label: 'Geolocalizzazione' },
  ];

  return (
    <SettingsCard className="gap-[12px]">
      <div className="flex items-center gap-[12px]">
        <ShieldCheck className="text-[#f4bf4f]" size={24} />
        <div className="text-left">
          <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">Permessi app</p>
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">Gestisci accessi e autorizzazioni</p>
        </div>
      </div>
      <div className="border-t border-[#2d2728] pt-[10px] flex flex-col gap-[12px]">
        {PERMISSION_ROWS.map(({ key, icon: Icon, label }) => (
          <div key={key} className="flex items-start justify-between gap-[12px]">
            <div className="flex items-start gap-[10px]">
              <Icon className="text-[#f4bf4f]" size={20} />
              <div>
                <p className="text-[16px] leading-[25.6px] text-white !m-0">{label}</p>
                <p className="text-[12px] leading-[18px] text-[#b8b2b3] !m-0">Stato: {formatPermissionStatus(permissionStatuses[key])}</p>
                {permissionMessages[key] && (
                  <p className="text-[12px] leading-[18px] text-[#9a9697] !m-0">{permissionMessages[key]}</p>
                )}
              </div>
            </div>
            <button type="button" onClick={() => onRequest(key)} disabled={!canRequest[key]}
              className="text-[12px] leading-[18px] px-[10px] py-[6px] rounded-[10px] border border-[#2d2728] text-white disabled:opacity-50">
              Richiedi
            </button>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}

function NotificationToggleCard({ notificationPermission, notificationStatusLabel, onToggle }: {
  notificationPermission: NotificationPermissionState; notificationStatusLabel: string;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <SettingsCard className="gap-[8px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[12px]">
          <Bell className="text-[#f4bf4f]" size={24} />
          <div className="text-left">
            <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">Notifiche di sistema</p>
            <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">Aggiornamenti su badge ed eventi</p>
          </div>
        </div>
        <Switch checked={notificationPermission === 'granted'} onCheckedChange={onToggle} disabled={notificationPermission === 'unsupported'} />
      </div>
      <p className="text-[14px] leading-[20px] text-[#b8b2b3]">Stato: {notificationStatusLabel}</p>
      {notificationPermission === 'unsupported' && (
        <p className="text-[14px] leading-[20px] text-[#ff4d4f]">Le notifiche di sistema non sono disponibili su questo dispositivo.</p>
      )}
    </SettingsCard>
  );
}

function LinksSection({ showAiSupport, showTicketPrototype, supportStatus, onViewSupport, onViewTicketPrototype, onViewTerms, onViewPrivacy }: {
  showAiSupport: boolean; showTicketPrototype: boolean;
  supportStatus: string; onViewSupport: () => void; onViewTicketPrototype: () => void;
  onViewTerms: () => void; onViewPrivacy: () => void;
}) {
  const supportUnavailable = supportStatus === 'unavailable';
  const supportDisabled = supportUnavailable || supportStatus === 'checking' || supportStatus === 'unknown';

  return (
    <SettingsCard className="gap-[14px]">
      {showAiSupport && (
        <>
          <LinkRow icon={MessageCircle} label="Supporto" subtitle="Chat con Maxwell" onClick={onViewSupport} disabled={supportDisabled} />
          {supportUnavailable && <p className="text-[14px] leading-[20px] text-[#ff4d4f]">Supporto AI attualmente non disponibile.</p>}
        </>
      )}
      {showTicketPrototype && (
        <LinkRow icon={QrCode} label="Prototipo ticket QR" subtitle="Generazione hash e attivazione one-shot" onClick={onViewTicketPrototype} />
      )}
      <LinkRow icon={FileText} label="Termini e Condizioni" subtitle="Condizioni d'uso del servizio" onClick={onViewTerms} />
      <LinkRow icon={Shield} label="Privacy Policy" subtitle="Come trattiamo i tuoi dati" onClick={onViewPrivacy} />
    </SettingsCard>
  );
}

function LinkRow({ icon: Icon, label, subtitle, onClick, disabled }: {
  icon: React.ElementType; label: string; subtitle: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="min-h-[56px] py-[2px] flex items-center justify-between disabled:opacity-60 disabled:cursor-not-allowed">
      <div className="flex items-center gap-[12px]">
        <Icon className="text-[#f4bf4f]" size={24} />
        <div className="text-left">
          <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">{label}</p>
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">{subtitle}</p>
        </div>
      </div>
      <ChevronRight className="text-[#9a9697]" size={20} />
    </button>
  );
}

function SettingsActionCard({ icon: Icon, label, subtitle, onClick, iconColor = 'text-[#f4bf4f]' }: {
  icon: React.ElementType; label: string; subtitle: string; onClick: () => void; iconColor?: string;
}) {
  return (
    <SettingsCard className="gap-[8px]">
      <button type="button" onClick={onClick} className="h-[51px] flex items-center justify-between">
        <div className="flex items-center gap-[12px]">
          <Icon className={iconColor} size={24} />
          <div className="text-left">
            <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">{label}</p>
            <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">{subtitle}</p>
          </div>
        </div>
        <ChevronRight className="text-[#9a9697]" size={20} />
      </button>
    </SettingsCard>
  );
}

function SettingsCard({ children, className = 'gap-[10px]' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] px-[12px] py-[12px] flex flex-col ${className}`}>
      {children}
    </div>
  );
}

// === Custom hooks ===

function useAppInfo() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [appInfoStatus, setAppInfoStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [appInfoError, setAppInfoError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setAppInfoStatus('loading');
      setAppInfoError(null);
      if (!isSupabaseConfigured || !supabase) {
        if (!mounted) return;
        setAppInfo({ version: '0.0.5', repo: null, changelog: [] });
        setAppInfoStatus('idle');
        return;
      }
      const { data, error } = await supabase.functions.invoke('app-version', { body: { limit: 8 } });
      if (!mounted) return;
      if (error) { setAppInfoStatus('error'); setAppInfoError(error.message || 'Impossibile caricare la versione'); return; }
      setAppInfo({
        version: typeof data?.version === 'string' ? data.version : '0.0.5',
        repo: typeof data?.repo === 'string' ? data.repo : null,
        changelog: Array.isArray(data?.changelog) ? data.changelog : [],
      });
      setAppInfoStatus('idle');
    };
    load();
    return () => { mounted = false; };
  }, []);

  return { appInfo, appInfoStatus, appInfoError };
}

function usePermissions() {
  const [permissionStatuses, setPermissionStatuses] = useState<Record<PermissionKey, PermissionStatus>>({
    notifications: 'default', camera: 'default', geolocation: 'default',
  });
  const [permissionMessages, setPermissionMessages] = useState<Record<PermissionKey, string | null>>({
    notifications: null, camera: null, geolocation: null,
  });

  const refreshAll = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      setPermissionStatuses({ notifications: 'unsupported', camera: 'unsupported', geolocation: 'unsupported' });
      return;
    }
    const queryPerm = (name: string) =>
      navigator.permissions.query({ name: name as PermissionName })
        .then(r => (r.state === 'prompt' ? 'default' : r.state) as PermissionStatus)
        .catch((): PermissionStatus => 'unsupported');
    const [notifications, camera, geolocation] = await Promise.all([
      queryPerm('notifications'), queryPerm('camera'), queryPerm('geolocation'),
    ]);
    setPermissionStatuses({ notifications, camera, geolocation });
  }, []);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const handlePermissionRequest = useCallback(async (key: PermissionKey) => {
    setPermissionMessages(p => ({ ...p, [key]: null }));

    if (key === 'notifications') {
      const result = await requestPermission();
      if (result === 'unsupported') {
        setPermissionStatuses(p => ({ ...p, notifications: 'unsupported' }));
        setPermissionMessages(p => ({ ...p, notifications: 'Le notifiche non sono supportate.' }));
      } else {
        setPermissionStatuses(p => ({ ...p, notifications: result }));
        setPermissionMessages(p => ({ ...p, notifications: result === 'granted' ? 'Notifiche abilitate con successo.' : 'Permesso notifiche non concesso.' }));
      }
    } else if (key === 'camera') {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setPermissionStatuses(p => ({ ...p, camera: 'unsupported' }));
        setPermissionMessages(p => ({ ...p, camera: 'La fotocamera non è supportata.' }));
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(t => t.stop());
          setPermissionStatuses(p => ({ ...p, camera: 'granted' }));
          setPermissionMessages(p => ({ ...p, camera: 'Permesso fotocamera concesso.' }));
        } catch {
          setPermissionStatuses(p => ({ ...p, camera: 'denied' }));
          setPermissionMessages(p => ({ ...p, camera: 'Permesso fotocamera negato.' }));
        }
      }
    } else if (key === 'geolocation') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setPermissionStatuses(p => ({ ...p, geolocation: 'unsupported' }));
        setPermissionMessages(p => ({ ...p, geolocation: 'La geolocalizzazione non è supportata.' }));
      } else {
        navigator.geolocation.getCurrentPosition(
          () => {
            setPermissionStatuses(p => ({ ...p, geolocation: 'granted' }));
            setPermissionMessages(p => ({ ...p, geolocation: 'Permesso geolocalizzazione concesso.' }));
            void refreshAll();
          },
          () => {
            setPermissionStatuses(p => ({ ...p, geolocation: 'denied' }));
            setPermissionMessages(p => ({ ...p, geolocation: 'Permesso geolocalizzazione negato.' }));
            void refreshAll();
          },
        );
        return;
      }
    }
    await refreshAll();
  }, [refreshAll]);

  return { permissionStatuses, permissionMessages, handlePermissionRequest };
}

function useNotificationToggle() {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(() => getPermission());

  const notificationStatusLabel = (() => {
    switch (notificationPermission) {
      case 'granted': return 'Attive';
      case 'denied': return 'Bloccate';
      case 'default': return 'Da abilitare';
      default: return 'Non supportate';
    }
  })();

  const handleNotificationToggle = useCallback(async (checked: boolean) => {
    if (notificationPermission === 'unsupported') {
      window.alert('Le notifiche di sistema non sono supportate su questo dispositivo.');
      return;
    }
    if (!checked) {
      window.alert('Puoi disattivare le notifiche dalle impostazioni del browser o del dispositivo.');
      setNotificationPermission(getPermission());
      return;
    }
    const next = await requestPermission();
    setNotificationPermission(next);
    if (next !== 'granted') window.alert('Permesso notifiche non concesso.');
  }, [notificationPermission]);

  return { notificationPermission, notificationStatusLabel, handleNotificationToggle };
}

function useSupportStatus(showAiSupport: boolean) {
  const [status, setStatus] = useState<'checking' | 'available' | 'unavailable' | 'unknown'>('checking');

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (!showAiSupport) { if (mounted) setStatus('unavailable'); return; }
      const result = await checkAiSupportAvailability();
      if (mounted) setStatus(result);
    };
    check();
    return () => { mounted = false; };
  }, [showAiSupport]);

  return status;
}

// === GDPR Privacy Card ===

type GeoConsent = 'granted' | 'denied' | null;

function useGeoConsent() {
  const [geoConsent, setGeoConsent] = useState<GeoConsent>(() => {
    if (typeof window === 'undefined') return null;
    const v = window.localStorage.getItem(GEO_CONSENT_KEY);
    if (v === 'granted' || v === 'denied') return v;
    return null;
  });

  const grantGeoConsent = useCallback(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(GEO_CONSENT_KEY, 'granted');
    setGeoConsent('granted');
  }, []);

  const denyGeoConsent = useCallback(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(GEO_CONSENT_KEY, 'denied');
    setGeoConsent('denied');
  }, []);

  return { geoConsent, grantGeoConsent, denyGeoConsent };
}

function GdprPrivacyCard({
  leaderboardVisible,
  geoConsent,
  onToggleLeaderboard,
  onGrantGeoConsent,
  onDenyGeoConsent,
  onExportData,
}: {
  leaderboardVisible: boolean;
  geoConsent: GeoConsent;
  onToggleLeaderboard: (visible: boolean) => void;
  onGrantGeoConsent: () => void;
  onDenyGeoConsent: () => void;
  onExportData: () => void;
}) {
  const geoLabel = geoConsent === 'granted' ? 'Attiva' : geoConsent === 'denied' ? 'Negata' : 'Non impostata';

  return (
    <SettingsCard className="gap-[14px]">
      <div className="flex items-center gap-[12px]">
        <Shield className="text-[#f4bf4f]" size={24} />
        <div className="text-left">
          <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">Privacy e dati</p>
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">Controlli GDPR</p>
        </div>
      </div>

      <div className="border-t border-[#2d2728] pt-[12px] flex flex-col gap-[16px]">
        {/* Leaderboard opt-out */}
        <div className="flex items-center justify-between gap-[12px]">
          <div className="flex-1">
            <p className="text-[16px] leading-[25.6px] text-white !m-0">Visibile in classifica</p>
            <p className="text-[12px] leading-[18px] text-[#b8b2b3] !m-0">Il tuo profilo appare nella classifica pubblica</p>
          </div>
          <Switch checked={leaderboardVisible} onCheckedChange={onToggleLeaderboard} />
        </div>

        {/* Geo consent */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex items-start justify-between gap-[12px]">
            <div className="flex-1">
              <p className="text-[16px] leading-[25.6px] text-white !m-0">Verifica GPS ai turni</p>
              <p className="text-[12px] leading-[18px] text-[#b8b2b3] !m-0">
                Consenti la raccolta della posizione GPS per la verifica presenza. Stato: {geoLabel}
              </p>
            </div>
          </div>
          <div className="flex gap-[8px]">
            <button type="button" onClick={onGrantGeoConsent}
              disabled={geoConsent === 'granted'}
              className="flex-1 py-[6px] px-[10px] rounded-[10px] border border-[#2d2728] text-[12px] text-white disabled:opacity-40">
              Consenti
            </button>
            <button type="button" onClick={onDenyGeoConsent}
              disabled={geoConsent === 'denied'}
              className="flex-1 py-[6px] px-[10px] rounded-[10px] border border-[#2d2728] text-[12px] text-white disabled:opacity-40">
              Nega
            </button>
          </div>
        </div>

        {/* Export data */}
        <button type="button" onClick={onExportData}
          className="flex items-center gap-[10px] py-[6px]">
          <Download className="text-[#f4bf4f]" size={20} />
          <div className="text-left">
            <p className="text-[16px] leading-[25.6px] font-semibold text-white !m-0">Scarica i miei dati</p>
            <p className="text-[12px] leading-[18px] text-[#b8b2b3] !m-0">Esporta profilo, turni e badge in JSON</p>
          </div>
        </button>
      </div>
    </SettingsCard>
  );
}

function AccessibilityCard() {
  const { state, updateProfile } = useGameState();
  const isLight = state.profile.theme === 'light';
  const accessibleMode = state.profile.accessibleMode;

  return (
    <SettingsCard className="gap-[14px]">
      <div className="flex items-center gap-[12px]">
        <Accessibility className="text-[#f4bf4f]" size={24} />
        <div className="text-left">
          <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">Accessibilità</p>
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">Tema e aiuti nei minigiochi</p>
        </div>
      </div>

      <div className="border-t border-[#2d2728] pt-[12px] flex flex-col gap-[16px]">
        <div className="flex items-center justify-between gap-[12px]">
          <div className="flex items-start gap-[10px] flex-1">
            <Sun className="text-[#f4bf4f]" size={20} />
            <div>
              <p className="text-[16px] leading-[25.6px] text-white !m-0">Tema chiaro</p>
              <p className="text-[12px] leading-[18px] text-[#b8b2b3] !m-0">Interfaccia su sfondo chiaro per contrasti migliori</p>
            </div>
          </div>
          <Switch
            checked={isLight}
            onCheckedChange={(checked) => updateProfile({ theme: checked ? 'light' : 'dark' })}
            aria-label="Attiva tema chiaro"
          />
        </div>

        <div className="flex items-center justify-between gap-[12px]">
          <div className="flex-1">
            <p className="text-[16px] leading-[25.6px] text-white !m-0">Modalità accessibile (minigiochi)</p>
            <p className="text-[12px] leading-[18px] text-[#b8b2b3] !m-0">Rallenta la velocità e amplia la tolleranza nei minigiochi timing</p>
          </div>
          <Switch
            checked={accessibleMode}
            onCheckedChange={(checked) => updateProfile({ accessibleMode: checked })}
            aria-label="Attiva modalità accessibile nei minigiochi"
          />
        </div>
      </div>
    </SettingsCard>
  );
}

// === Helpers ===

function formatChangelogDate(value: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function formatPermissionStatus(status: PermissionStatus) {
  if (status === 'unsupported') return 'non supportato';
  return status;
}
