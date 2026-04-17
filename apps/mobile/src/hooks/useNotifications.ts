import { useEffect, useRef } from 'react';
import { getPermission, notify } from '../lib/notifications';

export function useNotifications(upcomingEvent?: { id: string, name: string, date: string, time: string }, newestNewBadge?: { id: string, title: string }) {
    const lastNotifiedBadgeId = useRef<string | null>(null);
    const lastNotifiedEventId = useRef<string | null>(null);

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
    }, [upcomingEventId, upcomingEventName, upcomingEventDate, upcomingEventTime]);
}
