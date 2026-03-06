import { describe, expect, it } from "vitest";
import { buildControlPlaneUrl, CONTROL_PLANE_VIEWS, parseControlPlanePreset } from "../services/ops-sdk";
import { resolveInitialPage } from "../dev-plus/routing";

describe("SPA shell navigation", () => {
  it("defaults to overview when no view param", () => {
    expect(resolveInitialPage("")).toBe("overview");
    expect(resolveInitialPage("?")).toBe("overview");
    expect(resolveInitialPage("?view=overview")).toBe("overview");
  });

  it("routes to cp for any control plane view", () => {
    expect(resolveInitialPage("?view=commands")).toBe("cp");
    expect(resolveInitialPage("?view=render")).toBe("cp");
    expect(resolveInitialPage("?view=audit")).toBe("cp");
    expect(resolveInitialPage("?view=db")).toBe("cp");
    expect(resolveInitialPage("?view=mobile-flags")).toBe("cp");
  });

  it("routes to privacy view", () => {
    expect(resolveInitialPage("?view=privacy")).toBe("privacy");
  });

  it("buildControlPlaneUrl generates root-relative URLs", () => {
    const url = buildControlPlaneUrl({ view: "commands" });
    expect(url).toBe("/?view=commands");
  });

  it("buildControlPlaneUrl uses custom basePath when provided", () => {
    const url = buildControlPlaneUrl({ view: "audit" }, "/custom");
    expect(url).toBe("/custom?view=audit");
  });

  it("parseControlPlanePreset reads view from query string", () => {
    const preset = parseControlPlanePreset("?view=render&command=render.services.health");
    expect(preset.view).toBe("render");
    expect(preset.commandId).toBe("render.services.health");
  });

  it("CONTROL_PLANE_VIEWS contains all expected views", () => {
    expect(CONTROL_PLANE_VIEWS).toContain("commands");
    expect(CONTROL_PLANE_VIEWS).toContain("render");
    expect(CONTROL_PLANE_VIEWS).toContain("audit");
    expect(CONTROL_PLANE_VIEWS).toContain("db");
    expect(CONTROL_PLANE_VIEWS).toContain("mobile-flags");
  });
});
