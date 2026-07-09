import { reportCriticalError } from './error-handler';

type MobileWatchdogOptions = {
  operation: string;
  timeoutMs: number;
  title?: string;
  message?: string;
};

const DEFAULT_ERROR_TITLE = 'Operazione lenta';
const DEFAULT_ERROR_MESSAGE =
  "L'app sta impiegando troppo tempo a completare un'operazione.";

function scheduleWatchdogTimeout(handler: () => void, timeoutMs: number) {
  if (typeof window === 'undefined') {
    return setTimeout(handler, timeoutMs);
  }
  return window.setTimeout(handler, timeoutMs);
}

function clearWatchdogTimeout(timeoutId: ReturnType<typeof setTimeout> | number) {
  if (typeof window === 'undefined') {
    clearTimeout(timeoutId);
    return;
  }
  window.clearTimeout(timeoutId);
}

function buildTimeoutDetails(operation: string, timeoutMs: number) {
  return `Watchdog timeout: ${operation} exceeded ${timeoutMs}ms`;
}

export class WatchdogTimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(buildTimeoutDetails(operation, timeoutMs));
    this.name = 'WatchdogTimeoutError';
  }
}

export async function withMobileWatchdog<T>(
  task: () => Promise<T>,
  { operation, timeoutMs, title, message }: MobileWatchdogOptions
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | number | undefined;
  // Prevents reportCriticalError from firing after the task already completed
  // in the narrow race window between the timer callback executing and
  // clearWatchdogTimeout running in the finally block (closes #1411).
  let cancelled = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = scheduleWatchdogTimeout(() => {
      if (cancelled) return;
      reportCriticalError({
        title: title ?? DEFAULT_ERROR_TITLE,
        message: message ?? DEFAULT_ERROR_MESSAGE,
        details: buildTimeoutDetails(operation, timeoutMs),
      });
      reject(new WatchdogTimeoutError(operation, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([task(), timeoutPromise]);
  } finally {
    cancelled = true;
    if (timeoutId !== undefined) clearWatchdogTimeout(timeoutId);
  }
}
