import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";

const allowedRoles = parseEnvList(import.meta.env.VITE_PWA_DEV_ROLES || "dev");
const allowedEmails = parseEnvList(import.meta.env.VITE_PWA_DEV_EMAILS || "");

function parseEnvList(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function getUserRoles(user: User): string[] {
  const roles = new Set<string>();
  // Only trust app_metadata (server-side, not writable by the client).
  // user_metadata is intentionally excluded to prevent privilege escalation.
  const meta = user.app_metadata;
  if (meta) {
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
  cancelButton: HTMLButtonElement;
} {
  root.innerHTML = `
    <div class="min-h-screen bg-[#0f0d0e] flex items-center justify-center p-4">
      <div class="w-full max-w-sm bg-[#1a1617] border border-neutral-800 rounded-xl p-8 space-y-6">
        <div class="space-y-1">
          <p class="text-xs font-semibold tracking-widest uppercase text-[#f4bf4f]">Area riservata</p>
          <h1 class="text-xl font-bold text-neutral-100">Dev Dashboard</h1>
          <p class="text-sm text-neutral-400">Accedi con un account abilitato su Supabase.</p>
        </div>
        <div class="bg-[#1a120e] border border-amber-900/40 rounded-lg px-4 py-3 space-y-1">
          <p class="text-xs font-semibold text-amber-400">Stai cercando l'app?</p>
          <p class="text-xs text-amber-200/70">Questa è l'area tecnica riservata agli sviluppatori. Se sei un utente di Turni di Palco, <a href="/mobile/" class="underline underline-offset-2 hover:text-amber-200 transition-colors">vai all'app mobile</a>.</p>
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
          <button data-gate-cancel type="button"
            class="w-full bg-transparent border border-neutral-700 hover:border-neutral-500 text-neutral-400 hover:text-neutral-200 font-semibold text-sm rounded-lg px-4 py-2.5 transition-colors">
            Annulla
          </button>
        </form>
        <p data-gate-message class="text-xs text-center text-neutral-500 min-h-[1rem]" aria-live="polite"></p>
      </div>
    </div>
  `;

  const form = root.querySelector<HTMLFormElement>("[data-gate-form]");
  const message = root.querySelector<HTMLElement>("[data-gate-message]");
  const emailInput = root.querySelector<HTMLInputElement>('input[name="email"]');
  const passwordInput = root.querySelector<HTMLInputElement>('input[name="password"]');
  const submitButton = root.querySelector<HTMLButtonElement>("[data-gate-submit]");
  const cancelButton = root.querySelector<HTMLButtonElement>("[data-gate-cancel]");

  if (!form || !message || !emailInput || !passwordInput || !submitButton || !cancelButton) {
    throw new Error('renderGate: template elements not found');
  }

  return { form, message, emailInput, passwordInput, submitButton, cancelButton };
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
  gate.cancelButton.disabled = busy;
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

  // Avoid calling getUser() when no session exists — this can throw AuthSessionMissingError.
  const sessionRes = await supabase.auth.getSession();
  const session = sessionRes.data?.session ?? null;
  let getUserError: any = null;
  let data: { user: User | null } = { user: null };
  if (session) {
    const getUserRes = await supabase.auth.getUser();
    getUserError = getUserRes.error;
    data = getUserRes.data ?? { user: null };
    if (getUserError) {
      // Only log unexpected errors; missing session is expected and not an application error.
      console.error("[dev-gate] getUser() failed:", getUserError);
    }
  }
  if (isUserAllowed(data.user)) return true;

  const gate = renderGate(root);
  if (getUserError) {
    setMessage(gate.message, "Errore di rete: impossibile verificare la sessione. Riprova.", "error");
  } else if (data.user) {
    setMessage(gate.message, "Account non autorizzato per la dev dashboard.", "error");
  }

  return new Promise<boolean>((resolve) => {
    // Shared ref so onCancel can abort an in-flight auth request. Without this,
    // a successful sign-in after cancel clears root.innerHTML leaving a blank page.
    let activeController: AbortController | null = null;

    const onSubmit = async (e: Event) => {
      e.preventDefault();

      // Only disable the submit/input fields; keep cancel active so the user
      // can abort a hung auth call instead of being locked out indefinitely.
      gate.submitButton.disabled = true;
      gate.submitButton.textContent = "Verifico...";
      gate.emailInput.disabled = true;
      gate.passwordInput.disabled = true;
      setMessage(gate.message, "Verifico le credenziali...", "info");

      const controller = new AbortController();
      activeController = controller;
      const timeoutId = setTimeout(() => controller.abort(new Error("timeout")), 15_000);
      const abortPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
      });

      const resetBusy = () => {
        clearTimeout(timeoutId);
        gate.submitButton.disabled = false;
        gate.submitButton.textContent = "Accedi";
        gate.emailInput.disabled = false;
        gate.passwordInput.disabled = false;
      };

      try {
        const { error } = await Promise.race([
          supabase!.auth.signInWithPassword({
            email: gate.emailInput.value.trim(),
            password: gate.passwordInput.value,
          }),
          abortPromise,
        ]);

        if (error) {
          resetBusy();
          setMessage(gate.message, "Credenziali non valide.", "error");
          return;
        }

        const { data: fresh, error: freshError } = await Promise.race([
          supabase!.auth.getUser(),
          abortPromise,
        ]);
        clearTimeout(timeoutId);

        if (freshError) {
          resetBusy();
          setMessage(gate.message, "Errore di rete. Riprova.", "error");
          return;
        }
        if (!isUserAllowed(fresh.user)) {
          await supabase!.auth.signOut();
          resetBusy();
          setMessage(gate.message, "Utente non autorizzato.", "error");
          return;
        }

        gate.form.removeEventListener("submit", onSubmit);
        gate.cancelButton.removeEventListener("click", onCancel);
        setMessage(gate.message, "Accesso autorizzato.", "success");
        root.innerHTML = "";
        resolve(true);
      } catch (err) {
        resetBusy();
        const isTimeout = err instanceof Error && err.message === "timeout";
        const isCancelled = err instanceof Error && err.message === "cancelled";
        if (isTimeout) {
          setMessage(gate.message, "Timeout: il server non risponde. Riprova.", "error");
        } else if (isCancelled) {
          setMessage(gate.message, "", "info");
        } else {
          setMessage(gate.message, "Errore imprevisto. Riprova.", "error");
        }
      }
    };

    const onCancel = () => {
      activeController?.abort(new Error("cancelled"));
      gate.form.removeEventListener("submit", onSubmit);
      gate.cancelButton.removeEventListener("click", onCancel);
      resolve(false);
    };

    gate.form.addEventListener("submit", onSubmit);
    gate.cancelButton.addEventListener("click", onCancel);
  });
}
