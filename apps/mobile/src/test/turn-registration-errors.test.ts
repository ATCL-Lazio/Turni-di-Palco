import { describe, expect, it } from 'vitest';
import { localizeTurnRegistrationError } from '../state/store';

describe('localizeTurnRegistrationError', () => {
  it('maps outside_geofence to a user-friendly message', () => {
    expect(localizeTurnRegistrationError(new Error('outside_geofence'))).toBe(
      "Sei fuori dal raggio del teatro. Avvicinati al luogo dell'evento e riprova."
    );
  });

  it('maps geolocation_required to a user-friendly message', () => {
    expect(localizeTurnRegistrationError({ message: 'geolocation_required' })).toBe(
      'Geolocalizzazione obbligatoria per confermare il turno. Abilita il GPS e riprova.'
    );
  });

  it('maps theatre_geofence_not_configured to a user-friendly message', () => {
    expect(localizeTurnRegistrationError('theatre_geofence_not_configured')).toBe(
      'Geofence non configurato per questo teatro. Contatta il supporto ATCL.'
    );
  });

  it('returns the original message for unknown errors', () => {
    expect(localizeTurnRegistrationError(new Error('custom_failure'))).toBe('custom_failure');
  });
});
