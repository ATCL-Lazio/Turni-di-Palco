import "../../../../shared/styles/main.css";
import "./dev-plus.css";

import type { Session } from "@supabase/supabase-js";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { promptServiceWorkerUpdate } from "../pwa/sw-update";
import { registerServiceWorker } from "../pwa/register-sw";
import { isSupabaseConfigured, supabase } from "../services/supabase";
import {
  buildControlPlaneUrl,
  getRoleAdaptiveQuickActions,
  parseControlPlanePreset,
  type ControlPlaneView,
  type OpsQuickAction,
} from "../services/ops-sdk";
import { enforceDesktopOnly } from "../utils/desktop-only";
import {
  executeControlCommand,
  fetchCommandCatalog,
  fetchDashboardSnapshot,
  getControlPlaneEndpoint,
  prepareControlCommand,
  validateControlPlaneSession,
} from "./control-plane";
import type {
  AuditEntry,
  CommandCatalogEntry,
  CommandDraft,
  DashboardSnapshot,
  DbOperationStatus,
  MobileFeatureFlagEntry,
  MetricCard,
  PreparedCommand,
  RenderServiceStatus,
  SessionValidation,
} from "./types";

type AuthState = "checking" | "anonymous" | "authenticated";
type ViewId = ControlPlaneView;
type FeedbackTone = "info" | "ok" | "warn" | "error";

type FeedbackMessage = {
  tone: FeedbackTone;
  text: string;
};

const DEFAULT_COMMAND_OPTIONS: CommandCatalogEntry[] = [
  {
    id: "render.services.health",
    label: "Render services health",
    description: "Read health and deploy state for allowlisted Render services.",
    requiredRole: "dev_viewer",
    riskLevel: "low",
    requiresConfirmation: false,
    supportsDryRun: true,
    available: true,
  },
  {
    id: "render.deployments.list",
    label: "Render deployments list",
    description: "List Render deployments for allowlisted services.",
    requiredRole: "dev_viewer",
    riskLevel: "low",
    requiresConfirmation: false,
    supportsDryRun: true,
    available: true,
  },
  {
    id: "render.deployments.trigger",
    label: "Render trigger deployment",
    description: "Trigger deployment with two-step confirmation.",
    requiredRole: "dev_operator",
    riskLevel: "high",
    requiresConfirmation: true,
    supportsDryRun: true,
    available: true,
  },
  {
    id: "supabase.db.read",
    label: "Supabase readonly query",
    description: "Read rows from Supabase with safe filters.",
    requiredRole: "dev_viewer",
    riskLevel: "low",
    requiresConfirmation: false,
    supportsDryRun: true,
    available: true,
  },
  {
    id: "supabase.events.cleanup",
    label: "Supabase cleanup old events",
    description: "Delete stale events older than threshold days.",
    requiredRole: "dev_operator",
    riskLevel: "medium",
    requiresConfirmation: true,
    supportsDryRun: true,
    available: true,
  },
  {
    id: "supabase.db.mutate",
    label: "Supabase mutate",
    description: "Insert/update/upsert/delete data with strict guardrails.",
    requiredRole: "dev_admin",
    riskLevel: "high",
    requiresConfirmation: true,
    supportsDryRun: true,
    available: true,
  },
];

const VIEW_OPTIONS: { id: ViewId; label: string; note: string }[] = [
  { id: "commands", label: "Comandi", note: "reason, dry-run, conferma 2-step" },
  { id: "audit", label: "Audit", note: "eventi recenti e motivazioni" },
  { id: "render", label: "Deploy", note: "stato servizi e deploy" },
  { id: "db", label: "Database", note: "operazioni database recenti" },
  { id: "mobile-flags", label: "Flags mobile", note: "toggle runtime feature flag mobile" },
];

const DEFAULT_CONFIRM_TEXT = "CONFIRM";
const DEFAULT_PAYLOAD = '{\n  "scope": "default"\n}';

