import type { User } from "@supabase/supabase-js";
import { STORAGE_KEY } from "../state";
import { appConfig } from "./app-config";
import { isSupabaseConfigured, supabase } from "./supabase";

type DevGateState = {
  root: HTMLElement;
  form: HTMLFormElement;
  message: HTMLElement;
  emailInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  submitButton: HTMLButtonElement;
  signOutButton: HTMLButtonElement;
};

const { allowedRoles, allowedEmails, serverAccessFunction } = appConfig.devGate;
export const isPublicMode = appConfig.publicMode;

function getUserRoles(user: User) {
  const roles = new Set<string>();
  const metadataList = [user.app_metadata, user.user_metadata];

  metadataList.forEach((metadata) => {
    if (!metadata) return;
    const roleValue = metadata.role;
    const rolesValue = metadata.roles;

    if (typeof roleValue === "string") roles.add(roleValue);
    if (Array.isArray(roleValue)) roleValue.filter((item) => typeof item === "string").forEach((item) => roles.add(item));

    if (typeof rolesValue === "string") {
      rolesValue
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => roles.add(item));
    }
    if (Array.isArray(rolesValue)) {
      rolesValue.filter((item) => typeof item === "string").forEach((item) => roles.add(item));
    }
  });

  return Array.from(roles);
}

function isUserAllowed(user: User | null | undefined) {
  if (!user) return false;
  if (user.email && allowedEmails.includes(user.email)) return true;
  if (!allowedRoles.length) return false;
  const userRoles = getUserRoles(user);
  return userRoles.some((role) => allowedRoles.includes(role));
}

type DevAccessResponse = {
  allowed: boolean;
  reason?: string;
};

async function verifyServerAccess() {
  if (!supabase) {
    return { allowed: false, reason: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase.functions.invoke<DevAccessResponse>(serverAccessFunction, {
      body: { path: window.location.pathname },
    });

    if (error) {
      return { allowed: false, reason: error.message };
    }

    return {
      allowed: Boolean(data?.allowed),
      reason: data?.reason ?? undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto.";
    return { allowed: false, reason: message };
  }
}

function renderGate(root: HTMLElement) {
  root.innerHTML = `
    <main class="dev-gate">
      <section class="dev-gate-card">
        <div>
          <p class="eyebrow">Area riservata</p>
          <h1 class="heading-2">Accesso developer PWA</h1>
          <p class="muted">
            Per continuare devi autenticarti con un account abilitato su Supabase: le autorizzazioni sono verificate anche lato server.
          </p>
        </div>
        <form class="dev-gate-form" data-dev-gate-form>
          <label class="field">
            <span class="field-label">Email</span>
            <input class="input" name="email" type="email" autocomplete="email" required />
          </label>
          <label class="field">
            <span class="field-label">Password</span>
            <input class="input" name="password" type="password" autocomplete="current-password" required />
          </label>
          <button class="button primary" type="submit" data-dev-gate-submit>Accedi</button>
        </form>
        <div class="dev-gate-actions">
          <button class="button ghost" type="button" data-dev-gate-signout>Esci</button>
          <p class="muted" data-dev-gate-roles></p>
        </div>
        <p class="dev-gate-message" data-dev-gate-message aria-live="polite"></p>
      </section>
    </main>
  `;

  const form = root.querySelector<HTMLFormElement>("[data-dev-gate-form]");
  const message = root.querySelector<HTMLElement>("[data-dev-gate-message]");
  const emailInput = root.querySelector<HTMLInputElement>('input[name="email"]');
  const passwordInput = root.querySelector<HTMLInputElement>('input[name="password"]');
  const submitButton = root.querySelector<HTMLButtonElement>("[data-dev-gate-submit]");
  const signOutButton = root.querySelector<HTMLButtonElement>("[data-dev-gate-signout]");
  const rolesNote = root.querySelector<HTMLElement>("[data-dev-gate-roles]");

  if (!form || !message || !emailInput || !passwordInput || !submitButton || !signOutButton || !rolesNote) {
    throw new Error("Dev gate markup missing");
  }

  const rolesCopy = allowedRoles.length
    ? `Ruoli abilitati: ${allowedRoles.join(", ")}.`
    : "Nessun ruolo abilitato configurato.";
  rolesNote.textContent = rolesCopy;

  return { root, form, message, emailInput, passwordInput, submitButton, signOutButton } satisfies DevGateState;
}

function setGateMessage(state: DevGateState, message: string, tone: "error" | "success" | "info" = "info") {
  state.message.textContent = message;
  state.message.dataset.tone = tone;
}

function setGateBusy(state: DevGateState, isBusy: boolean) {
  state.submitButton.disabled = isBusy;
  state.submitButton.textContent = isBusy ? "Accesso in corso..." : "Accedi";
  state.emailInput.disabled = isBusy;
  state.passwordInput.disabled = isBusy;
  state.signOutButton.disabled = isBusy;
}

function clearLocalData() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.clear();
    const supabaseKeys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith("sb-")) supabaseKeys.push(key);
    }
    supabaseKeys.forEach((key) => window.localStorage.removeItem(key));
  } catch (error) {
    console.warn("Failed to clear local data", error);
  }
}

function exitDevGate(state?: DevGateState) {
  if (state) {
    setGateBusy(state, true);
    setGateMessage(state, "Chiusura sessione...", "info");
  }

  if (supabase) {
    void supabase.auth.signOut().catch((error) => {
      console.warn("Supabase signOut failed", error);
    });
  }

  clearLocalData();
  window.location.assign("/");
}

export async function requireDevAccess() {
  if (isPublicMode) return true;
  const root = document.querySelector<HTMLElement>("#app") ?? document.body;

  if (!isSupabaseConfigured || !supabase) {
    const state = renderGate(root);
    state.form.classList.add("is-disabled");
    setGateMessage(state, "Supabase non configurato: accesso developer non disponibile.", "error");
    state.signOutButton.addEventListener("click", () => {
      exitDevGate(state);
    });
    return false;
  }

  const { data } = await supabase.auth.getUser();
  const currentUser = data.user;
  let serverCheck: DevAccessResponse | null = null;

  if (currentUser && isUserAllowed(currentUser)) {
    serverCheck = await verifyServerAccess();
    if (serverCheck.allowed) return true;
  }

  const state = renderGate(root);

  if (currentUser) {
    if (!serverCheck) {
      serverCheck = await verifyServerAccess();
    }
    const message = serverCheck.reason ?? "Account autenticato ma non autorizzato.";
    setGateMessage(state, message, "error");
  }

  return new Promise<boolean>((resolve) => {
    state.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setGateBusy(state, true);
      setGateMessage(state, "Verifico le credenziali...", "info");

      const { error } = await supabase.auth.signInWithPassword({
        email: state.emailInput.value.trim(),
        password: state.passwordInput.value,
      });

      if (error) {
        setGateBusy(state, false);
        setGateMessage(state, error.message, "error");
        return;
      }

      const { data: freshData } = await supabase.auth.getUser();
      const serverCheck = await verifyServerAccess();
      if (!isUserAllowed(freshData.user) || !serverCheck.allowed) {
        await supabase.auth.signOut();
        setGateBusy(state, false);
        const message = serverCheck.reason ?? "Utente non autorizzato per la PWA.";
        setGateMessage(state, message, "error");
        return;
      }

      setGateMessage(state, "Accesso autorizzato.", "success");
      resolve(true);
    });

    state.signOutButton.addEventListener("click", () => {
      exitDevGate(state);
    });
  }).then((allowed) => {
    if (allowed) {
      root.innerHTML = "";
    }
    return allowed;
  });
}
