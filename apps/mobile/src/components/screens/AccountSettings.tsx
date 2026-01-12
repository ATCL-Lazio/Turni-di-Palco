import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Camera,
  ChevronRight,
  FileText,
  History,
  KeyRound,
  LogOut,
  MapPin,
  Shield,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Screen } from '../ui/Screen';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { requestPermission } from '../../services/notifications';
import { Switch } from '../ui/switch';
import {
  getPermission,
  requestPermission,
  type NotificationPermissionState,
} from '../../lib/notifications';

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

type PermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';
type PermissionKey = 'notifications' | 'camera' | 'geolocation';

function formatChangelogDate(value: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function normalizePermissionState(state: PermissionState) {
  if (state === 'prompt') return 'default';
  return state;
}

function formatPermissionStatus(status: PermissionStatus) {
  if (status === 'unsupported') return 'non supportato';
  return status;
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
  const [permissionStatuses, setPermissionStatuses] = useState<Record<PermissionKey, PermissionStatus>>(
    {
      notifications: 'default',
      camera: 'default',
      geolocation: 'default',
    }
  );
  const [permissionMessages, setPermissionMessages] = useState<
    Record<PermissionKey, string | null>
  >({
    notifications: null,
    camera: null,
    geolocation: null,
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(() => getPermission());

  const notificationStatusLabel = (() => {
    switch (notificationPermission) {
      case 'granted':
        return 'Attive';
      case 'denied':
        return 'Bloccate';
      case 'default':
        return 'Da abilitare';
      default:
        return 'Non supportate';
    }
  })();

  useEffect(() => {
    let mounted = true;

    const loadAppInfo = async () => {
      setAppInfoStatus('loading');
      setAppInfoError(null);

      if (!isSupabaseConfigured || !supabase) {
        if (!mounted) return;
        setAppInfo({ version: '0.0.5', repo: null, changelog: [] });
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
        version: typeof data?.version === 'string' ? data.version : '0.0.5',
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

  useEffect(() => {
    let mounted = true;

    const updatePermissionStatuses = async () => {
      if (typeof navigator === 'undefined') return;
      if (!navigator.permissions?.query) {
        if (!mounted) return;
        setPermissionStatuses({
          notifications: 'unsupported',
          camera: 'unsupported',
          geolocation: 'unsupported',
        });
        return;
      }

      const [notifications, camera, geolocation] = await Promise.all([
        navigator.permissions
          .query({ name: 'notifications' as PermissionName })
          .then((result) => normalizePermissionState(result.state))
          .catch(() => 'unsupported'),
        navigator.permissions
          .query({ name: 'camera' as PermissionName })
          .then((result) => normalizePermissionState(result.state))
          .catch(() => 'unsupported'),
        navigator.permissions
          .query({ name: 'geolocation' as PermissionName })
          .then((result) => normalizePermissionState(result.state))
          .catch(() => 'unsupported'),
      ]);

      if (!mounted) return;
      setPermissionStatuses({
        notifications,
        camera,
        geolocation,
      });
    };

    updatePermissionStatuses();

    return () => {
      mounted = false;
    };
  }, []);

  const refreshPermissionStatuses = async () => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;

    const [notifications, camera, geolocation] = await Promise.all([
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((result) => normalizePermissionState(result.state))
        .catch(() => 'unsupported'),
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((result) => normalizePermissionState(result.state))
        .catch(() => 'unsupported'),
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((result) => normalizePermissionState(result.state))
        .catch(() => 'unsupported'),
    ]);

    setPermissionStatuses({
      notifications,
      camera,
      geolocation,
    });
  };

  const updatePermissionMessage = (key: PermissionKey, message: string | null) => {
    setPermissionMessages((prev) => ({
      ...prev,
      [key]: message,
    }));
  };

  const updatePermissionStatus = (key: PermissionKey, status: PermissionStatus) => {
    setPermissionStatuses((prev) => ({
      ...prev,
      [key]: status,
    }));
    setNotificationPermission(getPermission());
  }, []);

  const handleNotificationToggle = async (checked: boolean) => {
    if (notificationPermission === 'unsupported') {
      window.alert('Le notifiche di sistema non sono supportate su questo dispositivo.');
      return;
    }

    if (!checked) {
      window.alert('Puoi disattivare le notifiche dalle impostazioni del browser o del dispositivo.');
      setNotificationPermission(getPermission());
      return;
    }

    const nextPermission = await requestPermission();
    setNotificationPermission(nextPermission);

    if (nextPermission !== 'granted') {
      window.alert('Permesso notifiche non concesso.');
    }
  };

  const handleReset = () => {
    if (typeof window === 'undefined') return;
    const ok = window.confirm(
      'Vuoi davvero resettare i progressi? Questa modifica è irreversibile: cancelleremo turni, badge e statistiche e ti riporteremo alla scelta del ruolo.'
    );
    if (!ok) return;
    onResetProgress();
  };

  const handleNotificationPermission = async () => {
    updatePermissionMessage('notifications', null);
    const result = await requestPermission();

    if (result === 'unsupported') {
      updatePermissionStatus('notifications', 'unsupported');
      updatePermissionMessage('notifications', 'Le notifiche non sono supportate.');
      return;
    }

    updatePermissionStatus('notifications', result);
    updatePermissionMessage(
      'notifications',
      result === 'granted'
        ? 'Notifiche abilitate con successo.'
        : 'Permesso notifiche non concesso.'
    );
    await refreshPermissionStatuses();
  };

  const handleCameraPermission = async () => {
    updatePermissionMessage('camera', null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      updatePermissionStatus('camera', 'unsupported');
      updatePermissionMessage('camera', 'La fotocamera non è supportata.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      updatePermissionStatus('camera', 'granted');
      updatePermissionMessage('camera', 'Permesso fotocamera concesso.');
    } catch (error) {
      updatePermissionStatus('camera', 'denied');
      updatePermissionMessage('camera', 'Permesso fotocamera negato.');
    }

    await refreshPermissionStatuses();
  };

  const handleGeolocationPermission = async () => {
    updatePermissionMessage('geolocation', null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      updatePermissionStatus('geolocation', 'unsupported');
      updatePermissionMessage('geolocation', 'La geolocalizzazione non è supportata.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        updatePermissionStatus('geolocation', 'granted');
        updatePermissionMessage('geolocation', 'Permesso geolocalizzazione concesso.');
        void refreshPermissionStatuses();
      },
      () => {
        updatePermissionStatus('geolocation', 'denied');
        updatePermissionMessage('geolocation', 'Permesso geolocalizzazione negato.');
        void refreshPermissionStatuses();
      }
    );
  };

  const canRequestNotifications =
    typeof window !== 'undefined' && typeof window.Notification !== 'undefined';
  const canRequestCamera =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const canRequestGeolocation =
    typeof navigator !== 'undefined' && !!navigator.geolocation;

  return (
    <Screen
      withBottomNavPadding={false}
      className="relative items-start justify-start"
      contentClassName="relative w-full flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] space-y-0 box-border"
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

        <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] px-[12px] py-[12px] flex flex-col gap-[12px]">
          <div className="flex items-center gap-[12px]">
            <ShieldCheck className="text-[#f4bf4f]" size={24} />
            <div className="text-left">
              <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">
                Permessi app
              </p>
              <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">
                Gestisci accessi e autorizzazioni
              </p>
            </div>
          </div>
          <div className="border-t border-[#2d2728] pt-[10px] flex flex-col gap-[12px]">
            <div className="flex items-start justify-between gap-[12px]">
              <div className="flex items-start gap-[10px]">
                <Bell className="text-[#f4bf4f]" size={20} />
                <div>
                  <p className="text-[16px] leading-[25.6px] text-white !m-0">Notifiche</p>
                  <p className="text-[12px] leading-[18px] text-[#b8b2b3] !m-0">
                    Stato: {formatPermissionStatus(permissionStatuses.notifications)}
                  </p>
                  {permissionMessages.notifications ? (
                    <p className="text-[12px] leading-[18px] text-[#7a7577] !m-0">
                      {permissionMessages.notifications}
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={handleNotificationPermission}
                disabled={!canRequestNotifications}
                className="text-[12px] leading-[18px] px-[10px] py-[6px] rounded-[10px] border border-[#2d2728] text-white disabled:opacity-50"
              >
                Richiedi
              </button>
            </div>

            <div className="flex items-start justify-between gap-[12px]">
              <div className="flex items-start gap-[10px]">
                <Camera className="text-[#f4bf4f]" size={20} />
                <div>
                  <p className="text-[16px] leading-[25.6px] text-white !m-0">Fotocamera</p>
                  <p className="text-[12px] leading-[18px] text-[#b8b2b3] !m-0">
                    Stato: {formatPermissionStatus(permissionStatuses.camera)}
                  </p>
                  {permissionMessages.camera ? (
                    <p className="text-[12px] leading-[18px] text-[#7a7577] !m-0">
                      {permissionMessages.camera}
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCameraPermission}
                disabled={!canRequestCamera}
                className="text-[12px] leading-[18px] px-[10px] py-[6px] rounded-[10px] border border-[#2d2728] text-white disabled:opacity-50"
              >
                Richiedi
              </button>
            </div>

            <div className="flex items-start justify-between gap-[12px]">
              <div className="flex items-start gap-[10px]">
                <MapPin className="text-[#f4bf4f]" size={20} />
                <div>
                  <p className="text-[16px] leading-[25.6px] text-white !m-0">
                    Geolocalizzazione
                  </p>
                  <p className="text-[12px] leading-[18px] text-[#b8b2b3] !m-0">
                    Stato: {formatPermissionStatus(permissionStatuses.geolocation)}
                  </p>
                  {permissionMessages.geolocation ? (
                    <p className="text-[12px] leading-[18px] text-[#7a7577] !m-0">
                      {permissionMessages.geolocation}
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={handleGeolocationPermission}
                disabled={!canRequestGeolocation}
                className="text-[12px] leading-[18px] px-[10px] py-[6px] rounded-[10px] border border-[#2d2728] text-white disabled:opacity-50"
              >
                Richiedi
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] px-[12px] py-[12px] flex flex-col gap-[8px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[12px]">
              <Bell className="text-[#f4bf4f]" size={24} />
              <div className="text-left">
                <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">
                  Notifiche di sistema
                </p>
                <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">
                  Aggiornamenti su badge ed eventi
                </p>
              </div>
            </div>
            <Switch
              checked={notificationPermission === 'granted'}
              onCheckedChange={handleNotificationToggle}
              disabled={notificationPermission === 'unsupported'}
            />
          </div>
          <p className="text-[14px] leading-[20px] text-[#b8b2b3]">
            Stato: {notificationStatusLabel}
          </p>
          {notificationPermission === 'unsupported' ? (
            <p className="text-[14px] leading-[20px] text-[#ff4d4f]">
              Le notifiche di sistema non sono disponibili su questo dispositivo.
            </p>
          ) : null}
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
