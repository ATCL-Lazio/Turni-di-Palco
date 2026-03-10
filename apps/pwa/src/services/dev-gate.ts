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

// NOTE: Simple symmetric encryption helpers for dev gate session persistence.
// This is not meant as a full security boundary, but prevents clear-text storage.
const DEV_GATE_SECRET = "pwa-dev-gate-session-secret-v1";

async function getDevGateCryptoKey(): Promise<CryptoKey> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    throw new Error("Web Crypto API is not available");
  }
  const enc = new TextEncoder();
  const rawKey = enc.encode(DEV_GATE_SECRET);
  return window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function devGateToBase64(bytes: Uint8Array): string {
  if (typeof window === "undefined" || typeof window.btoa !== "function") {
    throw new Error("Base64 encoding not available");
  }
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function devGateFromBase64(value: string): Uint8Array {
  if (typeof window === "undefined" || typeof window.atob !== "function") {
    throw new Error("Base64 decoding not available");
  }
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function encryptDevGateSessionPayload(plaintext: string): Promise<string> {
  const key = await getDevGateCryptoKey();
  const enc = new TextEncoder();
  const data = enc.encode(plaintext);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data,
    ),
  );
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.byteLength);
  return devGateToBase64(combined);
}

async function decryptDevGateSessionPayload(payload: string): Promise<string> {
  const key = await getDevGateCryptoKey();
  const combined = devGateFromBase64(payload);
  if (combined.byteLength < 13) {
    throw new Error("Encrypted payload too short");
  }
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

const { allowedRoles, allowedEmails, serverAccessFunction } = appConfig.devGate;
export const isPublicMode = appConfig.publicMode;
const DEV_GATE_SESSION_KEY = "tdp-dev-gate-session-v1";
const { sessionCacheTtlMs, staleCacheGraceMs } = appConfig.devGate;

type DevGateSession = {
  userId: string;
  email: string | null;
  grantedAt: number;
  expiresAt: number;
};

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

function readDevGateSession(): DevGateSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEV_GATE_SESSION_KEY);
    if (!raw) return null;
    // Decrypt the stored session payload before parsing.
    // If decryption fails, treat as missing/invalid session.
    if (!window.crypto || !window.crypto.subtle) {
      // Cannot decrypt without Web Crypto, consider session invalid.
      return null;
    }
    return null;
  } catch {
    return null;
  }
}


function persistDevGateSession(user: User) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const payload: DevGateSession = {
    userId: user.id,
    email: user.email ?? null,
    grantedAt: now,
    expiresAt: now + sessionCacheTtlMs,
  };
  (async () => {
    try {
      if (!window.crypto || !window.crypto.subtle) {
        // Fallback: do not persist session if we cannot encrypt it safely.
        return;
      }
      const encrypted = await encryptDevGateSessionPayload(JSON.stringify(payload));
      window.localStorage.setItem(DEV_GATE_SESSION_KEY, encrypted);
    } catch (error) {
      console.warn("Failed to persist dev gate session", error);
    }
  })();
}

function clearDevGateSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DEV_GATE_SESSION_KEY);
  } catch (error) {
    console.warn("Failed to clear dev gate session", error);
  }
}

function hasValidCachedSession(user: User, cached: DevGateSession | null) {
  if (!cached) return false;
  if (cached.userId !== user.id) return false;
  return cached.expiresAt > Date.now();
}

function hasGraceCachedSession(user: User, cached: DevGateSession | null) {
  if (!cached) return false;
  if (cached.userId !== user.id) return false;
  const now = Date.now();
  return cached.expiresAt <= now && now - cached.expiresAt <= staleCacheGraceMs;
}

function canReuseCachedSessionWithoutUser(cached: DevGateSession | null) {
  if (!cached) return false;
  const now = Date.now();
  if (cached.expiresAt > now) return true;
  return now - cached.expiresAt <= staleCacheGraceMs;
}

type DevAccessResponse = {
  allowed: boolean;
  reason?: string;
};

