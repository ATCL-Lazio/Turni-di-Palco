/**
 * Test di unità per la logica pura della registrazione turno estratta da store.tsx.
 */

import { describe, expect, it } from 'vitest';
import { MAX_TURNS } from '../state/constants';
import { createDefaultState } from '../state/persistence';
import {
  applyLocalTurn,
  buildPendingTurnFeedback,
  buildPendingTurnResult,
  computeLocalTurnOutcome,
  upsertPendingTurn,
} from '../state/turn-registration';
import type { GameEvent, TurnRecord } from '../state/types';

const event: GameEvent = {
  id: 'e1',
  name: 'Amleto',
  theatre: 'Argentina',
  date: '2026-12-01',
  time: '21:00',
  genre: 'Prosa',
  baseRewards: { xp: 100, reputation: 3, cachet: 50 },
  focusRole: 'luci',
};

function turn(id: string, createdAt = 0, overrides: Partial<TurnRecord> = {}): TurnRecord {
  return {
    id,
    eventId: 'e1',
    eventName: 'Amleto',
    theatre: 'Argentina',
    date: '2026-12-01',
    time: '21:00',
    roleId: 'luci',
    rewards: { xp: 1, reputation: 1, cachet: 1 },
    createdAt,
    ...overrides,
  };
}

describe('computeLocalTurnOutcome', () => {
  it('senza boost non tocca i token', () => {
    const outcome = computeLocalTurnOutcome(event, 'attore', false, 2);
    expect(outcome).toMatchObject({
      boostApplied: false,
      boostRejectionReason: null,
      nextTokenAtcl: 2,
      syncStatus: 'synced',
      rewards: { xp: 100, cachet: 50, reputation: 3 },
    });
  });

  it('con boost e token disponibili consuma un token e dà +10%', () => {
    const outcome = computeLocalTurnOutcome(event, 'attore', true, 1);
    expect(outcome).toMatchObject({
      boostApplied: true,
      nextTokenAtcl: 0,
      syncStatus: 'synced',
      // Stessa formula del codice: il risultato in virgola mobile viene arrotondato per eccesso.
      rewards: { xp: Math.ceil(100 * 1.1), cachet: Math.ceil(50 * 1.1) },
    });
  });

  it('con boost ma senza token ripiega su failed_boost_fallback', () => {
    const outcome = computeLocalTurnOutcome(event, 'attore', true, 0);
    expect(outcome).toMatchObject({
      boostApplied: false,
      boostRejectionReason: 'insufficient_token_balance',
      nextTokenAtcl: 0,
      syncStatus: 'failed_boost_fallback',
      rewards: { xp: 100, cachet: 50 },
    });
  });

  it('il ruolo in focus aggiunge il bonus', () => {
    expect(computeLocalTurnOutcome(event, 'luci', false, 0).rewards.xp).toBe(115);
  });
});

describe('applyLocalTurn', () => {
  it('applica ricompense e token e mette il turno in testa, mantenendo i piani', () => {
    const prev = createDefaultState();
    const outcome = computeLocalTurnOutcome(event, 'attore', true, 1);
    const record = turn('t1');
    const next = applyLocalTurn({ ...prev, turns: [turn('old')] }, outcome, record);
    expect(next.turns.map((t) => t.id)).toEqual(['t1', 'old']);
    expect(next.profile.tokenAtcl).toBe(0);
    expect(next.profile.xpTotal).toBe(prev.profile.xpTotal + Math.ceil(100 * 1.1));
    expect(next.eventPlans).toBe(prev.eventPlans);
  });

  it(`taglia la lista a ${MAX_TURNS} turni`, () => {
    const prev = { ...createDefaultState(), turns: Array.from({ length: MAX_TURNS }, (_, i) => turn(`t${i}`)) };
    const next = applyLocalTurn(prev, computeLocalTurnOutcome(event, 'attore', false, 0), turn('nuovo'));
    expect(next.turns).toHaveLength(MAX_TURNS);
    expect(next.turns[0].id).toBe('nuovo');
  });
});

describe('upsertPendingTurn', () => {
  it('aggiunge in testa un turno nuovo', () => {
    expect(upsertPendingTurn([turn('a')], turn('b')).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('è idempotente: aggiorna un turno con lo stesso id', () => {
    const once = upsertPendingTurn([turn('a')], turn('b', 5, { syncStatus: 'pending' }));
    const twice = upsertPendingTurn(once, turn('b', 5, { syncStatus: 'pending' }));
    expect(twice).toHaveLength(2);
    expect(twice[0]).toMatchObject({ id: 'b', syncStatus: 'pending' });
  });

  it(`taglia la lista a ${MAX_TURNS} turni`, () => {
    const full = Array.from({ length: MAX_TURNS }, (_, i) => turn(`t${i}`));
    expect(upsertPendingTurn(full, turn('nuovo'))).toHaveLength(MAX_TURNS);
  });
});

describe('pending turn feedback and result', () => {
  it('costruiscono feedback e risultato coerenti', () => {
    const pending = turn('p1', 0, { syncStatus: 'pending' });
    expect(buildPendingTurnFeedback('Amleto', true, false, 123)).toEqual({
      syncStatus: 'pending',
      boostRequested: true,
      boostApplied: false,
      boostRejectionReason: null,
      eventName: 'Amleto',
      createdAt: 123,
      geolocationAvailable: false,
    });
    expect(buildPendingTurnResult(pending, true)).toEqual({
      ok: true,
      syncStatus: 'pending',
      boostRequested: true,
      boostApplied: false,
      boostRejectionReason: null,
      rewards: pending.rewards,
      tokenBalanceAfter: null,
      turn: pending,
    });
  });
});
