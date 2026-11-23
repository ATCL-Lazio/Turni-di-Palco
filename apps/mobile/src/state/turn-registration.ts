/**
 * Logica pura della registrazione turno, estratta da store.tsx.
 * Il provider conserva guard, geolocalizzazione, RPC, coda offline e setState.
 */

import { MAX_TURNS } from './constants';
import { applyRewards, computeTurnRewards } from './rewards';
import type {
  GameEvent,
  GameState,
  RegisterTurnResult,
  RoleId,
  Rewards,
  TurnRecord,
  TurnSyncFeedback,
  TurnSyncStatus,
} from './types';

export type LocalTurnOutcome = {
  rewards: Rewards;
  boostApplied: boolean;
  boostRejectionReason: string | null;
  nextTokenAtcl: number;
  syncStatus: TurnSyncStatus;
};

/**
 * Esito di un turno registrato in locale (modalità demo, senza Supabase):
 * un boost richiesto consuma un token e dà +10% di XP e cachet, altrimenti
 * ripiega su `failed_boost_fallback`.
 */
export function computeLocalTurnOutcome(
  event: GameEvent,
  roleId: RoleId,
  boostRequested: boolean,
  tokenAtcl: number,
): LocalTurnOutcome {
  let boostApplied = false;
  let boostRejectionReason: string | null = null;
  let rewards = computeTurnRewards(event, roleId);
  let nextTokenAtcl = tokenAtcl;
  if (boostRequested) {
    if (nextTokenAtcl > 0) {
      boostApplied = true;
      nextTokenAtcl -= 1;
      rewards = {
        ...rewards,
        xp: Math.ceil(rewards.xp * 1.1),
        cachet: Math.ceil(rewards.cachet * 1.1),
      };
    } else {
      boostRejectionReason = 'insufficient_token_balance';
    }
  }
  const syncStatus: TurnSyncStatus = boostRequested && !boostApplied ? 'failed_boost_fallback' : 'synced';
  return { rewards, boostApplied, boostRejectionReason, nextTokenAtcl, syncStatus };
}

/** Stato dopo un turno registrato in locale: ricompense, token e turno in testa alla lista. */
export function applyLocalTurn(prev: GameState, outcome: LocalTurnOutcome, turn: TurnRecord): GameState {
  const rewardedProfile = applyRewards(prev.profile, outcome.rewards, 'turn');
  return {
    profile: {
      ...rewardedProfile,
      tokenAtcl: outcome.nextTokenAtcl,
    },
    eventPlans: prev.eventPlans,
    turns: [turn, ...prev.turns].slice(0, MAX_TURNS),
  };
}

/**
 * Aggiunge il turno `pending` alla lista (o ne aggiorna uno con lo stesso id),
 * così compare nello storico mentre aspetta il flush della coda offline
 * (closes #1528). È idempotente.
 */
export function upsertPendingTurn(turns: TurnRecord[], pending: TurnRecord): TurnRecord[] {
  const alreadyPresent = turns.some((t) => t.id === pending.id);
  return (alreadyPresent
    ? turns.map((t) => (t.id === pending.id ? { ...t, ...pending } : t))
    : [pending, ...turns]
  ).slice(0, MAX_TURNS);
}

/** Feedback mostrato quando il turno è in coda e non ancora sincronizzato. */
export function buildPendingTurnFeedback(
  eventName: string,
  boostRequested: boolean,
  geolocationAvailable: boolean,
  createdAt: number,
): TurnSyncFeedback {
  return {
    syncStatus: 'pending',
    boostRequested,
    boostApplied: false,
    boostRejectionReason: null,
    eventName,
    createdAt,
    geolocationAvailable,
  };
}

/** Risultato restituito alla UI per un turno messo in coda. */
export function buildPendingTurnResult(pending: TurnRecord, boostRequested: boolean): RegisterTurnResult {
  return {
    ok: true,
    syncStatus: 'pending',
    boostRequested,
    boostApplied: false,
    boostRejectionReason: null,
    rewards: pending.rewards,
    tokenBalanceAfter: null,
    turn: pending,
  };
}
