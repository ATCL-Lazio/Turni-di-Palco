export type CriticalErrorPayload = {
  title?: string;
  message?: string;
  details?: string;
};

const EVENT_NAME = 'tdp:critical-error';
let initialized = false;
let lastError: CriticalErrorPayload | null = null;

function canUseWindow() {
  return typeof window !== 'undefined';
}

function normalizeDetails(details: unknown) {
  if (!details) return undefined;
  if (typeof details === 'string') return details;
  if (details instanceof Error) return details.message;
  if (typeof details === 'object' && 'message' in details) {
    return String((details as { message?: unknown }).message ?? '');
  }
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

export function reportCriticalError(payload: CriticalErrorPayload) {
  lastError = payload;
  if (!canUseWindow()) return;
  const event = new CustomEvent<CriticalErrorPayload>(EVENT_NAME, { detail: payload });
  window.dispatchEvent(event);
}

export function getLastCriticalError() {
  return lastError;
}

export function clearLastCriticalError() {
  lastError = null;
}

export function subscribeToCriticalErrors(handler: (payload: CriticalErrorPayload) => void) {
  if (!canUseWindow()) return () => undefined;
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<CriticalErrorPayload>;
    handler(customEvent.detail ?? {});
  };
  window.addEventListener(EVENT_NAME, listener as EventListener);
  return () => window.removeEventListener(EVENT_NAME, listener as EventListener);
}

export function initErrorHandler() {
  if (initialized || !canUseWindow()) return;
  initialized = true;

  window.addEventListener('error', (event) => {
    reportCriticalError({
      title: 'Errore imprevisto',
      message: 'L\'app ha rilevato un problema. Ricarica la pagina o riprova più tardi.',
      details: normalizeDetails(event.error ?? event.message),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportCriticalError({
      title: 'Errore imprevisto',
      message: 'L\'app ha rilevato un problema. Ricarica la pagina o riprova più tardi.',
      details: normalizeDetails(event.reason),
    });
  });
}

export function formatErrorDetails(errors: unknown[]) {
  return errors
    .map((error) => normalizeDetails(error))
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' | ');
}
