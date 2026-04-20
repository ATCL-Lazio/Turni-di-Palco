export function openInMaps(theatre: string) {
    const destination = encodeURIComponent(theatre);
    if (typeof window === 'undefined') return;
    const isAppleDevice = /iPad|iPhone|iPod/i.test(navigator.userAgent);
    if (isAppleDevice) {
        window.location.href = `maps://?q=${destination}`;
        return;
    }
    if (/Android/i.test(navigator.userAgent)) {
        window.location.href = `geo:0,0?q=${destination}`;
        return;
    }
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank', 'noopener');
}

export function openEventsMap(theatres: string[]) {
    if (typeof window === 'undefined' || !theatres.length) return;
    const destination = encodeURIComponent(theatres[theatres.length - 1]);
    const waypoints = theatres
        .slice(0, -1)
        .map((value) => encodeURIComponent(value))
        .join('|');
    // Omit origin so Google Maps defaults to the device's current location.
    // Passing 'My Location' as a literal string causes geocoding failures.
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}`;
    window.open(url, '_blank', 'noopener');
}
