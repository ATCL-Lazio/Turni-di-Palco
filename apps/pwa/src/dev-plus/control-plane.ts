import type {
  AuditEntry,
  CommandCatalogEntry,
  CommandDraft,
  CommandResult,
  DashboardSnapshot,
  DbOperationStatus,
  MetricCard,
  PreparedCommand,
  RenderServiceStatus,
  SessionValidation,
} from "./types";
import { appConfig } from "../services/app-config";

type JsonResponse<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  url?: string;
};

type RequestOptions = {
  method?: "GET" | "POST";
  token: string;
  body?: unknown;
  signal?: AbortSignal;
};

const controlPlaneBase = appConfig.controlPlane.baseUrl;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return fallback;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toIsoString(value: unknown, fallback = new Date().toISOString()) {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback;
}

function parseErrorMessage(payload: unknown, fallback: string) {
  const record = asRecord(payload);
  if (!record) return fallback;
  return asString(record.error) || asString(record.message) || asString(record.reason) || fallback;
}

function buildUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return controlPlaneBase ? `${controlPlaneBase}${normalizedPath}` : normalizedPath;
}

async function requestJson<T>(path: string, options: RequestOptions): Promise<JsonResponse<T>> {
  const url = buildUrl(path);
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${options.token}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: parseErrorMessage(payload, `Control-plane HTTP ${response.status}`),
        data: payload as T,
        url,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: (payload ?? {}) as T,
      url,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false,
        status: 0,
        error: "Richiesta annullata.",
        url,
      };
    }

    return {
      ok: false,
      status: 0,
      error: "Control-plane non raggiungibile.",
      url,
    };
  }
}

function parseMetrics(payload: unknown): MetricCard[] {
  const record = asRecord(payload);
  const rows = asArray(record?.metrics);
  return rows
    .map((entry, index) => {
      const item = asRecord(entry);
      if (!item) return null;

      const trendValue = asString(item.trend).toLowerCase();
      const trend =
        trendValue === "up" || trendValue === "down" || trendValue === "steady" ? trendValue : undefined;

      return {
        id: asString(item.id, `metric-${index}`),
        label: asString(item.label, "Metric"),
        value: asString(item.value, "0"),
        detail: asString(item.detail),
        trend,
      } satisfies MetricCard;
    })
    .filter((entry): entry is MetricCard => Boolean(entry));
}

function parseAudit(payload: unknown): AuditEntry[] {
  const record = asRecord(payload);
  const rows = asArray(record?.entries);
  return rows
    .map((entry, index) => {
      const item = asRecord(entry);
      if (!item) return null;
      const resultValue = asString(item.result, "ok").toLowerCase();
      const result = resultValue === "warn" || resultValue === "error" ? resultValue : "ok";

      return {
        id: asString(item.id, `audit-${index}`),
        at: toIsoString(item.at ?? item.created_at ?? item.createdAt),
        actor: asString(item.actor, "system"),
        action: asString(item.action, "unknown"),
        result,
        reason: asString(item.reason),
        dryRun: asBoolean(item.dryRun, false),
      } satisfies AuditEntry;
    })
    .filter((entry): entry is AuditEntry => Boolean(entry));
}

function parseRenderServices(payload: unknown): RenderServiceStatus[] {
  const record = asRecord(payload);
  const container = asRecord(record?.result) ?? record;
  const rows = asArray(container?.services);
  return rows
    .map((entry, index) => {
      const item = asRecord(entry);
      if (!item) return null;
      return {
        id: asString(item.id, `render-${index}`),
        name: asString(item.name, "render-service"),
        environment: asString(item.environment, "prod"),
        status: asString(item.status, "unknown"),
        region: asString(item.region),
        latencyMs: asNumber(item.latencyMs),
        instances: asNumber(item.instances),
        updatedAt: asString(item.updatedAt),
      } satisfies RenderServiceStatus;
    })
    .filter((entry): entry is RenderServiceStatus => Boolean(entry));
}

