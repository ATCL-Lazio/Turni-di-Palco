const EVENT_ID_PATTERN = /\b([A-Za-z]{2,10}-\d{1,6})\b/;

export type ParsedEventLink = {
  eventId: string;
  roleId?: string;
};

export const PENDING_EVENT_KEY = 'tdp-mobile-pending-event';

export function normalizeEventId(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

export function extractEventIdFromPayload(payload: string): string {
  const raw = payload.trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const fromQuery = url.searchParams.get('event_id') ?? url.searchParams.get('eid');
    if (fromQuery) return normalizeEventId(fromQuery);
    const fromPath = url.pathname.match(EVENT_ID_PATTERN)?.[1];
    if (fromPath) return normalizeEventId(fromPath);
  } catch {
    // fall through for plain payloads
  }

  const token = raw.match(EVENT_ID_PATTERN)?.[1];
  return normalizeEventId(token ?? raw);
}

export function parseEventLink(urlText: string): ParsedEventLink | null {
  try {
    const url = new URL(urlText);
    const eventId = normalizeEventId(url.searchParams.get('event_id') ?? url.searchParams.get('eid'));
    if (!eventId) return null;
    const roleId = url.searchParams.get('role_id')?.trim() || undefined;
    return { eventId, roleId };
  } catch {
    return null;
  }
}

export function readPendingEventFromUrl(locationHref: string): ParsedEventLink | null {
  return parseEventLink(locationHref);
}

export function stripEventLinkParams(locationHref: string): string {
  try {
    const url = new URL(locationHref);
    url.searchParams.delete('event_id');
    url.searchParams.delete('eid');
    url.searchParams.delete('role_id');
    return url.toString();
  } catch {
    return locationHref;
  }
}
