export type NotificationPermissionState = NotificationPermission | 'unsupported';

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return 'unsupported';

  try {
    return await Notification.requestPermission();
  } catch (error) {
    console.error('Notification permission request failed', error);
    return Notification.permission;
  }
}

export function notify(title: string, options?: NotificationOptions) {
  if (!isNotificationSupported()) {
    console.warn('Notifications are not supported in this environment.');
    return null;
  }
  if (Notification.permission !== 'granted') return null;

  try {
    return new Notification(title, options);
  } catch (error) {
    console.error('Notification delivery failed', error);
    return null;
  }
}
