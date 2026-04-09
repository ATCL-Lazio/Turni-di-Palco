import { supabase } from "./services/supabase";

type FeatureFlag = { key: string; enabled: boolean; label: string; description: string };

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("mobile_feature_flags")
    .select("key, enabled, label, description")
    .order("key");
  if (error) return [];
  return (data ?? []) as FeatureFlag[];
}

async function getUserEmail(): Promise<string> {
  if (!supabase) return "—";
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? "—";
}

function flagRow(flag: FeatureFlag): string {
  const pill = flag.enabled
    ? `<span class="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-400 font-medium">on</span>`
    : `<span class="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-500 font-medium">off</span>`;
  return `
    <div class="flex items-center justify-between gap-4 py-2.5 border-b border-neutral-800 last:border-0">
      <div class="min-w-0">
        <p class="text-sm text-neutral-100 font-mono truncate">${escapeHtml(flag.key)}</p>
        <p class="text-xs text-neutral-500 truncate">${escapeHtml(flag.label)}${flag.description ? ` — ${escapeHtml(flag.description)}` : ""}</p>
      </div>
      ${pill}
    </div>
  `;
}

function linkCard(label: string, href: string, description: string): string {
  return `
    <a href="${href}" target="_blank" rel="noopener noreferrer"
      class="block bg-[#241f20] hover:bg-[#2e2728] border border-neutral-800 hover:border-neutral-700 rounded-lg p-4 transition-colors group">
      <p class="text-sm font-semibold text-neutral-100 group-hover:text-[#f4bf4f] transition-colors">${label}</p>
      <p class="text-xs text-neutral-500 mt-0.5">${description}</p>
    </a>
  `;
}

export function renderDashboard(root: HTMLElement): void {
  root.innerHTML = `
    <div class="min-h-screen bg-[#0f0d0e]">

      <!-- Header -->
      <header class="border-b border-neutral-800 bg-[#1a1617]">
        <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-semibold tracking-widest uppercase text-[#f4bf4f]">Turni di Palco</p>
            <h1 class="text-base font-bold text-neutral-100">Dev Dashboard</h1>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-neutral-500" data-user-email>—</span>
            <button data-signout
              class="text-xs text-neutral-400 hover:text-neutral-100 border border-neutral-700 hover:border-neutral-500 rounded-lg px-3 py-1.5 transition-colors">
              Esci
            </button>
          </div>
        </div>
      </header>

      <!-- Content -->
      <main class="max-w-4xl mx-auto px-4 py-8 space-y-8">

        <!-- Link rapidi -->
        <section class="space-y-3">
          <h2 class="text-xs font-semibold tracking-widest uppercase text-neutral-500">Link rapidi</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-links></div>
        </section>

        <!-- Feature flags -->
        <section class="space-y-3">
          <h2 class="text-xs font-semibold tracking-widest uppercase text-neutral-500">Feature flags</h2>
          <div class="bg-[#1a1617] border border-neutral-800 rounded-xl px-4" data-flags>
            <p class="text-sm text-neutral-500 py-4">Caricamento...</p>
          </div>
        </section>

        <!-- App mobile -->
        <section class="space-y-3">
          <h2 class="text-xs font-semibold tracking-widest uppercase text-neutral-500">App mobile</h2>
          <a href="/mobile/" target="_blank" rel="noopener noreferrer"
            class="flex items-center justify-between bg-[#1a1617] border border-neutral-800 hover:border-neutral-700 rounded-xl px-5 py-4 transition-colors group">
            <div>
              <p class="text-sm font-semibold text-neutral-100 group-hover:text-[#f4bf4f] transition-colors">Apri app mobile</p>
              <p class="text-xs text-neutral-500 mt-0.5">Versione utente finale su <code class="font-mono">/mobile/</code></p>
            </div>
            <span class="text-neutral-600 group-hover:text-[#f4bf4f] transition-colors text-lg">→</span>
          </a>
        </section>

      </main>

      <!-- Footer -->
      <footer class="border-t border-neutral-800 mt-16">
        <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <p class="text-xs text-neutral-600">Dev Dashboard — Turni di Palco</p>
          <p class="text-xs text-neutral-700" data-build-date></p>
        </div>
      </footer>

    </div>
  `;

  // Build date
  const buildDate = root.querySelector<HTMLElement>("[data-build-date]");
  if (buildDate) buildDate.textContent = new Date().toLocaleDateString("it-IT", { dateStyle: "long" });

  // Links
  const linksContainer = root.querySelector<HTMLElement>("[data-links]");
  if (linksContainer) {
    linksContainer.innerHTML = [
      linkCard("Supabase", "https://supabase.com/dashboard", "Database, auth, edge functions"),
      linkCard("GitHub", "https://github.com/ATCL-Lazio/Turni-di-Palco", "Repository sorgente"),
      linkCard("Netlify", "https://app.netlify.com", "Deploy app mobile"),
      linkCard("Railway", "https://railway.app", "Deploy servizi backend"),
      linkCard("Render", "https://dashboard.render.com", "Deploy server control-plane"),
    ].join("");
  }

  // User email
  void getUserEmail().then((email) => {
    const el = root.querySelector<HTMLElement>("[data-user-email]");
    if (el) el.textContent = email;
  });

  // Feature flags
  void fetchFeatureFlags().then((flags) => {
    const container = root.querySelector<HTMLElement>("[data-flags]");
    if (!container) return;
    if (!flags.length) {
      container.innerHTML = `<p class="text-sm text-neutral-500 py-4">Nessun feature flag trovato.</p>`;
      return;
    }
    container.innerHTML = flags.map(flagRow).join("");
  });

  // Sign out
  root.querySelector<HTMLButtonElement>("[data-signout]")?.addEventListener("click", async () => {
    if (supabase) await supabase.auth.signOut();
    window.location.reload();
  });
}
