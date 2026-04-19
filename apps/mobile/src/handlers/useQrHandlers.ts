import { useCallback } from 'react';
import { GameEvent, RegisterTurnInput, RegisterTurnResult, Rewards, RoleId, TurnSyncStatus } from '../state/store';
import {
  activateTicketByDetails,
  activateTicketHash,
  isManualTicketActivatedInSession,
  isTicketHashActivatedInSession,
  parseTicketQrValue,
  resolveTicketHashPreview,
  type ActivatedEventPayload,
} from '../services/ticket-activation';
import { validateQrPayload } from '../services/event-links';
import type { MobileFeatureFlagKey } from '../services/feature-flags';
import type { Screen } from '../types/navigation';

export type PendingTicketActivation =
  | { mode: 'hash'; hash: string; eventId: string; event?: ActivatedEventPayload }
  | { mode: 'manual'; eventId: string; ticketNumber: string };

export interface QrHandlerDeps {
  authUserId: string | null;
  authReady: boolean;
  isAuthValid: boolean;
  events: GameEvent[];
  profileEmail: string;
  profileRoleId: RoleId;
  isFeatureEnabled: (key: MobileFeatureFlagKey) => boolean;
  registerTurn: (input: RegisterTurnInput) => Promise<RegisterTurnResult>;
  navigate: (screen: Screen) => void;
  setScannedEventId: (id: string) => void;
  scannedEventId: string;
  pendingTicketActivation: PendingTicketActivation | null;
  setPendingTicketActivation: (value: PendingTicketActivation | null) => void;
  confirmationEventOverride: GameEvent | null;
  setConfirmationEventOverride: (value: GameEvent | null) => void;
}

function mapActivatedEvent(
  eventId: string,
  events: GameEvent[],
  eventPayload?: ActivatedEventPayload,
): GameEvent | undefined {
  const existingEvent = events.find(event => event.id === eventId);
  if (existingEvent) return existingEvent;
  if (!eventPayload) return undefined;

  const theatre = String(eventPayload.theatre ?? '').trim();
  const date = String(eventPayload.event_date ?? '').trim();
  const time = String(eventPayload.event_time ?? '').trim();
  if (!theatre || !date || !time) return undefined;

  const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const baseRewards = eventPayload.base_rewards ?? {};
  return {
    id: eventId,
    name: String(eventPayload.name ?? eventId).trim() || eventId,
    theatre,
    date,
    time,
    genre: String(eventPayload.genre ?? 'Evento').trim() || 'Evento',
    baseRewards: {
      xp: toNumber(baseRewards.xp),
      reputation: toNumber(baseRewards.reputation),
      cachet: toNumber(baseRewards.cachet),
    },
  };
}