function parseDbOps(payload: unknown): DbOperationStatus[] {
  const record = asRecord(payload);
  const rows = asArray(record?.operations);
  return rows
    .map((entry, index) => {
      const item = asRecord(entry);
      if (!item) return null;
      return {
        id: asString(item.id, `db-${index}`),
        operation: asString(item.operation, "unknown"),
        status: asString(item.status, "unknown"),
        target: asString(item.target, "-"),
        durationMs: asNumber(item.durationMs),
        startedAt: asString(item.startedAt),
        finishedAt: asString(item.finishedAt),
        nextRunAt: asString(item.nextRunAt),
      } satisfies DbOperationStatus;
    })
    .filter((entry): entry is DbOperationStatus => Boolean(entry));
}

function fallbackMetrics(validation?: SessionValidation): MetricCard[] {
  return [
    {
      id: "session",
      label: "Session Gate",
      value: validation?.valid ? "validated" : "pending",
      detail: validation?.reason || "Control-plane handshake",
      trend: validation?.valid ? "up" : "steady",
    },
  ];
}

function normalizeRiskLevel(value: unknown): "low" | "medium" | "high" {
  const normalized = asString(value, "medium").toLowerCase();
  if (normalized === "low" || normalized === "high") return normalized;
  return "medium";
}

function toCommandArgs(draft: CommandDraft) {
  const args: Record<string, unknown> = {};
  if (draft.target.trim()) args.target = draft.target.trim();
  if (draft.payload && typeof draft.payload === "object") {
    Object.assign(args, draft.payload);
  }
  return args;
}

export function getControlPlaneEndpoint() {
  return controlPlaneBase;
}

export async function validateControlPlaneSession(token: string, signal?: AbortSignal): Promise<SessionValidation> {
  const response = await requestJson<unknown>("/api/auth/session/validate", {
    method: "POST",
    token,
    body: {
      path: typeof window === "undefined" ? "/control-plane.html" : window.location.pathname,
      source: "dev-plus",
    },
    signal,
  });

  if (!response.ok) {
    return {
      valid: false,
      reason: response.error || "Sessione non validata.",
      validatedAt: new Date().toISOString(),
    };
  }

  const record = asRecord(response.data);
  const user = asRecord(record?.user);
  const tokenData = asRecord(record?.token);
  const roles = asArray(user?.roles).map((entry) => asString(entry)).filter(Boolean);

  return {
    valid: asBoolean(record?.valid, false),
    reason: asString(record?.reason),
    roles,
    expiresAt: asString(tokenData?.expiresAt),
    validatedAt: toIsoString(record?.validatedAt ?? tokenData?.issuedAt),
    controlPlaneVersion: asString(record?.version),
  };
}

export async function fetchCommandCatalog(
  token: string,
  signal?: AbortSignal
): Promise<{ commands: CommandCatalogEntry[]; error?: string }> {
  const response = await requestJson<unknown>("/api/commands/catalog", {
    method: "GET",
    token,
    signal,
  });

  if (!response.ok) {
    return { commands: [], error: response.error || "Catalogo comandi non disponibile." };
  }

  const record = asRecord(response.data);
  const rows = asArray(record?.commands);
  const commands = rows
    .map((entry) => {
      const item = asRecord(entry);
      if (!item) return null;
      return {
        id: asString(item.id),
        label: asString(item.label) || asString(item.id),
        description: asString(item.description),
        requiredRole: asString(item.requiredRole),
        riskLevel: normalizeRiskLevel(item.riskLevel),
        requiresConfirmation: asBoolean(item.requiresConfirmation, false),
        supportsDryRun: asBoolean(item.supportsDryRun, false),
        available: asBoolean(item.available, false),
      } satisfies CommandCatalogEntry;
    })
    .filter((entry): entry is CommandCatalogEntry => Boolean(entry) && Boolean(entry.id));

  return { commands };
}

