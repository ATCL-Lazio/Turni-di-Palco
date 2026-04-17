
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import express from "express";
import rateLimit from "express-rate-limit";
import { decodeJwt } from "jose";
import { createClient } from "@supabase/supabase-js";

const CONTROL_PLANE_VERSION = (process.env.CONTROL_PLANE_VERSION || "2026.02.09").trim();
const DEFAULT_CONTROL_PLANE_PORT = Number.parseInt(String.fromCharCode(56, 55, 56, 55), 10);
const CONTROL_PLANE_PORT = parseInteger(
  process.env.CONTROL_PLANE_PORT || process.env.PORT,
  DEFAULT_CONTROL_PLANE_PORT,
  1,
  65535
);
const RATE_LIMIT_PER_MIN = parseInteger(process.env.CONTROL_PLANE_RATE_LIMIT_PER_MIN, 120, 1, 5000);
const AUTH_RATE_LIMIT_PER_15_MIN = 300;
const DB_OPS_RATE_LIMIT_PER_MIN = 30;
const CONFIRM_TOKEN_TTL_MS = parseInteger(
  process.env.CONTROL_PLANE_CONFIRM_TTL_MS,
  300000,
  5000,
  24 * 60 * 60 * 1000
);
const GLOBAL_DRY_RUN = parseBoolean(process.env.DRY_RUN, false);

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const MOBILE_APP_VERSION_FALLBACK = (process.env.APP_VERSION || "0.0.5").trim() || "0.0.5";
const MOBILE_APP_VERSION_BADGE_LABEL = (process.env.APP_VERSION_BADGE_LABEL || "App version").trim() || "App version";
const MOBILE_APP_VERSION_BADGE_COLOR = (process.env.APP_VERSION_BADGE_COLOR || "2ea44f").trim() || "2ea44f";
const APP_VERSION_FUNCTION_ENDPOINT = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/app-version`
  : "";
const CONTROL_PLANE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const MOBILE_APP_VERSION_LOGO_PATH = path.join(
  CONTROL_PLANE_ROOT,
  "apps/mobile/src/assets/figma/welcome-logo.svg"
);
const MOBILE_APP_VERSION_LOGO_SVG = loadBadgeLogoSvg(MOBILE_APP_VERSION_LOGO_PATH);

const RENDER_API_KEY = (process.env.RENDER_API_KEY || "").trim();
const RENDER_API_BASE = "https://api.render.com/v1";

const ROLE_TABLE = normalizeTableName(process.env.CONTROL_PLANE_ROLE_TABLE || "control_plane_roles");
const CONFIRM_TABLE = normalizeTableName(process.env.CONTROL_PLANE_CONFIRM_TABLE || "control_plane_confirmations");
const EXECUTION_TABLE = normalizeTableName(process.env.CONTROL_PLANE_EXECUTION_TABLE || "control_plane_executions");
const AUDIT_TABLE = normalizeTableName(process.env.CONTROL_PLANE_AUDIT_TABLE || "control_plane_audit");

const DEFAULT_CONFIRM_TEXT = (process.env.CONTROL_PLANE_CONFIRM_TEXT || "CONFIRM").trim() || "CONFIRM";

const configuredOrigins = parseCsv(process.env.CONTROL_PLANE_ALLOWED_ORIGINS);
const ALLOWED_ORIGINS = new Set(
  configuredOrigins.length
    ? configuredOrigins
    : [
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://localhost:4173",
        "https://127.0.0.1:4173",
      ]
);
const ALLOWED_EMAILS = new Set(parseCsv(process.env.CONTROL_PLANE_ALLOWED_EMAILS).map((value) => value.toLowerCase()));

const READ_TABLE_ALLOWLIST = buildAllowlist(
  process.env.CONTROL_PLANE_DB_READ_ALLOWLIST,
  [ROLE_TABLE, CONFIRM_TABLE, EXECUTION_TABLE, AUDIT_TABLE]
);
const MUTATE_TABLE_ALLOWLIST = buildAllowlist(
  process.env.CONTROL_PLANE_DB_MUTATE_ALLOWLIST,
  [CONFIRM_TABLE, EXECUTION_TABLE, AUDIT_TABLE]
);

const SENSITIVE_KEY_PATTERN =
  /(password|passphrase|secret|token|api[_-]?key|authorization|cookie|jwt|private[_-]?key|access[_-]?key)/i;
const JWT_PATTERN = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;
const VALID_COLUMN_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const ROLE_RANK = Object.freeze({
  dev_viewer: 1,
  dev_operator: 2,
  dev_admin: 3,
});

const COMMAND_CATALOG = Object.freeze({
  "render.services.health": {
    minRole: "dev_viewer",
    riskLevel: "low",
    requiresConfirmText: DEFAULT_CONFIRM_TEXT,
    description: "Legge lo stato health dei servizi Render allowlistati.",
    label: "Render services health",
  },
  "render.deployments.list": {
    minRole: "dev_viewer",
    riskLevel: "low",
    requiresConfirmText: DEFAULT_CONFIRM_TEXT,
    description: "Elenca i deploy Render recenti per servizio.",
    label: "Render deployments list",
  },
  "render.deployments.trigger": {
    minRole: "dev_operator",
    riskLevel: "high",
    requiresConfirmText: DEFAULT_CONFIRM_TEXT,
    description: "Trigger deploy Render su servizio allowlistato.",
    label: "Render trigger deployment",
  },
  "supabase.db.read": {
    minRole: "dev_viewer",
    riskLevel: "low",
    requiresConfirmText: DEFAULT_CONFIRM_TEXT,
    description: "Read query su tabella Supabase allowlistata.",
    label: "Supabase readonly query",
  },
  "supabase.events.cleanup": {
    minRole: "dev_operator",
    riskLevel: "medium",
    requiresConfirmText: DEFAULT_CONFIRM_TEXT,
    description: "Cleanup eventi vecchi in Supabase.",
    label: "Supabase cleanup old events",
  },
  "supabase.db.mutate": {
    minRole: "dev_admin",
    riskLevel: "high",
    requiresConfirmText: DEFAULT_CONFIRM_TEXT,
    description: "Mutazioni Supabase con guardrail.",
    label: "Supabase mutate",
  },
});
const COMMAND_ALLOWLIST = new Set(Object.keys(COMMAND_CATALOG));

const RENDER_SERVICE_REGISTRY = parseRenderServiceRegistry(process.env.RENDER_SERVICE_IDS_JSON || "");

const supabaseAuthKey = SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
const supabaseAuthClient =
  SUPABASE_URL && supabaseAuthKey
    ? createClient(SUPABASE_URL, supabaseAuthKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

const supabaseAdminClient =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

const supabaseDbClient = supabaseAdminClient || supabaseAuthClient;

const rateLimitState = new Map();
const pendingByCommandId = new Map();
const pendingByTokenHash = new Map();

const PENDING_STORE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "pending-confirmations.json"
);

function savePendingToDisk() {
  try {
    const entries = Array.from(pendingByCommandId.values());
    const dir = path.dirname(PENDING_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PENDING_STORE_PATH, JSON.stringify(entries, null, 2), "utf8");
  } catch (err) {
    console.warn("[control-plane] failed to persist pending confirmations:", err.message);
  }
}

function loadPendingFromDisk() {
  try {
    if (!fs.existsSync(PENDING_STORE_PATH)) return;
    const raw = fs.readFileSync(PENDING_STORE_PATH, "utf8");
    const entries = JSON.parse(raw);
    const now = Date.now();
    for (const entry of entries) {
      if (!entry?.commandId || !entry?.tokenHash) continue;
      if (entry.expiresAtMs <= now) continue;
      pendingByCommandId.set(entry.commandId, entry);
      pendingByTokenHash.set(entry.tokenHash, entry.commandId);
    }
    if (pendingByCommandId.size > 0) {
      console.log(`[control-plane] restored ${pendingByCommandId.size} pending confirmation(s) from disk`);
    }
  } catch (err) {
    console.warn("[control-plane] failed to load pending confirmations:", err.message);
  }
}

loadPendingFromDisk();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));
app.use(requestIdMiddleware);
app.use(securityHeadersMiddleware);
app.use(corsMiddleware);
app.use(rateLimitMiddleware);
app.use(cleanupPendingMiddleware);

const router = express.Router();

router.get("/", controlPlaneRootHandler);
router.get("/control-plane", controlPlaneRootHandler);
router.get("/health", healthHandler);
for (const path of ["/api/badges/mobile-version", "/badges/mobile-version"]) {
  router.get(path, asyncRoute(mobileVersionBadgeHandler));
}

for (const path of ["/api/auth/session/validate", "/session/validate"]) {
  router.get(path, asyncRoute(sessionValidateHandler));
  router.post(path, asyncRoute(sessionValidateHandler));
}

router.get(
  "/api/commands/catalog",
  asyncRoute(attachAuthContext),
  requireRole("dev_viewer"),
  asyncRoute(commandsCatalogHandler)
);
router.get(
  "/commands/catalog",
  asyncRoute(attachAuthContext),
  requireRole("dev_viewer"),
  asyncRoute(commandsCatalogHandler)
);

for (const path of ["/api/commands/prepare", "/commands/prepare"]) {
  router.post(path, asyncRoute(attachAuthContext), requireRole("dev_operator"), asyncRoute(commandsPrepareHandler));
}

for (const path of ["/api/commands/execute", "/commands/execute"]) {
  router.post(path, asyncRoute(attachAuthContext), requireRole("dev_operator"), asyncRoute(commandsExecuteHandler));
}

for (const path of ["/api/commands/executions/:id", "/commands/executions/:id"]) {
  router.get(path, asyncRoute(attachAuthContext), requireRole("dev_viewer"), asyncRoute(commandExecutionByIdHandler));
}

for (const path of ["/api/render/services/health", "/api/render/services", "/render/services"]) {
  router.get(path, asyncRoute(attachAuthContext), requireRole("dev_viewer"), asyncRoute(renderServicesHealthHandler));
}

router.get(
  "/api/render/deployments",
  asyncRoute(attachAuthContext),
  requireRole("dev_viewer"),
  asyncRoute(renderDeploymentsGetHandler)
);
router.post(
  "/api/render/deployments",
  asyncRoute(attachAuthContext),
  requireRole("dev_operator"),
  asyncRoute(renderDeploymentsPostHandler)
);

router.post(
  "/api/supabase/db/read",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: AUTH_RATE_LIMIT_PER_15_MIN,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  asyncRoute(attachAuthContext),
  requireRole("dev_viewer"),
  asyncRoute(supabaseDbReadHandler)
);
router.post(
  "/api/supabase/db/mutate",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: AUTH_RATE_LIMIT_PER_15_MIN,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  asyncRoute(attachAuthContext),
  requireRole("dev_operator"),
  asyncRoute(supabaseDbMutateHandler)
);

for (const path of ["/api/audit/recent", "/api/audit", "/audit"]) {
  router.get(
    path,
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: AUTH_RATE_LIMIT_PER_15_MIN,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    asyncRoute(attachAuthContext),
    requireRole("dev_viewer"),
    asyncRoute(auditRecentHandler)
  );
}

for (const path of ["/api/dashboard/metrics", "/dashboard/metrics"]) {
  router.get(
    path,
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: AUTH_RATE_LIMIT_PER_15_MIN,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    asyncRoute(attachAuthContext),
    requireRole("dev_viewer"),
    asyncRoute(dashboardMetricsHandler)
  );
}

for (const path of ["/api/db/ops", "/db/ops"]) {
  router.get(
    path,
    rateLimit({
      windowMs: 60 * 1000,
      max: DB_OPS_RATE_LIMIT_PER_MIN,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    asyncRoute(attachAuthContext),
    requireRole("dev_viewer"),
    asyncRoute(dbOpsHandler)
  );
}

app.use("/", router);
app.use("/control-plane", router);

app.use((req, res) => {
  sendJson(res, 404, {
    ok: false,
    error: "Endpoint non trovato.",
    requestId: res.locals.requestId || null,
  });
});

app.use((error, req, res, _next) => {
  const statusCode = typeof error?.statusCode === "number" ? error.statusCode : 500;
  const message = statusCode >= 500 ? "Errore interno del control-plane." : error?.message || "Richiesta non valida.";

  console.error(
    "[control-plane:error]",
    sanitizeForOutput({
      requestId: res.locals.requestId || null,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      error: error?.message || String(error),
    })
  );

  sendJson(res, statusCode, {
    ok: false,
    error: message,
    requestId: res.locals.requestId || null,
  });
});

setInterval(() => {
  cleanupRateLimits();
  void cleanupExpiredPendingConfirmations();
}, 30_000).unref?.();

app.listen(CONTROL_PLANE_PORT, () => {
  console.info(
    "[control-plane] listening",
    sanitizeForOutput({
      port: CONTROL_PLANE_PORT,
      version: CONTROL_PLANE_VERSION,
      supabaseAuthConfigured: Boolean(supabaseAuthClient),
      supabaseAdminConfigured: Boolean(supabaseAdminClient),
      renderConfigured: Boolean(RENDER_API_KEY),
      rateLimitPerMin: RATE_LIMIT_PER_MIN,
      confirmTokenTtlMs: CONFIRM_TOKEN_TTL_MS,
      globalDryRun: GLOBAL_DRY_RUN,
    })
  );
});

function parseCsv(input) {
  if (!input) return [];
  return String(input)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function parseMaybeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return fallback;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function asString(value, fallback = "") {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function normalizeTableName(value) {
  const raw = asString(value);
  if (!raw) return "";
  const stripped = raw.replace(/^public\./i, "");
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(stripped) ? stripped : "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildAllowlist(raw, fallbackList) {
  const fromEnv = parseCsv(raw).map(normalizeTableName).filter(Boolean);
  const source = fromEnv.length > 0 ? fromEnv : fallbackList;
  return new Set(source.map(normalizeTableName).filter(Boolean));
}

function isTableAllowed(tableName, allowlist) {
  const normalized = normalizeTableName(tableName);
  if (!normalized) return false;
  if (allowlist.has("*")) return true;
  return allowlist.has(normalized);
}

function sanitizeString(value) {
  if (!value) return value;
  if (JWT_PATTERN.test(value)) return "[redacted.jwt]";
  if (/^Bearer\s+/i.test(value)) return "[redacted.bearer]";
  if (value.length > 4000) return `${value.slice(0, 4000)}...[truncated]`;
  return value;
}

function sanitizeForOutput(value, depth = 0, visited = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (depth > 8) return "[truncated.depth]";

  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 200).map((entry) => sanitizeForOutput(entry, depth + 1, visited));
  }

  if (typeof value === "object") {
    if (visited.has(value)) return "[circular]";
    visited.add(value);

    const output = {};
    for (const [key, current] of Object.entries(value).slice(0, 200)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = "[redacted]";
      } else {
        output[key] = sanitizeForOutput(current, depth + 1, visited);
      }
    }
    return output;
  }

  return String(value);
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function controlPlaneRootHandler(_req, res) {
  return sendJson(res, 200, {
    ok: true,
    service: "turni-di-palco-control-plane",
    version: CONTROL_PLANE_VERSION,
    endpoints: ["/health", "/api/auth/session/validate", "/api/commands/catalog"],
    requestId: res.locals.requestId || null,
  });
}

function parseRenderServiceRegistry(raw) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (!isPlainObject(entry)) return null;
        const id = asString(entry.id);
        if (!id) return null;
        return {
          id,
          name: asString(entry.name, id),
          environment: asString(entry.environment, "prod"),
          region: asString(entry.region),
        };
      })
      .filter(Boolean);
  } catch {
    return parseCsv(raw).map((id) => ({
      id,
      name: id,
      environment: "prod",
      region: "",
    }));
  }
}

function requestIdMiddleware(req, res, next) {
  const incoming = asString(req.headers["x-request-id"], "");
  const requestId = incoming || crypto.randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

function securityHeadersMiddleware(_req, res, next) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "no-referrer");
  next();
}

function corsMiddleware(req, res, next) {
  const origin = asString(req.headers.origin, "");

  if (!origin) {
    if (req.method === "OPTIONS") {
      res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
      res.setHeader("access-control-allow-headers", "Authorization,Content-Type");
      return res.status(204).end();
    }
    return next();
  }

  const allowAll = ALLOWED_ORIGINS.has("*");
  const isAllowed = allowAll || ALLOWED_ORIGINS.has(origin);
  if (!isAllowed) {
    return sendJson(res, 403, {
      ok: false,
      error: "Origin non autorizzata.",
      requestId: res.locals.requestId || null,
    });
  }

  res.setHeader("vary", "Origin");
  res.setHeader("access-control-allow-origin", allowAll ? "*" : origin);
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "Authorization,Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return next();
}

function extractClientIp(req) {
  const directIp = asString(req.socket?.remoteAddress);
  if (directIp) return directIp;

  const resolvedIp = asString(req.ip);
  if (resolvedIp) return resolvedIp;

  return "unknown";
}

function normalizeRateLimitPath(path) {
  if (typeof path !== "string" || !path) return "/";
  return path.replace(/^\/api(?=\/|$)/, "") || "/";
}

function handleRateLimit(req, res, next, options) {
  const { state, limit, skipHealth = false } = options;
  if (req.method === "OPTIONS") return next();
  if (skipHealth && (req.path === "/health" || req.path.endsWith("/health"))) return next();

  const now = Date.now();
  const key = `${extractClientIp(req)}:${normalizeRateLimitPath(req.path)}`;
  const entry = state.get(key);

  if (!entry || entry.resetAt <= now) {
    state.set(key, { count: 1, resetAt: now + 60_000 });
    res.setHeader("x-ratelimit-limit", String(limit));
    res.setHeader("x-ratelimit-remaining", String(Math.max(limit - 1, 0)));
    return next();
  }

  entry.count += 1;
  if (entry.count > limit) {
    const retryAfterSeconds = Math.max(Math.ceil((entry.resetAt - now) / 1000), 1);
    res.setHeader("retry-after", String(retryAfterSeconds));
    return sendJson(res, 429, {
      ok: false,
      error: "Rate limit superato.",
      retryAfterSeconds,
      requestId: res.locals.requestId || null,
    });
  }

  res.setHeader("x-ratelimit-limit", String(limit));
  res.setHeader("x-ratelimit-remaining", String(Math.max(limit - entry.count, 0)));
  return next();
}

function rateLimitMiddleware(req, res, next) {
  return handleRateLimit(req, res, next, {
    state: rateLimitState,
    limit: RATE_LIMIT_PER_MIN,
    skipHealth: true,
  });
}

function cleanupRateLimitState(state) {
  const now = Date.now();
  for (const [key, entry] of state.entries()) {
    if (entry.resetAt <= now) {
      state.delete(key);
    }
  }
}

function cleanupRateLimits() {
  cleanupRateLimitState(rateLimitState);
}

function cleanupPendingMiddleware(_req, _res, next) {
  void cleanupExpiredPendingConfirmations();
  next();
}

function extractBearerToken(req) {
  const authHeader = asString(req.headers.authorization, "");
  if (!authHeader) return "";
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return "";
  if (scheme.toLowerCase() !== "bearer") return "";
  return token.trim();
}

function normalizeRole(rawRole) {
  const role = asString(rawRole).toLowerCase();
  if (!role) return null;

  if (role === "dev_admin" || role === "control_admin" || role === "admin") return "dev_admin";
  if (role === "dev_operator" || role === "control_operator" || role === "operator") return "dev_operator";
  if (
    role === "dev_viewer" ||
    role === "control_viewer" ||
    role === "control_auditor" ||
    role === "viewer" ||
    role === "auditor"
  ) {
    return "dev_viewer";
  }

  return null;
}

function roleAtLeast(currentRole, minimumRole) {
  const currentRank = ROLE_RANK[currentRole] || 0;
  const requiredRank = ROLE_RANK[minimumRole] || 0;
  return currentRank >= requiredRank;
}

function highestRole(roles) {
  if (roles.includes("dev_admin")) return "dev_admin";
  if (roles.includes("dev_operator")) return "dev_operator";
  return "dev_viewer";
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      values
        .map((value) => asString(value))
        .filter(Boolean)
    )
  );
}

function extractRolesFromClaims(user) {
  const appMetadata = isPlainObject(user?.app_metadata) ? user.app_metadata : {};
  const userMetadata = isPlainObject(user?.user_metadata) ? user.user_metadata : {};

  const candidates = [appMetadata.roles, appMetadata.role, userMetadata.roles, userMetadata.role];
  const rawRoles = [];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const role of candidate) rawRoles.push(role);
      continue;
    }

    if (typeof candidate === "string" && candidate.trim()) {
      for (const role of candidate.split(",")) rawRoles.push(role);
    }
  }

  return uniqueStrings(rawRoles);
}

async function readRolesFromRoleTable(userId) {
  if (!supabaseDbClient || !ROLE_TABLE) return [];

  const { data, error } = await supabaseDbClient
    .from(ROLE_TABLE)
    .select("role")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .limit(100);

  if (error) {
    console.warn("[control-plane] role-table read failed", sanitizeForOutput({ error: error.message }));
    return [];
  }

  return uniqueStrings((data || []).map((entry) => entry.role));
}

function decodeTokenExpIso(token) {
  try {
    const claims = decodeJwt(token);
    if (typeof claims.exp === "number") {
      return new Date(claims.exp * 1000).toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveAuthContext(token) {
  if (!token) {
    return {
      ok: false,
      statusCode: 401,
      reason: "Bearer token mancante.",
    };
  }

  if (!supabaseAuthClient) {
    return {
      ok: false,
      statusCode: 503,
      reason: "Supabase auth non configurata.",
    };
  }

  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data?.user) {
    return {
      ok: false,
      statusCode: 401,
      reason: error?.message || "Token non valido o scaduto.",
    };
  }

  const user = data.user;
  const emailLower = asString(user.email).toLowerCase();
  if (ALLOWED_EMAILS.size > 0 && (!emailLower || !ALLOWED_EMAILS.has(emailLower))) {
    return {
      ok: false,
      statusCode: 403,
      reason: "Email non in CONTROL_PLANE_ALLOWED_EMAILS.",
    };
  }

  const claimRoles = extractRolesFromClaims(user);
  const tableRoles = await readRolesFromRoleTable(user.id);

  const mappedRoles = uniqueStrings(
    [...claimRoles, ...tableRoles]
      .map((role) => normalizeRole(role))
      .filter(Boolean)
  );

  if (!mappedRoles.length && ALLOWED_EMAILS.size > 0 && emailLower && ALLOWED_EMAILS.has(emailLower)) {
    mappedRoles.push("dev_admin");
  }

  if (!mappedRoles.length) {
    return {
      ok: false,
      statusCode: 403,
      reason: "Nessun ruolo dev_viewer/dev_operator/dev_admin disponibile.",
    };
  }

  const roleLevel = highestRole(mappedRoles);

  return {
    ok: true,
    auth: {
      userId: user.id,
      email: user.email || null,
      roles: mappedRoles,
      roleLevel,
      token,
      tokenExpiresAt: decodeTokenExpIso(token),
    },
  };
}

async function attachAuthContext(req, res, next) {
  const token = extractBearerToken(req);
  const resolved = await resolveAuthContext(token);

  if (!resolved.ok) {
    return sendJson(res, resolved.statusCode, {
      ok: false,
      error: resolved.reason,
      requestId: res.locals.requestId || null,
    });
  }

  res.locals.auth = resolved.auth;
  return next();
}

function getAuth(res) {
  return res.locals.auth || null;
}

function requireRole(minimumRole) {
  return (req, res, next) => {
    const auth = getAuth(res);
    if (!auth) {
      return sendJson(res, 401, {
        ok: false,
        error: "Sessione non autenticata.",
        requestId: res.locals.requestId || null,
      });
    }

    if (!roleAtLeast(auth.roleLevel, minimumRole)) {
      return sendJson(res, 403, {
        ok: false,
        error: `Permessi insufficienti. Richiesto almeno ${minimumRole}.`,
        requestId: res.locals.requestId || null,
      });
    }

    return next();
  };
}

function hashToken(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function removePending(commandId) {
  const found = pendingByCommandId.get(commandId);
  if (!found) return null;

  pendingByCommandId.delete(commandId);
  pendingByTokenHash.delete(found.tokenHash);
  savePendingToDisk();
  return found;
}

function restorePending(entry) {
  if (!entry?.commandId || !entry?.tokenHash) return;
  pendingByCommandId.set(entry.commandId, entry);
  pendingByTokenHash.set(entry.tokenHash, entry.commandId);
  savePendingToDisk();
}

async function markPendingExpired(entry) {
  if (!supabaseDbClient || !entry?.confirmationRowId || !CONFIRM_TABLE) return;

  await supabaseDbClient
    .from(CONFIRM_TABLE)
    .update({ status: "expired" })
    .eq("id", entry.confirmationRowId)
    .eq("status", "pending");
}

async function cleanupExpiredPendingConfirmations() {
  const now = Date.now();

  for (const [commandId, entry] of pendingByCommandId.entries()) {
    if (entry.expiresAtMs <= now) {
      removePending(commandId);
      await markPendingExpired(entry);
    }
  }
}

async function insertAudit({
  actorUserId,
  action,
  resourceType,
  resourceId = null,
  requestId = null,
  metadata = {},
}) {
  if (!supabaseDbClient || !AUDIT_TABLE) return;

  const payload = {
    actor_user_id: actorUserId || null,
    action: asString(action),
    resource_type: asString(resourceType),
    resource_id: resourceId ? asString(resourceId) : null,
    request_id: requestId || null,
    metadata: sanitizeForOutput(metadata),
  };

  const { error } = await supabaseDbClient.from(AUDIT_TABLE).insert(payload);
  if (error) {
    console.warn("[control-plane] audit insert failed", sanitizeForOutput({ action, error: error.message }));
  }
}

function healthHandler(_req, res) {
  sendJson(res, 200, {
    ok: true,
    service: "turni-di-palco-control-plane",
    version: CONTROL_PLANE_VERSION,
    now: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    configuration: {
      supabaseAuthConfigured: Boolean(supabaseAuthClient),
      supabaseAdminConfigured: Boolean(supabaseAdminClient),
      renderConfigured: Boolean(RENDER_API_KEY),
      allowedOrigins: ALLOWED_ORIGINS.size,
      rateLimitPerMin: RATE_LIMIT_PER_MIN,
      confirmTokenTtlMs: CONFIRM_TOKEN_TTL_MS,
      globalDryRun: GLOBAL_DRY_RUN,
    },
  });
}

async function fetchMobileAppVersion() {
  if (!APP_VERSION_FUNCTION_ENDPOINT) {
    return {
      version: MOBILE_APP_VERSION_FALLBACK,
      source: "fallback_no_supabase_url",
    };
  }

  const authKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  const headers = {
    "content-type": "application/json",
    "x-control-plane-source": "mobile-version-badge",
  };

  if (authKey) {
    headers.apikey = authKey;
    headers.authorization = `Bearer ${authKey}`;
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 5000);
  timeout.unref?.();

  try {
    const response = await fetch(APP_VERSION_FUNCTION_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ limit: 1, changelog: false }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`app-version endpoint HTTP ${response.status}`);
    }

    const payload = await response.json().catch(() => ({}));
    const version = asString(payload?.version, MOBILE_APP_VERSION_FALLBACK);
    return {
      version: version || MOBILE_APP_VERSION_FALLBACK,
      source: "supabase_function",
    };
  } catch (error) {
    console.warn(
      "[control-plane] mobile version badge fallback",
      sanitizeForOutput({ error: error?.message || String(error) })
    );
    return {
      version: MOBILE_APP_VERSION_FALLBACK,
      source: "fallback_on_error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function mobileVersionBadgeHandler(_req, res) {
  const { version, source } = await fetchMobileAppVersion();
  const normalizedVersion = asString(version, MOBILE_APP_VERSION_FALLBACK) || MOBILE_APP_VERSION_FALLBACK;
  const message = normalizedVersion.startsWith("v") ? normalizedVersion : `v${normalizedVersion}`;
  const color = source === "supabase_function" ? MOBILE_APP_VERSION_BADGE_COLOR : "f0ad4e";

  return sendJson(res, 200, {
    schemaVersion: 1,
    label: MOBILE_APP_VERSION_BADGE_LABEL,
    message,
    color,
    logoSvg: MOBILE_APP_VERSION_LOGO_SVG || undefined,
    cacheSeconds: 300,
  });
}

function loadBadgeLogoSvg(filePath) {
  try {
    const rawSvg = fs.readFileSync(filePath, "utf8");
    return normalizeBadgeLogoSvg(rawSvg);
  } catch (error) {
    console.warn(
      "[control-plane] badge logo fallback",
      sanitizeForOutput({
        filePath,
        error: error?.message || String(error),
      })
    );
    return "";
  }
}

function normalizeBadgeLogoSvg(rawSvg) {
  const compact = String(rawSvg || "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return compact
    .replaceAll("var(--stroke-0, #F4BF4F)", "#F4BF4F")
    .replaceAll("var(--stroke-0,#F4BF4F)", "#F4BF4F");
}

async function sessionValidateHandler(req, res) {
  const token = extractBearerToken(req);
  const resolved = await resolveAuthContext(token);

  if (!resolved.ok) {
    return sendJson(res, resolved.statusCode, {
      valid: false,
      reason: resolved.reason,
      validatedAt: new Date().toISOString(),
      version: CONTROL_PLANE_VERSION,
    });
  }

  const auth = resolved.auth;

  await insertAudit({
    actorUserId: auth.userId,
    action: "auth.session.validate",
    resourceType: "session",
    resourceId: auth.userId,
    requestId: res.locals.requestId,
    metadata: {
      source: asString(req.body?.source),
      path: asString(req.body?.path || req.path),
      roleLevel: auth.roleLevel,
      roles: auth.roles,
    },
  });

  return sendJson(res, 200, {
    valid: true,
    allowed: true,
    reason: "Sessione valida.",
    roles: auth.roles,
    level: auth.roleLevel,
    expiresAt: auth.tokenExpiresAt,
    user: {
      id: auth.userId,
      email: auth.email,
      roles: auth.roles,
      roleLevel: auth.roleLevel,
    },
    token: {
      expiresAt: auth.tokenExpiresAt,
      issuedAt: new Date().toISOString(),
    },
    validatedAt: new Date().toISOString(),
    version: CONTROL_PLANE_VERSION,
  });
}

function commandsCatalogHandler(_req, res) {
  const auth = getAuth(res);
  const commands = Object.entries(COMMAND_CATALOG)
    .map(([command, data]) => ({
      id: command,
      command,
      label: asString(data.label, command),
      requiredRole: data.minRole,
      minRole: data.minRole,
      riskLevel: data.riskLevel,
      description: data.description,
      requiresConfirmation: true,
      requiresConfirmText: data.requiresConfirmText,
      supportsDryRun: true,
      dryRunSupported: true,
      available: roleAtLeast(auth.roleLevel, data.minRole),
    }));

  return sendJson(res, 200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    commands,
    allowlist: commands.map((entry) => entry.id),
  });
}

function buildCommandPreview({ command, target, reason, dryRun, payload, expiresAtIso }) {
  const lines = [
    `Command: ${command}`,
    `Target: ${target}`,
    `Dry-run: ${dryRun ? "yes" : "no"}`,
    `Reason: ${reason}`,
    `Expires at: ${expiresAtIso}`,
  ];

  if (payload && Object.keys(payload).length > 0) {
    lines.push(`Payload keys: ${Object.keys(payload).join(", ")}`);
  }

  return lines;
}

function sanitizePayloadObject(value) {
  if (!isPlainObject(value)) return {};
  return sanitizeForOutput(value);
}

async function createConfirmationRow(entry) {
  if (!supabaseDbClient || !CONFIRM_TABLE) return null;

  const { data, error } = await supabaseDbClient
    .from(CONFIRM_TABLE)
    .insert({
      requested_by: entry.requestedBy,
      status: "pending",
      scope: entry.command,
      target: entry.target,
      reason: entry.reason,
      metadata: {
        commandId: entry.commandId,
        dryRun: entry.dryRun,
        riskLevel: entry.riskLevel,
        payload: entry.payload,
      },
      expires_at: entry.expiresAtIso,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[control-plane] confirmation insert failed", sanitizeForOutput({ error: error.message }));
    return null;
  }

  return data?.id || null;
}

async function commandsPrepareHandler(req, res) {
  const auth = getAuth(res);
  const body = isPlainObject(req.body) ? req.body : {};

  const command = asString(body.commandId || body.command).toLowerCase();
  const args = isPlainObject(body.args) ? body.args : {};
  const target = asString(body.target || args.target || args.serviceId || args.table, "-");
  const reason = asString(body.reason);
  const payload = sanitizePayloadObject(body.payload || args);
  const requestedDryRun = parseBoolean(body.dryRun, true);
  const dryRun = GLOBAL_DRY_RUN || requestedDryRun;

  if (!command || !COMMAND_ALLOWLIST.has(command)) {
    return sendJson(res, 400, {
      ok: false,
      error: "Comando non in allowlist.",
      requestId: res.locals.requestId || null,
    });
  }

  if (reason.length < 8) {
    return sendJson(res, 400, {
      ok: false,
      error: "Reason minima: 8 caratteri.",
      requestId: res.locals.requestId || null,
    });
  }

  const commandData = COMMAND_CATALOG[command];
  if (!roleAtLeast(auth.roleLevel, commandData.minRole)) {
    return sendJson(res, 403, {
      ok: false,
      error: `Permessi insufficienti per ${command}. Richiesto ${commandData.minRole}.`,
      requestId: res.locals.requestId || null,
    });
  }

  const commandId = `cmd_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const confirmationToken = crypto.randomBytes(24).toString("base64url");
  const tokenHash = hashToken(confirmationToken);
  const expiresAtMs = Date.now() + CONFIRM_TOKEN_TTL_MS;
  const expiresAtIso = new Date(expiresAtMs).toISOString();

  const pendingEntry = {
    commandId,
    tokenHash,
    command,
    target,
    reason,
    payload,
    requestedBy: auth.userId,
    riskLevel: commandData.riskLevel,
    requiresConfirmText: commandData.requiresConfirmText,
    dryRun,
    expiresAtMs,
    expiresAtIso,
    confirmationRowId: null,
  };

  pendingEntry.confirmationRowId = await createConfirmationRow(pendingEntry);
  if (supabaseDbClient && CONFIRM_TABLE && !pendingEntry.confirmationRowId) {
    return sendJson(res, 503, {
      ok: false,
      error: "Impossibile creare la conferma su database.",
      requestId: res.locals.requestId || null,
    });
  }

  pendingByCommandId.set(commandId, pendingEntry);
  pendingByTokenHash.set(tokenHash, commandId);
  savePendingToDisk();

  await insertAudit({
    actorUserId: auth.userId,
    action: "command.prepare",
    resourceType: "command",
    resourceId: commandId,
    requestId: res.locals.requestId,
    metadata: {
      command,
      target,
      reason,
      dryRun,
      riskLevel: pendingEntry.riskLevel,
      expiresAt: expiresAtIso,
    },
  });

  return sendJson(res, 200, {
    ok: true,
    commandId,
    command,
    summary: `${command} su ${target}`,
    riskLevel: pendingEntry.riskLevel,
    requiresConfirmation: true,
    requiresConfirmText: pendingEntry.requiresConfirmText,
    confirmationToken,
    confirmationTokenTtlMs: CONFIRM_TOKEN_TTL_MS,
    confirmationTokenExpiresAt: expiresAtIso,
    expiresAt: expiresAtIso,
    dryRun,
    preview: buildCommandPreview({
      command,
      target,
      reason,
      dryRun,
      payload,
      expiresAtIso,
    }),
  });
}

