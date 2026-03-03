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

  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Aggiornamento disponibile";
  const description = document.createElement("p");
  description.textContent = "E' pronta una nuova versione offline. Ricarica per applicarla.";
  copy.append(eyebrow, description);

  const actions = document.createElement("div");
  actions.className = "toast-actions";

  const dismissButton = document.createElement("button");
  dismissButton.type = "button";
  dismissButton.className = "button ghost";
  dismissButton.dataset.action = "dismiss-update";
  dismissButton.textContent = "Piu' tardi";

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.className = "button primary";
  applyButton.dataset.action = "apply-update";
  applyButton.textContent = "Ricarica ora";

  actions.append(dismissButton, applyButton);
  toast.append(copy, actions);

  dismissButton.addEventListener("click", () => {
    dismissToast();
  });

  applyButton.addEventListener("click", () => {
    if (pendingRegistration) {
      applyServiceWorkerUpdate(pendingRegistration);
    }
  });

  document.body.appendChild(toast);
  activeToast = toast;
}
