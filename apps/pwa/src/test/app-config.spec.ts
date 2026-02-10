import { describe, expect, it } from "vitest";
import { getConfigWarnings, resolveAppConfig } from "../services/app-config";

describe("app-config", () => {
  it("resolves config from env with normalized control-plane URL", () => {
    const config = resolveAppConfig({
      env: {
        MODE: "production",
        PROD: true,
        VITE_PUBLIC_MODE: "1",
        VITE_SUPABASE_URL: "https://supabase.example.com",
        VITE_SUPABASE_ANON_KEY: "anon-key",
        VITE_DEV_CONTROL_PLANE_URL: "https://cp.example.com///",
        VITE_PWA_DEV_ROLES: "dev,ops,dev",
        VITE_PWA_DEV_EMAILS: "dev@example.com,ops@example.com",
        VITE_FEATURE_FLAGS: "ai-support",
        VITE_DISABLED_FEATURE_FLAGS: "permissions-card",
      },
      origin: "https://fallback.example.com",
    });

    expect(config.environment).toBe("production");
    expect(config.isProd).toBe(true);
    expect(config.publicMode).toBe(true);
    expect(config.supabase.configured).toBe(true);
    expect(config.controlPlane.baseUrl).toBe("https://cp.example.com");
    expect(config.devGate.allowedRoles).toEqual(["dev", "ops"]);
    expect(config.devGate.allowedEmails).toEqual(["dev@example.com", "ops@example.com"]);
    expect(config.featureFlags["ai-support"]).toBe(true);
    expect(config.featureFlags["permissions-card"]).toBe(false);
  });

  it("applies runtime override for public mode, feature flags, service worker and dev gate", () => {
    const config = resolveAppConfig({
      env: {
        MODE: "development",
        PROD: false,
        VITE_PUBLIC_MODE: "0",
        VITE_SW_DEV: "cleanup",
        VITE_SW_DEV_CLEANUP: "1",
        VITE_PWA_DEV_ROLES: "dev",
      },
      runtimeOverride: {
        publicMode: true,
        controlPlaneBaseUrl: "https://runtime.example.com/",
        featureFlags: {
          "ai-support": true,
          "status-card": false,
        },
        serviceWorker: {
          devMode: "register",
          devCleanupRegistrations: false,
        },
        devGate: {
          allowedRoles: ["admin"],
          allowedEmails: ["admin@example.com"],
          serverAccessFunction: "runtime-access-check",
        },
      },
      origin: "https://fallback.example.com",
    });

    expect(config.publicMode).toBe(true);
    expect(config.controlPlane.baseUrl).toBe("https://runtime.example.com");
    expect(config.featureFlags["ai-support"]).toBe(true);
    expect(config.featureFlags["status-card"]).toBe(false);
    expect(config.serviceWorker.devMode).toBe("register");
    expect(config.serviceWorker.devCleanupRegistrations).toBe(false);
    expect(config.devGate.allowedRoles).toEqual(["admin"]);
    expect(config.devGate.allowedEmails).toEqual(["admin@example.com"]);
    expect(config.devGate.serverAccessFunction).toBe("runtime-access-check");
  });

  it("returns warnings for incomplete configuration", () => {
    const config = resolveAppConfig({
      env: {
        MODE: "development",
        PROD: false,
        VITE_PUBLIC_MODE: "0",
        VITE_PWA_DEV_ROLES: "",
        VITE_PWA_DEV_EMAILS: "",
      },
      runtimeOverride: {
        devGate: {
          allowedRoles: [],
          allowedEmails: [],
        },
      },
      origin: "",
    });

    const warnings = getConfigWarnings(config);
    expect(warnings.some((entry) => entry.includes("Supabase non configurato"))).toBe(true);
    expect(warnings.some((entry) => entry.includes("Dev gate senza ruoli/email"))).toBe(true);
    expect(warnings.some((entry) => entry.includes("Control-plane base URL"))).toBe(true);
  });
});
