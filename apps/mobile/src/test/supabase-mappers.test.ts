/**
 * Test di unità per i mapper riga DB → dominio estratti da store.tsx.
 */

import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../state/persistence';
import {
  mapDbActivityRow,
  mapDbEventRow,
  mapDbRoleRow,
  mapDbTurnRow,
  mergeHydratedProfileRow,
  mergeRealtimeProfileRow,
} from '../state/supabase-mappers';
import type { PlayerProfile } from '../state/types';

function baseProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    ...createDefaultState().profile,
    name: 'Locale',
    email: 'locale@example.com',
    roleId: 'luci',
    xp: 10,
    cachet: 5,
    lastActivityAt: 1_000,
    onboardingVariant: 'full',
    ...overrides,
  };
}

describe('mapDbRoleRow', () => {
  it('ripiega su "attore" per id sconosciuti e converte le stats in numeri', () => {
    const role = mapDbRoleRow({
      id: 'sconosciuto',
      name: 'Ruolo',
      focus: 'Focus',
      stats: { presence: 3, precision: undefined },
      role_profile: null,
    });
    expect(role.id).toBe('attore');
    expect(role.stats).toEqual({ presence: 3, precision: 0, leadership: 0, creativity: 0 });
  });
});

describe('mapDbEventRow', () => {
  it('normalizza testo e premi mancanti', () => {
    const event = mapDbEventRow({
      id: 'e1',
      name: '  Amleto  ',
      theatre: 'Teatro',
      event_date: '2026-11-23',
      event_time: null,
      genre: 'Prosa',
      base_rewards: { xp: 40 },
      focus_role: null,
    });
    expect(event.id).toBe('e1');
    expect(event.time).toBe('');
    expect(event.baseRewards).toEqual({ xp: 40, reputation: 0, cachet: 0 });
    expect(event.focusRole).toBeUndefined();
  });
});

describe('mapDbActivityRow', () => {
  it('rinomina i campi snake_case', () => {
    expect(
      mapDbActivityRow({
        id: 'a1',
        title: 'Prova',
        description: 'Desc',
        duration: '30 min',
        xp_reward: 50,
        cachet_reward: 20,
        difficulty: 'Facile',
      }),
    ).toEqual({
      id: 'a1',
      title: 'Prova',
      description: 'Desc',
      duration: '30 min',
      xpReward: 50,
      cachetReward: 20,
      difficulty: 'Facile',
    });
  });
});

describe('mapDbTurnRow', () => {
  it('mappa un turno completo', () => {
    const turn = mapDbTurnRow({
      id: 't1',
      event_id: 'e1',
      event_name: 'Amleto',
      theatre: 'Teatro',
      event_date: '2026-11-23',
      event_time: '21:00',
      role_id: 'fonico',
      rewards: { xp: 10, reputation: 2, cachet: 3 },
      created_at: '2026-11-23T10:00:00.000Z',
    });
    expect(turn).toMatchObject({
      id: 't1',
      eventId: 'e1',
      roleId: 'fonico',
      rewards: { xp: 10, reputation: 2, cachet: 3 },
      createdAt: Date.parse('2026-11-23T10:00:00.000Z'),
    });
  });

  it('usa default sicuri per campi mancanti', () => {
    const turn = mapDbTurnRow({ id: 't2', role_id: 'boh' });
    expect(turn.eventId).toBe('');
    expect(turn.roleId).toBe('attore');
    expect(turn.rewards).toEqual({ xp: 0, reputation: 0, cachet: 0 });
    expect(typeof turn.createdAt).toBe('number');
  });
});

describe('mergeHydratedProfileRow', () => {
  it('preferisce i valori remoti e conserva quelli locali dove il remoto è null', () => {
    const prev = baseProfile();
    const merged = mergeHydratedProfileRow(
      prev,
      { name: 'Remoto', xp: 99, cachet: null, role_id: 'palco', last_activity_at: 'non-una-data' },
      { email: 'auth@example.com', user_metadata: {} },
    );
    expect(merged.name).toBe('Remoto');
    expect(merged.xp).toBe(99);
    expect(merged.cachet).toBe(5);
    expect(merged.roleId).toBe('palco');
    // Data non valida → mantiene il valore locale.
    expect(merged.lastActivityAt).toBe(1_000);
  });

  it('ignora varianti di onboarding sconosciute', () => {
    const merged = mergeHydratedProfileRow(baseProfile(), { onboarding_variant: 'altro' }, null);
    expect(merged.onboardingVariant).toBe('full');
  });
});

describe('mergeRealtimeProfileRow', () => {
  it('applica le modifiche remote e rispetta leaderboard_visible=false', () => {
    const prev = baseProfile({ leaderboardVisible: true });
    const merged = mergeRealtimeProfileRow(prev, {
      leaderboard_visible: false,
      token_atcl: 7,
      onboarding_variant: 'skipped_qr',
    });
    expect(merged.leaderboardVisible).toBe(false);
    expect(merged.tokenAtcl).toBe(7);
    expect(merged.onboardingVariant).toBe('skipped_qr');
    expect(merged.email).toBe('locale@example.com');
  });
});
