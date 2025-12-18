import { registerServiceWorker } from "../pwa/register-sw";

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
      </article>
    `;
}

export function attachStatusListeners(root: HTMLElement, reloadButtonSelector: string) {
    const connectionNode = root.querySelector<HTMLElement>("[data-connection]");
    const swStatusNode = root.querySelector<HTMLElement>("[data-sw-status]");
    const reloadButton = root.querySelector<HTMLButtonElement>(reloadButtonSelector);

    function setConnectionStatus() {
        if (!connectionNode) return;
        const online = navigator.onLine;
        connectionNode.textContent = online ? "Online" : "Offline";
        connectionNode.dataset.state = online ? "online" : "offline";
    }

    window.addEventListener("online", setConnectionStatus);
    window.addEventListener("offline", setConnectionStatus);
    setConnectionStatus();

    registerServiceWorker({
        onReady: () => {
            if (swStatusNode) {
                swStatusNode.textContent = "Ready for offline use";
                swStatusNode.dataset.state = "ready";
            }
        },
        onUpdate: () => {
            if (swStatusNode) {
                swStatusNode.textContent = "Update available - reload to apply";
                swStatusNode.dataset.state = "update";
            }
            reloadButton?.classList.remove("ghost");
        },
        onError: (error) => {
            if (swStatusNode) {
                swStatusNode.textContent = "Service worker failed";
                swStatusNode.dataset.state = "error";
            }
            console.error("Service worker registration failed", error);
        },
    });

    reloadButton?.addEventListener("click", () => {
        window.location.reload();
    });
}