function resolvePending({ commandId, confirmationToken }) {
  const normalizedCommandId = asString(commandId);
  const normalizedToken = asString(confirmationToken);

  let entry = null;

  if (normalizedToken) {
    const tokenHash = hashToken(normalizedToken);
    const mappedCommandId = pendingByTokenHash.get(tokenHash);
    if (mappedCommandId) {
      entry = pendingByCommandId.get(mappedCommandId) || null;
      if (entry && entry.tokenHash !== tokenHash) {
        return { entry: null, error: "Token conferma non valido." };
      }
    }
  }

  if (!entry && normalizedCommandId) {
    entry = pendingByCommandId.get(normalizedCommandId) || null;
  }

  if (!entry) {
    return { entry: null, error: "Conferma non trovata o gia consumata." };
  }

  if (normalizedCommandId && normalizedCommandId !== entry.commandId) {
    return { entry: null, error: "commandId non coerente con la conferma." };
  }

  if (entry.expiresAtMs <= Date.now()) {
    return {
      entry: null,
      error: "Conferma scaduta.",
      expiredEntry: entry,
    };
  }

  return { entry, error: null };
}

async function markConfirmationApproved(entry, approverUserId) {
  if (!supabaseDbClient || !CONFIRM_TABLE || !entry?.confirmationRowId) return true;

  const { data, error } = await supabaseDbClient
    .from(CONFIRM_TABLE)
    .update({
      status: "approved",
      approved_by: approverUserId,
      approved_at: new Date().toISOString(),
      approval_note: "approved via commands/execute",
    })
    .eq("id", entry.confirmationRowId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn(
      "[control-plane] confirmation approve failed",
      sanitizeForOutput({ id: entry.confirmationRowId, error: error.message })
    );
    return false;
  }

  return Boolean(data?.id);
}