export async function fetchDashboardSnapshot(
  token: string,
  validation?: SessionValidation,
  signal?: AbortSignal
): Promise<DashboardSnapshot> {
  const [metricsRes, auditRes, renderRes, dbRes] = await Promise.all([
    requestJson<unknown>("/api/dashboard/metrics", { method: "GET", token, signal }),
    requestJson<unknown>("/api/audit/recent?limit=50", { method: "GET", token, signal }),
    requestJson<unknown>("/api/render/services/health", { method: "GET", token, signal }),
    requestJson<unknown>("/api/db/ops?limit=40", { method: "GET", token, signal }),
  ]);

  const metrics = metricsRes.ok ? parseMetrics(metricsRes.data) : [];
  const audit = auditRes.ok ? parseAudit(auditRes.data) : [];
  const renderServices = renderRes.ok ? parseRenderServices(renderRes.data) : [];
  const dbOperations = dbRes.ok ? parseDbOps(dbRes.data) : [];

  const errors = [metricsRes, auditRes, renderRes, dbRes]
    .filter((entry) => !entry.ok)
    .map((entry) => entry.error)
    .filter((entry): entry is string => Boolean(entry));

  return {
    metrics: metrics.length ? metrics : fallbackMetrics(validation),
    audit,
    renderServices,
    dbOperations,
    source: errors.length ? `fallback: ${errors.join(" | ")}` : metricsRes.url || controlPlaneBase,
    refreshedAt: new Date().toISOString(),
  };
}

export async function prepareControlCommand(
  draft: CommandDraft,
  token: string,
  signal?: AbortSignal
): Promise<{ prepared?: PreparedCommand; error?: string }> {
  const response = await requestJson<unknown>("/api/commands/prepare", {
    method: "POST",
    token,
    body: {
      commandId: draft.commandId,
      reason: draft.reason,
      dryRun: draft.dryRun,
      args: toCommandArgs(draft),
    },
    signal,
  });

  if (!response.ok) {
    return { error: response.error || "Preparazione comando fallita." };
  }

  const record = asRecord(response.data);
  if (!record) {
    return { error: "Risposta control-plane non valida durante la preparazione." };
  }

  const preview = asArray(record.preview).map((entry) => asString(entry)).filter(Boolean);

  return {
    prepared: {
      commandId: asString(record.commandId, draft.commandId),
      summary: asString(record.summary, draft.commandId),
      requiresConfirmation: asBoolean(record.requiresConfirmation, false),
      requiresConfirmText: asString(record.requiresConfirmText, "CONFIRM"),
      confirmationToken: asString(record.confirmationToken),
      confirmationTokenExpiresAt: asString(record.confirmationTokenExpiresAt),
      riskLevel: normalizeRiskLevel(record.riskLevel),
      preview,
      raw: response.data,
    },
  };
}

export async function executeControlCommand(
  draft: CommandDraft,
  prepared: PreparedCommand,
  confirmText: string,
  token: string,
  signal?: AbortSignal
): Promise<{ result?: CommandResult; error?: string }> {
  const response = await requestJson<unknown>("/api/commands/execute", {
    method: "POST",
    token,
    body: {
      commandId: prepared.commandId,
      reason: draft.reason,
      dryRun: draft.dryRun,
      args: toCommandArgs(draft),
      confirmationToken: prepared.confirmationToken,
      confirmText,
    },
    signal,
  });

  if (!response.ok) {
    return { error: response.error || "Esecuzione comando fallita." };
  }

  const record = asRecord(response.data);
  if (!record) {
    return { error: "Risposta control-plane non valida durante esecuzione." };
  }

  const statusRaw = asString(record.status, "completed").toLowerCase();
  const status = statusRaw === "failed" ? "failed" : statusRaw === "accepted" ? "accepted" : "completed";

  return {
    result: {
      executionId: asString(record.executionId),
      commandId: asString(record.commandId, prepared.commandId),
      status,
      message: asString(record.message, "Comando processato."),
      raw: response.data,
    },
  };
}
