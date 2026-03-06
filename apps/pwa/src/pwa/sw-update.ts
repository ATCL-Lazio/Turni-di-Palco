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
  toast.className = "toast";

  const label = document.createElement("p");
  label.className = "toast-label";
  label.textContent = "Aggiornamento disponibile";

  const actions = document.createElement("div");
  actions.className = "toast-actions";

  const dismissButton = document.createElement("button");
  dismissButton.type = "button";
  dismissButton.className = "btn btn-ghost";
  dismissButton.textContent = "Più tardi";

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.className = "btn btn-primary";
  applyButton.textContent = "Ricarica ora";

  actions.append(dismissButton, applyButton);
  toast.append(label, actions);

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
