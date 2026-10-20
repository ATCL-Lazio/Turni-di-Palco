import { formatErrorDetails, reportCriticalError } from '../services/error-handler';
import { isRecord } from './normalizers';
import { isNavigatorOffline } from './offline-sync-queue';

export function notifyCriticalError(message: string, errors: unknown[]) {
  const details = formatErrorDetails(errors);
  reportCriticalError({
    message,
    details: details || undefined,
  });
}

export function formatSyncError(error: unknown) {
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (isRecord(error)) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

const TURN_REGISTRATION_ERROR_MESSAGES: Array<{ token: string; message: string }> = [
  {
    token: 'geolocation_required',
    message: 'Geolocalizzazione obbligatoria per confermare il turno. Abilita il GPS e riprova.',
  },
  {
    token: 'outside_geofence',
    message: "Sei fuori dal raggio del teatro. Avvicinati al luogo dell'evento e riprova.",
  },
  {
    token: 'invalid_checkin_latitude',
    message: 'Coordinate GPS non valide (latitudine). Riprova dopo aver aggiornato la posizione.',
  },
  {
    token: 'invalid_checkin_longitude',
    message: 'Coordinate GPS non valide (longitudine). Riprova dopo aver aggiornato la posizione.',
  },
  {
    token: 'theatre_geofence_not_configured',
    message: 'Geofence non configurato per questo teatro. Contatta il supporto ATCL.',
  },
  {
    token: 'theatres_table_not_found',
    message: 'Configurazione teatri assente sul server. Contatta il supporto ATCL.',
  },
  {
    token: 'theatres_geodata_columns_missing',
    message: 'Configurazione coordinate teatri incompleta sul server. Contatta il supporto ATCL.',
  },
  {
    token: 'already_registered',
    message: 'Hai già registrato un turno per questo evento.',
  },
  {
    token: 'invalid_coordinates',
    message: 'Coordinate GPS non valide. Verifica il GPS e riprova.',
  },
  {
    token: 'registration_window_expired',
    message: 'Non è più possibile registrare questo turno: la finestra di registrazione è scaduta.',
  },
];

export function localizeTurnRegistrationError(error: unknown): string {
  const raw = formatSyncError(error);
  const normalized = raw.toLowerCase();
  for (const entry of TURN_REGISTRATION_ERROR_MESSAGES) {
    if (normalized.includes(entry.token)) {
      return entry.message;
    }
  }
  return raw;
}

function getSyncErrorStatus(error: unknown): number | null {
  if (!isRecord(error)) return null;
  const status = error.status;
  if (typeof status === 'number' && Number.isFinite(status)) return status;
  if (typeof status === 'string') {
    const parsed = Number.parseInt(status, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getSyncErrorCode(error: unknown): string | null {
  if (!isRecord(error)) return null;
  const code = error.code;
  return typeof code === 'string' && code.trim() ? code.trim() : null;
}

export function isDuplicateSyncError(error: unknown) {
  const code = getSyncErrorCode(error);
  if (code === '23505') return true;
  const status = getSyncErrorStatus(error);
  if (status === 409) return true;
  const message = formatSyncError(error).toLowerCase();
  return (
    message.includes('duplicate') ||
    message.includes('already exists') ||
    message.includes('already followed') ||
    message.includes('already_registered')
  );
}

export function shouldRetrySyncError(error: unknown) {
  if (isNavigatorOffline()) return true;
  const status = getSyncErrorStatus(error);
  if (status != null) {
    // 401 and 403 are permanent authentication/authorization failures — the
    // same token will still be invalid on every retry, so re-sending the
    // request wastes the entire backoff budget and may trigger server-side rate
    // limiting. These should be surfaced as dead-letter failures immediately
    // rather than retried (closes #1314).
    if (status === 401 || status === 403) return false;
    if (status === 0 || status === 408 || status === 429) {
      return true;
    }
    if (status >= 500) return true;
  }
  const message = formatSyncError(error).toLowerCase();
  return (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('timeout') ||
    message.includes('tempor')
  );
}
