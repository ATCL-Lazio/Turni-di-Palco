type ServiceWorkerCallbacks = {
  onReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration, worker?: ServiceWorker | null) => void;
  onError?: (error: unknown) => void;
};

type ServiceWorkerOptions = {
  devMode?: "cleanup" | "register";
  devCleanupRegistrations?: boolean;
};

export function registerServiceWorker(callbacks: ServiceWorkerCallbacks = {}, options: ServiceWorkerOptions = {}) {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const devMode: ServiceWorkerOptions["devMode"] =
    options.devMode ?? (import.meta.env.VITE_SW_DEV === "true" ? "register" : "cleanup");
  const devCleanupRegistrations = options.devCleanupRegistrations ?? true;

  // In sviluppo: consenti SW controllati solo quando esplicitamente richiesto.
  if (!import.meta.env.PROD) {
    if (devCleanupRegistrations) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister().catch(() => undefined));
      });
    }

    if (devMode === "cleanup") {
      return;
    }
  }

  navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      callbacks.onRegistered?.(registration);

      if (registration.waiting && navigator.serviceWorker.controller) {
        callbacks.onUpdate?.(registration, registration.waiting);
      } else if (registration.active) {
        callbacks.onReady?.();
      }

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          const isInstalled = newWorker.state === "installed";
          const hasController = Boolean(navigator.serviceWorker.controller);

          if (isInstalled && hasController) {
            callbacks.onUpdate?.(registration, registration.waiting ?? newWorker);
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