const MOBILE_FLAG_DEFAULTS: MobileFeatureFlagEntry[] = [
  { key: "mobile.section.turns", enabled: true, label: "Sezione Turni", description: "Mostra sezione turni e tab.", category: "section" },
  { key: "mobile.section.leaderboard", enabled: true, label: "Sezione Classifica", description: "Mostra sezione classifica e tab.", category: "section" },
  { key: "mobile.section.activities", enabled: true, label: "Sezione Attivita", description: "Mostra sezione attivita e tab.", category: "section" },
  { key: "mobile.section.shop", enabled: true, label: "Sezione Shop", description: "Mostra sezione shop e tab.", category: "section" },
  { key: "mobile.section.career", enabled: true, label: "Sezione Carriera", description: "Abilita schermata carriera.", category: "section" },
  { key: "mobile.section.earned_titles", enabled: true, label: "Sezione Titoli", description: "Abilita schermata titoli sbloccati.", category: "section" },
  { key: "mobile.action.qr_scan", enabled: true, label: "Azione Scansione QR", description: "Abilita scanner QR mobile.", category: "action" },
  { key: "mobile.action.turn_submit", enabled: true, label: "Azione Conferma Turno", description: "Abilita registrazione turni.", category: "action" },
  { key: "mobile.action.turn_boost", enabled: true, label: "Azione Boost Turno", description: "Abilita boost token su turno.", category: "action" },
  { key: "mobile.action.activity_start", enabled: true, label: "Azione Avvio Attivita", description: "Abilita avvio attivita.", category: "action" },
  { key: "mobile.action.activity_complete", enabled: true, label: "Azione Completamento Attivita", description: "Abilita completamento attivita.", category: "action" },
  { key: "mobile.action.shop_purchase", enabled: true, label: "Azione Acquisto Shop", description: "Abilita acquisti shop.", category: "action" },
];

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function parsePayloadInput(payloadText: string) {
  const trimmed = payloadText.trim();
  if (!trimmed) return { payload: undefined as Record<string, unknown> | undefined };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "Il payload JSON deve essere un oggetto." };
    }
    return { payload: parsed as Record<string, unknown> };
  } catch {
    return { error: "Payload JSON non valido." };
  }
}

function metricTrendLabel(trend?: MetricCard["trend"]) {
  if (trend === "up") return "trend-up";
  if (trend === "down") return "trend-down";
  return "trend-steady";
}

function normalizeRiskLabel(risk?: PreparedCommand["riskLevel"]) {
  if (!risk) return "risk-medium";
  return risk === "low" ? "risk-low" : risk === "high" ? "risk-high" : "risk-medium";
}

