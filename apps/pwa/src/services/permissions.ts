
export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface PermissionStatusResult {
    permission: 'notification' | 'geolocation' | 'camera';
    state: PermissionState;
    details?: string;
    stream?: MediaStream;
    position?: GeolocationPosition;
}

interface NavigatorStandalone extends Navigator {
    standalone?: boolean;
}

export class PermissionsService {
    static isSecureContext(): boolean {
        return window.isSecureContext;
    }

    static isIOS(): boolean {
        return /iP(ad|hone|od)/.test(navigator.userAgent);
    }

    static isStandalone(): boolean {
        return (
            window.matchMedia("(display-mode: standalone)").matches ||
            (navigator as NavigatorStandalone).standalone === true
        );
    }

    static supportsNotifications(): boolean {
        return "Notification" in window;
    }

    static supportsGeolocation(): boolean {
        return "geolocation" in navigator;
    }

    static supportsCamera(): boolean {
        return typeof navigator.mediaDevices?.getUserMedia === "function";
    }

    static getNotificationPermission(): NotificationPermission {
        if (!this.supportsNotifications()) return 'denied';
        return Notification.permission;
    }

    static async requestNotificationPermission(): Promise<NotificationPermission> {
        if (!this.supportsNotifications()) throw new Error("Notifications not supported");
        return await Notification.requestPermission();
    }

    static async checkGeolocationPermission(): Promise<PermissionState> {
        if (!this.supportsGeolocation()) return 'unsupported';
        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            return result.state;
        } catch {
            return 'prompt'; // Fallback
        }
    }

    static getCurrentPosition(): Promise<GeolocationPosition> {
        return new Promise((resolve, reject) => {
            if (!this.supportsGeolocation()) return reject(new Error("Geolocation not supported"));
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 8000,
                maximumAge: 0
            });
        });
    }

    static async checkCameraPermission(): Promise<PermissionState> {
        if (!this.supportsCamera()) return 'unsupported';
        try {
            // 'camera' is not in standard PermissionName type in all environments
            const result = await navigator.permissions.query({ name: 'camera' as any }); // eslint-disable-line @typescript-eslint/no-explicit-any
            return result.state;
        } catch {
            return 'prompt'; // Fallback
        }
    }

    static async requestCameraAccess(): Promise<MediaStream> {
        if (!this.supportsCamera()) throw new Error("Camera not supported");
        return await navigator.mediaDevices.getUserMedia({ video: true });
    }
}
