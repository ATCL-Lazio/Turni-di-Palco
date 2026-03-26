import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";

const allowedRoles = parseEnvList(import.meta.env.VITE_PWA_DEV_ROLES ?? "dev");
const allowedEmails = parseEnvList(import.meta.env.VITE_PWA_DEV_EMAILS ?? "");

function parseEnvList(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function getUserRoles(user: User): string[] {
  const roles = new Set<string>();
  for (const meta of [user.app_metadata, user.user_metadata]) {
    if (!meta) continue;
    const r = meta.role;
    const rs = meta.roles;
    if (typeof r === "string") roles.add(r);
    if (Array.isArray(r)) r.filter((x): x is string => typeof x === "string").forEach((x) => roles.add(x));
    if (typeof rs === "string") rs.split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => roles.add(x));
    if (Array.isArray(rs)) rs.filter((x): x is string => typeof x === "string").forEach((x) => roles.add(x));
  }
  return [...roles];
}

function isUserAllowed(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.email && allowedEmails.includes(user.email)) return true;
  if (!allowedRoles.length) return false;
  return getUserRoles(user).some((r) => allowedRoles.includes(r));
}

function renderGate(root: HTMLElement): {
  form: HTMLFormElement;
  message: HTMLElement;
  emailInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  submitButton: HTMLButtonElement;
} {
  root.innerHTML = `
    <div class="min-h-screen bg-[#0f0d0e] flex items-center justify-center p-4">
      <div class="w-full max-w-sm bg-[#1a1617] border border-neutral-800 rounded-xl p-8 space-y-6">
        <div class="space-y-1">
          <p class="text-xs font-semibold tracking-widest uppercase text-[#f4bf4f]">Area riservata</p>
          <h1 class="text-xl font-bold text-neutral-100">Dev Dashboard</h1>
          <p class="text-sm text-neutral-400">Accedi con un account abilitato su Supabase.</p>
        </div>
        <form data-gate-form class="space-y-4">
          <div class="space-y-1">
            <label class="text-xs text-neutral-400" for="gate-email">Email</label>
            <input id="gate-email" name="email" type="email" autocomplete="email" required
              class="w-full bg-[#241f20] border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-[#f4bf4f]" />
          </div>
          <div class="space-y-1">
            <label class="text-xs text-neutral-400" for="gate-password">Password</label>
            <input id="gate-password" name="password" type="password" autocomplete="current-password" required
              class="w-full bg-[#241f20] border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-[#f4bf4f]" />
          </div>
          <button data-gate-submit type="submit"
            class="w-full bg-[#f4bf4f] hover:bg-[#e6ae3a] text-[#0f0d0e] font-semibold text-sm rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Accedi
          </button>
        </form>
        <p data-gate-message class="text-xs text-center text-neutral-500 min-h-[1rem]" aria-live="polite"></p>
      </div>
    </div>
  `;

  const form = root.querySelector<HTMLFormElement>("[data-gate-form]")!;
  const message = root.querySelector<HTMLElement>("[data-gate-message]")!;
  const emailInput = root.querySelector<HTMLInputElement>('input[name="email"]')!;
  const passwordInput = root.querySelector<HTMLInputElement>('input[name="password"]')!;
  const submitButton = root.querySelector<HTMLButtonElement>("[data-gate-submit]")!;

  return { form, message, emailInput, passwordInput, submitButton };
}

function setMessage(el: HTMLElement, text: string, tone: "error" | "success" | "info") {
  el.textContent = text;
  el.className = `text-xs text-center min-h-[1rem] ${
    tone === "error" ? "text-red-400" : tone === "success" ? "text-green-400" : "text-neutral-500"
  }`;
}

function setBusy(gate: ReturnType<typeof renderGate>, busy: boolean) {
  gate.submitButton.disabled = busy;
  gate.submitButton.textContent = busy ? "Verifico..." : "Accedi";
  gate.emailInput.disabled = busy;
  gate.passwordInput.disabled = busy;
}

export async function requireDevAccess(): Promise<boolean> {
  const root = document.querySelector<HTMLElement>("#app") ?? document.body;

  if (!isSupabaseConfigured || !supabase) {
    const gate = renderGate(root);
    gate.form.classList.add("pointer-events-none", "opacity-50");
    setMessage(gate.message, "Supabase non configurato: accesso non disponibile.", "error");
    return false;
  }

  const { data } = await supabase.auth.getUser();
  if (isUserAllowed(data.user)) return true;

  const gate = renderGate(root);
  if (data.user) setMessage(gate.message, "Account non autorizzato per la dev dashboard.", "error");

  return new Promise<boolean>((resolve) => {
    gate.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setBusy(gate, true);
      setMessage(gate.message, "Verifico le credenziali...", "info");

      const { error } = await supabase!.auth.signInWithPassword({
        email: gate.emailInput.value.trim(),
        password: gate.passwordInput.value,
      });

      if (error) {
        setBusy(gate, false);
        setMessage(gate.message, error.message, "error");
        return;
      }

      const { data: fresh } = await supabase!.auth.getUser();
      if (!isUserAllowed(fresh.user)) {
        await supabase!.auth.signOut();
        setBusy(gate, false);
        setMessage(gate.message, "Utente non autorizzato.", "error");
        return;
      }

      setMessage(gate.message, "Accesso autorizzato.", "success");
      root.innerHTML = "";
      resolve(true);
    });
  });
}
