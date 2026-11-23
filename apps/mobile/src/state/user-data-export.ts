/**
 * Export dati utente (GDPR Art. 15/20 – diritto di accesso e portabilità),
 * estratto da store.tsx.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyCriticalError } from './errors';
import { mapDbTurnRow, type DbTurnRow } from './supabase-mappers';
import type { Badge, EventPlanning, PlayerProfile, TheatreReputation, TurnRecord } from './types';

const MAXWELL_HISTORY_PREFIX = 'tdp-maxwell-history:';

/** Raccoglie la cronologia chat di Maxwell salvata in localStorage. */
export function collectMaxwellChatHistory(storage: Storage | undefined): Record<string, unknown> {
  const chatHistory: Record<string, unknown> = {};
  if (!storage) return chatHistory;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(MAXWELL_HISTORY_PREFIX)) {
      try {
        chatHistory[key] = JSON.parse(storage.getItem(key) || '[]');
      } catch {
        chatHistory[key] = storage.getItem(key);
      }
    }
  }
  return chatHistory;
}

export type RemoteExportData = {
  turns: TurnRecord[] | null;
  activityCompletions: unknown[];
  narrativeHistory: unknown[];
  shopPurchases: unknown[];
  ticketActivationsActivated: unknown[];
  ticketActivationsReserved: unknown[];
  ticketActivationsAttendee: unknown[];
};

