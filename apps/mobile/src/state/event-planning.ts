import { EVENT_PLANNING_STATUSES } from './types';
import type { RoleId, GameEvent, EventPlanningStatus, EventPlanning } from './types';
import { isRoleId } from './normalizers';

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
