/**
 * Test di unità per la logica pura delle azioni di gioco estratta da store.tsx.
 */

import { describe, expect, it } from 'vitest';
import {
  applyActivityCompletionToProfile,
  applyShopPurchaseToProfile,
  buildActivityCompletionResult,
  buildActivitySlotsFromCompletion,
  buildShopPurchaseResult,
} from '../state/game-actions';
import { createDefaultState } from '../state/persistence';
import type { ActivityCompletionRpcRow, ShopPurchaseRpcRow } from '../state/supabase-mappers';
import type { Activity } from '../state/types';

const profile = { ...createDefaultState().profile, cachet: 50, reputation: 10, extraActivitySlots: 0 };

function shopRow(overrides: Partial<ShopPurchaseRpcRow> = {}): ShopPurchaseRpcRow {
  return {
    purchase_applied: true,
    status: 'applied',
    rejection_reason: null,
    cachet_balance_after: 30,
    profile_reputation_after: 12,
    extra_slots_after: 1,
    theatre: null,
    theatre_reputation_after: null,
    effect: { kind: 'slot' },
    ...overrides,
  };
}

function activityRow(overrides: Partial<ActivityCompletionRpcRow> = {}): ActivityCompletionRpcRow {
  return {
    activity_registered: true,
    status: 'applied',
    rejection_reason: null,
    rewards_applied: { xp: 5, cachet: 4, reputation: 1 },
    slots_used_today: 1,
    slots_total: 3,
    cachet_balance_after: 54,
    reputation_after: 11,
    ...overrides,
  };
}

const activity: Activity = {
  id: 'a1',
  title: 'Prova',
  description: 'Desc',
  duration: '30 min',
  xpReward: 5,
  cachetReward: 4,
  difficulty: 'Facile',
};

describe('buildShopPurchaseResult', () => {
  it('acquisto applicato', () => {
    expect(buildShopPurchaseResult(shopRow())).toEqual({
      ok: true,
      status: 'applied',
      cachetBalanceAfter: 30,
      reputationAfter: 12,
      extraSlotsAfter: 1,
      theatre: null,
      theatreReputationAfter: null,
      effect: { kind: 'slot' },
    });
  });

  it('acquisto duplicato', () => {
    expect(buildShopPurchaseResult(shopRow({ status: 'duplicate' }))).toMatchObject({ ok: true, status: 'duplicate' });
  });

  it("distingue l'errore server dal rifiuto per regole di business", () => {
    expect(
      buildShopPurchaseResult(shopRow({ purchase_applied: false, status: 'error', rejection_reason: 'boom' })),
    ).toEqual({ ok: false, status: 'error', error: 'boom' });
    expect(
      buildShopPurchaseResult(shopRow({ purchase_applied: false, status: 'error', rejection_reason: null })),
    ).toMatchObject({ error: "Errore server durante l'acquisto." });
    expect(
      buildShopPurchaseResult(shopRow({ purchase_applied: false, status: 'rejected', rejection_reason: 'saldo' })),
    ).toEqual({ ok: false, status: 'rejected', error: 'Acquisto non applicato.', rejectionReason: 'saldo' });
  });
});

describe('applyShopPurchaseToProfile', () => {
  it('allinea cachet, reputazione e slot ai valori del server', () => {
    const next = applyShopPurchaseToProfile(profile, shopRow());
    expect(next).toMatchObject({ cachet: 30, reputation: 12, extraActivitySlots: 1 });
  });

  it('lascia invariato il profilo su un duplicato', () => {
    expect(applyShopPurchaseToProfile(profile, shopRow({ status: 'duplicate' }))).toBe(profile);
  });
});

describe('buildActivitySlotsFromCompletion', () => {
  it('calcola gli slot rimanenti', () => {
    const { status, slotsUsedToday, slotsTotal } = buildActivitySlotsFromCompletion(activityRow());
    expect(status).toEqual({ usedToday: 1, totalSlots: 3, remainingSlots: 2 });
    expect([slotsUsedToday, slotsTotal]).toEqual([1, 3]);
  });

  it('usa default sicuri per valori non numerici e non va sotto zero', () => {
    const odd = buildActivitySlotsFromCompletion(
      activityRow({ slots_used_today: Number.NaN, slots_total: Number.NaN }),
    );
    expect(odd.status).toEqual({ usedToday: 0, totalSlots: 3, remainingSlots: 3 });
    const over = buildActivitySlotsFromCompletion(activityRow({ slots_used_today: 5, slots_total: 3 }));
    expect(over.status.remainingSlots).toBe(0);
  });
});

describe('buildActivityCompletionResult', () => {
  const slots = { slotsUsedToday: 1, slotsTotal: 3 };

  it('attività registrata', () => {
    expect(buildActivityCompletionResult(activityRow(), activity, slots)).toEqual({
      ok: true,
      activity,
      rewards: { xp: 5, cachet: 4, reputation: 1 },
      slotsUsedToday: 1,
      slotsTotal: 3,
      cachetBalanceAfter: 54,
      reputationAfter: 11,
      isDuplicate: false,
    });
  });

  it('segnala il duplicato', () => {
    expect(buildActivityCompletionResult(activityRow({ status: 'duplicate' }), activity, slots)).toMatchObject({
      ok: true,
      isDuplicate: true,
    });
  });

  it('limite giornaliero raggiunto', () => {
    expect(
      buildActivityCompletionResult(
        activityRow({ activity_registered: false, rejection_reason: 'limit' }),
        activity,
        slots,
      ),
    ).toEqual({
      ok: false,
      error: 'Limite giornaliero attività raggiunto.',
      rejectionReason: 'limit',
      slotsUsedToday: 1,
      slotsTotal: 3,
    });
  });
});

describe('applyActivityCompletionToProfile', () => {
  it('applica le ricompense e poi allinea cachet e reputazione al server', () => {
    const next = applyActivityCompletionToProfile(profile, activityRow());
    expect(next.xpTotal).toBe(profile.xpTotal + 5);
    expect(next.cachet).toBe(54);
    expect(next.reputation).toBe(11);
  });

  it('lascia invariato il profilo su un duplicato', () => {
    expect(applyActivityCompletionToProfile(profile, activityRow({ status: 'duplicate' }))).toBe(profile);
  });
});
