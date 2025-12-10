type ServiceWorkerCallbacks = {
  onReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: () => void;
  onError?: (error: unknown) => void;
};

export function registerServiceWorker(callbacks: ServiceWorkerCallbacks = {}) {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      callbacks.onRegistered?.(registration);

      if (registration.active) {
        callbacks.onReady?.();
      }

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          const isInstalled = newWorker.state === "installed";
          const hasController = Boolean(navigator.serviceWorker.controller);

          if (isInstalled && hasController) {
            callbacks.onUpdate?.();
          } else if (isInstalled) {
            callbacks.onReady?.();
          }
        });
      });
    })
    .catch((error) => {
      callbacks.onError?.(error);
    });
}