export function useQrHandlers(deps: QrHandlerDeps) {
  const {
    authUserId, authReady, isAuthValid, events, profileRoleId,
    isFeatureEnabled, registerTurn, navigate, setScannedEventId, scannedEventId,
    pendingTicketActivation, setPendingTicketActivation,
    confirmationEventOverride, setConfirmationEventOverride,
  } = deps;

  const handleQRScanAttempt = useCallback(async (code: string) => {
    const qrScanEnabled = isFeatureEnabled('qr_scan');

    if (!qrScanEnabled) {
      return { ok: false as const, error: 'Registrazione temporaneamente disattivata.' };
    }
    if (!authReady) return { ok: false as const, error: 'Verifica sessione...' };
    if (!isAuthValid) {
      navigate('welcome');
      return { ok: false as const, error: 'Login richiesto.' };
    }

    const activationUserId = (authUserId ?? '').trim();

    // Manual ticket entry (requires pre-registered ticket via Python generator)
    if (code.startsWith('manual-ticket:')) {
      const [, eventId, ticketNumber] = code.split(':');
      if (!eventId || !ticketNumber) return { ok: false as const, error: 'Dati manuali incompleti.' };

      const normalizedEventId = eventId.trim();
      const normalizedTicketNumber = ticketNumber.trim();
      if (isManualTicketActivatedInSession(normalizedEventId, normalizedTicketNumber)) {
        return { ok: false as const, error: 'Biglietto già registrato in questa sessione.' };
      }

      const matchedEvent = events.find(event => event.id === normalizedEventId);
      if (!matchedEvent) {
        return { ok: false as const, error: 'Evento non presente nel calendario.' };
      }

      setPendingTicketActivation({ mode: 'manual', eventId: normalizedEventId, ticketNumber: normalizedTicketNumber });
      setConfirmationEventOverride(mapActivatedEvent(normalizedEventId, events) ?? null);
      setScannedEventId(normalizedEventId);
      navigate('event-confirmation');
      return { ok: true as const };
    }

    // Ticket hash (QR scan path)
    const ticketHash = parseTicketQrValue(code);
    if (ticketHash) {
      if (!activationUserId) {
        return { ok: false as const, error: 'Utente non disponibile per l\'attivazione ticket.' };
      }
      if (isTicketHashActivatedInSession(ticketHash)) {
        return { ok: false as const, error: 'Ticket già attivato in questa sessione.' };
      }

      const preview = await resolveTicketHashPreview(ticketHash);
      if (!preview.ok) return { ok: false as const, error: preview.error };

      setPendingTicketActivation({ mode: 'hash', hash: ticketHash, eventId: preview.eventId, event: preview.event });
      setConfirmationEventOverride(mapActivatedEvent(preview.eventId, events, preview.event) ?? null);
      setScannedEventId(preview.eventId);
      navigate('event-confirmation');
      return { ok: true as const };
    }

    // Standard QR validation
    const result = await validateQrPayload(code, events.map(event => event.id));
    if (!result.valid || !result.eventId) {
      return { ok: false as const, error: result.error ?? 'QR non valido.' };
    }

    setPendingTicketActivation(null);
    setConfirmationEventOverride(null);
    setScannedEventId(result.eventId);
    navigate('event-confirmation');
    return { ok: true as const };
  }, [authReady, authUserId, events, isAuthValid, isFeatureEnabled, navigate, setConfirmationEventOverride, setPendingTicketActivation, setScannedEventId]);

  const handleEventConfirm = useCallback(async ({ boostRequested }: { boostRequested: boolean }): Promise<
    | { ok: true; syncStatus: TurnSyncStatus; boostRequested: boolean; boostApplied: boolean; boostRejectionReason: string | null; rewards: Rewards }
    | { ok: false; error: string }
  > => {
    if (!isFeatureEnabled('registra_turno')) {
      return { ok: false, error: 'Registrazione turni temporaneamente disattivata.' };
    }
    if (boostRequested && !isFeatureEnabled('boost_turno')) {
      return { ok: false, error: 'Boost turno temporaneamente disattivato.' };
    }

    const activationUserId = (authUserId ?? '').trim();

    if (pendingTicketActivation?.mode === 'hash') {
      if (!activationUserId) {
        navigate('welcome');
        return { ok: false, error: 'Sessione non valida. Effettua di nuovo il login.' };
      }

      const activation = await activateTicketHash(pendingTicketActivation.hash, activationUserId);
      if (!activation.ok) return { ok: false, error: activation.error };

      const resolvedEventId = activation.eventId ?? pendingTicketActivation.eventId;
      const turnResult = await registerTurn({
        eventId: resolvedEventId,
        roleId: profileRoleId,
        eventOverride: mapActivatedEvent(resolvedEventId, events, activation.event ?? pendingTicketActivation.event),
        boostRequested,
      });
      if (!turnResult.ok) {
        return { ok: false, error: turnResult.error || 'Ticket attivato, ma non e stato possibile registrare il turno.' };
      }

      setPendingTicketActivation(null);
      setConfirmationEventOverride(null);
      setScannedEventId(resolvedEventId);
      return { ok: true, syncStatus: turnResult.syncStatus, boostRequested: turnResult.boostRequested, boostApplied: turnResult.boostApplied, boostRejectionReason: turnResult.boostRejectionReason, rewards: turnResult.rewards };
    }

    if (pendingTicketActivation?.mode === 'manual') {
      if (!activationUserId) {
        navigate('welcome');
        return { ok: false, error: 'Sessione non valida. Effettua di nuovo il login.' };
      }

      const activation = await activateTicketByDetails(pendingTicketActivation.eventId, pendingTicketActivation.ticketNumber, activationUserId);
      if (!activation.ok) return { ok: false, error: activation.error };

      const resolvedEventId = activation.eventId ?? pendingTicketActivation.eventId;
      const turnResult = await registerTurn({
        eventId: resolvedEventId,
        roleId: profileRoleId,
        eventOverride: mapActivatedEvent(resolvedEventId, events, activation.event),
        boostRequested,
      });
      if (!turnResult.ok) {
        return { ok: false, error: turnResult.error || 'Ticket attivato, ma non e stato possibile registrare il turno.' };
      }

      setPendingTicketActivation(null);
      setConfirmationEventOverride(null);
      setScannedEventId(resolvedEventId);
      return { ok: true, syncStatus: turnResult.syncStatus, boostRequested: turnResult.boostRequested, boostApplied: turnResult.boostApplied, boostRejectionReason: turnResult.boostRejectionReason, rewards: turnResult.rewards };
    }

    // Standard confirmation (no ticket activation)
    const turnResult = await registerTurn({
      eventId: scannedEventId ?? '',
      roleId: profileRoleId,
      eventOverride: confirmationEventOverride ?? undefined,
      boostRequested,
    });
    if (turnResult.ok) {
      setPendingTicketActivation(null);
      setConfirmationEventOverride(null);
      return { ok: true, syncStatus: turnResult.syncStatus, boostRequested: turnResult.boostRequested, boostApplied: turnResult.boostApplied, boostRejectionReason: turnResult.boostRejectionReason, rewards: turnResult.rewards };
    }

    return { ok: false, error: turnResult.error || 'Non e stato possibile registrare il turno.' };
  }, [authUserId, confirmationEventOverride, scannedEventId, events, isFeatureEnabled, navigate, pendingTicketActivation, profileRoleId, registerTurn, setConfirmationEventOverride, setPendingTicketActivation, setScannedEventId]);

  return { handleQRScanAttempt, handleEventConfirm };
}
