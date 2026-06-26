import { useEffect, useRef } from 'react';
import { getPermission, notify } from '../lib/notifications';

// Module-level constants for localStorage keys used to persist the last-notified
// IDs across component remounts (e.g. login/logout auth transitions) — closes #1356.
const LAST_BADGE_KEY = 'tdp-last-notified-badge-id';
const LAST_EVENT_KEY = 'tdp-last-notified-event-id';

function readStoredId(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStoredId(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* SecurityError in private browsing */ }
}

export function useNotifications(upcomingEvent?: { id: string, name: string, date: string, time: string }, newestNewBadge?: { id: string, title: string }) {
    // Initialize from localStorage so the deduplication guard survives remounts
    // caused by auth state transitions (login/logout/token refresh).
    const lastNotifiedBadgeId = useRef<string | null>(readStoredId(LAST_BADGE_KEY));
    const lastNotifiedEventId = useRef<string | null>(readStoredId(LAST_EVENT_KEY));

    const newestNewBadgeId = newestNewBadge?.id;
    const newestNewBadgeTitle = newestNewBadge?.title;
    useEffect(() => {
        if (!newestNewBadgeId) return;
        if (lastNotifiedBadgeId.current === newestNewBadgeId) return;
        if (getPermission() !== 'granted') return;

        notify('Nuovo badge sbloccato', {
            body: newestNewBadgeTitle ?? '',
            tag: `badge-${newestNewBadgeId}`,
        });
        lastNotifiedBadgeId.current = newestNewBadgeId;
        writeStoredId(LAST_BADGE_KEY, newestNewBadgeId);
    }, [newestNewBadgeId, newestNewBadgeTitle]);

    const upcomingEventId = upcomingEvent?.id;
    const upcomingEventName = upcomingEvent?.name;
    const upcomingEventDate = upcomingEvent?.date;
    const upcomingEventTime = upcomingEvent?.time;
    useEffect(() => {
        if (!upcomingEventId) return;
        if (lastNotifiedEventId.current === upcomingEventId) return;
        if (getPermission() !== 'granted') return;

        notify('Nuovo evento in agenda', {
            body: `${upcomingEventName} · ${upcomingEventDate} ${upcomingEventTime}`,
            tag: `event-${upcomingEventId}`,
        });
        lastNotifiedEventId.current = upcomingEventId;
        writeStoredId(LAST_EVENT_KEY, upcomingEventId);
    }, [upcomingEventId, upcomingEventName, upcomingEventDate, upcomingEventTime]);
}
