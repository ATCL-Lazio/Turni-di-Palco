/**
 * Logica pura delle azioni di gioco che passano da una RPC (acquisto shop,
 * completamento attività), estratta da store.tsx. Il provider conserva
 * guard, chiamata RPC e setState; qui vive la traduzione della risposta.
 */

import { applyRewards } from './rewards';
import type { ActivityCompletionRpcRow, ShopPurchaseRpcRow } from './supabase-mappers';
import type {
  Activity,
  ActivitySlotsStatus,
  CompleteActivityResult,
  PlayerProfile,
  ShopPurchaseResult,
} from './types';

/** Esito mostrato alla UI per la risposta di purchase_shop_item. */
export function buildShopPurchaseResult(row: ShopPurchaseRpcRow): ShopPurchaseResult {
  if (!row.purchase_applied) {
    // Distinguish server-side errors (transient, retryable) from business-rule
    // rejections (role mismatch, insufficient balance, etc.) so the UI can
    // present the correct message and allow retry when appropriate (closes #1355).
    if (row.status === 'error') {
      return {
        ok: false,
        status: 'error',
        error: row.rejection_reason ?? "Errore server durante l'acquisto.",
      };
    }
    return {
      ok: false,
      status: 'rejected',
      error: 'Acquisto non applicato.',
      rejectionReason: row.rejection_reason,
    };
  }

  return {
    ok: true,
    status: row.status === 'duplicate' ? 'duplicate' : 'applied',
    cachetBalanceAfter: row.cachet_balance_after,
    reputationAfter: row.profile_reputation_after,
    extraSlotsAfter: row.extra_slots_after,
    theatre: row.theatre,
    theatreReputationAfter: row.theatre_reputation_after,
    effect: row.effect,
  };
}

/**
 * Profilo dopo un acquisto shop applicato. Un duplicato lascia il profilo
 * invariato: l'acquisto è già stato conteggiato e i saldi del server
 * potrebbero essere precedenti all'acquisto.
 */
export function applyShopPurchaseToProfile(profile: PlayerProfile, row: ShopPurchaseRpcRow): PlayerProfile {
  if (row.status === 'duplicate') return profile;
  return {
    ...profile,
    cachet: row.cachet_balance_after,
    reputation: row.profile_reputation_after,
    extraActivitySlots: row.extra_slots_after,
  };
}

/** Slot giornalieri dalla risposta di complete_activity_with_slots, con default sicuri. */
export function buildActivitySlotsFromCompletion(row: ActivityCompletionRpcRow): {
  slotsUsedToday: number;
  slotsTotal: number;
  status: ActivitySlotsStatus;
} {
  const slotsUsedToday = Number.isFinite(row.slots_used_today) ? row.slots_used_today : 0;
  const slotsTotal = Number.isFinite(row.slots_total) ? row.slots_total : 3;
  return {
    slotsUsedToday,
    slotsTotal,
    status: {
      usedToday: slotsUsedToday,
      totalSlots: slotsTotal,
      remainingSlots: Math.max(0, slotsTotal - slotsUsedToday),
    },
  };
}

/** Esito mostrato alla UI per la risposta di complete_activity_with_slots. */
export function buildActivityCompletionResult(
  row: ActivityCompletionRpcRow,
  activity: Activity,
  slots: { slotsUsedToday: number; slotsTotal: number },
): CompleteActivityResult {
  if (!row.activity_registered) {
    return {
      ok: false,
      error: 'Limite giornaliero attività raggiunto.',
      rejectionReason: row.rejection_reason,
      slotsUsedToday: slots.slotsUsedToday,
      slotsTotal: slots.slotsTotal,
    };
  }
  return {
    ok: true,
    activity,
    rewards: row.rewards_applied,
    slotsUsedToday: slots.slotsUsedToday,
    slotsTotal: slots.slotsTotal,
    cachetBalanceAfter: row.cachet_balance_after,
    reputationAfter: row.reputation_after,
    isDuplicate: row.status === 'duplicate',
  };
}

/**
 * Profilo dopo un'attività registrata: applica le ricompense e poi allinea
 * cachet e reputazione al server. Un duplicato lascia il profilo invariato.
 */
export function applyActivityCompletionToProfile(
  profile: PlayerProfile,
  row: ActivityCompletionRpcRow,
): PlayerProfile {
  if (row.status === 'duplicate') return profile;
  return {
    ...applyRewards(profile, row.rewards_applied, 'activity'),
    cachet: row.cachet_balance_after,
    reputation: row.reputation_after,
  };
}