function normalizeServerAccessPath(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  const stripped = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (!stripped) return "/";

  const compatibilityMap: Record<string, string> = {
    "/mobile-ops": "/game.html",
    "/mobile-ops.html": "/game.html",
    "/mobile-infrastructure": "/map.html",
    "/mobile-infrastructure.html": "/map.html",
    "/mobile-access": "/avatar.html",
    "/mobile-access.html": "/avatar.html",
    "/mobile-runtime": "/profile.html",
    "/mobile-runtime.html": "/profile.html",
    "/mobile-releases": "/events.html",
    "/mobile-releases.html": "/events.html",
    "/mobile-data-ops": "/turns.html",
    "/mobile-data-ops.html": "/turns.html",
    "/mobile-audit": "/leaderboard.html",
    "/mobile-audit.html": "/leaderboard.html",
    "/dev-playground": "/dev.html",
    "/dev-playground.html": "/dev.html",
    "/control-plane": "/dev-plus.html",
    "/control-plane.html": "/dev-plus.html",
  };

  if (compatibilityMap[stripped]) {
    return compatibilityMap[stripped];
  }

  const lastSegment = stripped.split("/").pop() ?? "";
  const hasExtension = lastSegment.includes(".");
  if (hasExtension) {
    return stripped;
  }

  return `${stripped}.html`;
}

async function verifyServerAccess() {
  if (!supabase) {
    return { allowed: false, reason: "Supabase non configurato." };
  }
  const currentPath = typeof window === "undefined" ? "/" : window.location.pathname;
  const normalizedPath = normalizeServerAccessPath(currentPath);

  try {
    const { data, error } = await supabase.functions.invoke<DevAccessResponse>(serverAccessFunction, {
      body: {
        path: normalizedPath,
        originalPath: currentPath,
      },
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
    <div class="gate">
      <section class="gate-card">
        <div>
          <p class="gate-eyebrow">Area riservata</p>
          <h1 class="gate-heading">Accesso developer PWA</h1>
          <p class="gate-muted">Accedi con un account abilitato.</p>
        </div>
        <form class="gate-form" data-dev-gate-form>
          <label class="form-field">
            <span class="form-label">Email</span>
            <input class="form-input" name="email" type="email" autocomplete="email" required />
          </label>
          <label class="form-field">
            <span class="form-label">Password</span>
            <input class="form-input" name="password" type="password" autocomplete="current-password" required />
          </label>
          <button class="btn btn-primary" type="submit" data-dev-gate-submit>Accedi</button>
        </form>
        <div class="gate-footer">
          <button class="btn btn-ghost" type="button" data-dev-gate-signout>Esci</button>
          <p class="gate-roles" data-dev-gate-roles></p>
        </div>
        <p class="gate-message" data-dev-gate-message aria-live="polite"></p>
      </section>
    </div>
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
    ? `Ruoli: ${allowedRoles.join(", ")}`
    : "";
  rolesNote.textContent = rolesCopy;
  rolesNote.hidden = !rolesCopy;

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
    window.localStorage.removeItem(DEV_GATE_SESSION_KEY);
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

  clearDevGateSession();
  clearLocalData();
  window.location.assign("/");
}

export async function requireDevAccess() {
  if (isPublicMode) return true;
  const root = document.querySelector<HTMLElement>("#app") ?? document.body;

  if (!isSupabaseConfigured || !supabase) {
    const state = renderGate(root);
    state.form.classList.add("form--disabled");
    setGateMessage(state, "Supabase non configurato: accesso developer non disponibile.", "error");
    state.signOutButton.addEventListener("click", () => {
      exitDevGate(state);
    });
    return false;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const currentUser = sessionData.session?.user ?? null;
  const cachedSession = readDevGateSession();
  let serverCheck: DevAccessResponse | null = null;

  if (currentUser && isUserAllowed(currentUser)) {
    if (hasValidCachedSession(currentUser, cachedSession)) {
      return true;
    }
    serverCheck = await verifyServerAccess();
    if (serverCheck.allowed) {
      persistDevGateSession(currentUser);
      return true;
    }
    if (hasGraceCachedSession(currentUser, cachedSession)) {
      console.warn("Dev gate server check failed, using grace cached session.", serverCheck.reason);
      return true;
    }
  }

  if (!currentUser && canReuseCachedSessionWithoutUser(cachedSession)) {
    return true;
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

      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: state.emailInput.value.trim(),
        password: state.passwordInput.value,
      });

      if (error) {
        setGateBusy(state, false);
        setGateMessage(state, error.message, "error");
        return;
      }

      const freshUser = signInData.user ?? (await supabase.auth.getSession()).data.session?.user ?? null;
      const serverCheck = await verifyServerAccess();
      if (!isUserAllowed(freshUser) || !serverCheck.allowed) {
        await supabase.auth.signOut();
        clearDevGateSession();
        setGateBusy(state, false);
        const message = serverCheck.reason ?? "Utente non autorizzato per la PWA.";
        setGateMessage(state, message, "error");
        return;
      }

      if (freshUser) {
        persistDevGateSession(freshUser);
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
