import { useEffect, useRef } from 'react';
import { getPermission, notify } from '../lib/notifications';

export function useNotifications(upcomingEvent?: { id: string, name: string, date: string, time: string }, newestNewBadge?: { id: string, title: string }) {
    const lastNotifiedBadgeId = useRef<string | null>(null);
    const lastNotifiedEventId = useRef<string | null>(null);

    useEffect(() => {
        if (!newestNewBadge) return;
        if (lastNotifiedBadgeId.current === newestNewBadge.id) return;
        if (getPermission() !== 'granted') return;

        notify('Nuovo badge sbloccato', {
            body: newestNewBadge.title,
            tag: `badge-${newestNewBadge.id}`,
        });
        lastNotifiedBadgeId.current = newestNewBadge.id;
    }, [newestNewBadge]);

    useEffect(() => {
        if (!upcomingEvent) return;
        if (lastNotifiedEventId.current === upcomingEvent.id) return;
        if (getPermission() !== 'granted') return;

        notify('Nuovo evento in agenda', {
            body: `${upcomingEvent.name} · ${upcomingEvent.date} ${upcomingEvent.time}`,
            tag: `event-${upcomingEvent.id}`,
        });
        lastNotifiedEventId.current = upcomingEvent.id;
    }, [upcomingEvent]);
}