async function markConfirmationRejected(entry, rejectorUserId, note) {
  if (!supabaseDbClient || !CONFIRM_TABLE || !entry?.confirmationRowId) return true;

  const { error } = await supabaseDbClient
    .from(CONFIRM_TABLE)
    .update({
      status: "rejected",
      rejected_by: rejectorUserId,
      rejected_at: new Date().toISOString(),
      approval_note: asString(note, "rejected"),
    })
    .eq("id", entry.confirmationRowId)
    .eq("status", "pending");

  if (error) {
    console.warn(
      "[control-plane] confirmation reject failed",
      sanitizeForOutput({ id: entry.confirmationRowId, error: error.message })
    );
    return false;
  }

  return true;
}

async function createExecutionLog({ entry, auth, effectiveDryRun }) {
  if (!supabaseDbClient || !EXECUTION_TABLE) {
    throw createHttpError(503, "Execution log non disponibile: Supabase non configurato.");
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseDbClient
    .from(EXECUTION_TABLE)
    .insert({
      confirmation_id: entry.confirmationRowId,
      requested_by: entry.requestedBy,
      executed_by: auth.userId,
      status: "running",
      operation: entry.command,
      target: entry.target,
      input_payload: sanitizeForOutput({
        commandId: entry.commandId,
        reason: entry.reason,
        dryRun: effectiveDryRun,
        payload: entry.payload,
      }),
      requested_at: nowIso,
      started_at: nowIso,
    })
    .select("*")
    .single();

  if (error) {
    throw createHttpError(503, `Errore creazione execution log: ${error.message}`);
  }

  return data;
}

async function updateExecutionLog(executionId, patch) {
  if (!supabaseDbClient || !EXECUTION_TABLE || !executionId) return null;

  const { data, error } = await supabaseDbClient
    .from(EXECUTION_TABLE)
    .update(sanitizeForOutput(patch))
    .eq("id", executionId)
    .select("*")
    .single();

  if (error) {
    console.warn("[control-plane] execution update failed", sanitizeForOutput({ executionId, error: error.message }));
    return null;
  }

  return data;
}

function findRenderServiceInRegistry(value) {
  const normalizedValue = asString(value);
  if (!normalizedValue || RENDER_SERVICE_REGISTRY.length === 0) return null;

  return (
    RENDER_SERVICE_REGISTRY.find(
      (entry) =>
        entry.id.toLowerCase() === normalizedValue.toLowerCase() ||
        entry.name.toLowerCase() === normalizedValue.toLowerCase()
    ) || null
  );
}

function resolveRenderServiceId(target, payload) {
  const explicit = asString(payload?.serviceId);
  const normalizedTarget = asString(target);
  const targetValue = normalizedTarget.startsWith("service:")
    ? normalizedTarget.slice("service:".length).trim()
    : normalizedTarget;
  const candidate = explicit || targetValue;
  if (!candidate) return "";

  const match = findRenderServiceInRegistry(candidate);
  return match ? match.id : "";
}

async function renderApiRequest(path, { method = "GET", body } = {}) {
  if (!RENDER_API_KEY) {
    throw createHttpError(503, "RENDER_API_KEY non configurata.");
  }

  const response = await fetch(`${RENDER_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${RENDER_API_KEY}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  if (!response.ok) {
    const message =
      asString(parsed?.message) ||
      asString(parsed?.error) ||
      `Render API HTTP ${response.status} ${response.statusText}`;
    throw createHttpError(response.status, message);
  }

  return parsed;
}

async function executeAllowlistedCommand(entry, auth, effectiveDryRun) {
  if (effectiveDryRun) {
    return {
      status: "succeeded",
      message: "Dry-run completato: nessuna mutazione applicata.",
      payload: {
        dryRun: true,
        command: entry.command,
        target: entry.target,
      },
    };
  }

  switch (entry.command) {
    case "render.services.health": {
      const list =
        RENDER_SERVICE_REGISTRY.length > 0
          ? RENDER_SERVICE_REGISTRY
          : [
              {
                id: "unconfigured",
                name: "unconfigured",
                environment: "prod",
                region: "",
              },
            ];
      const services = await Promise.all(list.map((item) => fetchRenderServiceHealth(item)));
      return {
        status: "succeeded",
        message: "Render services health letto.",
        payload: {
          services,
          source: RENDER_API_KEY ? "render_api" : "fallback_unconfigured",
        },
      };
    }

    case "render.deployments.list": {
      const serviceId = resolveRenderServiceId(entry.target, entry.payload);
      if (!serviceId) {
        return {
          status: "failed",
          message: "Service Render non allowlistato o non risolto da target/payload.",
          payload: {},
        };
      }
      const limit = parseInteger(entry.payload.limit, 20, 1, 100);
      const deployments = await renderApiRequest(
        `/services/${encodeURIComponent(serviceId)}/deploys?limit=${encodeURIComponent(limit)}`
      );
      return {
        status: "succeeded",
        message: `Deployments letti per ${serviceId}.`,
        payload: {
          serviceId,
          deployments: Array.isArray(deployments) ? deployments : deployments?.deploys || deployments,
        },
      };
    }

    case "render.deployments.trigger": {
      const serviceId = resolveRenderServiceId(entry.target, entry.payload);
      if (!serviceId || typeof serviceId !== "string" || serviceId.trim() === "") {
        return {
          status: "failed",
          message: "Service Render non allowlistato o non risolto da target/payload.",
          payload: {},
        };
      }

      const deployment = await renderApiRequest(`/services/${encodeURIComponent(serviceId)}/deploys`, {
        method: "POST",
        body: {
          clearCache: parseBoolean(entry.payload.clearCache, true),
        },
      });

      return {
        status: "succeeded",
        message: `Deploy trigger inviato per ${serviceId}.`,
        payload: {
          serviceId,
          deployment,
        },
      };
    }

    case "supabase.db.read": {
      assertDbClientAvailable();
      const table = normalizeTableName(entry.payload.table || entry.target);
      if (!table) {
        return {
          status: "failed",
          message: "table/target obbligatorio per supabase.db.read.",
          payload: {},
        };
      }
      if (!isTableAllowed(table, READ_TABLE_ALLOWLIST)) {
        return {
          status: "failed",
          message: `Table ${table} non in allowlist di lettura.`,
          payload: {},
        };
      }

      const selectClause = parseSelectClause(entry.payload.select || entry.payload.columns);
      const limit = parseInteger(entry.payload.limit, 50, 1, 500);
      let query = supabaseDbClient.from(table).select(selectClause, { count: "exact" });

      if (Array.isArray(entry.payload.filters)) {
        query = applyArrayFilters(query, entry.payload.filters);
      } else {
        query = applyReadFilters(query, isPlainObject(entry.payload.filters) ? entry.payload.filters : {});
      }

      query = applyReadOrdering(query, entry.payload.order);
      query = query.limit(limit);

      const { data, error, count } = await query;
      if (error) {
        return {
          status: "failed",
          message: `Errore DB read: ${error.message}`,
          payload: {},
        };
      }

      return {
        status: "succeeded",
        message: `Read completata su ${table}.`,
        payload: {
          table,
          count: count ?? (Array.isArray(data) ? data.length : 0),
          rows: data || [],
        },
      };
    }

    case "supabase.events.cleanup": {
      assertDbClientAvailable();
      const table = normalizeTableName(entry.payload.table || entry.target || "events");
      const days = parseInteger(entry.payload.days, 30, 1, 3650);
      const timestampColumn = asString(entry.payload.timestampColumn, "created_at");

      if (!table) {
        return {
          status: "failed",
          message: "table/target obbligatorio per supabase.events.cleanup.",
          payload: {},
        };
      }
      if (!VALID_COLUMN_NAME.test(timestampColumn)) {
        return {
          status: "failed",
          message: "timestampColumn non valido.",
          payload: {},
        };
      }
      if (!isTableAllowed(table, MUTATE_TABLE_ALLOWLIST)) {
        return {
          status: "failed",
          message: `Table ${table} non in allowlist di mutazione.`,
          payload: {},
        };
      }

      const thresholdIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseDbClient
        .from(table)
        .delete()
        .lt(timestampColumn, thresholdIso)
        .select("id");

      if (error) {
        return {
          status: "failed",
          message: `Errore cleanup: ${error.message}`,
          payload: {},
        };
      }

      return {
        status: "succeeded",
        message: `Cleanup ${table} completato.`,
        payload: {
          table,
          days,
          deletedRows: Array.isArray(data) ? data.length : 0,
          thresholdIso,
        },
      };
    }

    case "supabase.db.mutate": {
      assertDbClientAvailable();
      const table = normalizeTableName(entry.payload.table || entry.target);
      const action = asString(entry.payload.action || entry.payload.operation).toLowerCase();
      const values = entry.payload.values;
      const match = isPlainObject(entry.payload.match)
        ? entry.payload.match
        : isPlainObject(entry.payload.filters?.eq)
          ? entry.payload.filters.eq
          : {};
      const returning = parseBoolean(entry.payload.returning, true);

      if (!table) {
        return {
          status: "failed",
          message: "table/target obbligatorio per supabase.db.mutate.",
          payload: {},
        };
      }
      if (!isTableAllowed(table, MUTATE_TABLE_ALLOWLIST)) {
        return {
          status: "failed",
          message: `Table ${table} non in allowlist di mutazione.`,
          payload: {},
        };
      }
      if (action === "delete" && auth.roleLevel !== "dev_admin") {
        return {
          status: "failed",
          message: "Delete consentito solo a dev_admin.",
          payload: {},
        };
      }

      const result = await executeDbMutation({
        table,
        action,
        values,
        match,
        returning,
      });

      return {
        status: "succeeded",
        message: `Mutazione ${action} su ${table} completata.`,
        payload: {
          table,
          action,
          affectedRows: result.rows.length,
          rows: result.rows,
        },
      };
    }

    default:
      return {
        status: "failed",
        message: "Comando non gestito.",
        payload: {},
      };
  }
}

function mapExecutionToClientStatus(status) {
  if (status === "failed" || status === "cancelled") return "failed";
  if (status === "queued" || status === "running") return "accepted";
  return "completed";
}

async function commandsExecuteHandler(req, res) {
  const auth = getAuth(res);
  const body = isPlainObject(req.body) ? req.body : {};

  const commandId = asString(body.commandId);
  const confirmationToken = asString(body.confirmationToken);
  const confirmText = asString(body.confirmText);

  if (!commandId || !confirmationToken) {
    return sendJson(res, 400, {
      ok: false,
      error: "commandId e confirmationToken obbligatori.",
      requestId: res.locals.requestId || null,
    });
  }

  const resolved = resolvePending({ commandId, confirmationToken });
  if (!resolved.entry) {
    if (resolved.expiredEntry) {
      removePending(resolved.expiredEntry.commandId);
      await markPendingExpired(resolved.expiredEntry);
      await markConfirmationRejected(resolved.expiredEntry, auth.userId, "expired");
      return sendJson(res, 410, {
        ok: false,
        error: resolved.error || "Conferma scaduta.",
        requestId: res.locals.requestId || null,
      });
    }

    return sendJson(res, 404, {
      ok: false,
      error: resolved.error || "Conferma non trovata.",
      requestId: res.locals.requestId || null,
    });
  }

  const entry = resolved.entry;
  if (entry.requestedBy !== auth.userId && auth.roleLevel !== "dev_admin") {
    return sendJson(res, 403, {
      ok: false,
      error: "Solo richiedente o dev_admin puo eseguire.",
      requestId: res.locals.requestId || null,
    });
  }

  if (confirmText !== entry.requiresConfirmText) {
    const consumedForReject = removePending(entry.commandId);
    if (!consumedForReject) {
      return sendJson(res, 409, {
        ok: false,
        error: "Conferma gia consumata da un'altra richiesta.",
        requestId: res.locals.requestId || null,
      });
    }

    await markConfirmationRejected(consumedForReject, auth.userId, "invalid_confirm_text");
    return sendJson(res, 400, {
      ok: false,
      error: `confirmText non valido. Atteso: ${entry.requiresConfirmText}`,
      requestId: res.locals.requestId || null,
    });
  }

  const consumedEntry = removePending(entry.commandId);
  if (!consumedEntry) {
    return sendJson(res, 409, {
      ok: false,
      error: "Conferma gia consumata da un'altra richiesta.",
      requestId: res.locals.requestId || null,
    });
  }

  const effectiveDryRun = GLOBAL_DRY_RUN || consumedEntry.dryRun || parseBoolean(body.dryRun, false);
  let execution;
  try {
    execution = await createExecutionLog({ entry: consumedEntry, auth, effectiveDryRun });
  } catch (error) {
    restorePending(consumedEntry);
    return sendJson(res, 503, {
      ok: false,
      error: error?.message || "Execution log non disponibile.",
      requestId: res.locals.requestId || null,
    });
  }

  const approved = await markConfirmationApproved(consumedEntry, auth.userId);
  if (!approved) {
    restorePending(consumedEntry);
    await updateExecutionLog(execution.id, {
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: "Conferma non approvata: ripetere la procedura.",
    });
    return sendJson(res, 503, {
      ok: false,
      error: "Conferma non approvata: ripetere la procedura.",
      requestId: res.locals.requestId || null,
    });
  }

  let commandResult;
  try {
    commandResult = await executeAllowlistedCommand(consumedEntry, auth, effectiveDryRun);
  } catch (error) {
    commandResult = {
      status: "failed",
      message: error?.message || "Errore durante l'esecuzione del comando.",
      payload: {},
    };
  }

  const finalStatus = commandResult.status === "succeeded" ? "succeeded" : "failed";
  await updateExecutionLog(execution.id, {
    status: finalStatus,
    finished_at: new Date().toISOString(),
    result_payload: sanitizeForOutput(commandResult.payload),
    error_message: finalStatus === "failed" ? commandResult.message : null,
  });

  await insertAudit({
    actorUserId: auth.userId,
    action: "command.execute",
    resourceType: "command",
    resourceId: consumedEntry.commandId,
    requestId: res.locals.requestId,
    metadata: {
      command: consumedEntry.command,
      target: consumedEntry.target,
      dryRun: effectiveDryRun,
      executionId: execution.id,
      result: finalStatus === "succeeded" ? "ok" : "error",
      message: commandResult.message,
    },
  });

  return sendJson(res, 200, {
    ok: true,
    commandId: consumedEntry.commandId,
    executionId: execution.id,
    status: mapExecutionToClientStatus(finalStatus),
    message: commandResult.message,
    dryRun: effectiveDryRun,
    result: commandResult.payload,
  });
}

async function commandExecutionByIdHandler(req, res) {
  const auth = getAuth(res);
  const id = asString(req.params.id);

  if (!id) {
    return sendJson(res, 400, {
      ok: false,
      error: "execution id mancante.",
      requestId: res.locals.requestId || null,
    });
  }

  if (!supabaseDbClient || !EXECUTION_TABLE) {
    return sendJson(res, 503, {
      ok: false,
      error: "Execution log non disponibile.",
      requestId: res.locals.requestId || null,
    });
  }

  const { data, error } = await supabaseDbClient
    .from(EXECUTION_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return sendJson(res, 500, {
      ok: false,
      error: `Errore lettura execution: ${error.message}`,
      requestId: res.locals.requestId || null,
    });
  }

  if (!data) {
    return sendJson(res, 404, {
      ok: false,
      error: "Execution non trovata.",
      requestId: res.locals.requestId || null,
    });
  }

  if (
    auth.roleLevel !== "dev_admin" &&
    data.requested_by !== auth.userId &&
    data.executed_by !== auth.userId
  ) {
    return sendJson(res, 403, {
      ok: false,
      error: "Permesso negato.",
      requestId: res.locals.requestId || null,
    });
  }

  return sendJson(res, 200, {
    ok: true,
    execution: {
      id: data.id,
      status: data.status,
      operation: data.operation,
      target: data.target,
      requestedBy: data.requested_by,
      executedBy: data.executed_by,
      requestedAt: data.requested_at,
      startedAt: data.started_at,
      finishedAt: data.finished_at,
      error: data.error_message,
      resultPayload: data.result_payload,
      inputPayload: data.input_payload,
    },
  });
}

function inferRenderHealthStatus(service) {
  const explicit =
    asString(service?.status) ||
    asString(service?.service?.status) ||
    asString(service?.serviceDetails?.status);

  if (explicit) return explicit.toLowerCase();
  if (service?.suspended === true) return "suspended";
  return "healthy";
}

async function fetchRenderServiceHealth(serviceRef) {
  if (!RENDER_API_KEY) {
    return {
      id: serviceRef.id,
      name: serviceRef.name,
      environment: serviceRef.environment || "prod",
      status: "unconfigured",
      region: serviceRef.region || "",
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const service = await renderApiRequest(`/services/${encodeURIComponent(serviceRef.id)}`);
    return {
      id: asString(service?.id, serviceRef.id),
      name: asString(service?.name, serviceRef.name || serviceRef.id),
      environment:
        asString(service?.serviceDetails?.env) ||
        asString(service?.env) ||
        serviceRef.environment ||
        "prod",
      status: inferRenderHealthStatus(service),
      region: asString(service?.region || service?.serviceDetails?.region || serviceRef.region),
      instances:
        parseMaybeNumber(service?.serviceDetails?.numInstances) ||
        parseMaybeNumber(service?.numInstances) ||
        undefined,
      latencyMs: parseMaybeNumber(service?.latencyMs),
      updatedAt: asString(service?.updatedAt || service?.createdAt || new Date().toISOString()),
    };
  } catch (error) {
    return {
      id: serviceRef.id,
      name: serviceRef.name,
      environment: serviceRef.environment || "prod",
      status: "error",
      region: serviceRef.region || "",
      updatedAt: new Date().toISOString(),
      error: asString(error?.message, "Render API error"),
    };
  }
}

async function renderServicesHealthHandler(req, res) {
  const auth = getAuth(res);
  const list =
    RENDER_SERVICE_REGISTRY.length > 0
      ? RENDER_SERVICE_REGISTRY
      : [
          {
            id: "unconfigured",
            name: "unconfigured",
            environment: "prod",
            region: "",
          },
        ];

  const services = await Promise.all(list.map((item) => fetchRenderServiceHealth(item)));

  await insertAudit({
    actorUserId: auth.userId,
    action: "render.services.health.read",
    resourceType: "render_service",
    resourceId: null,
    requestId: res.locals.requestId,
    metadata: {
      count: services.length,
    },
  });

  return sendJson(res, 200, {
    ok: true,
    services,
    source: RENDER_API_KEY ? "render_api" : "fallback_unconfigured",
    updatedAt: new Date().toISOString(),
  });
}

function resolveDeploymentServiceId(req) {
  const bodyServiceId = asString(req.body?.serviceId);
  const queryServiceId = asString(req.query?.serviceId);
  const requestedServiceId = bodyServiceId || queryServiceId;

  if (requestedServiceId) {
    const match = findRenderServiceInRegistry(requestedServiceId);
    return match ? match.id : "";
  }
  if (RENDER_SERVICE_REGISTRY.length > 0) return RENDER_SERVICE_REGISTRY[0].id;
  return "";
}

async function renderDeploymentsGetHandler(req, res) {
  const auth = getAuth(res);
  const serviceId = resolveDeploymentServiceId(req);

  if (!serviceId) {
    return sendJson(res, 400, {
      ok: false,
      error: "serviceId mancante/non allowlistato oppure nessun servizio configurato.",
      requestId: res.locals.requestId || null,
    });
  }

  if (!RENDER_API_KEY) {
    return sendJson(res, 503, {
      ok: false,
      error: "RENDER_API_KEY non configurata.",
      requestId: res.locals.requestId || null,
    });
  }

  const limit = parseInteger(req.query?.limit, 20, 1, 100);
  const deployments = await renderApiRequest(
    `/services/${encodeURIComponent(serviceId)}/deploys?limit=${encodeURIComponent(limit)}`
  );

  await insertAudit({
    actorUserId: auth.userId,
    action: "render.deployments.read",
    resourceType: "render_deployment",
    resourceId: serviceId,
    requestId: res.locals.requestId,
    metadata: {
      limit,
      result: "ok",
    },
  });

  return sendJson(res, 200, {
    ok: true,
    serviceId,
    deployments: Array.isArray(deployments) ? deployments : deployments?.deploys || deployments,
    updatedAt: new Date().toISOString(),
  });
}

async function renderDeploymentsPostHandler(req, res) {
  const auth = getAuth(res);
  const serviceId = resolveDeploymentServiceId(req);

  if (!serviceId) {
    return sendJson(res, 400, {
      ok: false,
      error: "serviceId obbligatorio e deve essere in allowlist.",
      requestId: res.locals.requestId || null,
    });
  }

  const dryRun = GLOBAL_DRY_RUN || parseBoolean(req.body?.dryRun, false);
  const clearCache = parseBoolean(req.body?.clearCache, false);

  if (dryRun) {
    await insertAudit({
      actorUserId: auth.userId,
      action: "render.deployments.trigger",
      resourceType: "render_deployment",
      resourceId: serviceId,
      requestId: res.locals.requestId,
      metadata: {
        dryRun: true,
        clearCache,
        result: "ok",
      },
    });

    return sendJson(res, 200, {
      ok: true,
      dryRun: true,
      serviceId,
      clearCache,
      message: "Dry-run attivo: deploy non triggerato.",
    });
  }

  const deployment = await renderApiRequest(`/services/${encodeURIComponent(serviceId)}/deploys`, {
    method: "POST",
    body: {
      clearCache,
    },
  });

  await insertAudit({
    actorUserId: auth.userId,
    action: "render.deployments.trigger",
    resourceType: "render_deployment",
    resourceId: serviceId,
    requestId: res.locals.requestId,
    metadata: {
      dryRun: false,
      clearCache,
      result: "ok",
    },
  });

  return sendJson(res, 200, {
    ok: true,
    dryRun: false,
    serviceId,
    deployment,
  });
}

function assertDbClientAvailable() {
  if (!supabaseDbClient) {
    throw createHttpError(503, "Supabase non configurato.");
  }
}

function parseSelectClause(selectValue) {
  const raw = asString(selectValue, "*");
  if (raw === "*") return "*";
  if (raw.length > 300) return "*";
  if (!/^[a-zA-Z0-9_.*,()\s:]+$/.test(raw)) return "*";
  return raw;
}

function applyObjectFilter(query, obj, methodName) {
  if (!isPlainObject(obj)) return query;

  for (const [column, value] of Object.entries(obj)) {
    if (!VALID_COLUMN_NAME.test(column)) continue;
    query = query[methodName](column, value);
  }

  return query;
}

function applyReadFilters(query, filters) {
  if (!isPlainObject(filters)) return query;

  query = applyObjectFilter(query, filters.eq, "eq");
  query = applyObjectFilter(query, filters.neq, "neq");
  query = applyObjectFilter(query, filters.gt, "gt");
  query = applyObjectFilter(query, filters.gte, "gte");
  query = applyObjectFilter(query, filters.lt, "lt");
  query = applyObjectFilter(query, filters.lte, "lte");
  query = applyObjectFilter(query, filters.like, "like");
  query = applyObjectFilter(query, filters.ilike, "ilike");

  if (isPlainObject(filters.in)) {
    for (const [column, values] of Object.entries(filters.in)) {
      if (!VALID_COLUMN_NAME.test(column)) continue;
      if (!Array.isArray(values)) continue;
      query = query.in(column, values);
    }
  }

  if (Array.isArray(filters.isNull)) {
    for (const column of filters.isNull) {
      if (!VALID_COLUMN_NAME.test(column)) continue;
      query = query.is(column, null);
    }
  }

  if (Array.isArray(filters.notNull)) {
    for (const column of filters.notNull) {
      if (!VALID_COLUMN_NAME.test(column)) continue;
      query = query.not(column, "is", null);
    }
  }

  return query;
}

function applyArrayFilters(query, filters) {
  if (!Array.isArray(filters)) return query;
  let current = query;

  for (const rawFilter of filters) {
    if (!isPlainObject(rawFilter)) continue;
    const column = asString(rawFilter.column);
    const op = asString(rawFilter.op || rawFilter.operator, "eq").toLowerCase();
    if (!VALID_COLUMN_NAME.test(column)) continue;
    const value = rawFilter.value;

    if (op === "eq") current = current.eq(column, value);
    else if (op === "neq") current = current.neq(column, value);
    else if (op === "gt") current = current.gt(column, value);
    else if (op === "gte") current = current.gte(column, value);
    else if (op === "lt") current = current.lt(column, value);
    else if (op === "lte") current = current.lte(column, value);
    else if (op === "like") current = current.like(column, asString(value));
    else if (op === "ilike") current = current.ilike(column, asString(value));
    else if (op === "in" && Array.isArray(value)) current = current.in(column, value);
    else if (op === "is") current = current.is(column, value);
  }

  return current;
}

function applyReadOrdering(query, order) {
  const list = Array.isArray(order) ? order : order ? [order] : [];

  for (const item of list) {
    if (!isPlainObject(item)) continue;
    const column = asString(item.column);
    if (!VALID_COLUMN_NAME.test(column)) continue;

    query = query.order(column, {
      ascending: parseBoolean(item.ascending, true),
      nullsFirst: parseBoolean(item.nullsFirst, false),
    });
  }

  return query;
}

async function supabaseDbReadHandler(req, res) {
  const auth = getAuth(res);
  assertDbClientAvailable();

  const body = isPlainObject(req.body) ? req.body : {};
  const table = normalizeTableName(body.table);

  if (!table) {
    return sendJson(res, 400, {
      ok: false,
      error: "Table non valida.",
      requestId: res.locals.requestId || null,
    });
  }

  if (!isTableAllowed(table, READ_TABLE_ALLOWLIST)) {
    return sendJson(res, 403, {
      ok: false,
      error: "Table non in allowlist di lettura.",
      requestId: res.locals.requestId || null,
    });
  }

  const selectClause = parseSelectClause(body.select);
  const limit = parseInteger(body.limit, 50, 1, 500);

  let query = supabaseDbClient.from(table).select(selectClause, { count: "exact" });
  query = applyReadFilters(query, isPlainObject(body.filters) ? body.filters : {});
  query = applyReadOrdering(query, body.order);
  query = query.limit(limit);

  const { data, error, count } = await query;
  if (error) {
    return sendJson(res, 500, {
      ok: false,
      error: `Errore DB read: ${error.message}`,
      requestId: res.locals.requestId || null,
    });
  }

  await insertAudit({
    actorUserId: auth.userId,
    action: "db.read",
    resourceType: "table",
    resourceId: table,
    requestId: res.locals.requestId,
    metadata: {
      result: "ok",
      count,
      limit,
    },
  });

  return sendJson(res, 200, {
    ok: true,
    table,
    count: count ?? (Array.isArray(data) ? data.length : 0),
    rows: data || [],
  });
}

function applyMatchFilter(query, match) {
  if (!isPlainObject(match)) return query;

  for (const [column, value] of Object.entries(match)) {
    if (!VALID_COLUMN_NAME.test(column)) continue;
    query = query.eq(column, value);
  }

  return query;
}

async function executeDbMutation({ table, action, values, match, returning }) {
  let query = supabaseDbClient.from(table);

  switch (action) {
    case "insert":
      if (!(isPlainObject(values) || Array.isArray(values))) {
        throw createHttpError(400, "values obbligatorio per insert.");
      }
      query = query.insert(values);
      break;

    case "upsert":
      if (!(isPlainObject(values) || Array.isArray(values))) {
        throw createHttpError(400, "values obbligatorio per upsert.");
      }
      query = query.upsert(values);
      break;

    case "update":
      if (!isPlainObject(values)) {
        throw createHttpError(400, "values oggetto obbligatorio per update.");
      }
      if (!isPlainObject(match) || Object.keys(match).length === 0) {
        throw createHttpError(400, "match obbligatorio per update.");
      }
      query = query.update(values);
      query = applyMatchFilter(query, match);
      break;

    case "delete":
      if (!isPlainObject(match) || Object.keys(match).length === 0) {
        throw createHttpError(400, "match obbligatorio per delete.");
      }
      query = query.delete();
      query = applyMatchFilter(query, match);
      break;

    default:
      throw createHttpError(400, "action non supportata.");
  }

  if (returning) {
    query = query.select("*");
  }

  const { data, error } = await query;
  if (error) {
    throw createHttpError(500, `Errore DB mutate: ${error.message}`);
  }

  return {
    rows: Array.isArray(data) ? data : data ? [data] : [],
  };
}

async function supabaseDbMutateHandler(req, res) {
  const auth = getAuth(res);
  assertDbClientAvailable();

  const body = isPlainObject(req.body) ? req.body : {};
  const table = normalizeTableName(body.table);
  const action = asString(body.action).toLowerCase();
  const values = body.values;
  const match = isPlainObject(body.match) ? body.match : {};
  const returning = parseBoolean(body.returning, true);
  const dryRun = GLOBAL_DRY_RUN || parseBoolean(body.dryRun, false);

  if (!table) {
    return sendJson(res, 400, {
      ok: false,
      error: "Table non valida.",
      requestId: res.locals.requestId || null,
    });
  }

  if (!isTableAllowed(table, MUTATE_TABLE_ALLOWLIST)) {
    return sendJson(res, 403, {
      ok: false,
      error: "Table non in allowlist di mutazione.",
      requestId: res.locals.requestId || null,
    });
  }

  if (action === "delete" && auth.roleLevel !== "dev_admin") {
    return sendJson(res, 403, {
      ok: false,
      error: "Delete consentito solo a dev_admin.",
      requestId: res.locals.requestId || null,
    });
  }

  if (dryRun) {
    await insertAudit({
      actorUserId: auth.userId,
      action: "db.mutate",
      resourceType: "table",
      resourceId: table,
      requestId: res.locals.requestId,
      metadata: {
        result: "ok",
        action,
        dryRun: true,
      },
    });

    return sendJson(res, 200, {
      ok: true,
      dryRun: true,
      message: "Dry-run attivo: nessuna mutazione applicata.",
      table,
      action,
    });
  }

  const result = await executeDbMutation({
    table,
    action,
    values,
    match,
    returning,
  });

  await insertAudit({
    actorUserId: auth.userId,
    action: "db.mutate",
    resourceType: "table",
    resourceId: table,
    requestId: res.locals.requestId,
    metadata: {
      result: "ok",
      action,
      dryRun: false,
      affectedRows: result.rows.length,
    },
  });

  return sendJson(res, 200, {
    ok: true,
    dryRun: false,
    table,
    action,
    affectedRows: result.rows.length,
    rows: result.rows,
  });
}

function mapAuditResult(value) {
  const normalized = asString(value, "ok").toLowerCase();
  if (normalized === "warn" || normalized === "error") return normalized;
  return "ok";
}

function toAuditEntry(row) {
  const metadata = isPlainObject(row.metadata) ? row.metadata : {};
  return {
    id: row.id,
    at: row.created_at,
    actor: row.actor_user_id || asString(metadata.actor, "system"),
    action: row.action,
    result: mapAuditResult(metadata.result),
    reason: asString(metadata.reason || metadata.message),
    dryRun: parseBoolean(metadata.dryRun, false),
  };
}

async function auditRecentHandler(req, res) {
  assertDbClientAvailable();

  const limit = parseInteger(req.query?.limit, 25, 1, 200);
  const { data, error } = await supabaseDbClient
    .from(AUDIT_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return sendJson(res, 500, {
      ok: false,
      error: `Errore audit read: ${error.message}`,
      requestId: res.locals.requestId || null,
    });
  }

  const entries = (data || []).map((row) => toAuditEntry(row));

  return sendJson(res, 200, {
    ok: true,
    audit: entries,
    entries,
    count: entries.length,
    updatedAt: new Date().toISOString(),
  });
}

async function countRows(table, configure) {
  if (!supabaseDbClient) return 0;

  let query = supabaseDbClient.from(table).select("*", { head: true, count: "exact" });
  if (typeof configure === "function") {
    query = configure(query);
  }

  const { count, error } = await query;
  if (error) return 0;
  return count || 0;
}

async function dashboardMetricsHandler(req, res) {
  const auth = getAuth(res);
  const from24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [pendingConfirmations, runningExecutions, failedExecutions24h, auditEvents24h] = await Promise.all([
    countRows(CONFIRM_TABLE, (query) => query.eq("status", "pending")),
    countRows(EXECUTION_TABLE, (query) => query.in("status", ["queued", "running"])),
    countRows(EXECUTION_TABLE, (query) => query.eq("status", "failed").gte("created_at", from24h)),
    countRows(AUDIT_TABLE, (query) => query.gte("created_at", from24h)),
  ]);

  const healthyRenderServices = (
    await Promise.all((RENDER_SERVICE_REGISTRY.length ? RENDER_SERVICE_REGISTRY : []).map(fetchRenderServiceHealth))
  ).filter((service) => asString(service.status).toLowerCase() === "healthy").length;

  const renderTotal = RENDER_SERVICE_REGISTRY.length;

  const metrics = [
    {
      id: "metric-role-level",
      label: "Role Level",
      value: auth.roleLevel,
      detail: auth.roles.join(", "),
      trend: "steady",
    },
    {
      id: "metric-pending-confirmations",
      label: "Pending Confirmations",
      value: String(pendingConfirmations),
      detail: `TTL ${Math.floor(CONFIRM_TOKEN_TTL_MS / 1000)}s`,
      trend: pendingConfirmations > 0 ? "up" : "steady",
    },
    {
      id: "metric-running-executions",
      label: "Running Executions",
      value: String(runningExecutions),
      detail: "queued + running",
      trend: runningExecutions > 0 ? "up" : "steady",
    },
    {
      id: "metric-failed-24h",
      label: "Failed (24h)",
      value: String(failedExecutions24h),
      detail: "control_plane_executions",
      trend: failedExecutions24h > 0 ? "down" : "up",
    },
    {
      id: "metric-audit-24h",
      label: "Audit Events (24h)",
      value: String(auditEvents24h),
      detail: "control_plane_audit",
      trend: "steady",
    },
    {
      id: "metric-render-health",
      label: "Render Services",
      value: renderTotal > 0 ? `${healthyRenderServices}/${renderTotal}` : "0/0",
      detail: RENDER_API_KEY ? "healthy/total" : "RENDER_API_KEY assente",
      trend:
        renderTotal > 0 && healthyRenderServices === renderTotal
          ? "up"
          : renderTotal === 0
            ? "steady"
            : "down",
    },
  ];

  return sendJson(res, 200, {
    ok: true,
    metrics,
    generatedAt: new Date().toISOString(),
    source: "control-plane",
  });
}

function toDbOpRow(row) {
  const startedAt = asString(row.started_at);
  const finishedAt = asString(row.finished_at);

  let durationMs;
  if (startedAt && finishedAt) {
    const startMs = Date.parse(startedAt);
    const endMs = Date.parse(finishedAt);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
      durationMs = endMs - startMs;
    }
  }

  const resultPayload = isPlainObject(row.result_payload) ? row.result_payload : {};
  return {
    id: row.id,
    operation: row.operation,
    status: row.status,
    target: row.target || "default",
    durationMs,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    nextRunAt: asString(resultPayload.nextRunAt),
  };
}

async function dbOpsHandler(req, res) {
  assertDbClientAvailable();

  const limit = parseInteger(req.query?.limit, 25, 1, 200);
  const { data, error } = await supabaseDbClient
    .from(EXECUTION_TABLE)
    .select("id,operation,status,target,started_at,finished_at,result_payload,created_at")
    .or("operation.ilike.supabase.%,operation.ilike.db.%")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return sendJson(res, 500, {
      ok: false,
      error: `Errore DB ops read: ${error.message}`,
      requestId: res.locals.requestId || null,
    });
  }

  const operations = (data || []).map((row) => toDbOpRow(row));

  return sendJson(res, 200, {
    ok: true,
    operations,
    items: operations,
    updatedAt: new Date().toISOString(),
  });
}
