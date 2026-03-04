import "../../../shared/styles/main.css";
import { enforceDesktopOnly } from "./utils/desktop-only";

const IUBENDA_PRIVACY_POLICY_URL = "https://www.iubenda.com/privacy-policy/78603233";
const IUBENDA_SCRIPT_SRC = "https://cdn.iubenda.com/iubenda.js";
const IUBENDA_ANCHOR_CLASSES = "iubenda-nostyle no-brand iubenda-noiframe iubenda-embed iubenda-noiframe iub-body-embed";

function ensureIubendaScript() {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${IUBENDA_SCRIPT_SRC}"]`);
  if (existing) return;

  const script = document.createElement("script");
  script.src = IUBENDA_SCRIPT_SRC;
  script.async = true;
  document.body.appendChild(script);
}

const start = () => {
  if (enforceDesktopOnly()) return;

  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) throw new Error("Root container missing");

  root.innerHTML = `
    <main class="tdp-privacy">
      <section class="tdp-privacy-card">
        <p class="tdp-kicker">Turni di Palco</p>
        <h1>Privacy</h1>
        <div class="tdp-privacy-actions">
          <a class="tdp-btn tdp-btn-primary" href="/">Torna alla dashboard</a>
          <a class="tdp-btn tdp-btn-ghost" href="/mobile/">Apri app mobile</a>
        </div>
      </section>

      <section class="tdp-privacy-card">
        <div class="legal-embed" data-legal-embed>
          <a href="${IUBENDA_PRIVACY_POLICY_URL}" class="${IUBENDA_ANCHOR_CLASSES}" title="Privacy Policy">
            Privacy Policy
          </a>
        </div>
      </section>
    </main>
  `;

  ensureIubendaScript();
};

start();
