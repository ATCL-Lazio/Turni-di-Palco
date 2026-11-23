import { EVENT_PLANNING_STATUSES } from './types';
import type { RoleId, GameEvent, EventPlanningStatus, EventPlanning } from './types';
import { isRoleId, normalizeText } from './normalizers';
import type { PlannedParticipationRpcRow } from './supabase-mappers';

function isEventPlanningStatus(value: unknown): value is EventPlanningStatus {
  return typeof value === 'string'
    && (EVENT_PLANNING_STATUSES as readonly string[]).includes(value);
}

export function resolveEventPlanningStatus(value: unknown): EventPlanningStatus {
  return isEventPlanningStatus(value) ? value : 'planned';
}

export function resolveEventPlanningRoleId(value: unknown, fallbackRoleId: RoleId): RoleId {
  return isRoleId(value) ? value : fallbackRoleId;
}

const ITALIAN_MONTHS: Record<string, string> = {
  gen: '01', feb: '02', mar: '03', apr: '04', mag: '05', giu: '06',
  lug: '07', ago: '08', set: '09', ott: '10', nov: '11', dic: '12',
};

export function parseEventScheduleTimestamp(event: Pick<GameEvent, 'date' | 'time'>) {
  const parts = event.date.trim().split(/\s+/);
  if (parts.length === 3) {
    const [day, monthStr, year] = parts;
    const month = ITALIAN_MONTHS[monthStr.toLowerCase()];
    if (month) {
      const timestamp = new Date(`${year}-${month}-${day.padStart(2, '0')}T${event.time || '00:00'}`).getTime();
      return Number.isFinite(timestamp) ? timestamp : 0;
    }
  }
  const timestamp = new Date(`${event.date} ${event.time}`).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function sortEventsForPlanning(events: GameEvent[]) {
  const now = Date.now();
  return [...events].sort((left, right) => {
    const leftTimestamp = parseEventScheduleTimestamp(left);
    const rightTimestamp = parseEventScheduleTimestamp(right);
    const leftFuture = leftTimestamp >= now;
    const rightFuture = rightTimestamp >= now;

    if (leftFuture !== rightFuture) return leftFuture ? -1 : 1;
    if (leftFuture && rightFuture) return leftTimestamp - rightTimestamp;
    return rightTimestamp - leftTimestamp;
  });
}

export function upsertEventPlan(plans: EventPlanning[], nextPlan: EventPlanning) {
  const filtered = plans.filter((plan) => plan.eventId !== nextPlan.eventId);
  return [nextPlan, ...filtered].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function removeEventPlan(plans: EventPlanning[], eventId: string) {
  return plans.filter((plan) => plan.eventId !== eventId);
}

/** Piani evento dalle righe di get_my_planned_participations. */
export function mapPlannedParticipationPlans(
  rows: PlannedParticipationRpcRow[],
  fallbackRoleId: RoleId,
): EventPlanning[] {
  return rows
    .map((row) => {
      const roleId = resolveEventPlanningRoleId(row.role_id, fallbackRoleId);
      const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
      return {
        eventId: row.event_id,
        roleId,
        status: resolveEventPlanningStatus(row.status),
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
      };
    })
    .filter((plan) => plan.eventId);
}

/**
 * Eventi seguiti dalle righe di get_my_planned_participations: usa l'evento
 * del catalogo se c'è, altrimenti ne costruisce uno minimo dai campi della riga.
 */
export function mapPlannedParticipationEvents(
  rows: PlannedParticipationRpcRow[],
  catalogEvents: GameEvent[],
): GameEvent[] {
  return rows
    .map((row) => {
      const catalogEvent = catalogEvents.find((event) => event.id === row.event_id);
      if (catalogEvent) return catalogEvent;

      return {
        id: row.event_id,
        name: normalizeText(row.event_name),
        theatre: normalizeText(row.theatre),
        date: normalizeText(row.event_date),
        time: normalizeText(row.event_time),
        genre: 'Evento',
        baseRewards: {
          xp: 0,
          reputation: 0,
          cachet: 0,
        },
      } as GameEvent;
    })
    .filter((event) => Boolean(event.id && event.name));
}
