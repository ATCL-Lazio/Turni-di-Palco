import "../../../shared/styles/main.css";
import { registerServiceWorker } from "./pwa/register-sw";
import { renderAppBar } from "./components/app-bar";

const mainNav = [
  { label: "Home", href: "#hero", state: "active" as const },
  { label: "Permessi", href: "#permissions" },
  { label: "Dev playground", href: "/dev.html", icon: "🛠️" },
  { label: "Pagina gioco", href: "/game.html", icon: "🎮" },
];

const appBar = renderAppBar({ eyebrow: "Turni di Palco", subtitle: "PWA shell", actions: mainNav });

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Root container missing");
}

root.innerHTML = `
  <main class="page">
    ${appBar}

    <section class="hero layout-stack" id="hero">
      <p class="eyebrow">Turni di Palco</p>
      <h1>Progressive Web App base</h1>
      <p class="lede">
        Shell installabile e offline-ready per costruire il loop di gioco. I moduli demo (profilo, attivita simulate e turni) ora vivono nel playground dev.
      </p>
      <div class="cta-row">
        <a class="button primary" href="/dev.html">
          Apri dev playground
        </a>
        <button class="button ghost" type="button" data-action="refresh">
          Reload per update
        </button>
        <a class="button ghost" href="/game.html">
          Apri interfaccia base
        </a>
      </div>
      <div class="badges">
        <span class="badge">Installable</span>
        <span class="badge">Offline friendly</span>
        <span class="badge">Vite + TypeScript</span>
      </div>
    </section>

    <section class="grid layout-grid">
      <article class="card">
        <h2>App shell</h2>
        <p>
          Skeleton single-page: aggiungi scene e HUD in <code>src/</code>, tieni asset statici in <code>public/</code>, aggiorna il service worker quando cambi il core.
        </p>
        <ul class="list">
          <li><strong>Routing:</strong> SPA via Vite dev server</li>
          <li><strong>Install:</strong> manifest + service worker</li>
          <li><strong>Assets:</strong> cached on first use</li>
        </ul>
      </article>

      <article class="card">
        <h2>Build + Dev</h2>
        <p>
          Usa <code>npm run dev</code> per lo sviluppo, <code>npm run build</code> per il bundle e <code>npm run preview</code> per la smoke sul build.
        </p>
        <div class="pill-row">
          <span class="pill">Hot reload</span>
          <span class="pill">ESM</span>
          <span class="pill">Typed</span>
        </div>
      </article>

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

      <article class="card" id="permissions">
        <h2>Permission check</h2>
        <p>Richiedi i permessi comuni (notifiche, geolocalizzazione, fotocamera) e controlla l'esito in tempo reale.</p>
        <p class="muted">Nota: su iOS/Safari le notifiche funzionano solo dopo l'installazione come PWA e su connessione sicura (HTTPS). Geolocalizzazione e fotocamera richiedono contesto sicuro.</p>
        <div class="cta-row">
          <button class="button primary" type="button" data-action="notify-permission">
            Richiedi notifiche
          </button>
          <button class="button ghost" type="button" data-action="geo-permission">
            Richiedi geolocalizzazione
          </button>
          <button class="button ghost" type="button" data-action="camera-permission">
            Richiedi fotocamera
          </button>
          <button class="button ghost" type="button" data-action="notify-test">
            Notifica di prova
          </button>
        </div>
        <div class="result-box" data-permission-result>Pronto per i test.</div>
      </article>
    </section>
  </main>
`;

const connectionNode = root.querySelector<HTMLElement>("[data-connection]");
const swStatusNode = root.querySelector<HTMLElement>("[data-sw-status]");
const reloadButton = root.querySelector<HTMLButtonElement>('[data-action="refresh"]');
const notifyButton = root.querySelector<HTMLButtonElement>('[data-action="notify-permission"]');
const geoButton = root.querySelector<HTMLButtonElement>('[data-action="geo-permission"]');
const cameraButton = root.querySelector<HTMLButtonElement>('[data-action="camera-permission"]');
const notifyTestButton = root.querySelector<HTMLButtonElement>('[data-action="notify-test"]');
const permissionOutput = root.querySelector<HTMLElement>("[data-permission-result]");
const isSecure = window.isSecureContext;
const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent);
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;
const supportsCamera = typeof navigator.mediaDevices?.getUserMedia === "function";

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

function renderPermission(message: string, state: "info" | "ok" | "warn" | "error" = "info") {
  if (!permissionOutput) return;
  permissionOutput.textContent = message;
  permissionOutput.dataset.state = state;
}

function setNotifyButtonState(permission: NotificationPermission) {
  if (!notifyTestButton) return;
  notifyTestButton.disabled = permission !== "granted";
  notifyTestButton.textContent = permission === "granted" ? "Notifica di prova" : "Richiedi permesso per notifiche";
}

async function queryPermissionSafe(descriptor: PermissionDescriptor | { name: "camera" }) {
  if (!navigator.permissions) return null;
  try {
    return await navigator.permissions.query(descriptor as PermissionDescriptor);
  } catch {
    return null;
  }
}