function toDisplayValue(value: number | undefined, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value}${suffix}`;
}

function fallbackMetrics(validation: SessionValidation | null): MetricCard[] {
  return [
    {
      id: "validation",
      label: "Session Validation",
      value: validation?.valid ? "verified" : "pending",
      detail: validation?.reason || "control-plane handshake",
      trend: validation?.valid ? "up" : "steady",
    },
  ];
}

function toFeedbackClass(tone: FeedbackTone) {
  if (tone === "ok") return "feedback feedback-ok";
  if (tone === "warn") return "feedback feedback-warn";
  if (tone === "error") return "feedback feedback-error";
  return "feedback feedback-info";
}

function App() {
  const initialPreset = useMemo(
    () => parseControlPlanePreset(typeof window === "undefined" ? "" : window.location.search),
    []
  );

  const [authState, setAuthState] = useState<AuthState>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [validation, setValidation] = useState<SessionValidation | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [snapshotError, setSnapshotError] = useState("");

  const [catalog, setCatalog] = useState<CommandCatalogEntry[]>([]);
  const [activeView, setActiveView] = useState<ViewId>(initialPreset.view ?? "commands");

  const [commandValue, setCommandValue] = useState(initialPreset.commandId ?? DEFAULT_COMMAND_OPTIONS[0].id);
  const [targetValue, setTargetValue] = useState(initialPreset.target ?? "");
  const [reasonValue, setReasonValue] = useState(initialPreset.reason ?? "");
  const [payloadValue, setPayloadValue] = useState(
    initialPreset.payload ? JSON.stringify(initialPreset.payload, null, 2) : DEFAULT_PAYLOAD
  );
  const [dryRunValue, setDryRunValue] = useState(initialPreset.dryRun ?? true);
  const [preparedCommand, setPreparedCommand] = useState<PreparedCommand | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandFeedback, setCommandFeedback] = useState<FeedbackMessage>({
    tone: "info",
    text: "Pronto. Prepara un comando e conferma in due step.",
  });
  const [mobileFlags, setMobileFlags] = useState<MobileFeatureFlagEntry[]>([]);
  const [mobileFlagsBusy, setMobileFlagsBusy] = useState(false);
  const [mobileFlagsFeedback, setMobileFlagsFeedback] = useState<FeedbackMessage>({
    tone: "info",
    text: "Apri la vista Mobile Flags per leggere e modificare le feature runtime.",
  });

  const controlPlaneEndpoint = getControlPlaneEndpoint();

  const commandOptions = useMemo(() => {
    const liveOptions = catalog.filter((entry) => entry.available);
    return liveOptions.length ? liveOptions : DEFAULT_COMMAND_OPTIONS;
  }, [catalog]);

  useEffect(() => {
    if (!commandOptions.some((entry) => entry.id === commandValue)) {
      setCommandValue(commandOptions[0]?.id ?? DEFAULT_COMMAND_OPTIONS[0].id);
    }
  }, [commandOptions, commandValue]);

  const metrics = useMemo(() => {
    if (snapshot?.metrics?.length) return snapshot.metrics;
    return fallbackMetrics(validation);
  }, [snapshot?.metrics, validation]);

  const roleActions = useMemo(() => getRoleAdaptiveQuickActions(validation?.roles), [validation?.roles]);

  const loadSnapshot = useCallback(
    async (activeSession: Session, validationState: SessionValidation | null) => {
      setSnapshotBusy(true);
      setSnapshotError("");
      const response = await fetchDashboardSnapshot(activeSession.access_token, validationState ?? undefined);
      setSnapshot(response);
      if (response.source.startsWith("fallback:")) {
        setSnapshotError(response.source);
      }
      setSnapshotBusy(false);
    },
    []
  );

  const loadCatalog = useCallback(async (activeSession: Session) => {
    const response = await fetchCommandCatalog(activeSession.access_token);
    if (!response.commands.length && response.error) {
      setCommandFeedback({ tone: "warn", text: response.error });
      return;
    }
    setCatalog(response.commands);
  }, []);

  const loadMobileFlags = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setMobileFlags([]);
      setMobileFlagsFeedback({ tone: "warn", text: "Supabase non configurato: impossibile leggere le mobile feature flags." });
      return;
    }
    if (authState !== "authenticated") return;

    setMobileFlagsBusy(true);
    const { data, error } = await supabase
      .from("mobile_feature_flags")
      .select("key,enabled,label,description,category,updated_at,updated_by")
      .order("category", { ascending: true })
      .order("key", { ascending: true });
    setMobileFlagsBusy(false);

    if (error) {
      setMobileFlagsFeedback({ tone: "error", text: error.message || "Lettura feature flags fallita." });
      return;
    }

    const next = (data ?? []).map((row) => ({
      key: String(row.key ?? ""),
      enabled: Boolean(row.enabled),
      label: String(row.label ?? row.key ?? ""),
      description: String(row.description ?? ""),
      category: String(row.category ?? ""),
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
      updatedBy: typeof row.updated_by === "string" ? row.updated_by : null,
    }));

    setMobileFlags(next);
    setMobileFlagsFeedback({
      tone: "ok",
      text: next.length
        ? `${next.length} feature flags mobile caricate.`
        : "Nessuna feature flag trovata: usa il reset per inizializzare.",
    });
  }, [authState]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthState("anonymous");
      setAuthError("Supabase non configurato: imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const bootstrap = async () => {
      setAuthState("checking");
      setAuthError("");

      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error) {
        setAuthState("anonymous");
        setAuthError(error.message);
        return;
      }

      if (!data.session) {
        setAuthState("anonymous");
        return;
      }

      const validationResult = await validateControlPlaneSession(data.session.access_token, controller.signal);
      if (cancelled) return;

      if (!validationResult.valid) {
        await supabase.auth.signOut();
        setAuthState("anonymous");
        setValidation(validationResult);
        setAuthError(validationResult.reason || "Sessione non autorizzata dal control-plane.");
        return;
      }

      setSession(data.session);
      setValidation(validationResult);
      setAuthState("authenticated");
      await Promise.all([loadSnapshot(data.session, validationResult), loadCatalog(data.session)]);
    };

    void bootstrap();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loadCatalog, loadSnapshot]);

  const handleSignIn = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!supabase || !isSupabaseConfigured) {
        setAuthError("Supabase non configurato.");
        return;
      }

      setAuthBusy(true);
      setAuthError("");

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setAuthBusy(false);
        setAuthError(error.message);
        return;
      }

      const activeSession = data.session ?? (await supabase.auth.getSession()).data.session;
      if (!activeSession) {
        setAuthBusy(false);
        setAuthError("Sessione non disponibile dopo il login.");
        return;
      }

      const validationResult = await validateControlPlaneSession(activeSession.access_token);
      if (!validationResult.valid) {
        await supabase.auth.signOut();
        setAuthBusy(false);
        setAuthState("anonymous");
        setValidation(validationResult);
        setAuthError(validationResult.reason || "Sessione rifiutata dal control-plane.");
        return;
      }

      setSession(activeSession);
      setValidation(validationResult);
      setAuthState("authenticated");
      setAuthBusy(false);
      await Promise.all([loadSnapshot(activeSession, validationResult), loadCatalog(activeSession)]);
    },
    [email, loadCatalog, loadSnapshot, password]
  );

  const handleSignOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setValidation(null);
    setSnapshot(null);
    setCatalog([]);
    setMobileFlags([]);
    setAuthState("anonymous");
    setPassword("");
    setCommandFeedback({ tone: "info", text: "Sessione chiusa." });
    setMobileFlagsFeedback({ tone: "info", text: "Sessione chiusa." });
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!session) return;

    const validationResult = await validateControlPlaneSession(session.access_token);
    setValidation(validationResult);

    if (!validationResult.valid) {
      if (supabase) {
        await supabase.auth.signOut();
      }
      setAuthState("anonymous");
      setSession(null);
      setSnapshot(null);
      setCatalog([]);
      setAuthError(validationResult.reason || "Sessione non valida.");
      return;
    }

    await Promise.all([loadSnapshot(session, validationResult), loadCatalog(session)]);
    if (activeView === "mobile-flags") {
      await loadMobileFlags();
    }
  }, [activeView, loadCatalog, loadMobileFlags, loadSnapshot, session]);

  const handleToggleMobileFlag = useCallback(
    async (flag: MobileFeatureFlagEntry, enabled: boolean) => {
      if (!supabase || authState !== "authenticated") {
        setMobileFlagsFeedback({ tone: "error", text: "Sessione non valida per modificare le feature flags." });
        return;
      }
      setMobileFlagsBusy(true);
      const { error } = await supabase
        .from("mobile_feature_flags")
        .update({ enabled })
        .eq("key", flag.key);
      setMobileFlagsBusy(false);

      if (error) {
        setMobileFlagsFeedback({ tone: "error", text: error.message || "Aggiornamento flag fallito." });
        return;
      }

      setMobileFlagsFeedback({ tone: "ok", text: `Flag aggiornata: ${flag.key} -> ${enabled ? "ON" : "OFF"}` });
      await loadMobileFlags();
    },
    [authState, loadMobileFlags]
  );

  const handleBulkSetMobileFlags = useCallback(
    async (enabled: boolean) => {
      if (!supabase || authState !== "authenticated") {
        setMobileFlagsFeedback({ tone: "error", text: "Sessione non valida per modificare le feature flags." });
        return;
      }
      if (!mobileFlags.length) {
        setMobileFlagsFeedback({ tone: "warn", text: "Nessuna flag disponibile per bulk update." });
        return;
      }

      setMobileFlagsBusy(true);
      const keys = mobileFlags.map((entry) => entry.key);
      const { error } = await supabase
        .from("mobile_feature_flags")
        .update({ enabled })
        .in("key", keys);
      setMobileFlagsBusy(false);

      if (error) {
        setMobileFlagsFeedback({ tone: "error", text: error.message || "Bulk update feature flags fallito." });
        return;
      }

      setMobileFlagsFeedback({ tone: "ok", text: `Aggiornamento bulk completato: ${enabled ? "tutte ON" : "tutte OFF"}.` });
      await loadMobileFlags();
    },
    [authState, loadMobileFlags, mobileFlags]
  );

  const handleResetMobileFlags = useCallback(async () => {
    if (!supabase || authState !== "authenticated") {
      setMobileFlagsFeedback({ tone: "error", text: "Sessione non valida per il reset feature flags." });
      return;
    }

    setMobileFlagsBusy(true);
    const { error } = await supabase
      .from("mobile_feature_flags")
      .upsert(
        MOBILE_FLAG_DEFAULTS.map((entry) => ({
          key: entry.key,
          enabled: true,
          label: entry.label,
          description: entry.description,
          category: entry.category,
        })),
        { onConflict: "key" }
      );
    setMobileFlagsBusy(false);

    if (error) {
      setMobileFlagsFeedback({ tone: "error", text: error.message || "Reset feature flags fallito." });
      return;
    }

    setMobileFlagsFeedback({ tone: "ok", text: "Reset feature flags completato (seed ON)." });
    await loadMobileFlags();
  }, [authState, loadMobileFlags]);

  useEffect(() => {
    setPreparedCommand(null);
    setConfirmText("");
  }, [commandValue, dryRunValue, payloadValue, reasonValue, targetValue]);

  useEffect(() => {
    if (activeView !== "mobile-flags") return;
    if (authState !== "authenticated") return;
    void loadMobileFlags();
  }, [activeView, authState, loadMobileFlags]);

  const buildDraft = useCallback((): { draft?: CommandDraft; error?: string } => {
    if (reasonValue.trim().length < 8) {
      return { error: "La reason deve contenere almeno 8 caratteri." };
    }

    const payloadResult = parsePayloadInput(payloadValue);
    if (payloadResult.error) {
      return { error: payloadResult.error };
    }

    return {
      draft: {
        commandId: commandValue,
        target: targetValue.trim(),
        reason: reasonValue.trim(),
        dryRun: dryRunValue,
        payload: payloadResult.payload,
      },
    };
  }, [commandValue, dryRunValue, payloadValue, reasonValue, targetValue]);

  const handlePrepareCommand = useCallback(async () => {
    if (!session) {
      setCommandFeedback({ tone: "error", text: "Sessione non valida. Effettua login." });
      return;
    }

    const { draft, error } = buildDraft();
    if (!draft || error) {
      setCommandFeedback({ tone: "error", text: error || "Draft non valido." });
      return;
    }

    setCommandBusy(true);
    setCommandFeedback({ tone: "info", text: "Step 1/2: preparo il comando..." });
    const response = await prepareControlCommand(draft, session.access_token);
    setCommandBusy(false);

    if (!response.prepared) {
      setCommandFeedback({ tone: "error", text: response.error || "Preparazione comando fallita." });
      return;
    }

    setPreparedCommand(response.prepared);
    setCommandFeedback({ tone: "ok", text: "Step 1/2 completato. Verifica preview e conferma step 2." });
  }, [buildDraft, session]);

  const handleExecuteCommand = useCallback(async () => {
    if (!session || !preparedCommand) {
      setCommandFeedback({ tone: "error", text: "Nessun comando preparato." });
      return;
    }

    const requiredText = preparedCommand.requiresConfirmText || DEFAULT_CONFIRM_TEXT;
    if (confirmText.trim() !== requiredText) {
      setCommandFeedback({
        tone: "warn",
        text: `Conferma non valida. Inserisci esattamente: ${requiredText}`,
      });
      return;
    }

    if (preparedCommand.requiresConfirmation && !preparedCommand.confirmationToken) {
      setCommandFeedback({
        tone: "error",
        text: "Token di conferma assente. Ripeti lo step di preparazione.",
      });
      return;
    }

    const { draft, error } = buildDraft();
    if (!draft || error) {
      setCommandFeedback({ tone: "error", text: error || "Draft comando non valido." });
      return;
    }

    setCommandBusy(true);
    setCommandFeedback({ tone: "info", text: "Step 2/2: esecuzione comando in corso..." });
    const response = await executeControlCommand(draft, preparedCommand, confirmText.trim(), session.access_token);
    setCommandBusy(false);

    if (!response.result) {
      setCommandFeedback({ tone: "error", text: response.error || "Esecuzione comando fallita." });
      return;
    }

    const tone: FeedbackTone =
      response.result.status === "failed" ? "error" : response.result.status === "accepted" ? "warn" : "ok";
    setCommandFeedback({ tone, text: response.result.message });
    setPreparedCommand(null);
    setConfirmText("");
    await handleRefresh();
  }, [buildDraft, confirmText, handleRefresh, preparedCommand, session]);

  const applyQuickAction = useCallback((action: OpsQuickAction) => {
    if (action.preset.view) setActiveView(action.preset.view);
    if (action.preset.commandId) setCommandValue(action.preset.commandId);
    if (action.preset.target) setTargetValue(action.preset.target);
    if (action.preset.reason) setReasonValue(action.preset.reason);
    if (typeof action.preset.dryRun === "boolean") setDryRunValue(action.preset.dryRun);
    if (action.preset.payload) {
      setPayloadValue(JSON.stringify(action.preset.payload, null, 2));
    }
    setCommandFeedback({
      tone: "info",
      text: `Preset applicato: ${action.label}. Esegui Step 1/2 per preparare il comando.`,
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextUrl = buildControlPlaneUrl(
      {
        view: activeView,
        commandId: activeView === "commands" ? commandValue : undefined,
        target: activeView === "commands" ? targetValue || undefined : undefined,
        dryRun: activeView === "commands" ? dryRunValue : undefined,
        source: "session",
      },
      window.location.pathname || "/control-plane.html"
    );
    window.history.replaceState(null, "", nextUrl);
  }, [activeView, commandValue, dryRunValue, targetValue]);

  const auditRows: AuditEntry[] = snapshot?.audit ?? [];
  const renderRows: RenderServiceStatus[] = snapshot?.renderServices ?? [];
  const dbRows: DbOperationStatus[] = snapshot?.dbOperations ?? [];
  const currentUser = session?.user?.email || "anonymous";

  return (
    <main className="devplus-shell">
      <div className="devplus-grid-bg" aria-hidden="true" />

      <header className="devplus-header">
        <div className="devplus-brand-wrap">
          <p className="devplus-kicker">Turni di Palco</p>
          <h1>Control Plane</h1>
          <p className="devplus-subtitle">
            Console operativa unica: comandi, deploy, DB, audit e feature flags con flusso a due step.
          </p>
        </div>
        <div className="devplus-header-actions">
          <div className="devplus-links">
            <a href="/">Dashboard</a>
            <a href="/mobile/">Mobile</a>
            <a href={buildControlPlaneUrl({ view: "commands", source: "header" })}>Comandi</a>
          </div>
          <div className="devplus-endpoint">
            <span>Control-plane</span>
            <code>{controlPlaneEndpoint}</code>
          </div>
        </div>
      </header>

      <section className="devplus-auth-card">
        <div>
          <h2>Accesso e session validation</h2>
          <p className="devplus-muted">
            Login via Supabase e verifica server-side su endpoint <code>/api/auth/session/validate</code>.
          </p>
        </div>

        {!isSupabaseConfigured ? (
          <p className="feedback feedback-error">
            Supabase non configurato. Imposta <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.
          </p>
        ) : null}

        {authState === "checking" ? <p className="feedback feedback-info">Verifica sessione esistente...</p> : null}

        {authState !== "authenticated" && isSupabaseConfigured ? (
          <form className="devplus-login-form" onSubmit={handleSignIn}>
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <button type="submit" disabled={authBusy}>
              {authBusy ? "Accesso in corso..." : "Accedi e valida sessione"}
            </button>
          </form>
        ) : null}

        {authState === "authenticated" ? (
          <div className="devplus-session-ok">
            <div>
              <p className="devplus-session-user">Sessione attiva: {currentUser}</p>
              <p className="devplus-muted">
                Validata: {formatDateTime(validation?.validatedAt)}
                {validation?.expiresAt ? ` | Scadenza: ${formatDateTime(validation.expiresAt)}` : ""}
              </p>
            </div>
            <div className="devplus-inline-actions">
              <button type="button" onClick={handleRefresh} disabled={snapshotBusy}>
                {snapshotBusy ? "Sync..." : "Aggiorna viste"}
              </button>
              <button type="button" className="ghost" onClick={handleSignOut}>
                Logout
              </button>
            </div>
          </div>
        ) : null}

        {validation?.roles?.length ? <p className="devplus-muted">Ruoli validati: {validation.roles.join(", ")}</p> : null}
        {authError ? <p className="feedback feedback-error">{authError}</p> : null}
      </section>

      <section className="devplus-metrics-grid">
        {metrics.map((metric) => (
          <article key={metric.id} className="devplus-metric-card">
            <div className="devplus-metric-head">
              <p>{metric.label}</p>
              <span className={metricTrendLabel(metric.trend)}>{metric.trend || "steady"}</span>
            </div>
            <strong>{metric.value}</strong>
            {metric.detail ? <small>{metric.detail}</small> : null}
          </article>
        ))}
      </section>

      {snapshotError ? <p className="feedback feedback-warn">{snapshotError}</p> : null}

      <section className="devplus-quick-actions-card">
        <div>
          <h2>Preset rapidi per ruolo</h2>
          <p className="devplus-muted">
            Seleziona un preset per compilare il form comandi o aprire direttamente la vista corretta.
          </p>
        </div>
        <div className="devplus-quick-actions-grid">
          {roleActions.map((action) => (
            <button key={action.id} type="button" className="devplus-quick-action" onClick={() => applyQuickAction(action)}>
              <strong>{action.label}</strong>
              <small>{action.note}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="devplus-views-card">
        <div className="devplus-view-tabs" role="tablist" aria-label="Viste operative">
          {VIEW_OPTIONS.map((view) => (
            <button
              key={view.id}
              type="button"
              role="tab"
              aria-selected={activeView === view.id}
              className={activeView === view.id ? "active" : ""}
              onClick={() => setActiveView(view.id)}
            >
              <span>{view.label}</span>
              <small>{view.note}</small>
            </button>
          ))}
        </div>

        <div className="devplus-view-content">
          {activeView === "commands" ? (
            <section className="devplus-panel">
              <h3>Command Console</h3>
              <p className="devplus-muted">
                Ogni comando richiede <code>reason</code>, supporta <code>dry-run</code> e usa token server-side per lo
                step 2.
              </p>

              <div className="devplus-command-grid">
                <label>
                  <span>Command</span>
                  <select value={commandValue} onChange={(event) => setCommandValue(event.target.value)}>
                    {commandOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Target (opzionale)</span>
                  <input
                    type="text"
                    value={targetValue}
                    onChange={(event) => setTargetValue(event.target.value)}
                    placeholder="service-id, table, resource..."
                  />
                </label>

                <label className="full-row">
                  <span>Reason</span>
                  <textarea
                    value={reasonValue}
                    onChange={(event) => setReasonValue(event.target.value)}
                    placeholder="Perche questo comando e necessario"
                    rows={3}
                  />
                </label>

                <label className="full-row">
                  <span>Payload JSON</span>
                  <textarea
                    value={payloadValue}
                    onChange={(event) => setPayloadValue(event.target.value)}
                    rows={7}
                    spellCheck={false}
                  />
                </label>

                <label className="devplus-checkbox">
                  <input
                    type="checkbox"
                    checked={dryRunValue}
                    onChange={(event) => setDryRunValue(event.target.checked)}
                  />
                  <span>Dry-run attivo (nessuna mutazione definitiva)</span>
                </label>
              </div>

              <div className="devplus-inline-actions">
                <button type="button" onClick={handlePrepareCommand} disabled={commandBusy || authState !== "authenticated"}>
                  Step 1/2: Prepara comando
                </button>
              </div>

              {preparedCommand ? (
                <article className="devplus-review-card">
                  <div className="devplus-review-head">
                    <h4>Review pre-esecuzione</h4>
                    <span className={normalizeRiskLabel(preparedCommand.riskLevel)}>
                      risk: {preparedCommand.riskLevel || "medium"}
                    </span>
                  </div>
                  <p className="devplus-muted">{preparedCommand.summary}</p>
                  <p className="devplus-muted">
                    Command ID: <code>{preparedCommand.commandId}</code>
                  </p>
                  {preparedCommand.confirmationTokenExpiresAt ? (
                    <p className="devplus-muted">
                      Token scade: <strong>{formatDateTime(preparedCommand.confirmationTokenExpiresAt)}</strong>
                    </p>
                  ) : null}

                  {preparedCommand.preview?.length ? (
                    <ul className="devplus-preview-list">
                      {preparedCommand.preview.map((item, index) => (
                        <li key={`${preparedCommand.commandId}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : null}

                  <label>
                    <span>
                      Step 2/2 conferma: digita <code>{preparedCommand.requiresConfirmText || DEFAULT_CONFIRM_TEXT}</code>
                    </span>
                    <input type="text" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} />
                  </label>

                  <button type="button" onClick={handleExecuteCommand} disabled={commandBusy || authState !== "authenticated"}>
                    Step 2/2: Conferma ed esegui
                  </button>
                </article>
              ) : null}

              <p className={toFeedbackClass(commandFeedback.tone)}>{commandFeedback.text}</p>
            </section>
          ) : null}

          {activeView === "audit" ? (
            <section className="devplus-panel">
              <h3>Audit View</h3>
              <p className="devplus-muted">Eventi operativi recenti registrati dal control-plane.</p>

              {auditRows.length ? (
                <div className="devplus-table-wrap">
                  <table className="devplus-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Actor</th>
                        <th>Action</th>
                        <th>Result</th>
                        <th>Reason</th>
                        <th>Dry-run</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.map((entry) => (
                        <tr key={entry.id}>
                          <td>{formatDateTime(entry.at)}</td>
                          <td>{entry.actor}</td>
                          <td>{entry.action}</td>
                          <td>
                            <span className={`audit-${entry.result}`}>{entry.result}</span>
                          </td>
                          <td>{entry.reason || "-"}</td>
                          <td>{entry.dryRun ? "yes" : "no"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="feedback feedback-info">Nessun record audit disponibile.</p>
              )}
            </section>
          ) : null}

          {activeView === "render" ? (
            <section className="devplus-panel">
              <h3>Render Services</h3>
              <p className="devplus-muted">Stato servizi Render e ultimo deploy disponibile.</p>

              {renderRows.length ? (
                <div className="devplus-render-grid">
                  {renderRows.map((service) => (
                    <article key={service.id} className="devplus-render-card">
                      <div className="devplus-render-head">
                        <strong>{service.name}</strong>
                        <span className="service-status">{service.status}</span>
                      </div>
                      <p>Env: {service.environment}</p>
                      <p>Region: {service.region || "-"}</p>
                      <p>Latency: {toDisplayValue(service.latencyMs, "ms")}</p>
                      <p>Instances: {toDisplayValue(service.instances)}</p>
                      <p>Updated: {formatDateTime(service.updatedAt)}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="feedback feedback-info">Nessun servizio Render disponibile.</p>
              )}
            </section>
          ) : null}

          {activeView === "db" ? (
            <section className="devplus-panel">
              <h3>DB Ops</h3>
              <p className="devplus-muted">Storico recente delle operazioni database tracciate.</p>

              {dbRows.length ? (
                <div className="devplus-table-wrap">
                  <table className="devplus-table">
                    <thead>
                      <tr>
                        <th>Operation</th>
                        <th>Target</th>
                        <th>Status</th>
                        <th>Duration</th>
                        <th>Started</th>
                        <th>Finished</th>
                        <th>Next Run</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbRows.map((operation) => (
                        <tr key={operation.id}>
                          <td>{operation.operation}</td>
                          <td>{operation.target}</td>
                          <td>{operation.status}</td>
                          <td>{toDisplayValue(operation.durationMs, "ms")}</td>
                          <td>{formatDateTime(operation.startedAt)}</td>
                          <td>{formatDateTime(operation.finishedAt)}</td>
                          <td>{formatDateTime(operation.nextRunAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="feedback feedback-info">Nessuna operazione DB disponibile.</p>
              )}
            </section>
          ) : null}

          {activeView === "mobile-flags" ? (
            <section className="devplus-panel">
              <h3>Mobile Feature Flags</h3>
              <p className="devplus-muted">
                Toggle runtime per funzionalita mobile. Le modifiche vengono applicate in realtime lato app.
              </p>

              <div className="devplus-inline-actions">
                <button type="button" onClick={() => void loadMobileFlags()} disabled={mobileFlagsBusy || authState !== "authenticated"}>
                  {mobileFlagsBusy ? "Sync..." : "Ricarica flags"}
                </button>
                <button type="button" onClick={() => void handleBulkSetMobileFlags(true)} disabled={mobileFlagsBusy || authState !== "authenticated"}>
                  Attiva tutte
                </button>
                <button type="button" className="ghost" onClick={() => void handleBulkSetMobileFlags(false)} disabled={mobileFlagsBusy || authState !== "authenticated"}>
                  Disattiva tutte
                </button>
                <button type="button" className="ghost" onClick={() => void handleResetMobileFlags()} disabled={mobileFlagsBusy || authState !== "authenticated"}>
                  Reset default (ON)
                </button>
              </div>

              <p className={toFeedbackClass(mobileFlagsFeedback.tone)}>{mobileFlagsFeedback.text}</p>

              {mobileFlags.length ? (
                <div className="devplus-table-wrap">
                  <table className="devplus-table">
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th>Chiave</th>
                        <th>Label</th>
                        <th>Stato</th>
                        <th>Aggiornata</th>
                        <th>By</th>
                        <th>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mobileFlags.map((flag) => (
                        <tr key={flag.key}>
                          <td>{flag.category}</td>
                          <td><code>{flag.key}</code></td>
                          <td title={flag.description}>{flag.label}</td>
                          <td>{flag.enabled ? "ON" : "OFF"}</td>
                          <td>{formatDateTime(flag.updatedAt)}</td>
                          <td>{flag.updatedBy || "-"}</td>
                          <td>
                            <div className="devplus-inline-actions">
                              <button
                                type="button"
                                onClick={() => void handleToggleMobileFlag(flag, !flag.enabled)}
                                disabled={mobileFlagsBusy || authState !== "authenticated"}
                              >
                                {flag.enabled ? "Disattiva" : "Attiva"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="feedback feedback-info">Nessuna mobile feature flag disponibile.</p>
              )}
            </section>
          ) : null}
        </div>
      </section>

      <footer className="devplus-footer">
        <p>
          Last refresh: <strong>{snapshot ? formatDateTime(snapshot.refreshedAt) : "-"}</strong>
        </p>
        <p>
          Data source: <code>{snapshot?.source || controlPlaneEndpoint}</code>
        </p>
      </footer>
    </main>
  );
}

const start = () => {
  if (enforceDesktopOnly()) return;

  const rootElement = document.querySelector<HTMLDivElement>("#app");
  if (!rootElement) {
    throw new Error("Root container missing");
  }

  const root = createRoot(rootElement);
  root.render(<App />);

  registerServiceWorker({
    onReady: () => undefined,
    onUpdate: (registration) => {
      promptServiceWorkerUpdate(registration);
    },
    onError: (error) => {
      console.error("Service worker registration failed", error);
    },
  });
};

start();
