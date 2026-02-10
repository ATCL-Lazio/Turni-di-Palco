export type SessionValidation = {
  valid: boolean;
  reason?: string;
  roles?: string[];
  expiresAt?: string;
  validatedAt?: string;
  controlPlaneVersion?: string;
};

export type MetricCard = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  trend?: "up" | "down" | "steady";
};

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  result: "ok" | "warn" | "error";
  reason?: string;
  dryRun?: boolean;
};

export type RenderServiceStatus = {
  id: string;
  name: string;
  environment: string;
  status: string;
  region?: string;
  latencyMs?: number;
  instances?: number;
  updatedAt?: string;
};

export type DbOperationStatus = {
  id: string;
  operation: string;
  status: string;
  target: string;
  durationMs?: number;
  startedAt?: string;
  finishedAt?: string;
  nextRunAt?: string;
};

export type DashboardSnapshot = {
  metrics: MetricCard[];
  audit: AuditEntry[];
  renderServices: RenderServiceStatus[];
  dbOperations: DbOperationStatus[];
  source: string;
  refreshedAt: string;
};

export type CommandCatalogEntry = {
  id: string;
  label: string;
  description: string;
  requiredRole: string;
  riskLevel: "low" | "medium" | "high";
  requiresConfirmation: boolean;
  supportsDryRun: boolean;
  available: boolean;
};

export type PreparedCommand = {
  commandId: string;
  summary: string;
  requiresConfirmation: boolean;
  requiresConfirmText?: string;
  confirmationToken?: string;
  confirmationTokenExpiresAt?: string;
  riskLevel?: "low" | "medium" | "high";
  preview?: string[];
  raw?: unknown;
};

export type CommandResult = {
  executionId?: string;
  commandId: string;
  status: "accepted" | "completed" | "failed";
  message: string;
  raw?: unknown;
};

export type CommandDraft = {
  commandId: string;
  target: string;
  reason: string;
  dryRun: boolean;
  payload?: Record<string, unknown>;
};
