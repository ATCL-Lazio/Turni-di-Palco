/**
 * Test di unità per l'export dati GDPR estratto da store.tsx.
 */

import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../state/persistence';
import {
  EMPTY_REMOTE_EXPORT_DATA,
  buildUserDataExport,
  buildUserDataExportFileName,
  collectMaxwellChatHistory,
} from '../state/user-data-export';

describe('collectMaxwellChatHistory', () => {
  it('raccoglie solo le chiavi di Maxwell e tollera JSON non valido', () => {
    localStorage.clear();
    localStorage.setItem('tdp-maxwell-history:a', '[{"role":"user"}]');
    localStorage.setItem('tdp-maxwell-history:b', 'non-json');
    localStorage.setItem('altro', '1');
    expect(collectMaxwellChatHistory(localStorage)).toEqual({
      'tdp-maxwell-history:a': [{ role: 'user' }],
      'tdp-maxwell-history:b': 'non-json',
    });
    localStorage.clear();
  });

  it('restituisce un oggetto vuoto senza storage', () => {
    expect(collectMaxwellChatHistory(undefined)).toEqual({});
  });
});

describe('buildUserDataExport', () => {
  it('include profilo, turni e dati remoti', () => {
    const profile = { ...createDefaultState().profile, name: 'Mario', lastActivityAt: 0 };
    const data = buildUserDataExport({
      profile,
      turns: [],
      remote: { ...EMPTY_REMOTE_EXPORT_DATA, shopPurchases: [{ id: 1 }] },
      badges: [],
      theatreReputation: [],
      plannedEvents: [],
      chatHistory: {},
      exportDate: new Date('2026-11-23T00:00:00.000Z'),
    });
    expect(data.exportDate).toBe('2026-11-23T00:00:00.000Z');
    expect(data.profile.name).toBe('Mario');
    expect(data.profile.lastActivityAt).toBe('1970-01-01T00:00:00.000Z');
    expect(data.profile.profileImage).toBeNull();
    expect(data.shopPurchases).toEqual([{ id: 1 }]);
    expect(Object.keys(data)).toEqual([
      'exportDate',
      'profile',
      'turns',
      'activityCompletions',
      'narrativeHistory',
      'shopPurchases',
      'ticketActivationsActivated',
      'ticketActivationsReserved',
      'ticketActivationsAttendee',
      'badges',
      'theatreReputation',
      'plannedEvents',
      'chatHistory',
    ]);
  });
});

describe('buildUserDataExportFileName', () => {
  it('rende sicuro il nome del profilo', () => {
    expect(buildUserDataExportFileName('Mario Rossi!', 42)).toBe('turni-di-palco-mario_rossi_-42.json');
    expect(buildUserDataExportFileName('', 1)).toBe('turni-di-palco-profilo-1.json');
  });
});