async function checkPermissions() {
  if (!isSecure) {
    renderPermission("Permessi limitati: serve connessione sicura (HTTPS o localhost).", "warn");
  }

  if (typeof Notification !== "undefined") {
    setNotifyButtonState(Notification.permission);
    renderPermission(`Permesso notifiche attuale: ${Notification.permission}`, "info");

    if (isIOS && !isStandalone) {
      renderPermission("Su iOS chiedi notifiche solo dopo installazione come PWA.", "warn");
      notifyButton?.setAttribute("disabled", "true");
    }
  } else {
    notifyButton?.setAttribute("disabled", "true");
    notifyTestButton?.setAttribute("disabled", "true");
  }

  const geoStatus = await queryPermissionSafe({ name: "geolocation" });
  if (geoStatus) {
    renderPermission(`Geo stato: ${geoStatus.state}`, geoStatus.state === "granted" ? "ok" : "info");
    geoStatus.onchange = () => {
      renderPermission(`Geo stato: ${geoStatus.state}`, geoStatus.state === "granted" ? "ok" : "info");
    };
  }

  const cameraStatus = await queryPermissionSafe({ name: "camera" });
  if (cameraStatus) {
    renderPermission(`Stato fotocamera: ${cameraStatus.state}`, cameraStatus.state === "granted" ? "ok" : "info");
    cameraStatus.onchange = () => {
      renderPermission(`Stato fotocamera: ${cameraStatus.state}`, cameraStatus.state === "granted" ? "ok" : "info");
    };
  } else if (!supportsCamera) {
    renderPermission("Fotocamera non supportata in questo browser.", "warn");
    cameraButton?.setAttribute("disabled", "true");
  }
}

notifyButton?.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    renderPermission("Notifiche non supportate in questo browser.", "error");
    return;
  }
  if (!isSecure) {
    renderPermission("Richiedi notifiche solo su HTTPS/localhost.", "warn");
    return;
  }
  if (isIOS && !isStandalone) {
    renderPermission("Installa come PWA su iOS per abilitare le notifiche.", "warn");
    return;
  }
  try {
    const result = await Notification.requestPermission();
    const state = result === "granted" ? "ok" : result === "denied" ? "warn" : "info";
    renderPermission(`Permesso notifiche: ${result}`, state);
    setNotifyButtonState(result);
  } catch (error) {
    renderPermission("Richiesta notifiche fallita.", "error");
    console.error(error);
  }
});

geoButton?.addEventListener("click", () => {
  if (!("geolocation" in navigator)) {
    renderPermission("Geolocalizzazione non supportata.", "error");
    return;
  }
  if (!isSecure) {
    renderPermission("La geolocalizzazione richiede HTTPS o localhost.", "warn");
    return;
  }
  renderPermission("Richiesta posizione in corso...", "info");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      renderPermission(
        `Permesso geo: concesso (lat ${position.coords.latitude.toFixed(4)}, lon ${position.coords.longitude.toFixed(4)})`,
        "ok"
      );
    },
    (error) => {
      const reason =
        error.code === error.PERMISSION_DENIED
          ? "rifiutato"
          : error.code === error.POSITION_UNAVAILABLE
            ? "non disponibile"
            : "timeout";
      renderPermission(`Permesso geo: ${reason}`, reason === "rifiutato" ? "warn" : "error");
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
  );
});

cameraButton?.addEventListener("click", async () => {
  if (!supportsCamera) {
    renderPermission("Fotocamera non disponibile nel browser.", "error");
    return;
  }
  if (!isSecure) {
    renderPermission("La fotocamera richiede HTTPS o localhost.", "warn");
    return;
  }

  renderPermission("Richiesta fotocamera in corso...", "info");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
    renderPermission("Permesso fotocamera: concesso.", "ok");
  } catch (error) {
    if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
      renderPermission("Permesso fotocamera: rifiutato.", "warn");
      return;
    }
    renderPermission("Richiesta fotocamera fallita.", "error");
    console.error(error);
  }
});

notifyTestButton?.addEventListener("click", () => {
  if (!("Notification" in window)) {
    renderPermission("Notifiche non supportate in questo browser.", "error");
    return;
  }
  if (!isSecure) {
    renderPermission("Le notifiche richiedono HTTPS o localhost.", "warn");
    return;
  }
  if (isIOS && !isStandalone) {
    renderPermission("Installa come PWA su iOS per inviare notifiche.", "warn");
    return;
  }
  if (Notification.permission !== "granted") {
    renderPermission(`Permesso notifiche: ${Notification.permission}. Concedi prima il permesso.`, "warn");
    return;
  }
  try {
    new Notification("Turni di Palco", {
      body: "Questa e una notifica di prova.",
      icon: "/icons/pwa-192.png",
    });
    renderPermission("Notifica di prova inviata.", "ok");
  } catch (error) {
    renderPermission("Invio notifica fallito.", "error");
    console.error(error);
  }
});

checkPermissions().catch(() => undefined);
