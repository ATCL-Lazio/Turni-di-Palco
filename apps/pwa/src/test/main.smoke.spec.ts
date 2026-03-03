import { beforeEach, describe, expect, it, vi } from "vitest";

describe("main shell", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    vi.resetModules();
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

    await import("../main");

    const heading = document.querySelector("h1");
    const systemHeading = Array.from(document.querySelectorAll("h2")).find(
      (element) => element.textContent === "Stato sistema"
    );
    const actionLinks = document.querySelectorAll(".tdp-action-list .tdp-action-item a");

    expect(heading?.textContent).toContain("Dashboard PWA ricostruita");
    expect(systemHeading).not.toBeNull();
    expect(actionLinks).toHaveLength(3);
    expect(actionLinks[0]?.getAttribute("href")).toContain("/control-plane.html?view=commands");
  });
});
