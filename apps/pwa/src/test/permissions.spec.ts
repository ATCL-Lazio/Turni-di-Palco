import { describe, it, expect, vi, afterEach } from 'vitest';
import { PermissionsService } from '../services/permissions';

describe('PermissionsService', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should report notifications supported if Notification exists', () => {
        // Mock window.Notification
        const original = window.Notification;
        Object.defineProperty(window, 'Notification', { value: {} as unknown as typeof Notification, writable: true });
        expect(PermissionsService.supportsNotifications()).toBe(true);
        Object.defineProperty(window, 'Notification', { value: original, writable: true });
    });

    it('should check notification permission properly', () => {
        const original = window.Notification;
        Object.defineProperty(window, 'Notification', { value: { permission: 'granted' } as unknown as typeof Notification, writable: true });
        expect(PermissionsService.getNotificationPermission()).toBe('granted');
        Object.defineProperty(window, 'Notification', { value: original, writable: true });
    });
});
