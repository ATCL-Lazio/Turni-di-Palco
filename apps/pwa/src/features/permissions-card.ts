import { PermissionsService } from "../services/permissions";

export function renderPermissionsCard() {
    return `
      <article class="card" id="permissions">
        <h2>Permission check</h2>
        <p class="muted">Notifiche su iOS disponibili solo dopo l'installazione come PWA.</p>
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
    `;
}

export function attachPermissionsListeners(root: HTMLElement) {
    const notifyButton = root.querySelector<HTMLButtonElement>('[data-action="notify-permission"]');
    const geoButton = root.querySelector<HTMLButtonElement>('[data-action="geo-permission"]');
    const cameraButton = root.querySelector<HTMLButtonElement>('[data-action="camera-permission"]');
    const notifyTestButton = root.querySelector<HTMLButtonElement>('[data-action="notify-test"]');
    const permissionOutput = root.querySelector<HTMLElement>("[data-permission-result]");

    if (!permissionOutput) return;

    function renderResult(message: string, state: "info" | "ok" | "warn" | "error" = "info") {
        if (!permissionOutput) return;
        permissionOutput.textContent = message;
        permissionOutput.dataset.state = state;
    }

    function setNotifyButtonState(permission: NotificationPermission) {
        if (!notifyTestButton) return;
        notifyTestButton.disabled = permission !== "granted";
        notifyTestButton.textContent = permission === "granted" ? "Notifica di prova" : "Richiedi permesso per notifiche";
    }

    async function checkPermissions() {
        if (!PermissionsService.isSecureContext()) {
            renderResult("Permessi limitati: serve connessione sicura (HTTPS o localhost).", "warn");
        }

        if (PermissionsService.supportsNotifications()) {
            const perm = PermissionsService.getNotificationPermission();
            setNotifyButtonState(perm);
            renderResult(`Permesso notifiche attuale: ${perm}`, "info");

            if (PermissionsService.isIOS() && !PermissionsService.isStandalone()) {
                renderResult("Su iOS chiedi notifiche solo dopo installazione come PWA.", "warn");
                notifyButton?.setAttribute("disabled", "true");
            }
        } else {
            notifyButton?.setAttribute("disabled", "true");
            notifyTestButton?.setAttribute("disabled", "true");
        }

        const geoState = await PermissionsService.checkGeolocationPermission();
        if (geoState !== 'unsupported') {
            renderResult(`Geo stato: ${geoState}`, geoState === "granted" ? "ok" : "info");
        }

        const cameraState = await PermissionsService.checkCameraPermission();
        if (cameraState !== 'unsupported') {
            renderResult(`Stato fotocamera: ${cameraState}`, cameraState === "granted" ? "ok" : "info");
        } else {
            renderResult("Fotocamera non supportata in questo browser.", "warn");
            cameraButton?.setAttribute("disabled", "true");
        }
    }

    notifyButton?.addEventListener("click", async () => {
        if (!PermissionsService.supportsNotifications()) {
            renderResult("Notifiche non supportate in questo browser.", "error");
            return;
        }
        if (!PermissionsService.isSecureContext()) {
            renderResult("Richiedi notifiche solo su HTTPS/localhost.", "warn");
            return;
        }
        if (PermissionsService.isIOS() && !PermissionsService.isStandalone()) {
            renderResult("Installa come PWA su iOS per abilitare le notifiche.", "warn");
            return;
        }
        try {
            const result = await PermissionsService.requestNotificationPermission();
            const state = result === "granted" ? "ok" : result === "denied" ? "warn" : "info";
            renderResult(`Permesso notifiche: ${result}`, state);
            setNotifyButtonState(result);
        } catch (error) {
            renderResult("Richiesta notifiche fallita.", "error");
            console.error(error);
        }
    });

    geoButton?.addEventListener("click", () => {
        if (!PermissionsService.supportsGeolocation()) {
            renderResult("Geolocalizzazione non supportata.", "error");
            return;
        }
        if (!PermissionsService.isSecureContext()) {
            renderResult("La geolocalizzazione richiede HTTPS o localhost.", "warn");
            return;
        }
        renderResult("Richiesta posizione in corso...", "info");

        PermissionsService.getCurrentPosition()
            .then((position) => {
                renderResult(
                    `Permesso geo: concesso (lat ${position.coords.latitude.toFixed(4)}, lon ${position.coords.longitude.toFixed(4)})`,
                    "ok"
                );
            })
            .catch((error) => {
                // Simplification relative to original main.ts but acceptable
                renderResult(`Permesso geo: ${error.message || 'Error'}`, "error");
            });
    });

    cameraButton?.addEventListener("click", async () => {
        if (!PermissionsService.supportsCamera()) {
            renderResult("Fotocamera non disponibile nel browser.", "error");
            return;
        }
        if (!PermissionsService.isSecureContext()) {
            renderResult("La fotocamera richiede HTTPS o localhost.", "warn");
            return;
        }

        renderResult("Richiesta fotocamera in corso...", "info");
        try {
            const stream = await PermissionsService.requestCameraAccess();
            stream.getTracks().forEach((track) => track.stop());
            renderResult("Permesso fotocamera: concesso.", "ok");
        } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            if (error.name === "NotAllowedError" || error.name === "SecurityError") {
                renderResult("Permesso fotocamera: rifiutato.", "warn");
                return;
            }
            renderResult("Richiesta fotocamera fallita.", "error");
            console.error(error);
        }
    });

    notifyTestButton?.addEventListener("click", () => {
        // Replicating logic using service helpers where relevant or keeping simple check
        if (!PermissionsService.supportsNotifications()) {
            renderResult("Notifiche non supportate.", "error");
            return;
        }
        if (Notification.permission !== "granted") {
            renderResult(`Permesso notifiche: ${Notification.permission}. Concedi prima il permesso.`, "warn");
            return;
        }
        try {
            new Notification("Turni di Palco", {
                body: "Questa e una notifica di prova.",
                icon: "/icons/pwa-192.png"
            });
            renderResult("Notifica di prova inviata.", "ok");
        } catch {
            renderResult("Invio notifica fallito.", "error");
        }
    });

    checkPermissions().catch(() => undefined);
}