export const EMPTY_REMOTE_EXPORT_DATA: RemoteExportData = {
  turns: null,
  activityCompletions: [],
  narrativeHistory: [],
  shopPurchases: [],
  ticketActivationsActivated: [],
  ticketActivationsReserved: [],
  ticketActivationsAttendee: [],
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/**
 * Scarica da Supabase tutti i dati personali dell'utente.
 *
 * Fix #1229: fetch ALL turns directly from Supabase at export time so the
 * GDPR export is complete regardless of the MAX_TURNS=20 in-memory cap.
 * Fix #1231: also fetch activity_completions, narrative_history, and
 * shop_purchases in parallel — all tables deleted by delete-my-account must
 * be present in the Art. 15/20 export.
 * Fix #1407: include ticket_activations — deleted by delete-my-account under
 * both activated_by and reserved_by, so it qualifies as personal data and
 * must be exportable under Art. 15/20 symmetrically with deletion (Art. 17).
 *
 * `turns` is null when the turns query returned no array, so the caller can
 * fall back to the in-memory turns.
 */
export async function fetchRemoteExportData(client: SupabaseClient, authUserId: string): Promise<RemoteExportData> {
  const [
    { data: turnsData, error: turnsError },
    { data: activityData, error: activityError },
    { data: narrativeData, error: narrativeError },
    { data: shopData, error: shopError },
    { data: ticketActivatedData, error: ticketActivatedError },
    { data: ticketReservedData, error: ticketReservedError },
    { data: ticketAttendeeData, error: ticketAttendeeError },
  ] = await Promise.all([
    client
      .from('turns')
      .select('*')
      .eq('user_id', authUserId)
      .order('created_at', { ascending: false })
      .limit(10000),
    client
      .from('activity_completions')
      .select('*')
      .eq('user_id', authUserId)
      .order('created_at', { ascending: false })
      .limit(10000),
    client
      .from('narrative_history')
      .select('*')
      .eq('user_id', authUserId)
      .order('created_at', { ascending: false })
      .limit(10000),
    client
      .from('shop_purchases')
      .select('*')
      .eq('user_id', authUserId)
      .order('created_at', { ascending: false })
      .limit(10000),
    // Tickets this user activated by scanning a QR code.
    client
      .from('ticket_activations')
      .select('*')
      .eq('activated_by', authUserId)
      .order('activated_at', { ascending: false })
      .limit(10000),
    // Tickets this user generated as an admin (reserved_by), including
    // unactivated ones (activated_by IS NULL). Mirrors the reserved_by
    // deletion in delete-my-account (GDPR Art. 17 ↔ Art. 15/20 symmetry).
    client
      .from('ticket_activations')
      .select('*')
      .eq('reserved_by', authUserId)
      .order('created_at', { ascending: false })
      .limit(10000),
    // Tickets assigned to this user as a named attendee (attendee_id).
    // Deleted by delete-my-account under attendee_id but previously missing
    // from the Art. 15/20 export — restores GDPR symmetry (closes #1595).
    client
      .from('ticket_activations')
      .select('*')
      .eq('attendee_id', authUserId)
      .order('created_at', { ascending: false })
      .limit(10000),
  ]);
  // Fail loudly if any query errors so the user is not shown a silently
  // incomplete GDPR export (fixes #1253).
  const queryErrors: { table: string; error: unknown }[] = [];
  if (turnsError) queryErrors.push({ table: 'turns', error: turnsError });
  if (activityError) queryErrors.push({ table: 'activity_completions', error: activityError });
  if (narrativeError) queryErrors.push({ table: 'narrative_history', error: narrativeError });
  if (shopError) queryErrors.push({ table: 'shop_purchases', error: shopError });
  if (ticketActivatedError) queryErrors.push({ table: 'ticket_activations(activated_by)', error: ticketActivatedError });
  if (ticketReservedError) queryErrors.push({ table: 'ticket_activations(reserved_by)', error: ticketReservedError });
  if (ticketAttendeeError) queryErrors.push({ table: 'ticket_activations(attendee_id)', error: ticketAttendeeError });
  if (queryErrors.length > 0) {
    const tables = queryErrors.map((e) => e.table).join(', ');
    notifyCriticalError(
      `Esportazione dati incompleta: impossibile recuperare i dati dalle tabelle: ${tables}. Riprova più tardi.`,
      queryErrors.map((e) => e.error),
    );
    throw new Error(`exportUserData: query failed for tables: ${tables}`);
  }

  return {
    turns: Array.isArray(turnsData) ? (turnsData as DbTurnRow[]).map(mapDbTurnRow) : null,
    activityCompletions: asArray(activityData),
    narrativeHistory: asArray(narrativeData),
    shopPurchases: asArray(shopData),
    ticketActivationsActivated: asArray(ticketActivatedData),
    ticketActivationsReserved: asArray(ticketReservedData),
    ticketActivationsAttendee: asArray(ticketAttendeeData),
  };
}

export type UserDataExportInput = {
  profile: PlayerProfile;
  turns: TurnRecord[];
  remote: Omit<RemoteExportData, 'turns'>;
  badges: Badge[];
  theatreReputation: TheatreReputation[];
  plannedEvents: EventPlanning[];
  chatHistory: Record<string, unknown>;
  exportDate: Date;
};

/** Costruisce il documento JSON dell'export. */
export function buildUserDataExport({
  profile,
  turns,
  remote,
  badges,
  theatreReputation,
  plannedEvents,
  chatHistory,
  exportDate,
}: UserDataExportInput) {
  return {
    exportDate: exportDate.toISOString(),
    profile: {
      name: profile.name,
      email: profile.email,
      roleId: profile.roleId,
      xp: profile.xp,
      xpTotal: profile.xpTotal,
      xpField: profile.xpField,
      reputation: profile.reputation,
      cachet: profile.cachet,
      tokenAtcl: profile.tokenAtcl,
      lastActivityAt: new Date(profile.lastActivityAt).toISOString(),
      leaderboardVisible: profile.leaderboardVisible,
      level: profile.level,
      xpToNextLevel: profile.xpToNextLevel,
      extraActivitySlots: profile.extraActivitySlots,
      profileImage: profile.profileImage ?? null,
      skills: profile.skills,
      activeCourses: profile.activeCourses,
      completedCourses: profile.completedCourses,
      onboardingCompletedAt: profile.onboardingCompletedAt ?? null,
      onboardingVariant: profile.onboardingVariant ?? null,
    },
    turns,
    activityCompletions: remote.activityCompletions,
    narrativeHistory: remote.narrativeHistory,
    shopPurchases: remote.shopPurchases,
    ticketActivationsActivated: remote.ticketActivationsActivated,
    ticketActivationsReserved: remote.ticketActivationsReserved,
    ticketActivationsAttendee: remote.ticketActivationsAttendee,
    badges,
    theatreReputation,
    plannedEvents,
    chatHistory,
  };
}

export function buildUserDataExportFileName(profileName: string, now: number): string {
  const safeName = profileName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'profilo';
  return `turni-di-palco-${safeName}-${now}.json`;
}

/** Avvia il download del JSON nel browser. */
export function downloadJson(data: unknown, fileName: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revoking the object URL to give the browser time to start the download.
  // Calling revokeObjectURL synchronously after a.click() can silently abort the
  // download on Firefox and slow devices before the fetch begins (closes #1235).
  window.setTimeout(() => URL.revokeObjectURL(url), 100);
}
