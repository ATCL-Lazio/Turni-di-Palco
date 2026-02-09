import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
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

  if (!root) {
    throw new Error("Root container missing");
  }

  const pageHero = renderPageHero({
    title: "Privacy Policy",
    description: "Informativa sul trattamento dati",
    currentPage: "privacy",
    breadcrumbs: [
      { label: "Home", href: "/" },
      { label: "Privacy" },
    ],
    backHref: "/",
    backLabel: "Torna alla landing",
  });

  root.innerHTML = `
    <main class="page page-game layout-shell">
      ${pageHero}

      <section class="grid layout-grid">
        <article class="card layout-span-2 layout-stack">
          <p class="muted">
            L’informativa completa sulla privacy è pubblicata e mantenuta tramite Iubenda.
          </p>
          <div class="legal-embed" data-legal-embed>
            <a href="${IUBENDA_PRIVACY_POLICY_URL}" class="${IUBENDA_ANCHOR_CLASSES}" title="Privacy Policy">
              Privacy Policy
            </a>
          </div>
          <p class="muted">
            Nota: è necessaria una connessione internet per caricare il documento.
          </p>
        </article>
      </section>
    </main>
  `;

  ensureIubendaScript();
};

void start();
