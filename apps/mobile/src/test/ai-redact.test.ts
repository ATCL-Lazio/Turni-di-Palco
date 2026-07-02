// Tests for redactPII (services/ai.ts) — le segnalazioni di Maxwell diventano
// issue GitHub pubbliche, quindi il contenuto non deve esporre PII (tutela
// minori + GDPR Art. 32).

import { describe, expect, it } from 'vitest';
import { redactPII } from '../services/ai';

describe('redactPII', () => {
  it('rimuove gli indirizzi email', () => {
    expect(redactPII('scrivimi a mario.rossi@example.com grazie')).toBe(
      'scrivimi a [email rimossa] grazie',
    );
  });

  it('rimuove i numeri di telefono (con e senza prefisso)', () => {
    expect(redactPII('chiamami al +39 333 1234567')).toContain('[telefono rimosso]');
    expect(redactPII('il mio numero è 3331234567')).toContain('[telefono rimosso]');
    expect(redactPII('numero: 333-123-4567')).toContain('[telefono rimosso]');
  });

  it('rimuove il codice fiscale italiano', () => {
    expect(redactPII('CF RSSMRA85M01H501Z')).toBe('CF [dato rimosso]');
  });

  it('rimuove i termini extra noti (es. nome utente) case-insensitive', () => {
    expect(redactPII('Ciao sono Giovanni Bianchi', ['Giovanni Bianchi'])).toBe(
      'Ciao sono [nome rimosso]',
    );
    expect(redactPII('firmato giovanni', ['Giovanni'])).toBe('firmato [nome rimosso]');
  });

  it('NON redige numeri innocui brevi (punteggi, livelli)', () => {
    expect(redactPII('ho raggiunto il livello 100 con 1500 punti')).toBe(
      'ho raggiunto il livello 100 con 1500 punti',
    );
  });

  it('ignora termini extra troppo corti per evitare over-redaction', () => {
    expect(redactPII('la mia auto va', ['va'])).toBe('la mia auto va');
  });

  it('gestisce input vuoto o assente senza lanciare', () => {
    expect(redactPII('')).toBe('');
    expect(redactPII('testo pulito', [''])).toBe('testo pulito');
  });

  it('redige più occorrenze e più tipi nello stesso testo', () => {
    const input = 'Sono Anna, email anna@test.it tel 3391112223';
    const out = redactPII(input, ['Anna']);
    expect(out).not.toContain('anna@test.it');
    expect(out).not.toContain('3391112223');
    expect(out).toContain('[email rimossa]');
    expect(out).toContain('[telefono rimosso]');
    expect(out).toContain('[nome rimosso]');
  });
});
