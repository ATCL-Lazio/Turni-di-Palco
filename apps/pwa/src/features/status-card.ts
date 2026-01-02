import { registerServiceWorker } from "../pwa/register-sw";
import { applyServiceWorkerUpdate, promptServiceWorkerUpdate } from "../pwa/sw-update";

export function renderStatusCard() {
  return `
    <article class="card status">
      <h2>Status</h2>
      <dl>
        <div class="status-line">
          <dt>Connection</dt>
          <dd data-connection>Detecting...</dd>
        </div>
        <div class="status-line">
          <dt>Service worker</dt>
          <dd data-sw-status>Waiting for registration...</dd>
        </div>
      </dl>
      <p class="muted">Toggle rete per test offline. Se c'e un update SW usa il pulsante reload.</p>
      <div class="status-log" data-sw-error-box hidden>
        <p class="eyebrow">Log SW</p>
        <ul class="status-log-list" data-sw-errors></ul>
      </div>
    </article>
  `;
}

export function attachStatusListeners(root: HTMLElement, reloadButtonSelector: string) {
  const connectionNode = root.querySelector<HTMLElement>("[data-connection]");
  const swStatusNode = root.querySelector<HTMLElement>("[data-sw-status]");
  const swErrorBox = root.querySelector<HTMLElement>("[data-sw-error-box]");
  const swErrorList = root.querySelector<HTMLUListElement>("[data-sw-errors]");
  const reloadButton = root.querySelector<HTMLButtonElement>(reloadButtonSelector);
  let pendingUpdate: ServiceWorkerRegistration | null = null;

  function setConnectionStatus() {
    if (!connectionNode) return;
    const online = navigator.onLine;
    connectionNode.textContent = online ? "Online" : "Offline";
    connectionNode.dataset.state = online ? "online" : "offline";
  }

  function pushServiceWorkerError(message: string) {
    if (!swErrorList || !swErrorBox) return;
    const item = document.createElement("li");
    item.textContent = message;
    swErrorList.appendChild(item);
    swErrorBox.hidden = false;
  }

  window.addEventListener("online", setConnectionStatus);
  window.addEventListener("offline", setConnectionStatus);
  setConnectionStatus();

  registerServiceWorker({
    onReady: () => {
      pendingUpdate = null;
      reloadButton?.classList.add("ghost");
      if (swStatusNode) {
        swStatusNode.textContent = "Ready for offline use";
        swStatusNode.dataset.state = "ready";
      }
    },
    onUpdate: (registration) => {
      pendingUpdate = registration;
      if (swStatusNode) {
        swStatusNode.textContent = "Update available - reload to apply";
        swStatusNode.dataset.state = "update";
      }
      reloadButton?.classList.remove("ghost");
      promptServiceWorkerUpdate(registration);
    },
    onError: (error) => {
      if (swStatusNode) {
        swStatusNode.textContent = "Service worker failed";
        swStatusNode.dataset.state = "error";
      }
      const message = error instanceof Error ? error.message : String(error);
      pushServiceWorkerError(message);
      console.error("Service worker registration failed", error);
    },
  });

  reloadButton?.addEventListener("click", () => {
    if (pendingUpdate) {
      applyServiceWorkerUpdate(pendingUpdate);
    } else {
      window.location.reload();
    }
  });
}
