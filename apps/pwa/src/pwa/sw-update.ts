let activeToast: HTMLDivElement | null = null;
let pendingRegistration: ServiceWorkerRegistration | null = null;
let isReloadingForUpdate = false;

function dismissToast() {
  if (activeToast) {
    activeToast.remove();
    activeToast = null;
  }
}

function reloadWhenReady(registration: ServiceWorkerRegistration) {
  const reloadOnce = () => {
    if (isReloadingForUpdate) {
      return;
    }
    isReloadingForUpdate = true;
    window.location.reload();
  };

  const onControllerChange = () => {
    navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    reloadOnce();
  };

  navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

  const waitingWorker = registration.waiting ?? registration.installing;
  if (waitingWorker) {
    waitingWorker.addEventListener("statechange", () => {
      if (waitingWorker.state === "activated") {
        reloadOnce();
      }
    });
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }
}

export function applyServiceWorkerUpdate(registration: ServiceWorkerRegistration) {
  dismissToast();
  reloadWhenReady(registration);
}

export function promptServiceWorkerUpdate(registration: ServiceWorkerRegistration) {
  pendingRegistration = registration;

  if (activeToast) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = "toast update-toast";
  toast.innerHTML = `
    <div>
      <p class="eyebrow">Aggiornamento disponibile</p>
      <p>È pronta una nuova versione offline. Ricarica per applicarla.</p>
    </div>
    <div class="toast-actions">
      <button type="button" class="button ghost" data-action="dismiss-update">Più tardi</button>
      <button type="button" class="button primary" data-action="apply-update">Ricarica ora</button>
    </div>
  `;

  toast.querySelector<HTMLButtonElement>('[data-action="dismiss-update"]')?.addEventListener("click", () => {
    dismissToast();
  });

  toast.querySelector<HTMLButtonElement>('[data-action="apply-update"]')?.addEventListener("click", () => {
    if (pendingRegistration) {
      applyServiceWorkerUpdate(pendingRegistration);
    }
  });

  document.body.appendChild(toast);
  activeToast = toast;
}
