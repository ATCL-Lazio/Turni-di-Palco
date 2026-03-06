import { describe, expect, it } from "vitest";
import {
  buildControlPlaneUrl,
  getRoleAdaptiveQuickActions,
  parseControlPlanePreset,
} from "../services/ops-sdk";

describe("ops-sdk", () => {
  it("builds and parses control-plane deeplink presets", () => {
    const url = buildControlPlaneUrl({
      view: "commands",
      commandId: "render.deployments.trigger",
      target: "turni-di-palco-production",
      reason: "precheck",
      dryRun: true,
      payload: { scope: "default" },
      source: "test",
    });

    expect(url.startsWith("/?")).toBe(true);

    const search = url.split("?")[1] ?? "";
    const parsed = parseControlPlanePreset(search);

    expect(parsed.view).toBe("commands");
    expect(parsed.commandId).toBe("render.deployments.trigger");
    expect(parsed.target).toBe("turni-di-palco-production");
    expect(parsed.reason).toBe("precheck");
    expect(parsed.dryRun).toBe(true);
    expect(parsed.payload).toEqual({ scope: "default" });
    expect(parsed.source).toBe("test");
  });

  it("ignores invalid view and payload values", () => {
    const parsed = parseControlPlanePreset("view=unknown&payload=not-json&dryRun=abc");
    expect(parsed.view).toBeUndefined();
    expect(parsed.payload).toBeUndefined();
    expect(parsed.dryRun).toBeUndefined();
  });

  it("returns role-adaptive actions", () => {
    const viewer = getRoleAdaptiveQuickActions(["dev_viewer"]).map((entry) => entry.id);
    const operator = getRoleAdaptiveQuickActions(["dev_operator"]).map((entry) => entry.id);
    const admin = getRoleAdaptiveQuickActions(["dev_admin"]).map((entry) => entry.id);

    expect(viewer).toContain("qa-render-health");
    expect(viewer).not.toContain("qa-render-trigger");

    expect(operator).toContain("qa-render-trigger");
    expect(operator).not.toContain("qa-mobile-flags");

    expect(admin).toContain("qa-mobile-flags");
  });
});
