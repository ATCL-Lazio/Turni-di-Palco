import { beforeEach, describe, expect, it, vi } from "vitest";

describe("main shell", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    vi.resetModules();
  });

  it("renders developer dashboard", async () => {
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

    await import("../main");

    const title = document.querySelector("h1");
    const statusHeading = Array.from(document.querySelectorAll("h2")).find(
      (el) => el.textContent === "Stato sistema"
    );
    const quickItems = document.querySelectorAll(".quick-item");

    expect(title?.textContent?.trim()).toBe("Overview");
    expect(statusHeading).not.toBeNull();
    expect(quickItems.length).toBeGreaterThan(0);
    expect(quickItems[0]?.getAttribute("href")).toContain("/control-plane.html");
  });
});
