import { beforeEach, describe, expect, it, vi } from "vitest";

const registerServiceWorker = vi.fn();

describe("main shell", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    vi.resetModules();
    registerServiceWorker.mockClear();
  });

  it("renders landing page shell", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    vi.doMock("../services/dev-gate", () => ({
      isPublicMode: false,
      requireDevAccess: vi.fn().mockResolvedValue(true),
    }));

    vi.doMock("../pwa/register-sw", () => ({
      registerServiceWorker,
    }));

    await import("../main");

    const heading = document.querySelector("h1");
    const connectionStatus = document.querySelector("[data-connection]");

    expect(heading?.textContent).toContain("Ops Dashboard");
    expect(connectionStatus).not.toBeNull();
    expect(registerServiceWorker).toHaveBeenCalledTimes(1);
  });
});
