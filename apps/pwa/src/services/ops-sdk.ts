export const CONTROL_PLANE_VIEWS = ["commands", "audit", "render", "db", "mobile-flags"] as const;

export type ControlPlaneView = (typeof CONTROL_PLANE_VIEWS)[number];
export type OpsRole = "dev_viewer" | "dev_operator" | "dev_admin";

export type ControlPlanePreset = {
  view?: ControlPlaneView;
  commandId?: string;
  target?: string;
  reason?: string;
  dryRun?: boolean;
  payload?: Record<string, unknown>;
  source?: string;
};

export type OpsQuickAction = {
  id: string;
  label: string;
  minRole: OpsRole;
  preset: ControlPlanePreset;
};

const ROLE_PRIORITY: Record<OpsRole, number> = {
  dev_viewer: 1,
  dev_operator: 2,
  dev_admin: 3,
};

const QUICK_ACTIONS: OpsQuickAction[] = [
  {
    id: "qa-render-health",
    label: "Stato deploy",
    minRole: "dev_viewer",
    preset: {
      view: "render",
      commandId: "render.services.health",
      dryRun: true,
      source: "quick-action",
    },
  },
  {
    id: "qa-audit-last",
    label: "Audit recente",
    minRole: "dev_viewer",
    preset: {
      view: "audit",
      source: "quick-action",
    },
  },
  {
    id: "qa-render-trigger",
    label: "Prepara deploy",
    minRole: "dev_operator",
    preset: {
      view: "commands",
      commandId: "render.deployments.trigger",
      target: "turni-di-palco-production",
      reason: "Precheck deployment",
      dryRun: true,
      source: "quick-action",
    },
  },
  {
    id: "qa-db-read",
    label: "Controllo DB",
    minRole: "dev_operator",
    preset: {
      view: "commands",
      commandId: "supabase.db.read",
      reason: "Operational check",
      dryRun: true,
      payload: { scope: "default" },
      source: "quick-action",
    },
  },
  {
    id: "qa-mobile-flags",
    label: "Feature flags",
    minRole: "dev_admin",
    preset: {
      view: "mobile-flags",
      source: "quick-action",
    },
  },
];

function normalizeBoolean(value: string | null): boolean | undefined {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return undefined;
}

function parsePayload(value: string | null): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function isControlPlaneView(value: string | null): value is ControlPlaneView {
  if (!value) return false;
  return (CONTROL_PLANE_VIEWS as readonly string[]).includes(value);
}

function getRoleRank(role: string): number {
  if (role in ROLE_PRIORITY) return ROLE_PRIORITY[role as OpsRole];
  return 0;
}

export function buildControlPlaneUrl(preset: ControlPlanePreset, basePath = "/"): string {
  const params = new URLSearchParams();
  if (preset.view) params.set("view", preset.view);
  if (preset.commandId) params.set("command", preset.commandId);
  if (preset.target) params.set("target", preset.target);
  if (preset.reason) params.set("reason", preset.reason);
  if (typeof preset.dryRun === "boolean") params.set("dryRun", String(preset.dryRun));
  if (preset.payload) params.set("payload", JSON.stringify(preset.payload));
  if (preset.source) params.set("source", preset.source);

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function parseControlPlanePreset(search: string | URLSearchParams | undefined | null): ControlPlanePreset {
  if (!search) return {};

  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  const viewValue = params.get("view");
  const command = params.get("command");
  const target = params.get("target");
  const reason = params.get("reason");
  const source = params.get("source");

  return {
    view: isControlPlaneView(viewValue) ? viewValue : undefined,
    commandId: command || undefined,
    target: target || undefined,
    reason: reason || undefined,
    dryRun: normalizeBoolean(params.get("dryRun")),
    payload: parsePayload(params.get("payload")),
    source: source || undefined,
  };
}

export function getRoleAdaptiveQuickActions(roles: string[] | undefined): OpsQuickAction[] {
  if (!roles?.length) {
    return QUICK_ACTIONS.filter((action) => action.minRole === "dev_viewer");
  }

  const highestRank = roles.reduce((max, role) => Math.max(max, getRoleRank(role)), 0);
  return QUICK_ACTIONS.filter((action) => ROLE_PRIORITY[action.minRole] <= highestRank);
}
